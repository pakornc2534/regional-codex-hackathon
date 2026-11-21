import {bangkokDate,dayMs,orderUnits,unpacked,variantsOf,roundMoney} from './simulator.mjs'

export function aggregateOrders(world) {
  const today = bangkokDate(world.clock)
  const since = new Date(Date.parse(today) - 6 * dayMs).toISOString().slice(0,10)
  const daily = new Map()
  for (let offset = 0; offset < 28; offset += 1) {
    const date = new Date(Date.parse(world.source.period.from) + offset * dayMs).toISOString().slice(0,10)
    daily.set(date,{date,online:0,pos:0,orders:0,onlineOrders:0,posOrders:0})
  }
  const stages = Object.fromEntries(['picking','packing','ready','collected','transit','delivered','taken'].map(stage => [stage,{orders:0,units:0}]))
  const metrics = {
    sales7d:0,orders7d:0,paidOrders:0,sales:0,confirmedCash:0,pendingSettlements:0,
    period:{from:since,to:today},onlineSales:0,posSales:0,stages,queueUnits:0,queueOrders:0,overdueOrders:0
  }
  for (const order of world.orders) {
    if (order.paymentStatus !== 'paid') continue
    metrics.paidOrders += 1
    metrics.sales += order.paidAmount
    metrics[order.channel + 'Sales'] += order.paidAmount
    const date = bangkokDate(order.createdAt)
    if (date >= since && date <= today) {
      metrics.orders7d += 1
      metrics.sales7d += order.paidAmount
    }
    if (order.settlement) metrics.confirmedCash += order.settlement.amount
    else metrics.pendingSettlements += 1
    if (!daily.has(date)) daily.set(date,{date,online:0,pos:0,orders:0,onlineOrders:0,posOrders:0})
    const totals = daily.get(date)
    totals[order.channel] += order.paidAmount
    totals[order.channel + 'Orders'] += 1
    totals.orders += 1
    const units = orderUnits(order)
    const stage = stages[order.fulfillmentStatus]
    stage.orders += 1
    stage.units += units
    if (order.channel === 'online' && unpacked.has(order.fulfillmentStatus)) {
      metrics.queueOrders += 1
      metrics.queueUnits += units
      if (order.prepareBy && order.prepareBy < world.clock) metrics.overdueOrders += 1
    }
  }
  metrics.confirmedCash = roundMoney(metrics.confirmedCash)
  return {...metrics,daily:[...daily.values()].sort((a,b) => a.date.localeCompare(b.date))}
}

export function historicalDemand(world) {
  const start = world.source.period.from
  const end = new Date(Date.parse(start) + 27 * dayMs).toISOString().slice(0,10)
  const averages = Object.fromEntries(variantsOf(world).map(variant => [variant.id,{online:0,pos:0}]))
  for (const order of world.orders) {
    if (order.paymentStatus !== 'paid') continue
    const date = bangkokDate(order.createdAt)
    if (date < start || date > end) continue
    for (const item of order.items) averages[item.variantId][order.channel] += item.quantity
  }
  for (const row of Object.values(averages)) {
    row.online /= 28
    row.pos /= 28
  }
  return averages
}

export function supplyFacts(world, historical = historicalDemand(world)) {
  const variants = variantsOf(world)
  const reserved = Object.fromEntries(world.supplies.map(supply => [supply.id,0]))
  const usedDaily = {...reserved}
  const byId = new Map(variants.map(variant => [variant.id,variant]))
  const incomplete = variants.some(variant => !variant.recipe)
  for (const order of world.orders) {
    if (order.paymentStatus !== 'paid' || order.channel !== 'online' || !unpacked.has(order.fulfillmentStatus)) continue
    for (const {variantId,quantity} of order.items) {
      for (const [supplyId,count] of Object.entries(byId.get(variantId).recipe ?? {})) reserved[supplyId] += count * quantity
    }
  }
  for (const variant of variants) {
    for (const [supplyId,count] of Object.entries(variant.recipe ?? {})) usedDaily[supplyId] += count * historical[variant.id].online
  }
  return world.supplies.map(supply => {
    const free = supply.quantity === null || incomplete ? null : roundMoney(supply.quantity - reserved[supply.id])
    const daysRemaining = free === null || !usedDaily[supply.id] ? null : roundMoney(Math.max(0,free) / usedDaily[supply.id])
    const orderOn = daysRemaining === null ? null : bangkokDate(Date.parse(world.clock) + Math.floor(Math.max(0,daysRemaining - supply.leadDays)) * dayMs)
    return {...supply,reserved:incomplete ? null : roundMoney(reserved[supply.id]),free,usedDaily:incomplete ? null : usedDaily[supply.id],daysRemaining,orderOn}
  })
}

export function capacityFacts(world,metrics,supplies,historical) {
  const onlineDailyUnits = Object.values(historical).reduce((sum,item) => sum + item.online,0)
  const limits = supplies.flatMap(supply => supply.usedDaily > 0 && supply.free !== null ? [{
    supplyId:supply.id,capacity:Math.max(0,Math.floor(supply.free * onlineDailyUnits / supply.usedDaily))
  }] : []).sort((a,b) => a.capacity - b.capacity)
  const supplyIds = new Set(supplies.filter(supply => supply.free !== null).map(supply => supply.id))
  const hasAllMaterials = variantsOf(world).every(variant => !historical[variant.id].online || variant.recipe && Object.keys(variant.recipe).every(id => supplyIds.has(id)))
  const materialCapacity = onlineDailyUnits && limits.length && hasAllMaterials ? limits[0].capacity : null
  const workerCapacity = world.defaults.packingCapacity == null ? null : Math.max(0,world.defaults.packingCapacity - metrics.queueUnits)
  return {
    method:'คำนวณตามสัดส่วนยอดขายออนไลน์เฉลี่ยทั้งร้านจากประวัติ 28 วัน',
    onlineDailyUnits,materialCapacity,bottleneckSupplyId:materialCapacity === null ? null : limits[0].supplyId,
    workerCapacity,nextDayNewUnits:materialCapacity === null || workerCapacity === null ? null : Math.min(materialCapacity,workerCapacity)
  }
}

export function readWorld(world) {
  const {receipts,...view} = world
  const metrics = aggregateOrders(world)
  const historical = historicalDemand(world)
  const supplies = supplyFacts(world,historical)
  return {
    ...view,
    source:{...world.source,observedAt:world.clock},
    supplies,metrics,historical,capacity:capacityFacts(world,metrics,supplies,historical),
    health:{...world.health,stale:Date.parse(world.clock) - Date.parse(world.health.observedAt) > 3 * dayMs},
    cases:world.cases.map(item => {
      const latest = world.proposals.filter(proposal => proposal.caseId === item.id).at(-1)
      return {...item,proposal:latest ?? null,options:latest?.options ?? []}
    })
  }
}

export function updateBriefs(world, failMail = false) {
  const hour = Number(new Date(Date.parse(world.clock) + 7 * 3_600_000).toISOString().slice(11,13))
  const date = bangkokDate(world.clock)
  if (hour < 7 || world.briefs.some(brief => brief.date === date)) return
  const {sales7d,orders7d,queueUnits,period,overdueOrders} = aggregateOrders(world)
  const openCases = world.cases.filter(item => item.status !== 'verified')
  const brief = {
    id:'sim-brief-' + date,date,at:world.clock,period,sales7d,orders7d,queueUnits,overdueOrders,
    caseIds:openCases.map(item => item.id),completedCaseIds:world.cases.filter(item => item.status === 'verified').map(item => item.id),
    lowStock:variantsOf(world).filter(variant => variant.available < 3).map(variant => variant.sellerSku),
    lowSupplies:supplyFacts(world).filter(supply => supply.daysRemaining !== null && supply.daysRemaining < supply.leadDays).map(supply => supply.id),
    activeCampaigns:world.campaigns.filter(campaign => campaign.status === 'active').map(campaign => campaign.id),
    newsIds:world.news.map(item => item.id)
  }
  world.briefs.push(brief)
  world.mail.push({id:'sim-mail-' + date,date,briefId:brief.id,status:failMail ? 'failed' : 'delivered',deliveredAt:failMail ? null : world.clock,attempts:1})
}
