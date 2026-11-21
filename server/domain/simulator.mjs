import {randomUUID} from 'node:crypto'

export const dayMs = 86_400_000
export const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100
export const bangkokDate = time => new Date(new Date(time).getTime() + 7 * 3_600_000).toISOString().slice(0, 10)
export const recipe = size => ({[size]:1,wrap:size === 'large' ? 1.5 : 0.5,tape:1.5,label:1,ink:0.15})
export const atShop = new Set(['picking','packing','ready'])
export const unpacked = new Set(['picking','packing'])
export const orderUnits = order => order.items.reduce((total, item) => total + item.quantity, 0)
export const variantsOf = world => world.products.flatMap(product => product.variants)
export function variantOf(world, id) {
  const variant = variantsOf(world).find(item => item.id === id)
  if (!variant) throw Error('ไม่พบตัวเลือกสินค้านี้')
  return variant
}
export const iso = (date, time) => new Date(date + 'T' + time + '+07:00').toISOString()
const start = '2026-09-04'
const seedClock = iso('2026-10-02','06:50:00')
const rows = [
  ['model','โมเดล','โมเดลหุ่นยนต์ 1/144','regular','ROBOT','สีขาว',590,320,420,16,2,'large'],
  ['forest','ฟิกเกอร์','ฟิกเกอร์กล่องสุ่ม Forest Friends','regular','FOREST','กล่องสุ่ม',290,150,680,25,4,'small'],
  ['kiss-set','การ์ดและเพลง','BNK48 Kiss me ยกชุด','regular','KISS-B-CD','CD',590,330,120,3,1,'small'],
  ['kiss-set','การ์ดและเพลง','BNK48 Kiss me ยกชุด','regular','KISS-B-PH','Photobook',790,430,100,2,1,'small'],
  ['kiss-single','การ์ดและเพลง','BNK48 Kiss me แยกชิ้น','regular','KISS-S-CD','CD',89,35,340,9,2,'small'],
  ['kiss-single','การ์ดและเพลง','BNK48 Kiss me แยกชิ้น','regular','KISS-S-PH','Photobook',149,60,260,6,1,'small'],
  ['kibou','การ์ดและเพลง','Kibouteki Refrain','regular','KIBOU-CD','แพ็ก CD 20 แผ่น',990,540,90,2,0,'large'],
  ['kibou','การ์ดและเพลง','Kibouteki Refrain','regular','KIBOU-PH','แพ็ก Photobook 20 เล่ม',1290,730,70,1,0,'large'],
  ['kitty','ฟิกเกอร์','Yu-Gi-Oh! × Hello Kitty','unconfirmed','KITTY-A','แบบ A',159,65,180,5,1,'small'],
  ['kitty','ฟิกเกอร์','Yu-Gi-Oh! × Hello Kitty','unconfirmed','KITTY-B','แบบ B',159,65,160,4,1,'small'],
  ['sonic','ของสะสม','พวงกุญแจ Sonic','unconfirmed','SONIC','รุ่นมาตรฐาน',249,95,2,0,0,'small'],
  ['fortune','ของสะสม','Fortune ลายเซ็น','unique','FORTUNE','ชิ้นเดียว',1290,650,0,0,0,'small'],
  ['car','โมเดล','รถโมเดลสะสม','unique','RARE-CAR','น้ำเงินพร้อมกล่อง',890,490,1,0,0,'large']
]
const scope = (date, period) => ({source:'simulated',observedAt:date,period,completeness:'complete'})
export function seedWorld({runId = 'sim-run-' + randomUUID()} = {}) {
  const products = []
  const orders = []
  const bySku = new Map()
  for (const [key,category,title,kind,sellerSku,name,price,cost,physical,,,size] of rows) {
    const productId = 'sim-product-' + key
    let product = products.find(item => item.id === productId)
    if (!product) {
      product = {id:productId,shopId:'sim-shop-bankzar',category,name:title,kind,variants:[]}
      products.push(product)
    }
    const variant = {id:'sim-variant-' + (bySku.size + 1),productId,sellerSku,name,price,cost,physical,recipe:recipe(size),updatedAt:seedClock}
    product.variants.push(variant)
    bySku.set(sellerSku,variant)
  }
  function append(sku,date,channel,status,details = {}) {
    const variant = bySku.get(sku)
    const id = details.id ?? 'sim-order-' + (orders.length + 1)
    const createdAt = details.createdAt ?? iso(date,'05:10:00')
    const paid = details.paymentStatus !== 'unpaid'
    const settlementAt = new Date(new Date(createdAt).getTime() + 7 * dayMs).toISOString()
    const fee = roundMoney(variant.price * 0.12)
    const shipment = channel === 'online' && status !== 'picking'
    const recorded = new Date(createdAt).getTime()
    const stageAt = minutes => new Date(recorded + minutes * 60_000).toISOString()
    const events = [{stage:channel === 'online' ? 'picking' : 'taken',at:createdAt}]
    if (shipment) events.push({stage:'ready',at:stageAt(15)})
    if (['delivered','collected','transit'].includes(status)) events.push({stage:'collected',at:stageAt(30)})
    if (['delivered','transit'].includes(status)) events.push({stage:'transit',at:stageAt(40)})
    if (status === 'delivered') events.push({stage:'delivered',at:stageAt(60)})
    orders.push({
      id,channel,customerId:details.customerId ?? 'sim-customer-' + (orders.length + 100),
      conversationId:details.conversationId ?? null,items:[{variantId:variant.id,quantity:1,unitPrice:variant.price}],
      paymentStatus:paid ? 'paid' : 'unpaid',fulfillmentStatus:status,paidAmount:paid ? variant.price : 0,
      createdAt,prepareBy:channel === 'online' ? iso(date,'09:00:00') : null,
      settlement:paid && (channel === 'pos' || settlementAt <= seedClock) ? {amount:channel === 'pos' ? variant.price : roundMoney(variant.price - fee),date:channel === 'pos' ? createdAt : settlementAt} : null,
      costs:paid ? {product:variant.cost,fee:channel === 'online' ? fee : 0} : null,
      events,tracking:shipment ? 'SIM' + id.replace('sim-order-','').toUpperCase() : null
    })
  }
  for (let d = 0; d < 28; d += 1) {
    const date = new Date(Date.parse(start) + d * dayMs).toISOString().slice(0, 10)
    for (const [,,,,sku,,,,,baseOnline,basePos] of rows) {
      let online = baseOnline > 0 ? baseOnline + (d % 7 >= 5 ? 2 : d % 3 - 1) : 0
      if (sku === 'SONIC' && d % 4 === 0) online = 1
      if (sku === 'FORTUNE' && d === 5) online = 1
      if (sku === 'KISS-B-CD' && d === 27) online -= 1
      for (let i = 0; i < online; i += 1) {
        append(sku,date,'online',d <= 24 ? 'delivered' : d === 27 && i < 2 ? 'ready' : d === 27 && i === 2 ? 'picking' : 'collected')
      }
      const pos = basePos > 0 ? basePos + (d % 7 >= 5 ? 1 : 0) : 0
      for (let i = 0; i < pos; i += 1) append(sku,date,'pos','taken')
    }
  }
  const conversations = [
    ['sonic','สอบถาม Sonic ชิ้นสุดท้าย','พวงกุญแจ Sonic ยังมีของไหมคะ'],
    ['tracking','ติดตามพัสดุ Sonic','ขอสอบถามสถานะคำสั่งซื้อ Sonic ครับ'],
    ['kiss','สอบถามชุด Kiss me','ชุด Kiss me แบบ CD ยังสั่งได้ไหมคะ'],
    ['fortune','สอบถาม Fortune ลายเซ็น','Fortune ลายเซ็นยังมีไหมครับ']
  ].map(([key,title,question]) => ({
    id:'sim-conversation-' + key,title,customerId:'sim-customer-' + key,owner:'agent',waitingEpisode:1,acknowledgedEpisode:0,
    messages:[{id:'sim-message-' + key,author:'customer',text:question,at:iso('2026-10-02','06:35:00')}]
  }))
  append('SONIC','2026-10-02','online','picking',{id:'sim-order-sonic',customerId:conversations[1].customerId,conversationId:conversations[1].id})
  append('KISS-B-CD','2026-10-02','online','picking',{id:'sim-order-kiss',customerId:conversations[2].customerId,conversationId:conversations[2].id})
  append('SONIC','2026-10-02','online','picking',{id:'sim-order-unpaid',paymentStatus:'unpaid',customerId:conversations[0].customerId,conversationId:conversations[0].id})
  for (const [sku,count] of [['ROBOT',10],['FOREST',12],['KISS-S-CD',4]]) {
    for (let i = 0; i < count; i += 1) append(sku,'2026-10-02','online','picking')
  }
  const variants = products.flatMap(product => product.variants)
  const materials = [
    ['small','กล่องเล็ก','ใบ',900,6,3],['large','กล่องใหญ่','ใบ',260,12,4],
    ['wrap','กันกระแทก','เมตร',1050,4,2],['tape','เทป','เมตร',2100,0.5,2],
    ['label','ใบปะหน้า','แผ่น',1000,0.8,2],['ink','หมึก','มล.',135,2,3]
  ]
  const supplies = materials.map(([id,name,unit,quantity,unitCost,leadDays]) => ({
    id,name,unit,quantity,unitCost,leadDays,
    openingQuantity:roundMoney(quantity + orders.filter(order => order.paymentStatus === 'paid' && order.channel === 'online' && !unpacked.has(order.fulfillmentStatus))
      .reduce((sum,order) => sum + (variants.find(item => item.id === order.items[0].variantId).recipe[id] ?? 0),0)),
    updatedAt:seedClock
  }))
  for (const variant of variants) {
    const skuOrders = orders.filter(order => order.paymentStatus === 'paid' && order.items[0].variantId === variant.id)
    variant.reserved = skuOrders.filter(order => order.channel === 'online' && atShop.has(order.fulfillmentStatus)).length
    variant.available = variant.physical - variant.reserved
    variant.openingPhysical = variant.physical + skuOrders.length - variant.reserved
  }
  const campaigns = [
    ['sonic','Sonic',120,['SONIC']],['kiss','Kiss me',180,['KISS-B-CD','KISS-B-PH','KISS-S-CD','KISS-S-PH']],
    ['robot','Robot',300,['ROBOT']],['forest','Forest Friends',250,['FOREST']]
  ].map(([key,name,dailyBudget,skus]) => {
    const variantIds = skus.map(sku => bySku.get(sku).id)
    const attributed = orders.filter((order,i) => order.channel === 'online' && order.paymentStatus === 'paid' && bangkokDate(order.createdAt) >= '2026-09-26' && variantIds.includes(order.items[0].variantId) && i % 5 === 0)
    const spend = dailyBudget * 6
    return {id:'sim-campaign-' + key,name,status:'active',dailyBudget,variantIds,spend,clicks:Math.floor(spend / 4),attributedOrderIds:attributed.map(order => order.id),
      attributedSales:attributed.reduce((sum,order) => sum + order.paidAmount,0),period:{from:'2026-09-26',to:'2026-10-02'}}
  })
  const sonic = bySku.get('SONIC')
  const caseRows = [
    ['sonic-reply','product','ตอบลูกค้าเรื่อง Sonic',{variantId:sonic.id,conversationId:conversations[0].id},'high','ลูกค้ารอคำตอบเรื่องสต็อก'],
    ['sonic-prepare','preparation','เตรียมออเดอร์ Sonic ก่อน 09:00',{variantId:sonic.id,orderId:'sim-order-sonic'},'high','ชำระแล้วและยังรอหยิบ'],
    ['sonic-ads','ads','ทบทวนแอด Sonic เมื่อของใกล้หมด',{variantId:sonic.id,campaignId:campaigns[0].id},'medium','เปิดแคมเปญอยู่และเหลือขาย 1 ชิ้น']
  ]
  const cases = caseRows.map(([key,type,title,entityRefs,priority,evidence]) => ({
    id:'sim-case-' + key,type,title,entityRefs,priority,status:'open',evidence:[evidence],analysisVersion:1,history:[{at:seedClock,status:'open'}]
  }))
  const delivery = orders.filter(item => item.fulfillmentStatus === 'delivered').slice(-2)
  return {
    schemaVersion:1,runId,revision:1,clock:seedClock,shop:{id:'sim-shop-bankzar',name:'bankzar',mode:'simulated',timezone:'Asia/Bangkok',platform:'Shopee'},
    source:scope(seedClock,{from:start,to:'2026-10-02'}),defaults:{packingCapacity:120,cash:30000},products,supplies,orders,campaigns,cases,conversations,
    channelStock:variants.map(variant => ({
      platform:'Shopee',shopId:'sim-shop-bankzar',productId:variant.productId,variantId:variant.id,
      desiredQuantity:variant.available,verifiedQuantity:variant.available,syncStatus:'synced',lastSyncedAt:seedClock
    })),
    returns:delivery.map((order,i) => ({id:'sim-return-' + (i + 1),orderId:order.id,items:order.items,stage:i === 0 ? 'transit' : 'received',
      receivedAt:i === 0 ? null : seedClock,inspectionStatus:i === 0 ? 'not_received' : 'waiting'})),
    news:[
      {id:'sim-news-1',title:'ขนส่งปรับรอบรับพัสดุช่วงวันหยุด',summary:'เผื่อเวลาจัดเตรียมออเดอร์และตรวจรอบรับก่อนเปิดแคมเปญ',source:'ประกาศจำลองจากผู้ให้บริการขนส่ง',publishedAt:'2026-10-01',effectiveAt:'2026-10-03',checkedAt:'2026-10-02'},
      {id:'sim-news-2',title:'กิจกรรมส่งเสริมการขายเดือนตุลาคม',summary:'ประเมินวัสดุและสต็อกก่อนเข้าร่วมกิจกรรม',source:'ข่าวตลาดจำลอง',publishedAt:'2026-09-28',effectiveAt:'2026-10-10',checkedAt:'2026-10-02'}
    ],
    competitors:[
      {id:'sim-market-1',name:'ร้านโมเดลตัวอย่าง A',product:'โมเดลหุ่นยนต์ 1/144',price:579,source:'ข้อมูลคู่แข่งจำลอง',observedAt:seedClock},
      {id:'sim-market-2',name:'ร้านฟิกเกอร์ตัวอย่าง B',product:'ฟิกเกอร์กล่องสุ่ม',price:305,source:'ข้อมูลคู่แข่งจำลอง',observedAt:seedClock},
      {id:'sim-market-3',name:'ร้านของสะสมตัวอย่าง C',product:'พวงกุญแจ Sonic',price:269,source:'ข้อมูลคู่แข่งจำลอง',observedAt:seedClock}
    ],
    health:{status:'ตัวอย่างสถานะปกติ',observedAt:iso('2026-09-25','07:00:00'),period:{from:'2026-09-19',to:'2026-09-25'},source:'คำตอบจากแพลตฟอร์มจำลอง'},
    managerPaused:false,acknowledgement:{enabled:false,text:'ได้รับข้อความแล้วค่ะ ขอเวลาตรวจสอบสักครู่นะคะ'},
    policies:[],proposals:[],receipts:{},audit:[],movements:[],briefs:[],mail:[],plans:[]
  }
}
