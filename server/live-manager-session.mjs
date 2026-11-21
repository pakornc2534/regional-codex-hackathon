import {randomUUID,timingSafeEqual} from 'node:crypto'
import {AccessToken,RoomAgentDispatch,RoomConfiguration,RoomServiceClient,TrackSource} from 'livekit-server-sdk'
import {readLiveManagerTool} from './domain/live-manager-tools.mjs'

const durationMs = 4 * 60 * 1000
const agentName = 'ready-manager'

function error(status,message) {
  throw Object.assign(new Error(message),{status})
}

function toolAuthorized(value,secret) {
  if (!value || !secret) return false
  const provided = Buffer.from(value)
  const expected = Buffer.from('Bearer '+secret)
  return provided.length === expected.length && timingSafeEqual(provided,expected)
}

export function liveManagerSessions(shop, env = process.env) {
  let current
  let lastStarted = 0
  const available = env.LIVE_MANAGER_ENABLED === 'true' && env.DEMO_RUNTIME !== 'true' &&
    Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVE_MANAGER_TOOL_SECRET?.length >= 32)
  const rooms = available ? new RoomServiceClient(env.LIVEKIT_URL.replace(/^ws/,'http'),env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET) : null

  return {
    async start() {
      if (!available || shop.world.shop.mode !== 'simulated') error(503,'การคุยสดยังไม่ได้เปิดในระบบนี้')
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
      return {url:env.LIVEKIT_URL,token:await token.toJwt(),room,identity}
    },
    read(body,headers) {
      if (!available || !toolAuthorized(headers.authorization,env.LIVE_MANAGER_TOOL_SECRET)) error(403,'ไม่ได้รับอนุญาตให้อ่านข้อมูลร้าน')
      if (!current || headers['x-live-manager-room'] !== current.room || current.expiresAt <= Date.now()
        || current.runId !== shop.world.runId || shop.world.managerPaused) error(409,'สายหมดอายุหรือรอบร้านเปลี่ยนแล้ว')
      return readLiveManagerTool(shop.world,body)
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
