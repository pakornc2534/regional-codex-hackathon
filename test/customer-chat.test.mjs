import test from 'node:test'
import assert from 'node:assert/strict'
import {customerChat} from '../server/customer-chat.mjs'
import {seedWorld} from '../server/domain/simulator.mjs'

test('catalog, FAQ, and greetings bypass Codex while fuzzy product names use it', async () => {
  const shop = {world: seedWorld()}
  const sonic = shop.world.products.flatMap(product => product.variants).find(variant => variant.sellerSku === 'SONIC')
  let calls = 0
  const customer = customerChat(shop, {async run() { calls++; return '["SONIC"]' }})
  const catalog = customer.submit({message:'Sonic ยังมีของไหม'})
  assert.equal(catalog.status,'completed')
  assert.equal(catalog.source,'catalog')
  assert.match(catalog.text,/฿249 · เหลือขาย 1 ชิ้น/)
  sonic.available = 0
  assert.match(customer.submit({message:'SONIC'}).text,/สินค้าหมด/)
  assert.match(customer.submit({message:'Sonic ค่าส่งเท่าไหร่'}).text,/ไม่มีค่าส่ง/)
  assert.equal(customer.submit({message:'สวัสดีครับ'}).status,'completed')
  assert.equal(calls,0)

  const job = customer.submit({message:'พวงกุญแจโซนิคสีฟ้า'})
  assert.equal(job.status,'pending')
  assert.equal(calls,1)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(customer.status(job.id).source,'ai')
  assert.match(customer.status(job.id).text,/SONIC.*สินค้าหมด/)
})

test('model admission is checked only for a fuzzy lookup and a rejection leaves the customer able to retry', async () => {
  const shop = {world:seedWorld()}
  let calls = 0
  const chat = customerChat(shop, {async run() { calls++;return '["SONIC"]' }})
  const limit = () => { throw Error('คำถามถี่เกินไป') }
  assert.equal(chat.submit({message:'SONIC'},limit).source,'catalog')
  assert.equal(chat.submit({message:'ค่าส่งเท่าไหร่'},limit).source,'catalog')
  assert.throws(()=>chat.submit({message:'พวงกุญแจโซนิคสีฟ้า'},limit),/ถี่เกินไป/)
  assert.equal(calls,0)
  const job = chat.submit({message:'พวงกุญแจโซนิคสีฟ้า'})
  assert.equal(job.status,'pending')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(chat.status(job.id).source,'ai')
  assert.equal(calls,1)
})
