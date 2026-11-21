import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authorizeReadySession, consumeReadySearch, handleReadySession, reapExpiredReadySession } from '../web-host/ready-session.mjs'

const demo = 'https://demo.example'
const sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n'

function fixture(t) {
  const entries = new Map()
  let version = 0
  const bucket = {
    async get(key) {
      const value = entries.get(key)
      return value ? { etag: value.etag, json: async () => JSON.parse(value.text), body: new Blob([value.text]).stream() } : null
    },
    async put(key, text, { onlyIf } = {}) {
      const old = entries.get(key)
      if (onlyIf?.etagMatches && onlyIf.etagMatches !== old?.etag || onlyIf?.etagDoesNotMatch === '*' && old) return null
      const record = { text, etag: String(++version) }
      entries.set(key, record)
      return record
    },
  }
  const env = { BUCKET: bucket, OPENAI_API_KEY: 'private-openai', ANAM_API_KEY: 'private-anam', ANAM_AVATAR_ID: 'avatar' }
  const issuances = [], hangups = [], avatars = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/hangup')) {
      hangups.push(url)
      return new Response(null, { status: 200 })
    }
    if (url.includes('api.anam.ai')) {
      avatars.push(JSON.parse(options.body))
      return Response.json({ sessionToken: 'only-for-this-user' })
    }
    assert.equal(url, 'https://api.openai.com/v1/realtime/calls')
    assert.equal(options.headers.authorization, 'Bearer ' + env.OPENAI_API_KEY)
    const config = JSON.parse(options.body.get('session'))
    issuances.push(config)
    return new Response(sdp, { status: 201, headers: { location: '/v1/realtime/calls/rtc_open-' + issuances.length } })
  })
  const setShop = (changed = {}) => bucket.put('snapshot', JSON.stringify({ shop: { mode: 'simulated' }, runId: 'run-1', ...changed }))
  const request = (path, body, origin = demo) => handleReadySession(new Request(demo + '/api/ready/' + path, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), env, '/api/ready/' + path)
  return { env, issuances, hangups, avatars, setShop, request }
}

test('a single leased call can use the shop and search budget, mint one bounded Anam token, then hang up', async t => {
  const f = fixture(t)
  await f.setShop()
  const results = await Promise.all([f.request('session', { sdp }), f.request('session', { sdp })])
  assert.deepEqual(results.map(r => r.status).sort(), [200, 429])
  const sessionResponse = await results.find(r => r.ok).json()
  const { session, expiresAt } = sessionResponse
  assert.equal(sessionResponse.avatar, true)
  assert.equal(sessionResponse.sdp, sdp)
  assert.ok(!JSON.stringify(sessionResponse).includes('private'))
  assert.equal(f.issuances.length, 1)
  assert.ok(f.issuances[0].tools.some(tool => tool.name === 'search_public_market'))
  assert.ok(f.issuances[0].tools.some(tool => tool.name === 'read_catalog'))
  assert.equal(f.issuances[0].audio.output.voice, 'marin')
  assert.deepEqual(await authorizeReadySession(f.env, session), { runId: 'run-1', expiresAt })
  const attempts = await Promise.all(Array.from({ length: 6 }, () => consumeReadySearch(f.env, session)))
  assert.equal(attempts.filter(Boolean).length, 3)
  assert.equal(await consumeReadySearch(f.env, session), false)
  assert.equal((await f.request('avatar', { session: crypto.randomUUID() })).status, 409)
  assert.deepEqual(await (await f.request('avatar', { session })).json(), { sessionToken: 'only-for-this-user' })
  assert.equal((await f.request('avatar', { session })).status, 429)
  assert.equal(f.avatars[0].personaConfig.maxSessionLengthSeconds, 240)
  await f.request('end', { session: crypto.randomUUID() })
  assert.equal(f.hangups.length, 0)
  assert.deepEqual(await (await f.request('end', { session })).json(), { ok: true })
  assert.equal(await authorizeReadySession(f.env, session), null)
  await f.request('end', { session })
  assert.equal(f.hangups.length, 1)
})

test('expired sessions lose tool access and visiting the demo remotely hangs up the abandoned call', async t => {
  const f = fixture(t)
  let now = Date.now()
  t.mock.method(Date, 'now', () => now)
  await f.setShop()
  const { session, expiresAt } = await (await f.request('session', { sdp })).json()
  now = expiresAt + 1
  assert.equal(await authorizeReadySession(f.env, session), null)
  assert.equal(await consumeReadySearch(f.env, session), false)
  assert.equal((await f.request('avatar', { session })).status, 409)
  await reapExpiredReadySession(f.env)
  assert.match(f.hangups[0], /rtc_open-1\/hangup$/)
  assert.equal((await f.request('session', { sdp })).status, 200)
  assert.equal(f.hangups.length, 1)
})

test('invalid inputs and disabled or non-simulated shops do not open a paid call', async t => {
  const f = fixture(t)
  assert.equal((await f.request('session', { sdp }, 'https://other.example')).status, 403)
  assert.equal((await f.request('session', { sdp: 'not an offer' })).status, 400)
  assert.equal((await f.request('session', { sdp })).status, 503)
  await f.setShop({ managerPaused: true })
  assert.equal((await f.request('session', { sdp })).status, 409)
  await f.setShop({ shop: { mode: 'real' } })
  assert.equal((await f.request('session', { sdp })).status, 409)
  assert.equal(f.issuances.length, 0)
})

test('a failed negotiation releases the slot but repeated call starts still consume the daily budget', async t => {
  const f = fixture(t)
  let now = Date.UTC(2026, 10, 21, 4)
  t.mock.method(Date, 'now', () => now)
  await f.setShop()
  globalThis.fetch.mock.mockImplementationOnce(async () => new Response('busy', { status: 429 }))
  assert.equal((await f.request('session', { sdp })).status, 429)
  now += 6000
  for (let count = 1; count < 30; count++) {
    const started = await f.request('session', { sdp })
    assert.equal(started.status, 200)
    const { session } = await started.json()
    await f.request('end', { session })
    now += 6000
  }
  assert.equal((await f.request('session', { sdp })).status, 429)
  now += 24 * 60 * 60_000
  assert.equal((await f.request('session', { sdp })).status, 200)
})
