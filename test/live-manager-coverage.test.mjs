import assert from 'node:assert/strict'
import {test} from 'node:test'
import {dotSummary} from '../shared/dot-monitor.mjs'
import {stations,workspaceNames} from '../shared/shop-workspaces.mjs'
import {addManagerProposal,analyzeCase,applyCommand,growthPlan,readWorld,seedWorld} from '../server/domain/index.mjs'
import {bangkokDate,roundMoney} from '../server/domain/simulator.mjs'
import {readLiveManagerTool} from '../server/domain/live-manager-tools.mjs'

const read = (world,kind,input = {},owner) => readLiveManagerTool(world,{kind,...input},owner).data
const command = (world,payload) => applyCommand(world,{actor:'owner',runId:world.runId,expectedVersion:world.revision,
  idempotencyKey:'coverage-' + world.revision,...payload}).world

test('sales and finance show paid sales, unit rankings, daily values and payments by settlement date',() => {
  const world = seedWorld()
  const state = readWorld(world), {period} = state.metrics
  const sales = read(world,'sales')
  assert.equal(sales.periodTotals.sales,state.metrics.sales7d)
  assert.equal(sales.periodTotals.paidOrders,state.metrics.orders7d)
  assert.equal(sales.daily.matching,7)
  assert.equal(sales.daily.items.reduce((sum,row) => sum + row.online + row.pos,0),state.metrics.sales7d)
  const leader = sales.bestSellersByUnits.items[0]
  const recorded = world.orders.filter(o => o.paymentStatus === 'paid' && bangkokDate(o.createdAt) >= period.from && bangkokDate(o.createdAt) <= period.to)
  assert.equal(leader.units,recorded.flatMap(o => o.items).filter(i => i.variantId === leader.variantId).reduce((sum,i) => sum + i.quantity,0))
  const sku = read(world,'sales',{variantId:leader.variantId,channel:'pos',...period})
  assert.equal(sku.periodTotals.units,recorded.filter(o => o.channel === 'pos').flatMap(o => o.items).filter(i => i.variantId === leader.variantId).reduce((sum,i) => sum + i.quantity,0))
  assert.equal(read(world,'sales',{variantId:'does-not-exist'}).periodTotals,null)
  const today = bangkokDate(world.clock)
  const settled = world.orders.filter(o => o.channel === 'online' && o.settlement && bangkokDate(o.settlement.date) === today)
  const finance = read(world,'finance',{from:today,to:today,channel:'online'})
  assert.ok(settled.some(o => bangkokDate(o.createdAt) !== today))
  assert.equal(finance.periodTotals.receivedBySettlementDate,roundMoney(settled.reduce((total,o) => total + o.settlement.amount,0)))
  assert.equal(finance.allShopAllTime.netProfit,null)
  assert.equal(read(world,'finance',{from:'2030-08-17',to:'2030-08-18'}).periodTotals,null)
  assert.equal(read(world,'sales',{from:'2026-09-01',to:'2026-09-08'}).coverage,'partial')
  assert.throws(() => read(world,'sales',{channel:'unrecognized'}),/ช่องทาง/)
})

test('3D, bankzar configuration, stock, packing, shipping, and Dot agree with the current screens',() => {
  let world = seedWorld()
  const robot = world.products[0].variants[0]
  world = command(world,{type:'pos_sale',variantId:robot.id,quantity:2,failSync:true})
  const state = readWorld(world)
  const scene = read(world,'scene')
  assert.equal(scene.stations.length,9)
  for (const row of scene.stations) {
    assert.equal(row.name,stations[row.id].name)
    assert.equal(row.workspace,workspaceNames[stations[row.id].page])
  }
  assert.deepEqual(scene.stations.find(row => row.id === 'packing').capacity,state.capacity)
  const inv = read(world,'inventory',{variantId:robot.id,status:'failed'}).items[0]
  assert.equal(inv.available,405)
  assert.equal(inv.channelStock.desiredQuantity,405)
  assert.equal(inv.channelStock.verifiedQuantity,407)
  const changes = read(world,'movements',{variantId:robot.id,status:'pos_sale'}).items
  assert.equal(changes[0].before.available,407)
  assert.equal(changes[0].after.available,405)
  assert.equal(read(world,'inventory',{status:'out_of_stock'}).items[0].sellerSku,'FORTUNE')
  assert.equal(read(world,'settings').defaults.packingCapacity,world.defaults.packingCapacity)
  const health = read(world,'health')
  assert.equal(health.failedStockSyncs,1)
  assert.equal(health.platform.stale,state.health.stale)
  const dot = read(world,'dot')
  for (const [k,v] of Object.entries(dotSummary(state))) assert.equal(dot[k],v)
  const work = read(world,'fulfillment',{status:'overdue',limit:1})
  assert.equal(work.matching,state.metrics.overdueOrders)
  assert.deepEqual(work.currentShop.capacity,state.capacity)
  const sent = world.orders.find(o => o.tracking)
  const details = read(world,'fulfillment',{id:sent.id}).items[0]
  assert.equal(details.tracking,sent.tracking)
  assert.deepEqual(details.events,sent.events)
  assert.equal(read(world,'returns',{status:'waiting'}).items[0].stage,'received')
  assert.equal(read(world,'returns',{id:'no-order'}).matching,0)
  const activity = read(world,'activity').items[0]
  assert.equal(activity.type,'pos_sale')
  assert.doesNotMatch(JSON.stringify(activity),/customerId|idempotencyKey|payloadHash|before|after/)
})

test('case, inbox, saved owner memories, plans, briefs and internal research stay scoped and read-only',() => {
  let world = seedWorld()
  const analyzed = analyzeCase(world,{caseId:world.cases[0].id})
  world = addManagerProposal(world,analyzed).world
  const robot = world.products[0].variants[0]
  const plan = {mode:'ads',variantId:robot.id,dailyBudget:90}
  const expected = growthPlan(world,plan)
  world = command(world,{type:'save_plan',plan})
  world = command(world,{type:'advance_clock',minutes:15,failMail:true})
  const previous = structuredClone(world)
  const saved = read(world,'plans',{mode:'ads',variantId:robot.id}).items[0]
  assert.equal(saved.decision.adSpend,expected.adSpend)
  assert.equal(read(world,'plans',{id:saved.id}).items[0].assumptions.dailyBudget,90)
  const detail = read(world,'case_detail',{id:world.cases[0].id}).case
  assert.deepEqual(detail.evidence.items,world.cases[0].evidence)
  assert.equal(detail.proposal.options.length,world.proposals[0].options.length)
  assert.doesNotMatch(JSON.stringify(detail),/idempotencyKey|jobId|customerText/)
  const rooms = read(world,'inbox',{limit:1})
  assert.equal(rooms.matching,world.conversations.length)
  assert.doesNotMatch(JSON.stringify(rooms),/customerId|waitingEpisode|messages/)
  assert.equal(read(world,'inbox',{id:rooms.items[0].id}).messages.items[0].text,world.conversations[0].messages[0].text)
  assert.equal(read(world,'inbox',{limit:1,offset:rooms.nextOffset}).items[0].id,world.conversations[1].id)
  assert.deepEqual(read(world,'inbox',{id:'missing'}),{conversation:null})
  const owner = {runId:world.runId,memories:[{id:'1',text:'กำหนดวันหยุดร้าน',at:world.clock}],messages:[{text:'owner chat history'}]}
  assert.equal(read(world,'memories',{},owner).items[0].text,'กำหนดวันหยุดร้าน')
  assert.doesNotMatch(JSON.stringify(read(world,'memories',{},owner)),/owner chat history/)
  assert.deepEqual(read(world,'memories',{}, { ...owner,runId:'different-run' }),{available:false})
  assert.equal(read(world,'briefs',{status:'failed'}).items[0].mail.status,'failed')
  assert.equal(read(world,'competitors',{query:'Sonic'}).items[0].source,'ข้อมูลคู่แข่งจำลอง')
  assert.equal(read(world,'news').matching,world.news.length)
  assert.equal(read(world,'policies').matching,0)
  assert.deepEqual(previous,world)
})
