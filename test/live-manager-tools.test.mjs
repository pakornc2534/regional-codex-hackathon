import assert from 'node:assert/strict'
import {test} from 'node:test'
import {growthPlan,readWorld,seedWorld} from '../server/domain/index.mjs'
import {readLiveManagerTool} from '../server/domain/live-manager-tools.mjs'

test('live manager reads the same sales, queue, and capacity as the shop', () => {
  const world = seedWorld()
  const dashboard = readWorld(world)
  const answer = readLiveManagerTool(world,{kind:'summary'})
  assert.equal(answer.source,'simulated')
  assert.equal(answer.shopName,'bankzar')
  assert.equal(answer.observedAt,world.clock)
  assert.equal(answer.revision,world.revision)
  assert.equal(answer.data.coverage,'complete')
  assert.deepEqual(answer.data.period,dashboard.metrics.period)
  assert.equal(answer.data.sales.total,dashboard.metrics.sales7d)
  assert.equal(answer.data.sales.paidOrders,dashboard.metrics.orders7d)
  assert.equal(answer.data.queueOrders,dashboard.metrics.queueOrders)
  assert.deepEqual(answer.data.capacity,dashboard.capacity)

  const singleDay = '2026-10-01'
  const row = dashboard.metrics.daily.find(row => row.date === singleDay)
  const {data} = readLiveManagerTool(world,{kind:'summary',from:singleDay,to:singleDay})
  assert.equal(data.sales.total,row.online + row.pos)
  assert.equal(data.sales.paidOrders,row.orders)
  const unavailable = readLiveManagerTool(world,{kind:'summary',from:'2027-01-01',to:'2027-01-01'}).data
  assert.equal(unavailable.coverage,'unavailable')
  assert.equal(unavailable.sales,null)
  const partial = readLiveManagerTool(world,{kind:'summary',from:'2026-09-01',to:'2026-09-07'}).data
  assert.equal(partial.coverage,'partial')
  assert.equal(partial.coveredPeriod.from,world.source.period.from)
})

test('matching product and order reads stay bounded and exclude customer records', () => {
  const world = seedWorld()
  const read = input => readLiveManagerTool(world,input).data
  const [sonic] = read({kind:'products',query:'ｓｏｎｉｃ'})
  assert.equal(sonic.available,1)
  assert.equal(sonic.price,249)
  assert.equal(read({kind:'products',query:'ROBOT'})[0].available,407)
  assert.deepEqual(read({kind:'products',query:'missing sku'}),[])
  const {items,matching} = read({kind:'orders',id:'SIM-ORDER-SONIC'})
  assert.equal(matching,1)
  assert.equal(items[0].items[0].sku,'SONIC')
  assert.equal(items[0].fulfillmentStatus,'picking')
  assert.doesNotMatch(JSON.stringify(items),/customerId|conversationId|tracking|messages/)
  assert.equal(read({kind:'orders',status:'picking',limit:2}).items.length,2)
  assert.doesNotMatch(JSON.stringify(read({kind:'cases'})),/history|entityRefs|messages|evidence/)
  assert.doesNotMatch(JSON.stringify(read({kind:'campaigns'})),/attributedOrderIds/)
  assert.deepEqual(read({kind:'supplies'}).map(row => row.free),readWorld(world).supplies.map(row => row.free))
})

test('growth runs the existing calculator without modifying any shop records', () => {
  const world = seedWorld()
  const robot = world.products.flatMap(row => row.variants).find(row => row.sellerSku === 'ROBOT')
  const snapshot = structuredClone(world)
  const input = {variantId:robot.id,mode:'ads',dailyBudget:300,days:1}
  const expected = growthPlan(world,input)
  const {data} = readLiveManagerTool(world,{
    kind:'growth',variantId:input.variantId,mode:input.mode,inputs:{dailyBudget:input.dailyBudget,days:input.days}
  })
  assert.equal(data.adSpend,expected.adSpend)
  assert.equal(data.planDemand,expected.planDemand)
  assert.equal(data.requiredTotalUnits,expected.requiredTotalUnits)
  assert.deepEqual(world,snapshot)
})

test('invalid tool calls fail clearly instead of widening the scope', () => {
  const world = seedWorld()
  const read = input => readLiveManagerTool(world,input)
  assert.throws(() => read({kind:'summary',from:'2026-02-31',to:'2026-03-05'}),/YYYY-MM-DD/)
  assert.throws(() => read({kind:'orders',status:'unknown'}),/สถานะออเดอร์/)
  assert.throws(() => read({kind:'orders',limit:100}),/1 ถึง 25/)
  assert.throws(() => read({kind:'growth',inputs:{variantId:'unexpected'}}),/ระบุรหัสรุ่น/)
  assert.throws(() => read({kind:'growth',variantId:'sim-variant-1',inputs:{variantId:'overwrite'}}),/สมมติฐาน/)
  assert.throws(() => read({kind:'cancel_order'}),/ไม่รู้จักข้อมูลร้าน/)
  assert.throws(() => readLiveManagerTool({...world,shop:{...world.shop,mode:'live'}},{kind:'summary'}),/ร้านจำลอง/)
})
