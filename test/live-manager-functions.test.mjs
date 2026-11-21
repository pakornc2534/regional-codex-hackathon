import test from 'node:test'
import assert from 'node:assert/strict'
import { seedWorld } from '../server/domain/simulator.mjs'
import { readLiveManagerTool } from '../server/domain/live-manager-tools.mjs'
import { createViewReader, createShopTools } from '../server/live-manager-functions.mjs'

test('Ready resolves the current display on each turn and looks up the selected variant in the shop', async () => {
  const world = seedWorld()
  const [robot, sonic] = ['ROBOT','SONIC'].map(sku => world.products.flatMap(row => row.variants).find(v => v.sellerSku === sku))
  let current = {page:'scene',selectedVariantId:robot.id}
  const room = {localParticipant:{performRpc: async request => {
    assert.equal(request.destinationIdentity,'owner')
    assert.equal(request.method,'raan.current-view')
    return JSON.stringify(current)
  }}}
  const tools = createShopTools(payload => readLiveManagerTool(world,payload),createViewReader(room,'owner'))
  const view = tools.find(tool => tool.name === 'read_current_view')
  assert.equal((await view.execute({})).selectedProduct.price,590)
  current = {...current,selectedVariantId:sonic.id}
  const answer = await view.execute({})
  assert.equal(answer.pageTitle,'ร้าน 3D')
  assert.equal(answer.selectedProduct.sellerSku,'SONIC')
  assert.equal(answer.selectedProduct.available,1)
  current = {page:'plan',selectedVariantId:robot.id,plan:{variantId:robot.id,mode:'ads',dailyBudget:275,days:3}}
  const {plan} = await view.execute({})
  const {variantId,mode,...inputs} = plan
  const projection = await tools.find(tool => tool.name === 'read_growth').execute({variantId,mode,inputs})
  assert.equal(projection.data.adSpend,825)
  current = {page:'inbox',conversationId:world.conversations[0].id}
  assert.equal((await view.execute({})).conversationId,world.conversations[0].id)
  current = {page:'finance'}
  assert.equal((await view.execute({})).selectedProduct,null)
  current = {page:'scene',selectedVariantId:robot.id,price:1}
  assert.ok((await view.execute({})).error)
})

test('catalog miss names the requested material even if the model includes the Thai question particle', async () => {
  const world = seedWorld()
  const catalog = createShopTools(payload => readLiveManagerTool(world,payload),async () => ({})).find(tool => tool.name === 'read_catalog')
  function ask(query, textContent) {
    return catalog.execute({query},{ctx:{session:{history:{items:[{type:'message',role:'user',textContent}]}}}})
  }
  const cottonBag = await ask('กระเป๋าผ้าไหม','มีกระเป๋าผ้าไหม')
  assert.equal(cottonBag.searchedFor,'กระเป๋าผ้า')
  assert.match(cottonBag.catalogFinding,/“กระเป๋าผ้า”/u)
  assert.equal(cottonBag.data.matching,0)
  assert.ok(cottonBag.data.suggestions.length)
  assert.equal((await ask('กระเป๋าผ้าไหม','มีกระเป๋าผ้าไหมขายไหม')).searchedFor,'กระเป๋าผ้าไหม')
})
