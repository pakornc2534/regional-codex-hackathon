import {variantsOf,variantOf,dayMs,bangkokDate,roundMoney} from './simulator.mjs'
import {aggregateOrders,historicalDemand,supplyFacts} from './shop-business.mjs'

const ceil = n => Math.ceil(n - 1e-9)
const floor = n => Math.floor(n + 1e-9)
const modes = new Set(['ads','flash','marketing','investment'])
function number(input,key,defaultValue,{max = 1_000_000_000,min = 0,whole = false,nullable = false} = {}) {
  const value = input[key] === undefined ? defaultValue : input[key]
  if (value === null && nullable) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw Error('ค่าที่ระบุไม่ถูกต้อง (' + key + ')')
  }
  return value
}

export function unitTargets({
  regularPrice,discountedPrice,productCost,packingCost,feeRate,variableExtras = 0,
  baselineUnits,adSpend,fixedCosts,existingUnits = Infinity,inboundUnitCost = productCost,supportableUnits = null
}) {
  if ([productCost,packingCost,baselineUnits,inboundUnitCost].some(value => value === null)) {
    return {unitContribution:null,inboundUnitContribution:null,baselineContribution:null,adRecoveryUnits:null,requiredTotalUnits:null,
      requiredAdditionalUnits:null,planContribution:null,unitRecoveryEvidence:[]}
  }
  const satang = value => Math.round(value * 100 + 1e-8)
  const variableRevenue = satang(discountedPrice) - satang(packingCost) - satang(discountedPrice * feeRate) - satang(variableExtras)
  const m = variableRevenue - satang(productCost)
  const inboundMargin = variableRevenue - satang(inboundUnitCost)
  const normalMargin = satang(regularPrice) - satang(productCost) - satang(packingCost) - satang(regularPrice * feeRate)
  const baselineTotal = baselineUnits * normalMargin
  const margin = (count,after = 0) => {
    const existing = Math.min(count,Math.max(0,existingUnits - after))
    return existing * m + (count - existing) * inboundMargin
  }
  function firstTarget(amount,after = 0) {
    if (m <= 0 && (existingUnits === Infinity || inboundMargin <= 0)) return null
    if (amount <= 0) return 0
    const existing = Math.max(0,existingUnits - after)
    const first = m > 0 ? Math.ceil(amount / m) : null
    if (first !== null && first <= existing) return first
    if (existing === Infinity || inboundMargin <= 0) return null
    return existing + Math.ceil((amount - existing * m) / inboundMargin)
  }
  const adRecoveryUnits = firstTarget(satang(adSpend),baselineUnits)
  const requiredTotalUnits = fixedCosts === null ? null : firstTarget(baselineTotal + satang(fixedCosts))
  const requiredAdditionalUnits = requiredTotalUnits === null ? null : Math.max(0,requiredTotalUnits - baselineUnits)
  const unitRecoveryEvidence = adRecoveryUnits > 0 ? [...new Set([Math.max(1,adRecoveryUnits - 1),adRecoveryUnits])].map(units => ({
    units,contribution:margin(units,baselineUnits) / 100,afterAds:(margin(units,baselineUnits) - satang(adSpend)) / 100
  })) : []
  const planContribution = supportableUnits === null || fixedCosts === null ? null : (margin(supportableUnits) - satang(fixedCosts)) / 100
  return {unitContribution:m / 100,inboundUnitContribution:inboundMargin / 100,baselineContribution:baselineTotal / 100,adRecoveryUnits,
    requiredTotalUnits,requiredAdditionalUnits,unitRecoveryEvidence,planContribution}
}

function scheduleDebt(loanPrincipal,apr,graceDays,installments) {
  if (!loanPrincipal) return []
  if (apr === null) return null
  let outstanding = roundMoney(loanPrincipal)
  const principal = Math.floor(outstanding * 100 / installments) / 100
  return Array.from({length:installments},(_,index) => {
    const day = graceDays + 30 * (index + 1)
    const interest = roundMoney(outstanding * apr * (index ? 30 : day) / 365)
    const repayment = index === installments - 1 ? outstanding : Math.min(outstanding,principal)
    outstanding = roundMoney(outstanding - repayment)
    return {day,principal:repayment,interest,outstanding,paid:roundMoney(repayment + interest)}
  })
}

function cashTimeline(inputs,{supported,netPayout,activeDays,delay,adSpend,debt}) {
  if (inputs.cash === null || inputs.restockSpend === null || debt === null || supported === null || netPayout === null) return null
  const flows = new Map()
  function entry(day) {
    if (!flows.has(day)) flows.set(day,{day,in:0,out:0,sales:0,debtPayment:0})
    return flows.get(day)
  }
  entry(0).in = inputs.loanPrincipal
  entry(0).out = roundMoney(adSpend + inputs.slotFee + inputs.otherFixedCosts + inputs.loanFees + inputs.restockSpend + inputs.supplySpend)
  for (const loan of debt) {
    entry(loan.day).out += loan.paid
    entry(loan.day).debtPayment += loan.paid
  }
  for (let i = 0; i < activeDays; i += 1) {
    const units = floor((i + 1) * supported / activeDays) - floor(i * supported / activeDays)
    if (!units) continue
    const day = delay + i
    entry(day).out += inputs.sellerShipping * units
    const paidOn = entry(day + inputs.settlementDelay)
    paidOn.in += netPayout * units
    paidOn.sales += netPayout * units
  }
  let balance = inputs.cash
  return [...flows.values()].sort((a,b) => a.day - b.day).map(flow => {
    const out = roundMoney(flow.out)
    const received = roundMoney(flow.in)
    const low = roundMoney(balance - out + (flow.day === 0 ? inputs.loanPrincipal : 0))
    balance = roundMoney(balance - out + received)
    return {...flow,in:received,out,balance,low}
  })
}

export function growthPlan(world,input = {}) {
  if (input.runId && input.runId !== world.runId) throw Error('ข้อมูลเป็นของรอบร้านก่อนหน้า')
  const selected = variantsOf(world).find(variant => variant.sellerSku === 'ROBOT')
  const variant = variantOf(world,input.variantId ?? selected.id)
  const mode = input.mode ?? 'ads'
  if (!modes.has(mode)) throw Error('ไม่รู้จักประเภทแผน')
  const historical = historicalDemand(world)
  const inputDays = number(input,'days',1,{min:1,max:365,whole:true})
  const inputs = {
    variantId:variant.id,mode,days:inputDays,
    packingCapacity:number(input,'packingCapacity',world.defaults.packingCapacity,{nullable:true,whole:true}),
    cash:number(input,'cash',world.defaults.cash,{nullable:true}),
    baselineDemand:number(input,'baselineDemand',historical[variant.id].online,{nullable:true}),
    quota:number(input,'quota',100,{whole:true}),
    demandLift:number(input,'demandLift',1,{max:1000}),
    carrierDisruptionDays:number(input,'carrierDisruptionDays',0,{max:365,whole:true}),
    dailyBudget:number(input,'dailyBudget',mode === 'ads' ? 300 : 0),
    cpc:number(input,'cpc',4,{min:0.01}),
    conversionRate:number(input,'conversionRate',0.03,{max:1}),
    feeRate:number(input,'feeRate',0.12,{max:1}),
    discount:number(input,'discount',0,{max:1}),
    price:number(input,'price',variant.price),
    discountAmount:number(input,'discountAmount',0),
    slotFee:number(input,'slotFee',0),
    voucher:number(input,'voucher',0),
    voucherUsage:number(input,'voucherUsage',0,{max:1}),
    platformVoucher:number(input,'platformVoucher',0),
    sellerShipping:number(input,'sellerShipping',0),
    affiliateRate:number(input,'affiliateRate',0,{max:1}),
    otherFixedCosts:number(input,'otherFixedCosts',0),
    settlementDelay:number(input,'settlementDelay',7,{max:365,whole:true}),
    loanPrincipal:number(input,'loanPrincipal',0),
    apr:number(input,'apr',null,{nullable:true,max:10}),
    loanFees:number(input,'loanFees',0),
    graceDays:number(input,'graceDays',0,{max:3650,whole:true}),
    installments:number(input,'installments',1,{min:1,max:60,whole:true}),
    restockUnits:number(input,'restockUnits',0,{whole:true}),
    restockSpend:number(input,'restockSpend',variant.cost === null && input.restockUnits > 0 ? null : roundMoney((variant.cost ?? 0) * (input.restockUnits ?? 0)),{nullable:true}),
    restockDelay:number(input,'restockDelay',0,{max:365,whole:true}),
    supplySpend:number(input,'supplySpend',0),
    supplyQuantity:number(input,'supplyQuantity',0),
    supplyId:input.supplyId ?? null,
    supplyDelay:number(input,'supplyDelay',0,{max:365,whole:true})
  }
  if (inputs.supplyId !== null && !world.supplies.some(supply => supply.id === inputs.supplyId)) throw Error('ไม่พบวัสดุที่สั่งเพิ่ม')
  if (inputs.supplyQuantity > 0 && inputs.supplyId === null) throw Error('เลือกวัสดุที่สั่งเพิ่ม')
  const debt = scheduleDebt(inputs.loanPrincipal,inputs.apr,inputs.graceDays,inputs.installments)
  const inboundDelay = Math.max(inputs.restockUnits ? inputs.restockDelay : 0,inputs.supplyQuantity ? inputs.supplyDelay : 0)
  const blockedDays = Math.min(inputDays,inputs.carrierDisruptionDays + inboundDelay)
  const activeDays = inputDays - blockedDays
  const baselineActiveDays = Math.max(0,inputDays - inputs.carrierDisruptionDays)
  const adSpend = roundMoney(inputs.dailyBudget * inputDays)
  const assumedClicks = adSpend / inputs.cpc
  const adUnits = assumedClicks * inputs.conversionRate
  const rawBaselineDemand = inputs.baselineDemand === null ? null : inputs.baselineDemand * inputDays
  const rawPlanDemand = rawBaselineDemand === null ? null : rawBaselineDemand * inputs.demandLift + adUnits
  const normalDemand = rawBaselineDemand === null ? null : ceil(rawBaselineDemand)
  const planDemand = rawPlanDemand === null ? null : ceil(rawPlanDemand)
  const posAllowance = ceil(historical[variant.id].pos * inputDays)
  const stockBase = Math.max(0,variant.available - posAllowance)
  const allocatableStock = stockBase + (activeDays > 0 ? inputs.restockUnits : 0)
  const queue = aggregateOrders(world).queueUnits
  const supplies = supplyFacts(world,historical)
  const physicalMaterials = new Map(supplies.map(supply => [supply.id,supply.free]))
  function allocate(days,extraSupply) {
    const allowance = variantsOf(world).filter(item => item.id !== variant.id).map(item => ({
      variant:item,normal:Math.min(floor(historical[item.id].online * inputDays),Math.max(0,item.available - ceil(historical[item.id].pos * inputDays)))
    }))
    const requested = allowance.reduce((sum,item) => sum + item.normal,0)
    const capacity = inputs.packingCapacity === null ? null : Math.max(0,inputs.packingCapacity * days - queue)
    const supplyRequested = new Map(supplies.map(supply => [
      supply.id,allowance.reduce((sum,item) => sum + item.normal * (item.variant.recipe?.[supply.id] ?? 0),0)
    ]))
    const freeForPeriod = supplyId => {
      const amount = physicalMaterials.get(supplyId)
      return amount == null ? null : Math.max(0,amount + (extraSupply && supplyId === inputs.supplyId ? inputs.supplyQuantity : 0))
    }
    const supplyRatios = supplies.flatMap(({id}) => {
      const amount = freeForPeriod(id)
      return amount === null || supplyRequested.get(id) === 0 ? [] : [amount / supplyRequested.get(id)]
    })
    const ratio = Math.max(0,Math.min(1,...supplyRatios,capacity === null || requested === 0 ? 1 : capacity / requested))
    const apportioned = allowance.map(item => ({...item,units:floor(item.normal * ratio)}))
    const otherUnits = apportioned.reduce((sum,item) => sum + item.units,0)
    const materials = Object.entries(variant.recipe ?? {}).map(([supplyId,perUnit]) => {
      const reservedForOthers = roundMoney(apportioned.reduce((sum,item) => sum + item.units * (item.variant.recipe?.[supplyId] ?? 0),0))
      const free = freeForPeriod(supplyId)
      const remaining = free === null ? null : Math.max(0,roundMoney(free - reservedForOthers))
      return {supplyId,name:supplies.find(item => item.id === supplyId)?.name ?? supplyId,perUnit,free,reservedForOthers,remaining,capacity:remaining === null ? null : floor(remaining / perUnit)}
    })
    const materialCapacity = !materials.length || materials.some(item => item.capacity === null) ? null : Math.min(...materials.map(item => item.capacity))
    return {materialCapacity,preparationCapacity:capacity === null ? null : Math.max(0,capacity - otherUnits),otherUnits,materials}
  }
  const allocation = allocate(activeDays,activeDays > 0)
  const typical = inboundDelay ? allocate(baselineActiveDays,false) : allocate(activeDays,false)
  const {materialCapacity,preparationCapacity,otherUnits} = allocation
  const constrained = values => values.some(value => value === null) ? null : Math.min(...values)
  const baselineUnits = constrained([normalDemand,stockBase,typical.materialCapacity,typical.preparationCapacity])
  const supportablePlanUnits = constrained([planDemand,allocatableStock,materialCapacity,preparationCapacity,inputs.quota])
  const packCosts = Object.entries(variant.recipe ?? {}).map(([id,quantity]) => {
    const cost = supplies.find(supply => supply.id === id)?.unitCost
    return cost === null || cost === undefined ? null : quantity * cost
  })
  const packingCost = !packCosts.length || packCosts.includes(null) || materialCapacity === null ? null : roundMoney(packCosts.reduce((a,b) => a + b,0))
  const discountedPrice = roundMoney(Math.max(0,inputs.price * (1 - inputs.discount) - inputs.discountAmount))
  const variableExtras = roundMoney(inputs.voucher * inputs.voucherUsage + inputs.sellerShipping + discountedPrice * inputs.affiliateRate)
  const interest = debt === null ? null : roundMoney(debt.reduce((sum,payment,index) => {
    const priorDay = index > 0 ? debt[index - 1].day : 0
    const outstanding = index > 0 ? debt[index - 1].outstanding : inputs.loanPrincipal
    return sum + outstanding * inputs.apr * Math.max(0,Math.min(inputDays,payment.day) - priorDay) / 365
  },0))
  const fixedCosts = interest === null ? null : roundMoney(adSpend + inputs.slotFee + inputs.otherFixedCosts + inputs.loanFees + interest)
  const inboundAvailable = activeDays > 0 && inputs.restockUnits > 0
  const inboundUnitCost = inboundAvailable ? inputs.restockSpend === null ? null : inputs.restockSpend / inputs.restockUnits : variant.cost
  const targets = unitTargets({
    regularPrice:variant.price,discountedPrice,productCost:variant.cost,packingCost,feeRate:inputs.feeRate,variableExtras,baselineUnits,adSpend,fixedCosts,
    existingUnits:inboundAvailable ? stockBase : Infinity,inboundUnitCost,supportableUnits:supportablePlanUnits
  })
  const {unitContribution,requiredTotalUnits,adRecoveryUnits,requiredAdditionalUnits} = targets
  const adTarget = adRecoveryUnits === null || baselineUnits === null ? null : baselineUnits + adRecoveryUnits
  const checkTarget = target => {
    if (target === null) return null
    const checks = {stock:allocatableStock,materials:materialCapacity,capacity:preparationCapacity,quota:inputs.quota,demand:planDemand}
    return Object.fromEntries(Object.entries(checks).map(([key,value]) => [key,{available:value,required:target,shortfall:value === null ? null : Math.max(0,target - value)}]))
  }
  const materials = allocation.materials.map(item => ({...item,required:requiredTotalUnits === null ? null : roundMoney(requiredTotalUnits * item.perUnit),
    shortage:requiredTotalUnits === null || item.remaining === null ? null : roundMoney(Math.max(0,requiredTotalUnits * item.perUnit - item.remaining))}))
  const warnings = []
  if (inputs.cash === null) warnings.push('ยังไม่ทราบเงินสดตั้งต้น')
  if (inputs.packingCapacity === null) warnings.push('ยังไม่ทราบจำนวนที่แพ็กได้ต่อวัน')
  if (inputs.baselineDemand === null) warnings.push('ยังไม่ทราบยอดขายปกติที่ใช้ประเมิน')
  if (variant.cost === null || packingCost === null || inboundUnitCost === null) warnings.push('ยังไม่ทราบต้นทุนสินค้าหรือข้อมูลวัสดุครบถ้วน')
  if (interest === null) warnings.push('ระบุอัตราดอกเบี้ยก่อนประเมินแผนเงินกู้')
  if (inputs.packingCapacity !== null && queue > inputs.packingCapacity * activeDays) warnings.push('งานรอแพ็กเกินกำลังในช่วงแผน ' + (queue - inputs.packingCapacity * activeDays) + ' ชิ้น')
  if (activeDays === 0) warnings.push('ไม่มีวันทำงานในช่วงแผน ปรับจำนวนวันหรือวันที่ขนส่งหยุด')
  if (inboundDelay > 0) warnings.push('แผนเริ่มขายเมื่อสินค้าและวัสดุที่สั่งมาถึงครบ')
  if (inboundAvailable && inboundUnitCost !== variant.cost) warnings.push('ประมาณเงินเหลือจากสต็อกเดิมก่อน แล้วคิดต้นทุนสินค้าที่ซื้อเพิ่มเฉพาะส่วนที่ขายได้')
  if (adSpend > 0 && inputs.packingCapacity !== null && preparationCapacity === 0 && adRecoveryUnits > 0 && activeDays > 0) {
    warnings.push('ต้องมีกำลังอย่างน้อย ' + (queue + adRecoveryUnits) + ' ชิ้นตลอดช่วงแผนเพื่อรองรับคิวเดิมและยอดเพิ่ม โดยยังไม่รวมยอดขายปกติ')
  }
  if (requiredTotalUnits !== null && supportablePlanUnits !== null && requiredTotalUnits > supportablePlanUnits) warnings.push('แผนยังขายได้ไม่ถึงจำนวนที่ต้องใช้เพื่อให้คุ้มเท่าขายปกติ')
  if (unitContribution !== null && unitContribution <= 0 && targets.inboundUnitContribution <= 0) warnings.push('ยอดขายเพิ่มอย่างเดียวไม่สามารถชดเชยค่าใช้จ่ายคงที่ได้')
  const netPayout = roundMoney(discountedPrice * (1 - inputs.feeRate - inputs.affiliateRate) - inputs.voucher * inputs.voucherUsage)
  const timeline = cashTimeline(inputs,{supported:supportablePlanUnits,netPayout,activeDays,delay:blockedDays,adSpend,debt})
  const lowestCash = timeline === null ? null : Math.min(inputs.cash,...timeline.map(row => row.low))
  const receivables = timeline === null ? null : roundMoney(timeline.filter(row => row.day >= inputDays).reduce((total,row) => total + row.sales,0))
  if (lowestCash !== null && lowestCash < 0) warnings.push('เงินสดตามแผนไม่พอ ฿' + Math.abs(lowestCash).toLocaleString('th-TH'))
  const primaryMessage = adTarget === null || adSpend <= 0 ? null : 'ถ้าขายเพิ่มจากปกติ ' + adRecoveryUnits + ' ชิ้นขึ้นไป รวมอย่างน้อย ' + adTarget + ' ชิ้น เงินที่เหลือหลังหักต้นทุนจะพอจ่ายค่าแอด ' + adSpend.toLocaleString('th-TH') + ' บาทแล้ว'
  return {
    runId:world.runId,revision:world.revision,variantId:variant.id,mode,inputs,
    observedAt:world.clock,source:'simulated',baselineUnits,normalDemand,planDemand,rawBaselineDemand,rawPlanDemand,supportablePlanUnits,
    adSpend,assumedClicks,assumedIncrementalAdUnits:adUnits,...targets,
    preparationCapacity,materialCapacity,allocatableStock,packingCost,discountedPrice,queueUnits:queue,otherUnits,posAllowance,
    lowestCash,receivables,revenue:supportablePlanUnits === null ? null : roundMoney(supportablePlanUnits * discountedPrice),
    warnings,materials,adTarget,adRequirements:checkTarget(adTarget),wholePlanRequirements:checkTarget(requiredTotalUnits),
    cashTimeline:timeline,loanSchedule:debt,interest,fixedCosts,activeDays,primaryMessage,requiredAdditionalUnits,
    costs:{product:variant.cost,inboundProduct:inboundUnitCost,packing:packingCost,fee:roundMoney(discountedPrice * inputs.feeRate),sellerVoucher:roundMoney(inputs.voucher * inputs.voucherUsage),sellerShipping:inputs.sellerShipping,affiliate:roundMoney(discountedPrice * inputs.affiliateRate)},
    roas:adSpend && supportablePlanUnits !== null && baselineUnits !== null ? roundMoney(Math.min(adUnits,Math.max(0,supportablePlanUnits - baselineUnits)) * discountedPrice / adSpend) : null,
    assumptions:['กันงบแอดและจ่ายค่าซื้อสินค้า/วัสดุวันเริ่มแผน','สมมติว่าขายตามจำนวนที่รองรับได้และรับเงินหลังครบวันรอรับเงิน','ชำระคืนเงินต้นเท่ากันทุกงวด โดยงวดสุดท้ายรับส่วนต่างจากการปัดเศษ'],
    startDate:activeDays ? bangkokDate(Date.parse(world.clock) + blockedDays * dayMs) : null
  }
}
