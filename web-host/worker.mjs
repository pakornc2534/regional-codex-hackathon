import {handleReadySession,reapExpiredReadySession} from './ready-session.mjs'
import {handleReadyTool} from './ready-tools.mjs'
import {decode,encode,bounded} from './codec.mjs'
import {customerCatalog, catalogReply, customerCompleted, customerFaq, customerQuestion, matchCustomerProducts} from '../shared/customer-catalog.mjs'
import {dotSummary} from '../shared/dot-monitor.mjs'
import {createAiRateLimit} from '../shared/ai-rate-limit.mjs'

const endpoints = new Set(['customer/ask','customer/status','chat','sim/command','sim/analyze','sim/growth','sim/impact','memories','reconnect','chat/cancel'])
const json = (value,status = 200) => Response.json(value,{status,headers:{'cache-control':'no-store'}})
const getJSON = async (bucket,key) => (await bucket.get(key))?.json()
const wait = ms => new Promise(resolve => setTimeout(resolve,ms))
const safeJob = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(id)

const edgeLimits = new WeakMap()
async function admitAiRequest(req, env) {
  let admit = edgeLimits.get(env)
  if (!admit) {
    admit = createAiRateLimit(env)
    edgeLimits.set(env, admit)
  }
  // CF-Connecting-IP is set by the edge. Only a rotating digest travels in the queued job.
  const address = req.headers.get('cf-connecting-ip') ?? 'unknown'
  const day = new Date().toISOString().slice(0, 10)
  const bytes = new TextEncoder().encode([env.RELAY_SECRET, day, address].join('\n'))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const clientKey = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
  admit(clientKey)
  return clientKey
}

function generation(snapshot,heartbeat) {
  const meta = snapshot.customMetadata
  const runId = meta ? meta.runId : heartbeat?.runId
  const dataAt = Number(meta ? meta.dataAt : heartbeat?.dataAt)
  return {
    runId,
    dataAt,
    mode:meta ? meta.mode : heartbeat?.mode,
    at:heartbeat?.runId === runId ? heartbeat.at : dataAt,
    etag:snapshot.etag
  }
}

async function relay(req,env,path) {
  if (!env.RELAY_SECRET || req.headers.get('authorization') !== 'Bearer ' + env.RELAY_SECRET) return json({error:'Unauthorized'},401)
  if (req.method !== 'POST') return json({error:'Method'},405)
  const bucket = env.BUCKET
  let raw
  const data = path === 'snapshot' ? await decode(req.body,wire => {raw = wire}) : await decode(req.body)
  if (path === 'snapshot') {
    if (data.shop?.mode !== 'simulated' || typeof data.runId !== 'string' || !data.runId || data.hosted) return json({error:'ต้องเป็นร้านจำลอง'},400)
    const at = Date.now()
    const metadata = {runId:data.runId,mode:data.shop.mode,dataAt:String(at)}
    await bucket.put('snapshot',raw,{customMetadata:metadata})
    await bucket.put('seen',JSON.stringify({...metadata,dataAt:at,at}))
    return json({ok:true})
  }
  if (path === 'poll') {
    const [snapshot,heartbeat] = await Promise.all([bucket.head('snapshot'),getJSON(bucket,'seen')])
    if (!snapshot) return json({needSnapshot:true})
    const latest = generation(snapshot,heartbeat)
    if (latest.runId !== data.runId) return json({needSnapshot:true})
    await bucket.put('seen',JSON.stringify({runId:latest.runId,mode:latest.mode,dataAt:latest.dataAt,at:Date.now()}))
    const objects = await bucket.list({prefix:'queue/',limit:1})
    if (!objects.objects.length) return json({})
    const key = objects.objects[0].key
    const job = await getJSON(bucket,key)
    if (!job) return json({})
    // The claim gates execution. A relay restart can only read back or return uncertainty.
    const claimed = await bucket.put('claim/' + job.id,JSON.stringify({at:Date.now(),expiresAt:job.expiresAt}),{onlyIf:{etagDoesNotMatch:'*'}})
    await bucket.delete(key)
    return json(claimed ? {job} : {})
  }
  if (path === 'result' && safeJob(data.id)) {
    if (!await bucket.head('claim/' + data.id)) return json({error:'Unknown claim'},409)
    if (!data.result || !Number.isInteger(data.result.status) || data.result.status < 200 || data.result.status > 599 ||
      [204,205,304].includes(data.result.status) || !Object.hasOwn(data.result,'body')) return json({error:'Invalid result'},400)
    // Keep the first acknowledged result so retrying transport cannot change the outcome.
    await bucket.put('result/' + data.id,await encode(data.result),{onlyIf:{etagDoesNotMatch:'*'}})
    return json({ok:true})
  }
  return json({error:'Unknown relay operation'},404)
}

async function storedResult(bucket,id) {
  const object = await bucket.get('result/' + id)
  if (!object) return null
  const result = await decode(object.body)
  const reply = json(result.body,result.status)
  if (result.status === 429 && Number.isSafeInteger(result.retryAfter) && result.retryAfter > 0) {
    reply.headers.set('Retry-After',String(result.retryAfter))
  }
  return reply
}

async function fetchWorker(req,env,ctx) {
  const url = new URL(req.url),path = url.pathname
  if (path.startsWith('/relay/')) return relay(req,env,path.slice(7))
  if (!path.startsWith('/api/')) return serveAsset(path)
  const ep = path.slice(5),bucket = env.BUCKET
  const publicDemo = env.PUBLIC_DEMO_ENABLED === 'true'
  if (!publicDemo && (!env.OWNER_SITE_ID || req.headers.get('oai-authenticated-user-id') !== env.OWNER_SITE_ID)) return json({error:'ต้องเข้าสู่ระบบเจ้าของร้าน'},403)
  if (ep === 'dot-summary' && req.method !== 'GET') {
    return Response.json({error:'ต้องใช้ GET'},{status:405,headers:{allow:'GET','cache-control':'no-store'}})
  }
  const customerAsk = req.method === 'POST' && ep === 'customer/ask'
  const validPost = () => req.headers.get('origin') === url.origin && req.headers.get('content-type')?.includes('application/json')
  const readBody = async () => JSON.parse(new TextDecoder().decode(await bounded(req.body,32000)))
  const readyTool = ep === 'ready/tool'
  if (ep.startsWith('ready/')) {
    if (req.method !== 'POST') return json({error:'ต้องใช้ POST'},405)
    if (!validPost()) return json({error:'คำขอต้องมาจากหน้าเดโม'},403)
    if (!readyTool) {
      const result = handleReadySession(req,env,path)
      // Finish releasing the call even when the visitor closes the tab during hangup.
      if (ep === 'ready/end') ctx?.waitUntil?.(result.then(() => {}))
      return result
    }
  }
  if (env.OPENAI_API_KEY && ctx?.waitUntil && ep === 'stamp') {
    ctx.waitUntil(reapExpiredReadySession(env))
  }
  let customerBody
  if (customerAsk) {
    if (!validPost()) return json({error:'คำขอต้องมาจากหน้าเดโม'},403)
    const input = await readBody()
    customerBody = {message:customerQuestion(input ?? {})}
    const answer = customerFaq(customerBody.message)
    if (answer) return json(answer)
  }
  const wantState = req.method === 'GET' && (ep === 'state' || ep === 'dot-summary')
  const [snapshot,heartbeat] = await Promise.all([(wantState || customerAsk || readyTool) ? bucket.get('snapshot') : bucket.head('snapshot'),getJSON(bucket,'seen')])
  if (!snapshot) return json({error:'รอข้อมูลร้านจำลองจากเครื่องเจ้าของ'},503)
  const latest = generation(snapshot,heartbeat)
  if (latest.mode !== 'simulated') return json({error:'รอข้อมูลร้านจำลองจากเครื่องเจ้าของ'},503)
  const ageMs = Date.now() - latest.at, stale = ageMs > 15000
  const version = [latest.runId,latest.etag ?? latest.dataAt,stale].join('-')
  if (customerAsk) {
    const state = await decode(snapshot.body)
    if (state.shop?.mode !== 'simulated' || state.runId !== latest.runId) return json({error:'โหมดหรือรอบร้านไม่ตรงกัน'},403)
    const matches = matchCustomerProducts(customerBody.message, customerCatalog(state))
    if (matches.length) {
      const savedAt = new Date(latest.dataAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'})
      const notice = stale ? '\n\nข้อมูลล่าสุดที่บันทึกไว้ ' + savedAt + ' เวลาไทย ราคาและสต็อกอาจเปลี่ยนไปครับ' : ''
      return json(customerCompleted(catalogReply(matches) + notice))
    }
    if (stale) return json(customerCompleted('ช่วยพิมพ์ชื่อสินค้าหรือรหัส SKU ให้ตรงกับแค็ตตาล็อกครับ ตอนนี้ AI ช่วยค้นหาชื่อใกล้เคียงไม่ได้'))
  }
  if (req.method === 'GET' && ep === 'stamp') return json({version})
  if (wantState || readyTool) {
    const state = await decode(snapshot.body)
    if (state.shop?.mode !== 'simulated' || state.runId !== latest.runId) return json({error:'โหมดหรือรอบร้านไม่ตรงกัน'},403)
    if (ep === 'dot-summary') return json(dotSummary(state,stale))
    state.hosted = {publicDemo,stale,ageMs,lastHeartbeat:latest.at,lastDataUpdate:latest.dataAt}
    if (readyTool) return handleReadyTool(req,env,state)
    state.liveManagerAvailable = publicDemo && Boolean(env.OPENAI_API_KEY)
    if (stale) state.connection = {status:'disconnected',detail:'เครื่องเจ้าของออฟไลน์ กำลังแสดงข้อมูลล่าสุด'}
    return json(state)
  }
  if (req.method === 'GET' && ep === 'events') {
    return new Response('retry: 5000\ndata: ' + version + '\n\n',{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store'}})
  }
  if (req.method === 'GET' && ep.startsWith('results/')) {
    const id = ep.slice(8)
    if (!safeJob(id)) return json({error:'ไม่พบผลคำสั่ง'},404)
    const [result,claim] = await Promise.all([storedResult(bucket,id),getJSON(bucket,'claim/' + id)])
    if (result) return result
    if (!claim) return json({error:'ไม่พบผลคำสั่ง'},404)
    if (Number.isFinite(claim.expiresAt) && Date.now() > claim.expiresAt) {
      return json({error:'คำสั่งอาจดำเนินการแล้ว โปรดตรวจสอบสถานะก่อนลองใหม่',status:'uncertain',jobId:id},409)
    }
    return json({status:'pending',jobId:id},202)
  }
  if (!endpoints.has(ep) || req.method !== 'POST') return json({error:'ไม่พบคำสั่ง'},404)
  if (!validPost()) return json({error:'คำขอต้องมาจากหน้าเดโม'},403)
  if (stale) return json({error:'เครื่องเจ้าของออฟไลน์ ลองใหม่เมื่อเชื่อมต่อแล้ว'},503)
  const body = customerBody ?? await readBody()
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400)
  if (body.runId && body.runId !== latest.runId) return json({error:'ร้านเปลี่ยนรอบแล้ว'},409)
  const needsAi = ep === 'chat' || ep === 'customer/ask' || ep === 'reconnect'
  const clientKey = needsAi ? await admitAiRequest(req, env) : undefined
  const open = await bucket.list({prefix:'queue/',limit:10})
  if (open.objects.length >= 10) return json({error:'คิวเต็ม กรุณารอสักครู่'},429)
  const id = crypto.randomUUID()
  const now = Date.now()
  await bucket.put('queue/' + now + '-' + id,JSON.stringify({id,ep,body,clientKey,runId:latest.runId,expiresAt:now + 45000}))
  const deadline = now + 17500
  let delay = 400
  while (Date.now() < deadline) {
    await wait(delay)
    const result = await storedResult(bucket,id)
    if (result) return result
    delay = Math.min(delay + 150,1200)
  }
  return json({error:'ยังไม่ยืนยันผลคำสั่ง ตรวจสอบสถานะก่อนลองใหม่',jobId:id},504)
}

export default {
  async fetch(req,env,ctx) {
    try { return await fetchWorker(req,env,ctx) }
    catch (error) {
      if (error.status === 429) return Response.json({error:error.message}, {status:429, headers:{'retry-after':String(error.retryAfter),'cache-control':'no-store'}})
      return json({error:'ประมวลผลไม่ได้ · ' + error.message},400)
    }
  }
}
