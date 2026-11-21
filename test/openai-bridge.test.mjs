import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {setTimeout as delay} from 'node:timers/promises'
import {manager} from '../server/manager-controller.mjs'
import {chooseOption} from '../server/approved-actions.mjs'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createBridge} from '../server/bridge.mjs'
import {createModelBudget} from '../server/model-budget.mjs'
import {customerChat} from '../server/customer-chat.mjs'
import {openShop} from '../server/persistence.mjs'

async function setup(t, respond, limit = 4) {
  const dir = await mkdtemp(join(tmpdir(), 'shop-model-test-'))
  t.after(() => rm(dir, {recursive:true, force:true}))
  const calls = []
  const server = createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    res.setHeader('content-type', 'application/json')
    if (req.url.startsWith('/v1/models/')) {
      res.end(JSON.stringify({id:'test-model', object:'model'})); return
    }
    const body = JSON.parse(raw)
    calls.push(body)
    const {code = 200, data} = respond(body, calls.length)
    res.writeHead(code)
    res.end(JSON.stringify(data))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  const env = {MODEL_PROVIDER:'openai', OPENAI_MODEL:'test-model', OPENAI_API_KEY:'fixture-local-only',
    OPENAI_BASE_URL:'http://127.0.0.1:'+server.address().port+'/v1', DATA_DIR:dir, AI_DAILY_CAP:String(limit)}
  return {env, dir, calls}
}
const contextTool = {type:'function', name:'sim_get_context', description:'shop context', inputSchema:{type:'object',properties:{}}}
const request = {prompt:'ยอดของร้าน', tools:[contextTool], signal:new AbortController().signal}
const answer = content => ({data:{choices:[{finish_reason:'stop',message:{role:'assistant',content}}]}})
const toolRequest = (name, args = {}) => ({data:{choices:[{finish_reason:'tool_calls',message:{role:'assistant',tool_calls:[
  {id:'shop-call',type:'function',function:{name,arguments:JSON.stringify(args)}}
]}}]}})

test('OpenAI uses only registered shop tools, meters each completion and preserves the cap across shop resets', async t => {
  const {env,calls,dir} = await setup(t, (body,n) => n === 1 ? toolRequest('sim_get_context') : answer('พร้อม'), 2)
  const manager = createBridge(env)
  await manager.connect()
  assert.equal(manager.status,'ready')
  const result = await manager.run({...request,call:(name,args)=>{
    assert.equal(name,'sim_get_context');assert.deepEqual(args,{});return {available:407}
  }})
  assert.equal(result,'พร้อม')
  assert.deepEqual(calls.map(c=>c.model),['test-model','test-model'])
  assert.deepEqual(calls[0].tools.map(t=>t.function.name),['sim_get_context'])
  assert.deepEqual(calls[1].messages.at(-1),{role:'tool',tool_call_id:'shop-call',content:'{"available":407}'})
  const shop = openShop(dir);shop.reset()
  const buyer = customerChat(shop,createBridge(env))
  let admitted = 0
  assert.equal(buyer.submit({message:'SONIC'},()=>{admitted++}).source,'catalog')
  assert.throws(()=>buyer.submit({message:'แรบบิทคุง'},()=>{admitted++}),/เพดาน/)
  assert.equal(admitted,0)
  await assert.rejects(createBridge(env).run(request),/เพดาน/)
  assert.equal(calls.length,2)
})

test('OpenAI fails closed on missing credentials, disabled AI, out-of-scope functions and external research', async t => {
  const {env,calls} = await setup(t, ()=>toolRequest('sim_out_of_scope'))
  const bridge = createBridge(env)
  await assert.rejects(bridge.run({...request,research:true}),/ค้นเว็บ/)
  assert.equal(calls.length,0)
  let called = false
  await assert.rejects(bridge.run({...request,call:()=>{called = true}}),/เครื่องมือ/)
  assert.equal(called,false)
  assert.equal(calls.length,1)
  env.DEMO_AI_ENABLED='false'
  await assert.rejects(bridge.run(request),/ปิดการใช้ AI/)
  const buyer = customerChat(openShop(env.DATA_DIR),bridge)
  assert.equal(buyer.submit({message:'SONIC'}).source,'catalog')
  assert.throws(()=>buyer.submit({message:'คำค้นใกล้เคียง'}),/ปิดการใช้ AI/)
  env.DEMO_AI_ENABLED='true'
  env.OPENAI_API_KEY=''
  await assert.rejects(createBridge(env).connect(),/OPENAI_API_KEY/)
  assert.equal(calls.length,1)
})

test('the OpenAI SDK does not silently retry a rejected call or expose provider error data', async t => {
  const {env,calls} = await setup(t,()=>({code:429,data:{error:{code:'rate_limit_exceeded',message:'private upstream request data'}}}),1)
  const bridge = createBridge(env)
  await assert.rejects(bridge.run(request), e=> /429/.test(e.message) && !e.message.includes('private upstream'))
  await assert.rejects(bridge.run(request), /เพดาน/)
  assert.equal(calls.length,1)
  assert.equal(bridge.status,'disconnected')
})

test('durable quota rolls over at midnight Bangkok independently of the simulated shop clock', async t => {
  const dir=await mkdtemp(join(tmpdir(),'shop-meter-day-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  const env={DATA_DIR:dir,AI_DAILY_CAP:'1'}
  const before=()=>new Date('2026-11-21T16:59:59.999Z')
  const after=()=>new Date('2026-11-21T17:00:00Z')
  createModelBudget(env,before).reserve()
  assert.throws(()=>createModelBudget(env,before).reserve(),/เพดาน/)
  createModelBudget(env,after).reserve()
  assert.throws(()=>createModelBudget(env,after).reserve(),/เพดาน/)
})

test('OpenAI manager proposes a scoped reply, the owner verifies its destination, and the buyer shares the model budget', {timeout:5000}, async t => {
  const customerText = 'SONIC เหลือพร้อมขาย 1 ชิ้นครับ'
  const {env,dir,calls} = await setup(t, (body,n) => {
    if (!body.tools) return answer('["SONIC"]')
    if (n === 1) return toolRequest('sim_get_context')
    if (n === 2) return toolRequest('sim_propose_options', {options:[{
      actionType:'customer_reply', title:'แจ้งของที่เหลือ', reason:'ตรวจจำนวนพร้อมขายแล้ว', text:customerText,
    }]})
    return answer('รอเจ้าของเลือกข้อความที่จะส่ง')
  }, 4)
  const shop = openShop(dir)
  shop.editOwner(owner => owner.memories.push({text:'private-settings-never-for-buyers'}))
  const finished = Promise.withResolvers()
  const controller = manager(shop,() => {
    const reply = shop.owner.messages.at(-1)
    if (reply?.status === 'completed') finished.resolve()
    if (reply?.status === 'failed') finished.reject(Error(reply.text))
  },createBridge(env))
  const buyer = customerChat(shop,createBridge(env))
  t.after(() => {controller.close();buyer.close()})
  const caseId = 'sim-case-sonic-reply'
  const conversationId = shop.world.cases.find(row => row.id === caseId).entityRefs.conversationId
  const inbox = () => shop.world.conversations.find(row => row.id === conversationId)
  const messageCount = inbox().messages.length
  controller.enqueue({room:'case',caseId,message:'ร่างข้อความแจ้งสต็อก SONIC ให้ตรวจ'})
  await finished.promise
  assert.equal(inbox().messages.length,messageCount)
  const proposal = shop.world.proposals.at(-1)
  assert.equal(proposal.caseId,caseId)
  assert.equal(proposal.source,'ai')
  const receipt = chooseOption(shop,{actor:'owner',runId:shop.world.runId,expectedVersion:shop.world.revision,type:'choose_option',
    caseId,proposalId:proposal.id,optionId:proposal.options[0].id,idempotencyKey:'approve-scoped-choice'})
  assert.equal(receipt.status,'verified')
  assert.equal(inbox().messages.length,messageCount + 1)
  assert.equal(inbox().messages.at(-1).text,customerText)
  const pending = buyer.submit({message:'พวงกุญแจโซนิคสีฟ้า'})
  assert.equal(pending.status,'pending')
  let product
  do {
    await delay(5)
    product = buyer.status(pending.id)
  } while (product.status === 'pending')
  assert.equal(product.source,'ai')
  assert.match(product.text,/SONIC.*เหลือขาย 1 ชิ้น/)
  assert.equal(calls.length,4)
  assert.doesNotMatch(JSON.stringify(calls),/private-settings-never-for-buyers/)
  assert.equal(JSON.parse(calls[1].messages.at(-1).content).products[0].variants[0].available,1)
  assert.equal(calls[3].tools,undefined)
  assert.throws(()=>buyer.submit({message:'คำค้นใหม่'}),/เพดาน/)
  await assert.rejects(createBridge(env).run(request),/เพดาน/)
})
