import {spawn} from 'node:child_process'
import {mkdirSync,readFileSync,existsSync,writeFileSync,renameSync,rmSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {encode} from './codec.mjs'
import {commandReference,persistedResult} from './recovery.mjs'

const base = process.env.SITE_URL
if (!base || new URL(base).protocol !== 'https:') throw Error('Set SITE_URL to the deployed HTTPS origin')
const dir = resolve(process.env.RELAY_DIR || '.data-relay')
const port = Number(process.env.DEMO_PORT || 4321)
const worldDirectory = join(dir,'world')
mkdirSync(dir,{recursive:true,mode:0o700})
const secret = process.env.RELAY_SECRET || readFileSync(join(dir,'secret'),'utf8').trim()
const origin = 'http://127.0.0.1:' + port
const child = spawn(process.execPath,['server/api.mjs'],{
  stdio:['ignore','inherit','inherit'],
  env:{...process.env,DATA_DIR:worldDirectory,PORT:String(port),DEMO_RUNTIME:'true'}
})
let stopped = false
for (const sig of ['SIGINT','SIGTERM']) process.on(sig,() => {stopped = true;child.kill()})
child.on('exit',code => {stopped = true;process.exitCode = code || 0})

const healthFile = process.env.RELAY_HEALTH_FILE
if (healthFile) rmSync(healthFile, {force:true})
const journal = join(dir,'delivery.json')
const endpoints = new Set(['customer/ask','customer/status','chat','sim/command','sim/analyze','sim/growth','sim/impact','memories','reconnect','chat/cancel'])
const uncertain = {status:409,body:{error:'คำสั่งอาจดำเนินการแล้ว โปรดตรวจสอบสถานะก่อนลองใหม่',status:'uncertain'}}
const wait = ms => new Promise(resolve => setTimeout(resolve,ms))

function writeJournal(data) {
  writeFileSync(journal + '.tmp',JSON.stringify(data),{mode:0o600,flush:true})
  renameSync(journal + '.tmp',journal)
}

async function send(path,value) {
  const response = await fetch(new URL('/relay/' + path,base),{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer ' + secret},
    body:await encode(value),
    signal:AbortSignal.timeout(14_000),
    redirect:'error'
  })
  if (!response.ok) throw Error('Site ' + path + ' HTTP ' + response.status)
  return response.json()
}

async function readLocal(path) {
  const response = await fetch(origin + '/api/' + path,{signal:AbortSignal.timeout(4000)})
  if (!response.ok) throw Error('Local ' + path + ' HTTP ' + response.status)
  return response.json()
}

let version = '',runId = '',backoff = 1000
async function publishSnapshot() {
  const stamp = await readLocal('stamp')
  if (stamp.version === version) return
  const state = await readLocal('state')
  if (state.shop?.mode !== 'simulated' || !state.runId) throw Error('Relay accepts simulated shops only')
  await send('snapshot',state)
  runId = state.runId
  version = stamp.version
}

async function executeJob(job,payload) {
  if (!endpoints.has(job.ep) || job.runId !== runId || Date.now() > job.expiresAt) {
    return {status:409,body:{error:'คำสั่งหมดอายุหรือรอบร้านเปลี่ยนแล้ว'}}
  }
  const headers = {'Content-Type':'application/json',Origin:origin}
  if (typeof job.clientKey === 'string' && /^[0-9a-f]{64}$/.test(job.clientKey)) headers['X-Shop-Client-Key'] = job.clientKey
  const response = await fetch(origin + '/api/' + job.ep,{
    method:'POST',
    headers,
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(12_000)
  })
  const result = {status:response.status,body:await response.json()}
  const retryAfter = response.headers.get('retry-after')
  if (response.status === 429 && retryAfter !== null) result.retryAfter = Number(retryAfter)
  return result
}

while (!stopped) {
  try {
    const pending = existsSync(journal) ? JSON.parse(readFileSync(journal)) : null
    await publishSnapshot()
    if (pending) {
      const result = pending.result ?? persistedResult(worldDirectory,pending.reference) ?? uncertain
      if (!pending.result) writeJournal({...pending,result})
      await send('result',{id:pending.id,result})
      writeJournal(null)
    }
    const {job,needSnapshot} = await send('poll',{runId})
    if (needSnapshot) {
      version = ''
      continue
    }
    if (healthFile) writeFileSync(healthFile,'', {mode:0o600})
    if (job) {
      const payload = {...job.body,runId:job.runId}
      const reference = commandReference(job.runId,job.ep,payload)
      writeJournal({id:job.id,reference})
      const result = await executeJob(job,payload)
      writeJournal({id:job.id,reference,result})
      await publishSnapshot()
      await send('result',{id:job.id,result})
      writeJournal(null)
    }
    backoff = 1000
    await wait(job ? 150 : 2200)
  } catch (e) {
    if (!stopped) console.error('Relay:',e.message)
    await wait(backoff)
    backoff = Math.min(backoff * 2,8000)
  }
}
