import { fileURLToPath } from 'node:url'
import { cli, defineAgent, log, ServerOptions, voice } from '@livekit/agents'
import { AvatarSession } from '@livekit/agents-plugin-anam'
import { realtime } from '@livekit/agents-plugin-openai'
import { z } from 'zod'
import { readyInstructions } from '../shared/ready-instructions.mjs'
import { createShopTools, createViewReader } from './live-manager-functions.mjs'
import { createWebResearchTool } from './live-manager-market.mjs'

const agentName = 'ready-manager'
const maxSessionMs = 4 * 60 * 1000
const dispatchSchema = z.object({ participantIdentity: z.string().min(1).max(120) })

function dispatchedParticipant(job) {
  if (!job.room?.name?.startsWith('raan-ready-')) return undefined
  try { return dispatchSchema.parse(JSON.parse(job.metadata)).participantIdentity }
  catch { return undefined }
}

function createStoreReader(room, signal) {
  const origin = new URL(process.env.LIVE_MANAGER_API_ORIGIN || 'http://127.0.0.1:4310')
  const secret = process.env.LIVE_MANAGER_TOOL_SECRET
  if (!secret || !['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) {
    throw Error('ตั้งค่า API ร้านของพร้อมไม่ครบ')
  }
  return async payload => {
    const response = await fetch(new URL('/api/manager/live/read', origin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + secret,
        'x-live-manager-room': room
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([signal, AbortSignal.timeout(6500)]),
      redirect: 'error'
    })
    if (!response.ok) {
      const result = await response.json().catch(() => null)
      const detail = typeof result?.error === 'string' && response.status < 500 ? result.error.slice(0, 180) : 'ยังอ่านข้อมูลร้านไม่ได้'
      throw Error(detail)
    }
    return response.json()
  }
}

function publicAvatarEndpoint() {
  const address = process.env.ANAM_LIVEKIT_URL || process.env.LIVEKIT_URL
  if (!process.env.ANAM_API_KEY || !process.env.ANAM_AVATAR_ID || !address) return undefined
  // Anam joins from its own server, so the development server on localhost can only serve voice.
  try {
    const endpoint = new URL(address)
    if (endpoint.protocol === 'wss:' && !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) return endpoint.href
  } catch { return undefined }
}

export default defineAgent({
  entry: async ctx => {
    const identity = dispatchedParticipant(ctx.job)
    if (!identity) return ctx.shutdown('Unsupported room')

    const abort = new AbortController()
    const timer = setTimeout(() => ctx.shutdown('Ready call time limit'), maxSessionMs)
    let session
    let phase = 'connect'
    ctx.addShutdownCallback(async () => {
      clearTimeout(timer)
      abort.abort()
      await session?.close()
    })

    try {
      await ctx.connect()
      phase = 'shop access'
      const readStore = createStoreReader(ctx.room.name, abort.signal)
      await readStore({ kind: 'summary' })
      phase = 'participant'
      await ctx.waitForParticipant(identity)
      if (abort.signal.aborted) return

      session = new voice.AgentSession({
        llm: new realtime.RealtimeModel({
          model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
          voice: process.env.OPENAI_REALTIME_VOICE || 'marin',
          modalities: ['audio'],
          inputAudioTranscription: { model: 'gpt-4o-mini-transcribe' }
        })
      })

      const livekitUrl = publicAvatarEndpoint()
      let mode = 'audio'
      if (livekitUrl) {
        const avatar = new AvatarSession({
          personaConfig: { name: 'พร้อม', avatarId: process.env.ANAM_AVATAR_ID },
          connOptions: { maxRetry: 1 }
        })
        try {
          await avatar.start(session, ctx.room, { livekitUrl })
          await avatar.waitForJoin({ timeout: 12000 })
          mode = 'video'
        } catch {
          session.output.audio = null
          void avatar.aclose().catch(() => undefined)
          log().warn('Unable to start Anam avatar, keeping audio')
        }
      }
      if (abort.signal.aborted) return

      const readView = createViewReader(ctx.room, identity)
      phase = 'realtime'
      await session.start({
        room: ctx.room,
        agent: voice.Agent.create({
          instructions: readyInstructions,
          tools: [
            ...createShopTools(readStore, readView),
            createWebResearchTool(ctx, identity, abort.signal, readStore, async () => (await readView()).selectedVariantId)
          ]
        }),
        inputOptions: {
          participantIdentity: identity,
          closeOnDisconnect: true,
          deleteRoomOnClose: true,
          textInputCallback: (activeSession, {text}) => {
            const message = text.trim().slice(0, 1500)
            if (message) activeSession.generateReply({ userInput: message })
          }
        },
        outputOptions: { jsonFormat: false },
        record: false
      })
      await ctx.room.localParticipant?.sendText(JSON.stringify({ mode }), {
        topic: 'raan.avatar-status', destinationIdentities: [identity]
      }).catch(() => undefined)
    } catch (error) {
      log().warn({ phase, type: error?.name }, 'Unable to start Ready manager session')
      ctx.shutdown('Unable to start Ready manager session')
    }
  }
})

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.LIVE_MANAGER_ENABLED !== 'true' || !process.env.OPENAI_API_KEY || !process.env.LIVE_MANAGER_TOOL_SECRET) {
    throw Error('เปิด LIVE_MANAGER_ENABLED และตั้งค่า OpenAI กับ LIVE_MANAGER_TOOL_SECRET ก่อนเริ่มพร้อม')
  }
  cli.runApp(new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName,
    requestFunc: request => dispatchedParticipant(request.job) ? request.accept('พร้อม') : request.reject()
  }))
}
