import {randomUUID,timingSafeEqual} from 'node:crypto'
import {AccessToken,RoomAgentDispatch,RoomConfiguration,RoomServiceClient,TrackSource} from 'livekit-server-sdk'
import {readLiveManagerTool} from './domain/live-manager-tools.mjs'

const durationMs = 4 * 60 * 1000
const agentName = 'ready-manager'
const avatarTokenUrl = 'https://api.anam.ai/v1/auth/session-token'

function browserAvatarConfigured(env) {
  if (!env.ANAM_API_KEY || !env.ANAM_AVATAR_ID || env.ANAM_LIVEKIT_URL) return false
  const endpoint = new URL(env.LIVEKIT_URL)
  return endpoint.protocol === 'ws:' && ['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)
}

function error(status,message) {
  throw Object.assign(new Error(message),{status})
}

function toolAuthorized(value,secret) {
  if (!value || !secret) return false
  const provided = Buffer.from(value)
  const expected = Buffer.from('Bearer '+secret)
  return provided.length === expected.length && timingSafeEqual(provided,expected)
}

export function liveManagerSessions(shop, env = process.env, fetchAvatar = fetch) {
  let current
  let lastStarted = 0
  const configured = env.LIVE_MANAGER_ENABLED === 'true' && env.DEMO_RUNTIME !== 'true' &&
    Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVE_MANAGER_TOOL_SECRET?.length >= 32)
  const available = () => configured && shop.world.shop.mode === 'simulated'
  const browserAvatar = configured && browserAvatarConfigured(env)
  const rooms = configured ? new RoomServiceClient(env.LIVEKIT_URL.replace(/^ws/,'http'),env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET) : null

  return {
    get available() { return available() },
    async start() {
      if (!available()) error(503,'การคุยสดยังไม่ได้เปิดในระบบนี้')
      if (shop.world.managerPaused) error(409,'ผู้จัดการร้านพักงานอยู่')
      const now = Date.now()
      if (current?.expiresAt > now || now - lastStarted < 5000) error(429,'มีสายอยู่แล้ว กรุณาวางสายก่อนเริ่มใหม่')
      lastStarted = now
      const room = 'raan-ready-' + randomUUID()
      const identity = 'merchant-' + randomUUID()
      const token = new AccessToken(env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET,{identity,ttl:60})
      token.addGrant({roomJoin:true,room,canPublish:true,canPublishData:true,canSubscribe:true,canPublishSources:[TrackSource.MICROPHONE]})
      token.roomConfig = new RoomConfiguration({
        agents:[new RoomAgentDispatch({agentName,metadata:JSON.stringify({participantIdentity:identity})})],
        emptyTimeout:30,
        departureTimeout:10,
      })
      current = {room,identity,runId:shop.world.runId,expiresAt:now+durationMs}
      return {url:env.LIVEKIT_URL,token:await token.toJwt(),room,identity,browserAvatar}
    },
    async avatar({room,identity}) {
      if (!browserAvatar) error(503,'ยังไม่ได้เปิดวิดีโอ Anam สำหรับโหมดนี้')
      const call = current
      if (!call || call.room !== room || call.identity !== identity || call.expiresAt <= Date.now()
        || call.runId !== shop.world.runId || shop.world.managerPaused) error(409,'สายหมดอายุหรือรอบร้านเปลี่ยนแล้ว')
      if (call.avatarRequested) error(429,'สายนี้เริ่มเชื่อม Anam ไปแล้ว กรุณาเริ่มสายใหม่')
      call.avatarRequested = true

      const response = await fetchAvatar(avatarTokenUrl,{
        method:'POST',
        headers:{authorization:'Bearer '+env.ANAM_API_KEY,'content-type':'application/json'},
        body:JSON.stringify({personaConfig:{
          name:'พร้อม',avatarId:env.ANAM_AVATAR_ID,avatarModel:'cara-4',
          enableAudioPassthrough:true,maxSessionLengthSeconds:Math.min(240,Math.ceil((call.expiresAt-Date.now())/1000))
        }}),
        signal:AbortSignal.timeout(12000),
        redirect:'error'
      }).catch(() => error(502,'เชื่อมต่อ Anam ไม่สำเร็จ'))
      if (response.status === 401 || response.status === 403) error(502,'Anam ไม่อนุญาตให้ใช้อวตารนี้ กรุณาตรวจสิทธิ์และเครดิตในบัญชี')
      if (!response.ok) error(502,'Anam ยังเปิดวิดีโอให้ไม่ได้')
      const result = await response.json().catch(() => null)
      if (current !== call || call.expiresAt <= Date.now() || call.runId !== shop.world.runId) error(409,'สายหมดอายุหรือรอบร้านเปลี่ยนแล้ว')
      if (typeof result?.sessionToken !== 'string' || !result.sessionToken) error(502,'Anam ยังไม่ส่งโทเคนวิดีโอกลับมา')
      return {sessionToken:result.sessionToken}
    },
    read(body,headers) {
      if (!available() || !toolAuthorized(headers.authorization,env.LIVE_MANAGER_TOOL_SECRET)) error(403,'ไม่ได้รับอนุญาตให้อ่านข้อมูลร้าน')
      if (!current || headers['x-live-manager-room'] !== current.room || current.expiresAt <= Date.now()
        || current.runId !== shop.world.runId || shop.world.managerPaused) error(409,'สายหมดอายุหรือรอบร้านเปลี่ยนแล้ว')
      return readLiveManagerTool(shop.world,body,shop.owner)
    },
    async end({room,identity}) {
      if (current && current.room === room && current.identity === identity) {
        current = undefined
        await rooms.deleteRoom(room).catch(() => {})
      }
      return {ok:true}
    },
  }
}
