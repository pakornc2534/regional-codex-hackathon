import assert from 'node:assert/strict'
import test from 'node:test'
import {seedWorld} from '../server/domain/simulator.mjs'
import {liveManagerSessions} from '../server/live-manager-session.mjs'

const toolSecret = 'test-manager-room-secret-with-more-than-32-characters'
const env = {
  LIVE_MANAGER_ENABLED:'true',
  LIVEKIT_URL:'ws://127.0.0.1:7880',
  LIVEKIT_API_KEY:'test-key',
  LIVEKIT_API_SECRET:'test-only-secret',
  LIVE_MANAGER_TOOL_SECRET:toolSecret,
}

test('LiveKit browser gets a short microphone-only room grant and scoped merchant tools', async () => {
  const shop = {world:seedWorld()}
  const sessions = liveManagerSessions(shop,env)
  const session = await sessions.start()
  const jwt = JSON.parse(Buffer.from(session.token.split('.')[1], 'base64url'))
  assert.equal(jwt.sub,session.identity)
  assert.equal(jwt.video.room,session.room)
  assert.deepEqual(jwt.video.canPublishSources,['microphone'])
  assert.equal(jwt.roomConfig.agents[0].agentName,'ready-manager')
  assert.deepEqual(JSON.parse(jwt.roomConfig.agents[0].metadata),{participantIdentity:session.identity})
  assert.ok(jwt.exp - jwt.nbf <= 60)
  await assert.rejects(sessions.start(),{status:429})

  const query = {kind:'products',query:'ROBOT'}
  assert.throws(() => sessions.read(query,{}),{status:403})
  const auth = {authorization:'Bearer '+toolSecret,'x-live-manager-room':'other-room'}
  assert.throws(() => sessions.read(query,auth),{status:409})
  auth['x-live-manager-room'] = session.room
  assert.equal(sessions.read(query,auth).source,'simulated')
  shop.world = seedWorld()
  assert.throws(() => sessions.read(query,auth),{status:409})
})

test('the public simulator relay cannot mint paid voice sessions', async () => {
  const sessions = liveManagerSessions({world:seedWorld()},{...env,DEMO_RUNTIME:'true'})
  await assert.rejects(sessions.start(),{status:503})
})

test('loopback pass-through gives one short Anam token to the active browser room', async () => {
  const avatarId = 'affe8ba2-6401-4c89-b394-619ad9720540'
  const config = {...env,ANAM_API_KEY:'fixture-only-key',ANAM_AVATAR_ID:avatarId}
  const sessions = liveManagerSessions({world:seedWorld()},config,async (url,options) => {
    assert.equal(url,'https://api.anam.ai/v1/auth/session-token')
    assert.equal(options.headers.authorization,'Bearer fixture-only-key')
    const {personaConfig} = JSON.parse(options.body)
    assert.equal(personaConfig.avatarId,avatarId)
    assert.equal(personaConfig.enableAudioPassthrough,true)
    assert.ok(personaConfig.maxSessionLengthSeconds <= 240)
    return Response.json({sessionToken:'fixture-short-lived-token'})
  })
  await assert.rejects(sessions.avatar({room:'missing',identity:'any'}),{status:409})
  const {room,identity,browserAvatar} = await sessions.start()
  assert.equal(browserAvatar,true)
  await assert.rejects(sessions.avatar({room,identity:'other'}),{status:409})
  assert.deepEqual(await sessions.avatar({room,identity}),{sessionToken:'fixture-short-lived-token'})
  await assert.rejects(sessions.avatar({room,identity}),{status:429})
})
