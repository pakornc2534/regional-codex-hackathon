import assert from 'node:assert/strict'
import {test} from 'node:test'
import {seedWorld,readWorld,applyCommand,analyzeCase,addManagerProposal,growthPlan,unitTargets,managerContext} from '../server/domain/index.mjs'

const get = (world, sku) => world.products.flatMap(row => row.variants).find(row => row.sellerSku === sku)
const supply = (world, id) => readWorld(world).supplies.find(row => row.id === id)
let counter = 0
function command(world,input) {
  return {actor:'owner',runId:world.runId,expectedVersion:world.revision,idempotencyKey:'test-command-' + counter++,...input}
}
function act(world,input) {
  return applyCommand(world, command(world,input))
}
const productCase = 'sim-case-sonic-reply'
const adCase = 'sim-case-sonic-ads'
const conversationId = 'sim-conversation-sonic'
function propose(world,caseId) {
  return addManagerProposal(world,analyzeCase(world,{caseId}))
}
function choice(proposal) {
  return {type:'choose_option',caseId:proposal.caseId,proposalId:proposal.id,optionId:proposal.options[0].id}
}

test('simulated seed reconciles sales, reservations, inventory history and model context', () => {
  const world = seedWorld()
  const {metrics} = readWorld(world)
  assert.equal(world.products.length,9)
  assert.equal(world.products.flatMap(row => row.variants).length,13)
  assert.equal(world.orders.length,2658)
  assert.deepEqual([metrics.paidOrders,metrics.sales,metrics.orders7d,metrics.sales7d,metrics.queueUnits],[2657,974414,600,221056,38])
  const robot = get(world,'ROBOT')
  const sonic = get(world,'SONIC')
  assert.deepEqual([robot.physical,robot.reserved,robot.available],[420,13,407])
  assert.deepEqual([sonic.physical,sonic.reserved,sonic.available],[2,1,1])
  const departed = world.orders.filter(order => order.paymentStatus === 'paid' && ['taken','collected','delivered'].includes(order.fulfillmentStatus) && order.items[0].variantId === robot.id).length
  assert.equal(robot.openingPhysical - departed,420)
  const overview = managerContext(world)
  assert.equal(overview.metrics.sales,974414)
  assert.ok(overview.contextCoverage.returnedOrders >= 50 && overview.contextCoverage.returnedOrders < 60)
  assert.deepEqual(managerContext(world,{caseId:productCase}).orders.map(order => order.id),['sim-order-unpaid'])
})

test('fresh ROBOT plan uses one calculator for 17 baseline, 19 total and 2 additional units', () => {
  const world = seedWorld()
  const result = growthPlan(world)
  assert.deepEqual(
    [result.baselineUnits,result.planDemand,result.adRecoveryUnits,result.requiredTotalUnits,result.preparationCapacity,result.materialCapacity,result.allocatableStock],
    [17,19,2,19,25,244,404]
  )
  assert.deepEqual([result.unitContribution,result.planContribution,result.baselineContribution,result.lowestCash],[179.35,3107.65,3048.95,29700])
  assert.deepEqual(result.unitRecoveryEvidence.map(row => row.afterAds),[-120.65,58.70])
  assert.match(result.primaryMessage,/2 ชิ้นขึ้นไป รวมอย่างน้อย 19 ชิ้น/)
})

test('whole-plan matching captures discount lost on baseline sales', () => {
  const result = unitTargets({regularPrice:400,discountedPrice:360,productCost:250,packingCost:10,feeRate:.1,baselineUnits:5,adSpend:300,fixedCosts:300})
  assert.deepEqual([result.unitContribution,result.baselineContribution,result.adRecoveryUnits,result.requiredTotalUnits,result.requiredAdditionalUnits],[64,500,5,13,8])
  assert.equal(12 * result.unitContribution - 300,468)
  assert.equal(13 * result.unitContribution - 300,532)
})

test('zero and unknown capacity, cash, and unit costs stay distinct', () => {
  const world = seedWorld()
  const low = growthPlan(world,{packingCapacity:20,cash:0})
  assert.deepEqual([low.preparationCapacity,low.supportablePlanUnits,low.lowestCash],[0,0,-300])
  assert.ok(low.warnings.some(warning => warning.includes('18 ชิ้น')))
  const zero = growthPlan(world,{packingCapacity:0,cash:null})
  assert.deepEqual([zero.inputs.packingCapacity,zero.preparationCapacity,zero.lowestCash],[0,0,null])
  const unknown = growthPlan(world,{packingCapacity:null})
  assert.deepEqual([unknown.preparationCapacity,unknown.supportablePlanUnits,unknown.lowestCash],[null,null,null])
  get(world,'ROBOT').cost = null
  assert.equal(growthPlan(world).unitContribution,null)
  world.supplies = world.supplies.filter(row => row.id !== 'large')
  assert.equal(growthPlan(world).materialCapacity,null)
})

test('order acceptance → packing → carrier → POS → supplies updates one world with idempotent retry', () => {
  const initial = seedWorld()
  const variantId = get(initial,'ROBOT').id
  const submit = command(initial,{type:'accept_order',variantId,quantity:2})
  const accepted = applyCommand(initial,submit)
  const orderId = accepted.receipt.verification.id
  assert.equal(get(accepted.world,'ROBOT').available,405)
  assert.equal(readWorld(accepted.world).metrics.queueUnits,40)
  const again = applyCommand(accepted.world,submit)
  assert.equal(again.receipt.verification.id,orderId)
  assert.equal(again.world.orders.length,initial.orders.length+1)
  assert.throws(() => applyCommand(accepted.world,{...submit,quantity:3}),/รหัสคำสั่งเดิม/)
  const prepared = act(accepted.world,{type:'prepare_order',orderId})
  assert.equal(prepared.receipt.after.fulfillmentStatus,'picking')
  assert.ok(prepared.receipt.after.documents.label)
  assert.equal(supply(prepared.world,'large').quantity,260)
  const packed = act(prepared.world,{type:'pack',orderId})
  assert.equal(readWorld(packed.world).metrics.queueUnits,38)
  assert.equal(supply(packed.world,'large').quantity,258)
  assert.throws(() => act(packed.world,{type:'pack',orderId}),/ไม่อยู่ในคิว/)
  const pickedUp = act(packed.world,{type:'pickup',orderId})
  assert.equal(pickedUp.receipt.after.fulfillmentStatus,'collected')
  assert.equal(get(pickedUp.world,'ROBOT').reserved,13)
  assert.equal(get(pickedUp.world,'ROBOT').available,405)
  assert.equal(get(pickedUp.world,'ROBOT').physical,418)
  const pos = act(pickedUp.world,{type:'pos_sale',variantId,quantity:3})
  assert.equal(get(pos.world,'ROBOT').available,402)
  assert.equal(supply(pos.world,'large').quantity,258)
  const receipt = act(pos.world,{type:'receive_supply',supplyId:'large',quantity:10})
  assert.equal(supply(receipt.world,'large').free - supply(pos.world,'large').free,10)
})

test('isolated customer approval, acknowledgement once, pause and customer takeover', () => {
  const initial = seedWorld()
  const enabled = act(initial,{type:'set_acknowledgement',enabled:true}).world
  const first = act(enabled,{type:'customer_message',conversationId,text:'ยังมีของไหมคะ'}).world
  const second = act(first,{type:'customer_message',conversationId,text:'ยังรอคำตอบอยู่ค่ะ'}).world
  const room = world => world.conversations.find(row => row.id === conversationId)
  assert.equal(room(second).messages.filter(row => row.acknowledgement).length,1)
  const next = propose(second,productCase)
  assert.equal(room(next.world).messages.length,4)
  assert.throws(() => act(next.world,{...choice(next.proposal),caseId:adCase}),/เคสอื่น/)
  assert.throws(() => addManagerProposal(next.world,{...analyzeCase(next.world,{caseId:productCase}),options:[{
    label:'ส่ง',reason:'ทดสอบขอบเขต',action:{type:'customer_reply',text:'สวัสดี',conversationId:'sim-conversation-kiss'}
  }]}),/กำหนดปลายทางจากเคส/)
  const stolen = act(next.world,{type:'take_over',conversationId}).world
  assert.throws(() => act(stolen,choice(next.proposal)),/หมดอายุ/)
  const paused = act(next.world,{type:'pause_manager',paused:true}).world
  assert.throws(() => act(paused,choice(next.proposal)),/หยุดทำงาน/)
  const approved = act(next.world,choice(next.proposal))
  assert.equal(approved.receipt.caseId,productCase)
  assert.equal(approved.receipt.proposalId,next.proposal.id)
  assert.equal(room(approved.world).messages.at(-1).text,next.proposal.options[0].action.text)
  assert.equal(approved.world.conversations.find(row => row.id === 'sim-conversation-kiss').messages.length,1)
  assert.match(approved.receipt.policyQuestion,/ครั้งหน้า/)
  assert.equal(approved.world.policies.length,0)
  const policy = act(approved.world,{...choice(next.proposal),type:'set_policy',enabled:true})
  const matched = act(policy.world,{type:'customer_message',conversationId,text:'ยังรอคำตอบอยู่ค่ะ'})
  assert.equal(room(matched.world).messages.at(-1).text,next.proposal.options[0].action.text)
  assert.ok(matched.world.audit.some(item => item.policyId === policy.receipt.verification.id))
  const outside = act(matched.world,{type:'customer_message',conversationId,text:'มีสีอื่นไหม'})
  assert.equal(room(outside.world).messages.at(-1).acknowledgement,true)
})

test('sold-out stock keeps reservations, invalidates older proposals and retries sync safely', () => {
  const {world,proposal} = propose(seedWorld(),productCase)
  const variantId = get(world,'SONIC').id
  const failed = act(world,{type:'pos_sale',variantId,quantity:1,failSync:true}).world
  const target = failed.channelStock.find(row => row.variantId === variantId)
  const variant = get(failed,'SONIC')
  assert.deepEqual([variant.physical,variant.reserved,variant.available],[1,1,0])
  assert.deepEqual([target.desiredQuantity,target.verifiedQuantity,target.syncStatus],[0,1,'failed'])
  assert.throws(() => act(failed,choice(proposal)),/หมดอายุ/)
  const retried = act(failed,{type:'retry_sync',variantId}).world
  assert.equal(retried.channelStock.find(row => row.variantId === variantId).verifiedQuantity,0)
  assert.equal(get(retried,'SONIC').available,0)
  const review = propose(retried,adCase)
  const paused = act(review.world,choice(review.proposal)).world
  assert.equal(paused.campaigns.find(row => row.id === 'sim-campaign-sonic').status,'paused')
  assert.equal(paused.campaigns.find(row => row.id === 'sim-campaign-robot').status,'active')
})

test('returns do not affect sellable stock and daily mail retry does not duplicate briefs', () => {
  const world = seedWorld()
  const returned = act(world,{type:'receive_return',returnId:'sim-return-1'}).world
  assert.equal(returned.returns[0].stage,'received')
  assert.deepEqual(world.products,returned.products)
  const dayOne = act(returned,{type:'advance_clock',minutes:12,failMail:true}).world
  assert.equal(dayOne.briefs.length,1)
  assert.equal(dayOne.mail[0].status,'failed')
  const retry = act(dayOne,{type:'retry_mail',date:dayOne.briefs[0].date}).world
  const repeat = act(retry,{type:'retry_mail',date:dayOne.briefs[0].date}).world
  assert.deepEqual(retry.mail,repeat.mail)
  const dayTwo = act(repeat,{type:'advance_clock',minutes:1440}).world
  assert.equal(dayTwo.briefs.length,2)
  assert.equal(dayTwo.mail.filter(row => row.status === 'delivered').length,2)
})

test('loan preview tracks cash and debt without claiming revenue or available inbound stock', () => {
  const world = seedWorld()
  const example = growthPlan(world,{mode:'investment',days:2,cash:0,loanPrincipal:5000,apr:.15,restockUnits:25,restockSpend:7000,restockDelay:3})
  const next = growthPlan(world,{mode:'investment',days:5,cash:0,loanPrincipal:5000,apr:.15,restockUnits:25,restockSpend:7000,restockDelay:3})
  assert.equal(example.allocatableStock,402)
  assert.equal(example.supportablePlanUnits,0)
  assert.equal(example.revenue,0)
  assert.equal(example.cashTimeline[0].in,5000)
  assert.equal(example.lowestCash,-7000-0 + 5000 - example.loanSchedule[0].paid)
  assert.equal(next.activeDays,2)
  assert.equal(get(world,'ROBOT').available,407)
  assert.equal(world.plans.length,0)
})

test('mixed shop capacity is measured independently from the selected SKU', () => {
  const world = seedWorld()
  const {capacity} = readWorld(world)
  assert.equal(capacity.workerCapacity,82)
  assert.equal(capacity.nextDayNewUnits,82)
  assert.equal(capacity.bottleneckSupplyId,'ink')
  assert.ok(capacity.onlineDailyUnits > 75)
  world.supplies = world.supplies.filter(item => item.id !== 'large')
  assert.equal(readWorld(world).capacity.materialCapacity,null)
})

test('new inventory cost applies only to sold purchased units and debt principal reconciles', () => {
  const example = unitTargets({
    regularPrice:400,discountedPrice:400,productCost:250,packingCost:10,feeRate:.10,baselineUnits:5,
    existingUnits:5,inboundUnitCost:300,adSpend:100,fixedCosts:100,supportableUnits:7
  })
  assert.equal(example.unitContribution,100)
  assert.equal(example.inboundUnitContribution,50)
  assert.equal(example.planContribution,500)
  assert.equal(example.requiredTotalUnits,7)
  assert.equal(example.adRecoveryUnits,2)
  const plan = growthPlan(seedWorld(),{mode:'investment',loanPrincipal:1,apr:.15,graceDays:15,installments:3})
  assert.deepEqual(plan.loanSchedule.map(row => row.principal),[.33,.33,.34])
  assert.deepEqual(plan.loanSchedule.map(row => row.day),[45,75,105])
  assert.equal(plan.loanSchedule.at(-1).outstanding,0)
})
