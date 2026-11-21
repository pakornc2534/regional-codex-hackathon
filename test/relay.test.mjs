import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {tmpdir} from 'node:os'
import worker from '../web-host/worker.mjs'
import {encode} from '../web-host/codec.mjs'
import {commandReference,persistedResult} from '../web-host/recovery.mjs'
import {seedWorld,applyCommand,readWorld} from '../server/domain/index.mjs'

const host = 'https://demo.example'
const relayHeaders = {authorization:'Bearer test-credential'}
const appHeaders = {origin:host,'Content-Type':'application/json'}
class Bucket {
  rows = new Map()
  getCount = new Map()
  delaySeenWrite = null
  async get(key) {
    this.getCount.set(key,(this.getCount.get(key) ?? 0) + 1)
    const object = this.rows.get(key)
    if (!object) return null
    const {body,...metadata} = object
    return {...metadata,body:new Blob([body]).stream(),json:async () => JSON.parse(new TextDecoder().decode(body))}
  }
  async head(key) {
    const object = this.rows.get(key)
    return object ? {etag:object.etag,customMetadata:object.customMetadata} : null
  }
  async put(key,value,options) {
    if (key === 'seen' && this.delaySeenWrite) {
      const pause = this.delaySeenWrite
      this.delaySeenWrite = null
      await pause()
    }
    if (options?.onlyIf?.etagDoesNotMatch === '*' && this.rows.has(key)) return null
    const body = typeof value === 'string' ? new TextEncoder().encode(value) : value
    const etag = createHash('sha256').update(body).digest('hex')
    this.rows.set(key,{body,etag,customMetadata:options?.customMetadata})
    return {}
  }
  async delete(key) { this.rows.delete(key) }
  async list({prefix,limit}) {
    return {objects:[...this.rows.keys()].filter(key => key.startsWith(prefix)).sort().slice(0,limit).map(key => ({key}))}
  }
}

function site() {
  const bucket = new Bucket()
  const env = {BUCKET:bucket,PUBLIC_DEMO_ENABLED:'true',RELAY_SECRET:'test-credential'}
  const get = path => worker.fetch(new Request(host + path),env)
  const post = (path,body,headers) => worker.fetch(new Request(host + path,{
    method:'POST',headers,body:typeof body === 'string' ? body : JSON.stringify(body)
  }),env)
  return {bucket,get,post}
}

test('an interrupted command is recovered by reading its exact local receipt', () => {
  const directory = mkdtempSync(join(tmpdir(),'sim-recovery-'))
  try {
    const initial = seedWorld()
    const payload = {type:'pos_sale',runId:initial.runId,expectedVersion:1,idempotencyKey:randomUUID(),
      variantId:'sim-variant-11',quantity:1,actor:'owner'}
    const ref = commandReference(initial.runId,'sim/command',payload)
    assert.equal(persistedResult(directory,ref),null)
    const {world,receipt} = applyCommand(initial,payload)
    const path = join(directory,initial.runId)
    mkdirSync(path)
    writeFileSync(join(path,'simulator.json'),JSON.stringify(world))
    assert.deepEqual(persistedResult(directory,ref),{status:200,body:receipt})
    assert.equal(persistedResult(directory,commandReference(initial.runId,'sim/command',{...payload,quantity:2})),null)
    assert.equal(commandReference(initial.runId,'memories',payload),null)
    // A run reset may point elsewhere but archived receipts still prove the original result.
    writeFileSync(join(directory,'current.json'),JSON.stringify({directory:seedWorld().runId}))
    assert.deepEqual(persistedResult(directory,ref)?.body,receipt)
  } finally {
    rmSync(directory,{recursive:true,force:true})
  }
})

test('large snapshots retain exact bounded transport bytes and real order coverage', async () => {
  const {bucket,get,post} = site()
  const world = readWorld(seedWorld())
  const note = 'ข้อมูลร้านจำลอง'.repeat(30000)
  const data = {...world,owner:{memories:[{text:note}]}}
  const wire = await encode(data)
  assert.equal(JSON.parse(wire).encoding,'gzip-base64')
  const upload = await post('/relay/snapshot',wire,relayHeaders)
  assert.equal(upload.status,200)
  assert.equal(new TextDecoder().decode(bucket.rows.get('snapshot').body),wire)
  await get('/api/stamp')
  assert.equal(bucket.getCount.get('snapshot'),undefined)
  const response = await get('/api/state')
  assert.equal(response.status,200)
  const result = await response.json()
  assert.equal(result.owner.memories[0].text,note)
  assert.equal(result.orders.length,2658)
  assert.equal(result.metrics.sales,974414)
})

test('a previous run polling while reset publishes never changes the visible generation', async () => {
  const {bucket,get,post} = site()
  const first = {shop:{mode:'simulated'},runId:'run-before'}
  const second = {...first,runId:'run-after'}
  await post('/relay/snapshot',first,relayHeaders)
  let resumeWrite
  let started
  const writing = new Promise(resolve => {started = resolve})
  bucket.delaySeenWrite = () => {
    started()
    return new Promise(resolve => {resumeWrite = resolve})
  }
  const oldPoll = post('/relay/poll',{runId:first.runId},relayHeaders)
  await writing
  await post('/relay/snapshot',second,relayHeaders)
  resumeWrite()
  await oldPoll
  assert.match((await (await get('/api/stamp')).json()).version,/^run-after-/u)
  assert.equal((await (await get('/api/state')).json()).runId,second.runId)
  assert.deepEqual(await (await post('/relay/poll',{runId:first.runId},relayHeaders)).json(),{needSnapshot:true})
})

test('concurrent poll claims once and stores the first verified result across upload retries', async () => {
  const {bucket,get,post} = site()
  const runId = 'run-shared'
  await post('/relay/snapshot',{shop:{mode:'simulated'},runId},relayHeaders)
  const browser = post('/api/sim/command',{idempotencyKey:randomUUID()},appHeaders)
  while (!(await bucket.list({prefix:'queue/',limit:1})).objects.length) {
    await new Promise(resolve => setTimeout(resolve,0))
  }
  const pulls = await Promise.all(Array.from({length:4},async () => (await post('/relay/poll',{runId},relayHeaders)).json()))
  const jobs = pulls.flatMap(item => item.job ? [item.job] : [])
  assert.equal(jobs.length,1)
  const [{id}] = jobs
  assert.equal((await get('/api/results/' + id)).status,202)
  const result = {status:200,body:{status:'verified',receipt:'stored'}}
  assert.equal((await post('/relay/result',{id,result},relayHeaders)).status,200)
  assert.equal((await post('/relay/result',{id,result:{status:409,body:{status:'uncertain'}}},relayHeaders)).status,200)
  assert.deepEqual(await (await browser).json(),result.body)
  assert.deepEqual(await (await get('/api/results/' + id)).json(),result.body)
  assert.deepEqual((await bucket.list({prefix:'queue/',limit:1})).objects,[])
})

test('unacknowledged expired claims expose uncertainty without re-entry', async () => {
  const {bucket,get,post} = site()
  await post('/relay/snapshot',{shop:{mode:'simulated'},runId:'run-shared'},relayHeaders)
  const id = randomUUID()
  await bucket.put('claim/' + id,JSON.stringify({at:Date.now() - 50000,expiresAt:Date.now() - 5000}))
  const result = await get('/api/results/' + id)
  assert.equal(result.status,409)
  assert.equal((await result.json()).status,'uncertain')
  assert.deepEqual(await (await post('/relay/poll',{runId:'run-shared'},relayHeaders)).json(),{})
})

test('outbound relay recovers after the response is lost without a second local mutation', {timeout:15_000}, async () => {
  const {createServer} = await import('node:http')
  const {spawn} = await import('node:child_process')
  const directory = mkdtempSync(join(tmpdir(),'sim-demo-relay-'))
  const env = {BUCKET:new Bucket(),PUBLIC_DEMO_ENABLED:'true',RELAY_SECRET:'test-credential'}
  const bridge = createServer(async (incoming,outgoing) => {
    const bodies = []
    for await (const chunk of incoming) bodies.push(chunk)
    const request = new Request(host + incoming.url,{
      method:incoming.method,headers:incoming.headers,
      body:incoming.method === 'POST' ? Buffer.concat(bodies) : undefined
    })
    const response = await worker.fetch(request,env)
    outgoing.writeHead(response.status,Object.fromEntries(response.headers))
    outgoing.end(Buffer.from(await response.arrayBuffer()))
  })
  const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',() => resolve(server.address().port)))
  const close = server => new Promise(resolve => {server.closeAllConnections();server.close(resolve)})
  const port = await listen(bridge)
  const placeholder = createServer()
  const storePort = await listen(placeholder)
  await close(placeholder)
  const preload = join(directory,'intercept.mjs')
  const marker = join(directory,'local-attempts.txt')
  writeFileSync(preload,`
import {appendFileSync} from 'node:fs'
const fetchActual = globalThis.fetch
globalThis.fetch = async (input,options) => {
  const url = new URL(input)
  if (url.origin === ${JSON.stringify(host)}) {
    return fetchActual('http://127.0.0.1:${port}' + url.pathname,options)
  }
  const result = await fetchActual(input,options)
  if (url.pathname === '/api/sim/command') {
    appendFileSync(${JSON.stringify(marker)},'attempt\\n')
    await result.arrayBuffer()
    throw Error('simulated lost mutation response')
  }
  return result
}
`)
  const relay = spawn(process.execPath,['--import',pathToFileURL(preload).href,'web-host/relay.mjs'],{
    env:{...process.env,SITE_URL:host,DEMO_PORT:String(storePort),RELAY_SECRET:'test-credential',RELAY_DIR:directory,CODEX_BIN:'/usr/bin/false'},
    stdio:['ignore','ignore','ignore']
  })
  async function state() {
    const result = await worker.fetch(new Request(host + '/api/state'),env)
    return result.ok ? result.json() : null
  }
  try {
    let initial
    for (let i = 0; i < 80 && !initial; i += 1) {
      initial = await state()
      if (!initial) await new Promise(resolve => setTimeout(resolve,100))
    }
    assert.ok(initial,'relay did not publish initial snapshot')
    const response = await worker.fetch(new Request(host + '/api/sim/command',{
      method:'POST',headers:appHeaders,body:JSON.stringify({
        actor:'owner',type:'pos_sale',quantity:1,variantId:'sim-variant-11',expectedVersion:initial.revision,
        runId:initial.runId,idempotencyKey:randomUUID()
      })
    }),env)
    assert.equal(response.status,200)
    assert.equal((await response.json()).status,'verified')
    assert.equal((await state()).orders.length,initial.orders.length + 1)
    const {readFileSync} = await import('node:fs')
    assert.equal(readFileSync(marker,'utf8'),'attempt\n')
  } finally {
    await new Promise(resolve => {
      if (relay.exitCode !== null || relay.signalCode) return resolve()
      relay.once('exit',resolve)
      relay.kill('SIGTERM')
    })
    await close(bridge)
    rmSync(directory,{recursive:true,force:true})
  }
})

test('customer FAQ and cached product answers bypass the relay with an offline Mac', async () => {
  const {bucket,get,post} = site()
  const ask = message => post('/api/customer/ask',{message},appHeaders)
  const faq = await ask('ค่าส่งเท่าไหร่')
  assert.equal(faq.status,200)
  assert.match((await faq.json()).text,/ไม่มีค่าส่ง/)

  const state = readWorld(seedWorld())
  assert.equal((await post('/relay/snapshot',await encode(state),relayHeaders)).status,200)
  const live = await (await ask('SONIC ยังมีของไหม')).json()
  assert.match(live.text,/฿249 · เหลือขาย 1 ชิ้น/)
  assert.doesNotMatch(live.text,/ข้อมูลล่าสุดที่บันทึกไว้/)

  const {customMetadata} = bucket.rows.get('snapshot')
  const seen = await (await bucket.get('seen')).json()
  await bucket.put('seen',JSON.stringify({...seen,at:Number(customMetadata.dataAt) - 60000}))
  const offline = await (await ask('SONIC ยังมีของไหม')).json()
  assert.equal(offline.source,'catalog')
  assert.match(offline.text,/฿249 · เหลือขาย 1 ชิ้น/)
  assert.match(offline.text,/ข้อมูลล่าสุดที่บันทึกไว้/)
  assert.match((await (await ask('พวงกุญแจโซนิค')).json()).text,/รหัส SKU/)
  assert.equal((await get('/api/dot-summary')).status,200)
  assert.deepEqual((await bucket.list({prefix:'queue/',limit:10})).objects,[])
})
