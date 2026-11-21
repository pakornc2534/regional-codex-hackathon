import test from 'node:test'
import assert from 'node:assert/strict'
import { createWebResearchTool } from '../server/live-manager-market.mjs'

const product = {
  id: 'sim-variant-1', productId: 'sim-product-model', sellerSku: 'ROBOT', productName: 'โมเดลหุ่นยนต์ 1/144',
  price: 590, cost: 321, available: 407
}
const citation = { type: 'url_citation', title: 'ข้อมูลสินค้า', url: 'https://manufacturer.example/model' }
const webResult = {
  output: [{ type: 'web_search_call', status: 'completed' }, { type: 'message', content: [{
    type: 'output_text', text: 'ข้อมูลสาธารณะที่ตรวจพบ', annotations: [citation, citation]
  }] }]
}

function setup(t, result = webResult, getSelectedSku = () => 'ROBOT') {
  const requests = []
  const posts = []
  t.mock.method(globalThis, 'fetch', async (_url, request) => {
    requests.push(JSON.parse(request.body))
    return Response.json(result)
  })
  const room = { localParticipant: { sendText: async (text, options) => posts.push({ text: JSON.parse(text), options }) } }
  const readStore = async ({ kind, query }) => {
    assert.equal(kind, 'catalog')
    const matches = [product.productName, product.sellerSku, product.id].some(value => value.toLowerCase() === query.toLowerCase())
    return { data: { items: matches ? [product] : [] } }
  }
  const tool = createWebResearchTool({ room }, 'owner', new AbortController().signal, readStore, getSelectedSku)
  function run(subjects, items, focus = 'competitor_prices') {
    const messages = items.map(item => typeof item === 'string'
      ? { type: 'message', role: 'user', textContent: item } : item)
    return tool.execute({ subjects, focus }, { ctx: { session: { history: { items: messages } } }, abortSignal: new AbortController().signal })
  }
  return { requests, posts, run }
}

test('research follow-up converts a seller SKU to the verified public product name and publishes dated citations', async t => {
  const { run, requests, posts } = setup(t)
  const answer = await run([product.productName], ['SKU ROBOT เหลือกี่ชิ้น ต้นทุนและราคาขายเท่าไร', 'คู่แข่งขายรุ่นนี้เท่าไหร่'])
  assert.equal(answer.source, 'public_web')
  assert.deepEqual(JSON.parse(requests[0].input), { productsOrCategories: [product.productName] })
  assert.equal(requests[0].store, false)
  assert.equal(requests[0].tools[0].external_web_access, true)
  assert.equal(posts.length, 1)
  assert.deepEqual(posts[0].options, { topic: 'raan.sources', destinationIdentities: ['owner'] })
  assert.equal(answer.sources.length, 1)
  assert.equal(posts[0].text.searchedAt, answer.searchedAt)
  assert.ok(Number.isFinite(Date.parse(answer.searchedAt)))
  for (const value of ['ROBOT', '407', '321', '590', 'sim-variant', 'ต้นทุน']) assert.ok(!requests[0].input.includes(value))
})

test('the owner can research a new product with no catalog match and change from demand to product features', async t => {
  const { run, requests } = setup(t)
  assert.equal((await run(['กระเป๋าผ้า'], ['ร้านเรามีกระเป๋าผ้าไหม', 'วิเคราะห์ตลาดรุ่นนี้เพิ่มเติมหน่อย'], 'demand')).source, 'public_web')
  assert.equal((await run(['Bandai', 'Daban'], ['เปรียบเทียบจุดเด่น Bandai กับ Daban ให้หน่อย'], 'features')).source, 'public_web')
  assert.deepEqual(JSON.parse(requests[0].input).productsOrCategories, ['กระเป๋าผ้า'])
  assert.deepEqual(JSON.parse(requests[1].input).productsOrCategories, ['Bandai', 'Daban'])
  assert.match(requests[0].instructions, /ความต้องการ/)
  assert.match(requests[1].instructions, /สเปก/)
})

test('explicit references to the active shop display resolve to its catalog product', async t => {
  const { run, requests } = setup(t)
  const answer = await run(['สินค้าบนแท่น'], ['สินค้าบนแท่นคืออะไร', 'แล้วคู่แข่งขายตัวนี้อย่างไร'])
  assert.equal(answer.source, 'public_web')
  assert.deepEqual(JSON.parse(requests[0].input).productsOrCategories, [product.productName])
})

test('bare competitor follow-ups recover the nearest explicitly discussed product, including an item absent from the shop', async t => {
  const { run, requests } = setup(t, webResult, () => { throw Error('screen not available') })
  const cases = [
    ['SKU ROBOT ราคาเท่าไหร่', 'คู่แข่งล่ะ', 'ROBOT', product.productName],
    ['ร้านเรามีกระเป๋าผ้าไหม', 'ร้านอื่นขายเท่าไหร่', 'รุ่นนี้', 'กระเป๋าผ้า'],
    ['SKU ROBOT ราคาเท่าไหร่', 'แล้วรุ่นนี้เท่าไรในตลาด', 'รุ่นนี้', product.productName]
  ]
  for (const [previous, latest, subject, expected] of cases) {
    assert.equal((await run([subject], [previous, latest])).source, 'public_web')
    assert.deepEqual(JSON.parse(requests.at(-1).input).productsOrCategories, [expected])
  }
})

test('a newer named product takes precedence over a previously selected display item', async t => {
  const { run, requests } = setup(t)
  const history = ['สินค้าบนแท่นคืออะไร', 'ร้านเรามีกระเป๋าผ้าไหม', 'แล้วร้านอื่นขายเท่าไหร่']
  assert.equal((await run(['รุ่นนี้'], history)).source, 'public_web')
  assert.deepEqual(JSON.parse(requests[0].input).productsOrCategories, ['กระเป๋าผ้า'])
})

test('a comparison combines only the explicit public brand and the verified selected catalog item', async t => {
  const { run, requests } = setup(t)
  const previous = 'ตอนนี้ฉันกำลังดูหน้าไหน แล้วสินค้าบนแท่นที่ฉันเลือกอยู่ชื่ออะไร ราคาเท่าไหร่ เหลือขายกี่ชิ้นคะ'
  const latest = 'แล้วถ้าจะเทียบกับคู่แข่งอย่าง Bandai ช่วยค้นเว็บสดหาราคาของโมเดลสเกลเดียวกับรุ่นเมื่อกี้มาหนึ่งตัวอย่าง พร้อมแหล่งอ้างอิงให้หน่อยค่ะ'
  assert.equal((await run(['Bandai โมเดล 1/144'], [previous, latest])).source, 'public_web')
  assert.deepEqual(JSON.parse(requests[0].input).productsOrCategories, ['Bandai โมเดลหุ่นยนต์ 1/144'])
  assert.equal((await run(['Bandai โมเดล 1/144'], ['SKU ROBOT ราคาเท่าไร', 'ราคาตลาดของ Bandai เทียบกับรุ่นนี้ล่ะ'])).source, 'public_web')
  assert.deepEqual(JSON.parse(requests[1].input).productsOrCategories, ['Bandai โมเดลหุ่นยนต์ 1/144'])
  for (const invalid of ['Bandai 407 โมเดล 1/144', 'Bandai โมเดล 1/14', 'Bandai Gundam โมเดล 1/144', 'ForgottenBrand โมเดล 1/144']) {
    assert.ok((await run([invalid], [previous, latest])).error)
  }
  assert.equal(requests.length, 2)
})

test('uses the owner’s original product when a generated follow-up accidentally includes the Thai question particle', async t => {
  const { run, requests } = setup(t)
  const question = 'แล้วร้านอื่นขายเท่าไหร่'
  for (const subject of ['กระเป๋าผ้าไหม', 'รุ่นนี้']) {
    assert.equal((await run([subject], ['มีกระเป๋าผ้าไหม', question])).source, 'public_web')
    assert.deepEqual(JSON.parse(requests.at(-1).input).productsOrCategories, ['กระเป๋าผ้า'])
  }
})

test('preserves explicit silk as a material and honors a change of product in the current request', async t => {
  const { run, requests } = setup(t)
  for (const [subject, questions] of [
    ['กระเป๋าผ้าไหม', ['มีกระเป๋าผ้าไหมขายไหม', 'คู่แข่งล่ะ']],
    ['รุ่นนี้', ['มีกระเป๋าผ้าไหมขายไหม', 'คู่แข่งล่ะ']],
    ['กระเป๋าผ้าไหม', ['มีกระเป๋าผ้าไหม', 'แล้วราคาตลาดล่ะ ขอเปลี่ยนเป็นกระเป๋าผ้าไหม']],
  ]) {
    assert.equal((await run([subject], questions)).source, 'public_web')
    assert.deepEqual(JSON.parse(requests.at(-1).input).productsOrCategories, ['กระเป๋าผ้าไหม'])
  }
})

test('rejects sensitive terms, internal-only requests, assistant/tool invented subjects and stale owner topics', async t => {
  const { run, requests, posts } = setup(t)
  const cases = [
    [['Somchai'], ['ลูกค้าชื่อ Somchai ฝากถามราคา', 'เทียบคู่แข่งของรุ่นนี้']],
    [['supplier code'], ['หาข้อมูลตลาด supplier code เพิ่ม']],
    [['ALPHA'], ['บันทึก ALPHA ให้หน่อย', 'วิเคราะห์ตลาดตัวนี้']],
    [['sim-order-15'], ['ค้นตลาด sim-order-15']],
    [['ROBOT'], ['ช่วยสรุปยอดขาย ROBOT บน Shopee ในร้านเรา']],
    [['ROBOT'], ['วิเคราะห์ราคาตลาด ROBOT ไม่ต้องค้นเว็บ']],
    [['SecretBrand'], [{ type: 'message', role: 'assistant', textContent: 'แนะนำ SecretBrand' }, 'วิเคราะห์ตลาดตัวนี้']],
    [['SecretBrand'], [{ type: 'function_call_output', textContent: 'SecretBrand' }, 'วิเคราะห์ตลาดตัวนี้']],
    [['Bandai'], ['รีวิวสินค้า Bandai', 'ถัดมา', 'งานอะไร', 'ยอดขาย', 'ออเดอร์', 'รุ่นนี้เทียบตลาดอย่างไร']],
  ]
  for (const [subjects, turns] of cases) assert.ok((await run(subjects, turns)).error)
  assert.deepEqual(requests, [])
  assert.deepEqual(posts, [])
})

test('a provider answer without a completed live search or valid citations cannot be represented as fresh research', async t => {
  for (const result of [
    { output: webResult.output.slice(1) },
    { output: [webResult.output[0], { type: 'message', content: [{ type: 'output_text', text: 'ไม่ยืนยัน', annotations: [] }] }] },
  ]) {
    const { run, posts } = setup(t, result)
    assert.ok((await run(['Bandai'], ['คู่แข่ง Bandai ราคาตลาดเท่าไหร่'])).error)
    assert.deepEqual(posts, [])
    t.mock.restoreAll()
  }
})
