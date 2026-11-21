import {growthPlan} from './growth-planner.mjs'
import {aggregateOrders,capacityFacts,historicalDemand,supplyFacts} from './shop-business.mjs'
import {bangkokDate,dayMs,roundMoney} from './simulator.mjs'

const growthModes = new Set(['ads','flash','marketing','investment'])
const growthInputs = new Set([
  'days','packingCapacity','cash','baselineDemand','quota','demandLift','carrierDisruptionDays',
  'dailyBudget','cpc','conversionRate','feeRate','discount','price','discountAmount','slotFee',
  'voucher','voucherUsage','platformVoucher','sellerShipping','affiliateRate','otherFixedCosts',
  'settlementDelay','loanPrincipal','apr','loanFees','graceDays','installments','restockUnits',
  'restockSpend','restockDelay','supplySpend','supplyQuantity','supplyId','supplyDelay'
])
const fulfillmentStatuses = new Set([
  'picking','packing','ready','collected','transit','delivered','taken','cancelled','returned'
])

function optionalText(value,label) {
  if (value === undefined) return ''
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw Error(label + 'ไม่ถูกต้อง')
  return value.trim()
}

function day(value) {
  const valid = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  if (!valid || new Date(value).toISOString().slice(0,10) !== value) throw Error('ระบุวันที่เริ่มต้นและสิ้นสุดเป็น YYYY-MM-DD')
  return Date.parse(value)
}

function summary(world,{from,to}) {
  const {daily,...metrics} = aggregateOrders(world)
  const historical = historicalDemand(world)
  const supplies = supplyFacts(world,historical)
  const capacity = capacityFacts(world,metrics,supplies,historical)
  const period = from === undefined && to === undefined ? metrics.period : {from,to}
  const span = (day(period.to) - day(period.from)) / dayMs
  if (span < 0 || span > 365) throw Error('เลือกช่วงวันที่ไม่เกิน 366 วัน โดยให้วันสิ้นสุดตรงกับหรือหลังวันเริ่มต้น')

  const firstKnown = world.source.period.from
  const today = bangkokDate(world.clock)
  const coveredFrom = period.from < firstKnown ? firstKnown : period.from
  const coveredTo = period.to > today ? today : period.to
  const coveredPeriod = coveredFrom <= coveredTo ? {from:coveredFrom,to:coveredTo} : null
  const selected = coveredPeriod ? daily.filter(row => row.date >= coveredFrom && row.date <= coveredTo) : []
  const totals = selected.reduce((total,row) => ({
    onlineSales:total.onlineSales + row.online,
    posSales:total.posSales + row.pos,
    orders:total.orders + row.orders
  }),{onlineSales:0,posSales:0,orders:0})
  const sales = !coveredPeriod ? null : {
    onlineSales:roundMoney(totals.onlineSales),
    posSales:roundMoney(totals.posSales),
    total:roundMoney(totals.onlineSales + totals.posSales),
    paidOrders:totals.orders
  }
  return {
    period,coveredPeriod,
    coverage:coveredPeriod === null ? 'unavailable'
      : coveredFrom === period.from && coveredTo === period.to ? 'complete' : 'partial',
    sales,
    sales7d:metrics.sales7d,orders7d:metrics.orders7d,lastSevenDays:metrics.period,
    queueOrders:metrics.queueOrders,queueUnits:metrics.queueUnits,overdueOrders:metrics.overdueOrders,
    confirmedCash:metrics.confirmedCash,pendingSettlements:metrics.pendingSettlements,
    stages:metrics.stages,capacity
  }
}

function productRows(world,query) {
  const term = optionalText(query,'คำค้นสินค้า').normalize('NFKC').toLocaleLowerCase('th')
  return world.products.flatMap(product => product.variants
    .filter(row => [row.id,row.sellerSku,row.name,product.name,product.category]
      .some(value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('th').includes(term)))
    .map(({id,sellerSku,name,price,cost,available,physical,reserved,updatedAt}) => ({
      id,productId:product.id,productName:product.name,category:product.category,
      sellerSku,name,price,cost,available,physical,reserved,updatedAt
    })))
}

function orders(world,input) {
  const id = optionalText(input.id,'เลขออเดอร์')
  const status = optionalText(input.status,'สถานะออเดอร์')
  const limit = input.limit === undefined ? 10 : input.limit
  if (status && !fulfillmentStatuses.has(status)) throw Error('ไม่รู้จักสถานะออเดอร์')
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw Error('ระบุจำนวนออเดอร์ระหว่าง 1 ถึง 25')
  const matching = world.orders.filter(order => (!id || order.id.toLowerCase() === id.toLowerCase()) &&
    (!status || order.fulfillmentStatus === status))
  const byVariant = new Map(world.products.flatMap(product => product.variants.map(variant => [variant.id,variant.sellerSku])))
  const items = matching.sort((a,b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0,limit)
    .map(({id,createdAt,prepareBy,channel,paymentStatus,fulfillmentStatus,paidAmount,items}) => ({
      id,createdAt,prepareBy,channel,paymentStatus,fulfillmentStatus,paidAmount,
      items:items.map(({variantId,quantity,unitPrice}) => ({variantId,sku:byVariant.get(variantId) ?? null,quantity,unitPrice}))
    }))
  return {matching:matching.length,items}
}

function plan(world,{variantId,mode = 'ads',inputs = {}}) {
  const selected = optionalText(variantId,'รหัสรุ่นสินค้า')
  if (!selected) throw Error('ระบุรหัสรุ่นสินค้าก่อนประเมินแผน')
  if (!growthModes.has(mode)) throw Error('ไม่รู้จักประเภทแผน')
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs) ||
      Object.keys(inputs).some(key => !growthInputs.has(key))) throw Error('สมมติฐานของแผนไม่ถูกต้อง')
  const result = growthPlan(world,{...inputs,variantId:selected,mode})
  // Keep the full calculation in the existing planner; voice needs the decision values, not the raw schedules.
  const {cashTimeline,loanSchedule,...decision} = result
  return decision
}

/** Read scoped facts for the assistant. This adapter never executes shop actions. */
export function readLiveManagerTool(world,input) {
  if (world.shop.mode !== 'simulated') throw Error('ผู้จัดการสดรอบนี้ใช้ได้กับร้านจำลองเท่านั้น')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('รูปแบบคำถามเกี่ยวกับร้านไม่ถูกต้อง')
  const {kind} = input
  let data
  switch (kind) {
    case 'summary': data = summary(world,input); break
    case 'products': data = productRows(world,input.query); break
    case 'orders': data = orders(world,input); break
    case 'supplies': data = supplyFacts(world).map(({id,name,unit,quantity,unitCost,leadDays,reserved,free,daysRemaining,orderOn}) =>
      ({id,name,unit,quantity,unitCost,leadDays,reserved,free,daysRemaining,orderOn})); break
    case 'campaigns': data = world.campaigns.map(({id,name,status,dailyBudget,spend,clicks,attributedSales,period,variantIds}) =>
      ({id,name,status,dailyBudget,spend,clicks,attributedSales,period,variantIds})); break
    case 'cases': data = world.cases.map(({id,type,title,priority,status}) => ({id,type,title,priority,status})); break
    case 'growth': data = plan(world,input); break
    default: throw Error('ไม่รู้จักข้อมูลร้านที่ขอ')
  }
  return {source:'simulated',shopName:world.shop.name,runId:world.runId,revision:world.revision,observedAt:world.clock,kind,data}
}
