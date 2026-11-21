import {bangkokDate,dayMs,roundMoney} from './simulator.mjs'

export function pageOf(rows,{limit = 10,offset = 0},project = value => value) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw Error('ระบุจำนวนรายการระหว่าง 1 ถึง 25')
  if (!Number.isSafeInteger(offset) || offset < 0) throw Error('ตำแหน่งเริ่มต้นรายการไม่ถูกต้อง')
  const end = offset + limit
  return {matching:rows.length,items:rows.slice(offset,end).map(project),nextOffset:end < rows.length ? end : null}
}

function day(value) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(value) : NaN
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0,10) !== value) throw Error('ระบุวันที่เริ่มต้นและสิ้นสุดเป็น YYYY-MM-DD')
  return date
}

export function periodCoverage(world,{from,to},defaults) {
  const today = bangkokDate(world.clock)
  const first = world.source.period.from
  const period = from === undefined && to === undefined ? defaults : {from:from ?? first,to:to ?? today}
  const span = (day(period.to) - day(period.from)) / dayMs
  if (span < 0 || span > 365) throw Error('เลือกช่วงวันที่ไม่เกิน 366 วัน โดยให้วันสิ้นสุดตรงกับหรือหลังวันเริ่มต้น')
  const start = period.from < first ? first : period.from
  const end = period.to > today ? today : period.to
  const coveredPeriod = start <= end ? {from:start,to:end} : null
  const coverage = !coveredPeriod ? 'unavailable' : start === period.from && end === period.to ? 'complete' : 'partial'
  return {period,coveredPeriod,coverage}
}

export function channelMatch(channel = 'all') {
  if (!['all','online','pos'].includes(channel)) throw Error('ไม่รู้จักช่องทางขาย')
  return order => channel === 'all' || order.channel === channel
}

export function inPeriod(timestamp,period) {
  if (!period || !timestamp) return false
  const date = bangkokDate(timestamp)
  return date >= period.from && date <= period.to
}

export function salesReport(world,input,metrics) {
  const scope = periodCoverage(world,input,metrics.period)
  const {coveredPeriod} = scope
  const filteredChannel = channelMatch(input.channel)
  const paid = world.orders.filter(order => order.paymentStatus === 'paid' && filteredChannel(order))
  const ranged = paid.filter(order => inPeriod(order.createdAt,coveredPeriod))
  const common = {...scope,channel:input.channel ?? 'all'}
  if (input.kind === 'finance') {
    const settled = paid.filter(order => inPeriod(order.settlement?.date,coveredPeriod))
    return {...common,periodTotals:coveredPeriod && {
      sales:roundMoney(ranged.reduce((sum,row) => sum + row.paidAmount,0)),
      paidOrders:ranged.length,
      receivedBySettlementDate:roundMoney(settled.reduce((sum,row) => sum + row.settlement.amount,0)),
      ordersAwaitingSettlement:ranged.filter(order => !order.settlement).length
    },allShopAllTime:{sales:metrics.sales,confirmedCash:metrics.confirmedCash,
      ordersAwaitingSettlement:metrics.pendingSettlements,planningOpeningCash:world.defaults.cash,netProfit:null,
      netProfitReason:'ข้อมูลต้นทุนยังไม่ครบ'}}
  }

  const totals = new Map()
  const ranked = new Map()
  if (coveredPeriod) {
    for (let date = Date.parse(coveredPeriod.from); date <= Date.parse(coveredPeriod.to); date += dayMs) {
      totals.set(new Date(date).toISOString().slice(0,10),{online:0,pos:0,paidOrders:0})
    }
  }
  let sales = 0, units = 0, paidOrders = 0
  const variants = new Map(world.products.flatMap(product => product.variants.map(v => [v.id,{sellerSku:v.sellerSku,productName:product.name,name:v.name}])))
  for (const order of ranged) {
    const items = order.items.filter(item => !input.variantId || input.variantId === item.variantId)
    if (!items.length) continue
    // SKU totals are line sales. Whole-store totals use the same paid amount as the finance screen.
    const amount = input.variantId ? items.reduce((sum,item) => sum + item.unitPrice * item.quantity,0) : order.paidAmount
    const daily = totals.get(bangkokDate(order.createdAt))
    daily[order.channel] += amount
    daily.paidOrders++
    sales += amount
    paidOrders++
    for (const item of items) {
      const row = ranked.get(item.variantId) ?? {variantId:item.variantId,...variants.get(item.variantId),units:0,lineSales:0}
      row.units += item.quantity
      row.lineSales = roundMoney(row.lineSales + item.quantity * item.unitPrice)
      units += item.quantity
      ranked.set(item.variantId,row)
    }
  }
  const days = [...totals].reverse().map(([date,row]) => ({date,online:roundMoney(row.online),pos:roundMoney(row.pos),paidOrders:row.paidOrders}))
  const top = [...ranked.values()].sort((a,b) => b.units - a.units || b.lineSales - a.lineSales || a.variantId.localeCompare(b.variantId))
  const variantFound = input.variantId ? variants.has(input.variantId) : null
  return {...common,variantId:input.variantId ?? null,variantFound,
    periodTotals:coveredPeriod && variantFound !== false ? {sales:roundMoney(sales),paidOrders,units} : null,
    daily:pageOf(days,input),bestSellersByUnits:pageOf(top,input)}
}
