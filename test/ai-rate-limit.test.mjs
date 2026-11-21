import test from 'node:test'
import assert from 'node:assert/strict'
import {createAiRateLimit} from '../shared/ai-rate-limit.mjs'

test('per-client and global admission share a window and reset at the next minute', () => {
  const admit = createAiRateLimit({AI_REQUESTS_PER_IP_MINUTE:1, AI_REQUESTS_GLOBAL_MINUTE:2})
  admit('A', 58000)
  assert.throws(() => admit('A',59000), {status:429, retryAfter:1})
  admit('B',59000)
  assert.throws(() => admit('C',59000), {status:429, retryAfter:1})
  admit('A',60000)
  admit('B',60000)
})
