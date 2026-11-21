import assert from 'node:assert/strict'
import test from 'node:test'
import { dotSnapshot } from '../shared/dot-monitor.mjs'

// The current hour crosses midnight in Bangkok.
const clock = '2026-10-02T00:20:00+07:00'
const hour = 3_600_000
const day = 24 * hour
const base = {clock, orders:[], cases:[], returns:[], supplies:[], metrics:{queueOrders:0}}

function order(id, age, paidAmount = 18.95) {
  return {id, paymentStatus:'paid', paidAmount, createdAt:new Date(Date.parse(clock) - age).toISOString()}
}

test('Dot matches seven prior shop-clock windows, deduplicates paid IDs and respects hour boundaries', () => {
  const orders = [
    order('at-now', 0, 15.10), order('at-now', 0, 15.10), order('just-inside', hour - 1, 20.35),
    order('too-early', hour), order('future', -1),
    {...order('unpaid', 0), paymentStatus:'unpaid'},
    ...Array.from({length:7}, (_, i) => order('previous-' + i, (i + 1) * day)),
    order('oldest-inside', 7 * day + hour - 1), order('oldest-outside', 7 * day + hour),
    order('oldest-inside', 7 * day + hour - 1), order('too-old', 8 * day),
  ]
  const value = dotSnapshot({...base, orders})
  assert.equal(value.orders, 2)
  assert.equal(value.amount, 35.45)
  assert.equal(value.baseline, 8 / 7)
  assert.equal(value.spike, false)
})

test('Dot requires five paid orders and three times the average, including at a zero baseline', () => {
  const current = Array.from({length:6}, (_, i) => order('now-' + i, i))
  const history = Array.from({length:14}, (_, i) => order('history-' + i, (i % 7 + 1) * day))
  const snapshot = orders => dotSnapshot({...base, orders})
  assert.equal(snapshot(current.slice(0, 4)).spike, false)
  assert.equal(snapshot(current.slice(0, 5)).spike, true)
  assert.equal(snapshot([...current.slice(0, 5), ...history]).spike, false)
  assert.equal(snapshot([...current, ...history]).spike, true)
})

test('Dot morning counts follow actual workflow states and retain unknown overdue counts', () => {
  const state = {
    ...base, metrics:{queueOrders:38, overdueOrders:10},
    cases:['open','awaiting_approval','verified'].map(status => ({status})),
    returns:['transit','received','received'].map(stage => ({stage})),
    supplies:[
      {free:0, daysRemaining:null, leadDays:1}, {free:1, daysRemaining:2, leadDays:2},
      {free:12, daysRemaining:5, leadDays:2}, {free:null, daysRemaining:null, leadDays:3},
    ],
  }
  assert.deepEqual(dotSnapshot(state), {orders:0, baseline:0, amount:0, spike:false, overdue:10, queue:38, approval:1, returns:2, supplies:2})
  assert.equal(dotSnapshot(base).overdue, null)
  assert.equal(dotSnapshot({...base, metrics:{queueOrders:0, overdueOrders:0}}).overdue, 0)
})
