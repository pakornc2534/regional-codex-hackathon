import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {createHash} from 'node:crypto'

const signature = value => JSON.stringify(value, (_key,item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]]))
    : item
)

export function commandReference(runId, ep, payload) {
  if (ep !== 'sim/command' || typeof payload.idempotencyKey !== 'string') return null
  if (!/^sim-run-[a-f0-9-]{36}$/u.test(runId) || !/^[a-zA-Z0-9_-]{5,120}$/u.test(payload.idempotencyKey)) return null
  return {
    runId,
    idempotencyKey:payload.idempotencyKey,
    payloadHash:createHash('sha256').update(signature(payload)).digest('hex')
  }
}

export function persistedResult(directory, reference) {
  if (!reference || !/^sim-run-[a-f0-9-]{36}$/u.test(reference.runId)) return null
  // Atomic local persistence makes the on-disk receipt an authoritative readback, including after reset.
  let world
  try {
    world = JSON.parse(readFileSync(join(directory,reference.runId,'simulator.json'),'utf8'))
  } catch {
    return null
  }
  if (world.runId !== reference.runId || world.shop?.mode !== 'simulated') return null
  if (!world.receipts || !Object.hasOwn(world.receipts,reference.idempotencyKey)) return null
  const receipt = world.receipts[reference.idempotencyKey]
  return receipt.payloadHash === reference.payloadHash && receipt.status === 'verified' ? {status:200,body:receipt} : null
}
