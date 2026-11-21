import assert from 'node:assert/strict'
import {test} from 'node:test'
import {seedWorld} from '../server/domain/index.mjs'
import {readManagerCatalog} from '../server/domain/live-manager-catalog.mjs'

test('spoken Thai, multiword variants and inventory numbers resolve against the current shop', () => {
  const world = seedWorld()
  const lookup = query => readManagerCatalog(world,{query}).items.map(row => row.sellerSku)
  assert.deepEqual(lookup('ช่วยเช็กราคาหุ่นยนต์ให้หน่อยครับ'),['ROBOT'])
  assert.deepEqual(lookup('ช่วยดูราคาโซนิคให้หน่อย'),['SONIC'])
  assert.deepEqual(lookup('Kiss me แบบแยกชิ้นรุ่นซีดี'),['KISS-S-CD'])
  assert.deepEqual(lookup('แผ่นซีดีของบีเอ็นเค48'),['KISS-B-CD','KISS-S-CD'])
  assert.deepEqual(lookup('ฟิกเกอร์ของ Hello Kitty รุ่น A'),['KITTY-A'])
  assert.deepEqual(lookup('ของสะสม'),['SONIC','FORTUNE'])
  assert.deepEqual(lookup('ｓｏｎｉｃ'),['SONIC'])
  assert.deepEqual(lookup('＊'),[])
  assert.deepEqual(lookup('missing sku'),[])
  assert.deepEqual(lookup('กระเป๋าผ้า Hello Kitty'),[])
  const result = readManagerCatalog(world,{query:'ในร้านเรามีกระเป๋าผ้าขายไหมคะ'})
  assert.equal(result.matching,0)
  assert.equal(result.catalog.productCount,9)
  assert.equal(result.catalog.variantCount,13)
  assert.equal(new Set(result.suggestions.map(name => world.products.find(product => product.name === name)?.category)).size,4)
  assert.ok(result.suggestions.every(name => world.products.some(product => product.name === name)))

  world.products.push({id:'new-bag',category:'กระเป๋า',name:'กระเป๋าผ้าแคนวาส',variants:[
    {id:'bag-m',sellerSku:'TOTE-M',name:'กลาง',price:199,cost:null,available:7,physical:9,reserved:2},
  ]})
  const added = readManagerCatalog(world,{query:'ในร้านเรามีกระเป๋าผ้าขายไหมคะ'})
  assert.deepEqual(added.items.map(row => [row.sellerSku,row.price,row.available,row.cost]),[['TOTE-M',199,7,null]])
})

test('catalog returns bounded pages and applies price and stock filters before paging', () => {
  const world = seedWorld()
  const variants = world.products.flatMap(product => product.variants)
  const filtered = variants.filter(row => row.price >= 89 && row.price <= 590 && row.available >= 1)
  const read = offset => readManagerCatalog(world,{minPrice:89,maxPrice:590,minAvailable:1,limit:2,offset})
  let page = read(0)
  assert.equal(page.matching,filtered.length)
  const ids = []
  while (true) {
    ids.push(...page.items.map(row => row.id))
    if (page.nextOffset === null) break
    page = read(page.nextOffset)
  }
  assert.deepEqual(ids,filtered.map(row => row.id))
  variants[0].available = null
  const soldOut = readManagerCatalog(world,{maxAvailable:0})
  assert.ok(soldOut.matching > 0)
  assert.ok(soldOut.items.every(row => row.available === 0))
  for (const query of ['แค็ตตาล็อกมีสินค้าอะไรบ้าง','ขอดูรายการสินค้าทั้งหมด','ในร้านเรามีอะไรขายบ้าง']) {
    assert.deepEqual(readManagerCatalog(world,{query}).items.map(row => row.id), variants.map(row => row.id))
  }
  for (const input of [{limit:26},{offset:-1},{maxPrice:null},{minPrice:300,maxPrice:50},{maxAvailable:2.1}]) {
    assert.throws(() => readManagerCatalog(world,input))
  }
})
