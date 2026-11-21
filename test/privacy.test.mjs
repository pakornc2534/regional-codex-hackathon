import assert from 'node:assert/strict'
import {test} from 'node:test'
import {managerContext,seedWorld} from '../server/domain/index.mjs'
import {chooseOption} from '../server/approved-actions.mjs'
import {manager} from '../server/manager-controller.mjs'

const caseId = 'sim-case-sonic-reply'

function createShop() {
  const world = seedWorld()
  const item = world.cases.find(row => row.id === caseId)
  const inbox = world.conversations.find(row => row.id === item.entityRefs.conversationId)
  const other = world.conversations.find(row => row.id !== inbox.id)
  const order = world.orders.find(row => row.conversationId === inbox.id)
  world.products.find(product => product.variants.some(row => row.id === item.entityRefs.variantId)).variants.push({
    ...world.products[0].variants[0], id:'sim-sibling', sellerSku:'PRIVATE-SIBLING'
  })
  inbox.internalNote = 'PRIVATE-INBOX'
  item.history.push({memo:'PRIVATE-CASE'})
  order.costs = {memo:'PRIVATE-SETTLEMENT'}
  other.messages.push({author:'customer',text:'PRIVATE-OTHER-BUYER'})
  const owner = {
    memories:[{text:'PRIVATE-MEMORY'}],
    messages:[
      {room:'overview',caseId:null,role:'owner',text:'PRIVATE-OWNER-ROOM'},
      {room:'case',caseId,role:'manager',text:'PRIVATE-LEGACY-ANSWER'},
      {room:'case',caseId,role:'manager',status:'failed',replyContextVersion:1,runId:world.runId,text:'PRIVATE-ERROR'},
      {room:'case',caseId,role:'owner',replyContextVersion:1,runId:'old-run',text:'PRIVATE-PREVIOUS-RUN'},
      {room:'case',caseId:'another-case',role:'owner',replyContextVersion:1,runId:world.runId,text:'PRIVATE-OTHER-CASE'},
    ]
  }
  return {world,owner,saveWorld(next){this.world = next},editOwner(fn){fn(owner)}}
}

test('a customer reply receives only the linked conversation, order status and public selling facts', () => {
  const shop = createShop()
  const ctx = managerContext(shop.world,{caseId})
  assert.doesNotMatch(JSON.stringify(ctx),/PRIVATE-/)
  assert.equal(ctx.products[0].variants.length,1)
  assert.deepEqual(ctx.products[0].variants[0],{
    id:'sim-variant-11', sellerSku:'SONIC', name:'รุ่นมาตรฐาน', price:249, available:1
  })
  assert.equal(ctx.conversation.messages[0].text,'พวงกุญแจ Sonic ยังมีของไหมคะ')
  assert.deepEqual(ctx.orders.map(row => row.id),['sim-order-unpaid'])
  assert.equal(ctx.orders[0].paymentStatus,'unpaid')
  assert.equal(ctx.contextCoverage.totalOrders,1)
  for (const key of ['metrics','defaults','supplies','campaigns']) assert.equal(Object.hasOwn(ctx,key),false)
  for (const key of ['costs','settlement','documents']) assert.equal(Object.hasOwn(ctx.orders[0],key),false)
  assert.equal(ctx.capabilities.calculate,false)
  assert.ok(managerContext(shop.world).metrics.sales7d > 0)
  assert.ok(managerContext(shop.world).defaults.cash > 0)
})

test('reply jobs keep legacy private chat, owner plans and calculations outside every model call', async () => {
  const shop = createShop()
  const responses = []
  const pending = []
  const bridge = {run: async input => {
    const handler = responses.shift()
    if (!handler) throw Error('unexpected model call')
    return handler(input)
  },close(){}}
  const controller = manager(shop,() => {
    for (const entry of pending) {
      const row = shop.owner.messages.find(message => message.id === entry.id)
      if (row?.status === 'completed') entry.resolve(row)
      if (row?.status === 'failed') entry.reject(Error(row.text))
    }
  },bridge)
  function run(payload,handler) {
    responses.push(handler)
    const {jobId} = controller.enqueue(payload)
    return new Promise((resolve,reject) => pending.push({id:jobId,resolve,reject}))
  }
  let proposal
  try {
    await run({caseId,room:'research',message:'ช่วยร่างคำตอบ',research:true,variantId:'PRIVATE-SKU',plan:{variantId:'PRIVATE-SKU'}},
      async ({prompt,tools,call,research}) => {
        assert.doesNotMatch(prompt,/PRIVATE-/)
        assert.equal(JSON.parse(prompt).instruction,'ช่วยร่างคำตอบ')
        assert.equal(research,false)
        assert.deepEqual(tools.map(({name})=>name),['sim_get_context','sim_propose_options','sim_execute_approved'])
        assert.throws(() => call('sim_calculate_growth',{variantId:'sim-variant-1'}))
        assert.throws(() => call('sim_calculate_impact',{}))
        assert.doesNotMatch(JSON.stringify(call('sim_get_context',{})),/PRIVATE-/)
        proposal = call('sim_propose_options',{options:[{actionType:'customer_reply',title:'ตอบเรื่องสต็อก',reason:'ตรวจจากจำนวนที่เหลือ',text:'Sonic เหลือ 1 ชิ้นค่ะ'}]})
        assert.doesNotMatch(JSON.stringify(proposal),/PRIVATE-/)
        return 'เสนอข้อความเกี่ยวกับ Sonic แล้ว'
      })
    const receipt = chooseOption(shop,{actor:'owner',runId:shop.world.runId,expectedVersion:shop.world.revision,type:'choose_option',
      caseId,proposalId:proposal.id,optionId:proposal.options[0].id,idempotencyKey:'approve-reply'})
    assert.equal(receipt.status,'verified')
    await run({caseId,room:'case',message:'ส่งข้อความไหนแล้ว'},async ({prompt,call}) => {
      assert.doesNotMatch(prompt,/PRIVATE-/)
      assert.match(prompt,/เสนอข้อความเกี่ยวกับ Sonic แล้ว/)
      const verified = call('sim_execute_approved',{idempotencyKey:'approve-reply'})
      assert.doesNotMatch(JSON.stringify(verified),/PRIVATE-/)
      assert.equal(verified.message.text,'Sonic เหลือ 1 ชิ้นค่ะ')
      assert.equal(verified.verification.id,verified.message.id)
      return 'ตรวจข้อความที่ส่งแล้ว'
    })
    await run({room:'overview',message:'ดูยอดรวมร้าน'},async ({prompt,tools,call}) => {
      assert.match(prompt,/PRIVATE-MEMORY/)
      assert.ok(tools.some(tool => tool.name === 'sim_calculate_growth'))
      assert.ok(call('sim_get_context',{}).metrics.sales7d > 0)
      return 'ตรวจยอดแล้ว'
    })
  } finally {
    controller.close()
  }
})
