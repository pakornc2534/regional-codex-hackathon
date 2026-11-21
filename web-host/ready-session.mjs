import { bounded, decode } from './codec.mjs'
import { readyToolSchemas } from './ready-tools.mjs'
import { readyInstructions } from '../shared/ready-instructions.mjs'

const callsUrl = 'https://api.openai.com/v1/realtime/calls'
const anamUrl = 'https://api.anam.ai/v1/auth/session-token'
const leaseKey = 'ready/live-session'
const durationMs = 4 * 60_000
const dailyStarts = 30
const startCooldownMs = 5_000
const recentReaps = new WeakMap()
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const expiredMessage = 'สายหมดอายุแล้ว กรุณาเริ่มสายใหม่'

function stop(status, message) {
  throw Object.assign(new Error(message), { status })
}

async function readLease(env) {
  const object = await env.BUCKET.get(leaseKey)
  return { etag: object?.etag, state: object ? await object.json() : {} }
}

function writeLease(env, etag, state) {
  const onlyIf = etag ? { etagMatches: etag } : { etagDoesNotMatch: '*' }
  return env.BUCKET.put(leaseKey, JSON.stringify(state), { onlyIf })
}

function active(state, session) {
  return typeof session === 'string' && session.length === 36 && session === state.session && state.callId && state.expiresAt > Date.now()
}

export async function authorizeReadySession(env, session) {
  if (typeof session !== 'string' || session.length !== 36) return null
  const { state } = await readLease(env)
  return active(state, session) ? { runId: state.runId, expiresAt: state.expiresAt } : null
}

// All isolates compare the same R2 ETag. Re-read on contention with another operation in this call.
async function updateSession(env, session, update) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { etag, state } = await readLease(env)
    if (state.session !== session) return null
    const next = update(state)
    if (!next) return null
    if (await writeLease(env, etag, next)) return next
  }
  return null
}

export async function consumeReadySearch(env, session) {
  const next = await updateSession(env, session, state => active(state, session) && state.searches < 3 && { ...state, searches: state.searches + 1 })
  return Boolean(next)
}

async function hangup(env, callId) {
  const res = await fetch(`${callsUrl}/${callId}/hangup`, {
    method: 'POST', headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY },
    redirect: 'manual', signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) stop(502, 'กำลังปิดสายเดิม กรุณาลองอีกครั้ง')
}

function closed(state) {
  const { day, starts, lastStart } = state
  return { day, starts, lastStart }
}

export async function reapExpiredReadySession(env) {
  if (!env.OPENAI_API_KEY || (recentReaps.get(env) || 0) > Date.now()) return
  recentReaps.set(env, Date.now() + 30_000)
  const { etag, state } = await readLease(env)
  if (!state.session || state.expiresAt > Date.now()) return
  if (state.callId) await hangup(env, state.callId)
  await writeLease(env, etag, closed(state))
}

async function reserve(env, runId) {
  const { etag, state } = await readLease(env)
  const now = Date.now()
  if (state.expiresAt > now || state.lastStart + startCooldownMs > now) stop(429, 'มีผู้คุยกับพร้อมอยู่ กรุณาลองอีกครั้งในสักครู่')
  const day = new Date(now).toISOString().slice(0, 10)
  const starts = state.day === day ? state.starts : 0
  if (starts >= dailyStarts) stop(429, 'วันนี้เดโมเปิดสายครบจำนวนแล้ว กรุณาลองใหม่ในวันถัดไป')
  // Reclaim an abandoned call before handing the one active slot to another visitor.
  if (state.callId) await hangup(env, state.callId)
  const next = { session: crypto.randomUUID(), runId, expiresAt: now + durationMs, lastStart: now, day, starts: starts + 1, searches: 0 }
  if (!await writeLease(env, etag, next)) stop(429, 'มีผู้อื่นกำลังเปิดสาย กรุณาลองอีกครั้งในสักครู่')
  return next
}

function sessionConfig(env, shop) {
  const names = (shop.products ?? []).slice(0, 40).map(product => String(product.name ?? '').slice(0, 70)).filter(Boolean)
  const transcription = {
    model: 'gpt-4o-mini-transcribe',
    prompt: 'Transcribe the speaker in the original language (Thai, English or Mandarin Chinese). Catalog names: ' + names.join(' / ').slice(0, 900)
  }
  return {
    type: 'realtime', model: env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
    instructions: readyInstructions + '\nกำลังสนทนาบนเดโมออนไลน์ เมื่อข้อมูลร้านเป็นสำเนาที่บันทึกไว้ ให้บอกเวลาบันทึกที่เครื่องมือส่งมาหากเกี่ยวกับคำถาม ใช้ผลค้นเว็บเฉพาะเพื่ออ้างอิงข้อมูลภายนอก',
    output_modalities: ['audio'], max_output_tokens: 1200,
    audio: {
      input: { transcription, turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true } },
      output: { voice: env.OPENAI_REALTIME_VOICE || 'marin' },
    },
    tools: readyToolSchemas, tool_choice: 'auto',
  }
}

function callIdFrom(res) {
  const location = res.headers.get('location')
  if (!location) return null
  const url = new URL(location, callsUrl)
  return url.origin === 'https://api.openai.com' ? url.pathname.match(/^\/v1\/realtime\/calls\/(rtc_[\w-]+)$/)?.[1] : null
}

async function start(env, sdp) {
  if (!env.OPENAI_API_KEY) stop(503, 'เดโมยังไม่ได้เปิดการเชื่อมต่อพร้อม')
  if (typeof sdp !== 'string' || sdp.length > 32_000 || !/^v=0\r?\n/.test(sdp) || !/^m=audio /m.test(sdp) || !/^m=application /m.test(sdp)) stop(400, 'ข้อมูลเชื่อมต่อเสียงไม่ถูกต้อง')
  const snapshot = await env.BUCKET.get('snapshot')
  if (!snapshot) stop(503, 'ยังไม่มีข้อมูลร้านสำหรับพร้อม')
  const shop = await decode(snapshot.body)
  if (shop.shop?.mode !== 'simulated' || !shop.runId || shop.managerPaused) stop(409, 'ผู้จัดการร้านยังไม่พร้อมสำหรับรอบนี้')
  const lease = await reserve(env, shop.runId)
  const form = new FormData()
  form.set('sdp', sdp)
  form.set('session', JSON.stringify(sessionConfig(env, shop)))
  let callId
  try {
    const res = await fetch(callsUrl, {
      method: 'POST', headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, accept: 'application/sdp' },
      body: form, redirect: 'manual', signal: AbortSignal.timeout(22_000),
    })
    if (!res.ok) stop(res.status === 429 ? 429 : 502, res.status === 429 ? 'บริการเสียงถึงขีดจำกัดชั่วคราว กรุณาลองใหม่ภายหลัง' : 'บริการเสียงยังเปิดสายไม่ได้ กรุณาลองใหม่')
    callId = callIdFrom(res)
    const answer = await res.text()
    if (!callId || !/^v=0\r?\n/.test(answer)) stop(502, 'บริการเสียงส่งข้อมูลเชื่อมต่อกลับมาไม่ครบ')
    if (!await updateSession(env, lease.session, state => ({ ...state, callId }))) stop(409, expiredMessage)
    return { sdp: answer, session: lease.session, expiresAt: lease.expiresAt, avatar: Boolean(env.ANAM_API_KEY && env.ANAM_AVATAR_ID) }
  } catch (error) {
    if (callId) await hangup(env, callId)
    await updateSession(env, lease.session, closed)
    throw error
  }
}

async function avatar(env, session) {
  if (!env.ANAM_API_KEY || !env.ANAM_AVATAR_ID) stop(503, 'เดโมยังไม่ได้เปิดวิดีโอของพร้อม')
  const lease = await updateSession(env, session, state => {
    if (!active(state, session)) stop(409, expiredMessage)
    if (state.avatarRequested) stop(429, 'สายนี้เริ่มเชื่อมวิดีโอไปแล้ว')
    return { ...state, avatarRequested: true }
  })
  if (!lease) stop(409, expiredMessage)
  const res = await fetch(anamUrl, {
    method: 'POST', headers: { authorization: 'Bearer ' + env.ANAM_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ personaConfig: {
      name: 'พร้อม', avatarId: env.ANAM_AVATAR_ID, avatarModel: 'cara-4', enableAudioPassthrough: true,
      maxSessionLengthSeconds: Math.max(1, Math.ceil((lease.expiresAt - Date.now()) / 1000)),
    } }), redirect: 'manual', signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) stop(502, 'Anam ยังเปิดวิดีโอให้ไม่ได้')
  const result = await res.json()
  if (typeof result?.sessionToken !== 'string' || !result.sessionToken) stop(502, 'Anam ยังไม่ส่งโทเคนวิดีโอกลับมา')
  if (!await authorizeReadySession(env, session)) stop(409, expiredMessage)
  return { sessionToken: result.sessionToken }
}

async function end(env, session) {
  const { state } = await readLease(env)
  if (session === state.session && state.callId) {
    await hangup(env, state.callId)
    await updateSession(env, session, closed)
  }
  return { ok: true }
}

export async function handleReadySession(req, env, path) {
  if (req.method !== 'POST') return reply({ error: 'ต้องใช้ POST' }, 405)
  if (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'กรุณาเปิดจากหน้าเดโม' }, 403)
  try {
    let body
    try { body = JSON.parse(new TextDecoder().decode(await bounded(req.body, 48_000))) }
    catch { stop(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง') }
    if (path === '/api/ready/session') return reply(await start(env, body?.sdp))
    if (typeof body?.session !== 'string' || body.session.length !== 36) stop(400, 'รหัสสายไม่ถูกต้อง')
    if (path === '/api/ready/avatar') return reply(await avatar(env, body.session))
    if (path === '/api/ready/end') return reply(await end(env, body.session))
    return reply({ error: 'ไม่พบคำขอ' }, 404)
  } catch (error) {
    return reply({ error: error.status ? error.message : 'ยังเชื่อมต่อบริการของพร้อมไม่ได้ กรุณาลองใหม่' }, error.status || 502)
  }
}
