import {growthPlan} from './growth-planner.mjs'
import {aggregateOrders,capacityFacts,historicalDemand,supplyFacts} from './shop-business.mjs'
import {roundMoney} from './simulator.mjs'
import {pageOf,periodCoverage} from './live-manager-reports.mjs'
import {workspaceReport} from './live-manager-workspaces.mjs'
import {readManagerCatalog} from './live-manager-catalog.mjs'

const growthModes = new Set(['ads','flash','marketing','investment'])
export const growthInputs = new Set([
  'days','packingCapacity','cash','baselineDemand','quota','demandLift','carrierDisruptionDays',
  'dailyBudget','cpc','conversionRate','feeRate','discount','price','discountAmount','slotFee',
  'voucher','voucherUsage','platformVoucher','sellerShipping','affiliateRate','otherFixedCosts',
  'settlementDelay','loanPrincipal','apr','loanFees','graceDays','installments','restockUnits',
  'restockSpend','restockDelay','supplySpend','supplyQuantity','supplyId','supplyDelay'
])
function optionalText(value,label) {
  if (value === undefined) return ''
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw Error(label + 'ไม่ถูกต้อง')
  return value.trim()
}

function summary(world,input) {
  const {daily,...metrics} = aggregateOrders(world)
  const historical = historicalDemand(world)
  const supplies = supplyFacts(world,historical)
  const capacity = capacityFacts(world,metrics,supplies,historical)
  const scope = periodCoverage(world,input,metrics.period)
  const {coveredPeriod} = scope
  const selected = coveredPeriod ? daily.filter(row => row.date >= coveredPeriod.from && row.date <= coveredPeriod.to) : []
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
    ...scope,
    sales,
    sales7d:metrics.sales7d,orders7d:metrics.orders7d,lastSevenDays:metrics.period,
    queueOrders:metrics.queueOrders,queueUnits:metrics.queueUnits,overdueOrders:metrics.overdueOrders,
    confirmedCash:metrics.confirmedCash,pendingSettlements:metrics.pendingSettlements,
    stages:metrics.stages,capacity
  }
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
export function readLiveManagerTool(world,input,owner) {
  if (world.shop.mode !== 'simulated') throw Error('ผู้จัดการสดรอบนี้ใช้ได้กับร้านจำลองเท่านั้น')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('รูปแบบคำถามเกี่ยวกับร้านไม่ถูกต้อง')
  const {kind} = input
  for (const key of ['id','query','status','variantId']) {
    if (input[key] !== undefined) optionalText(input[key],key)
  }
  const matches = (row,fields) => (!input.id || row.id === input.id)
    && (!input.status || row.status === input.status)
    && (!input.variantId || row.entityRefs?.variantId === input.variantId || row.variantIds?.includes(input.variantId))
    && (!input.query || fields.some(key => String(row[key] ?? '').toLocaleLowerCase('th').includes(input.query.trim().toLocaleLowerCase('th'))))
  let data, pagination
  // Keep legacy array responses for these readers; include counts outside the arrays.
  function records(rows,fields,project) {
    const page = pageOf(rows.filter(row => matches(row,fields)),{...input,limit:input.limit ?? 25},project)
    pagination = {matching:page.matching,nextOffset:page.nextOffset}
    return page.items
  }
  switch (kind) {
    case 'summary': data = summary(world,input); break
    case 'catalog': data = readManagerCatalog(world,input); break
    case 'products': {
      const page = readManagerCatalog(world,{...input,limit:input.limit ?? 25})
      data = page.items
      pagination = {matching:page.matching,nextOffset:page.nextOffset}
      break
    }
    case 'supplies': data = records(supplyFacts(world),['id','name'],({id,name,unit,quantity,unitCost,leadDays,reserved,free,usedDaily,daysRemaining,orderOn}) =>
      ({id,name,unit,quantity,unitCost,leadDays,reserved,free,usedDaily,daysRemaining,orderOn})); break
    case 'campaigns': data = records(world.campaigns,['id','name'],({id,name,status,dailyBudget,spend,clicks,attributedSales,period,variantIds}) =>
      ({id,name,status,dailyBudget,spend,clicks,attributedSales,period,variantIds})); break
    case 'cases': data = records(world.cases,['id','type','title','priority'],({id,type,title,priority,status}) => ({id,type,title,priority,status})); break
    case 'growth': data = plan(world,input); break
    default: data = workspaceReport(world,input,owner)
  }
  return {source:'simulated',shopName:world.shop.name,runId:world.runId,revision:world.revision,observedAt:world.clock,kind,data,...(pagination && {pagination})}
}
