const hour = 60 * 60 * 1000
const day = 24 * hour
const historyDays = 7

/**
 * Project the same shop snapshot read by Dot. Notification delivery and
 * episode tracking belong to the private scheduled task.
 * @param {Pick<import('../src/model').ShopState, 'clock'|'orders'|'metrics'|'cases'|'returns'|'supplies'>} state
 */
export function dotSnapshot(state) {
  const now = Date.parse(state.clock)
  const paidIds = new Set()
  let orders = 0
  let satang = 0
  let historicalOrders = 0

  for (const order of state.orders) {
    if (order.paymentStatus !== 'paid' || paidIds.has(order.id)) continue
    const age = now - Date.parse(order.createdAt)
    // Bangkok has no offset changes. Each window is (end - 1 hour, end].
    if (!(age >= 0 && age < historyDays * day + hour && age % day < hour)) continue
    paidIds.add(order.id)
    if (age < hour) {
      orders += 1
      satang += Math.round(order.paidAmount * 100)
    } else {
      historicalOrders += 1
    }
  }

  const baseline = historicalOrders / historyDays
  return {
    orders,
    baseline,
    amount: satang / 100,
    spike: orders >= 5 && orders * historyDays >= 3 * historicalOrders,
    overdue: state.metrics.overdueOrders ?? null,
    queue: state.metrics.queueOrders,
    approval: state.cases.filter(item => item.status === 'awaiting_approval').length,
    returns: state.returns.filter(item => item.stage === 'received').length,
    supplies: state.supplies.filter(item =>
      (item.free !== null && item.free <= 0) ||
      (item.daysRemaining !== null && item.daysRemaining <= item.leadDays)
    ).length,
  }
}

/**
 * Public, read-only projection for Dot. An offline relay keeps the last
 * measured figures but cannot establish whether a spike is happening now.
 * @param {Parameters<typeof dotSnapshot>[0] & {runId:string, revision?:number}} state
 * @param {boolean} [stale]
 */
export function dotSummary(state, stale = false) {
  const snapshot = dotSnapshot(state)
  return {
    runId: state.runId,
    revision: state.revision ?? null,
    clock: state.clock,
    stale,
    ...snapshot,
    spike: stale ? null : snapshot.spike,
  }
}
