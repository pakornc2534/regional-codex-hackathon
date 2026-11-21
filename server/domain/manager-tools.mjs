import {randomUUID} from 'node:crypto'
import {variantOf} from './simulator.mjs'
import {readWorld} from './shop-business.mjs'

const allowed = {
  product:['customer_reply'],
  preparation:['prepare_order'],
  ads:['campaign_pause','campaign_reduce','campaign_increase','campaign_enable']
}
export function notFound(message) {
  throw Object.assign(Error(message),{status:404})
}
export function conflict(message) {
  throw Object.assign(Error(message),{status:409})
}
export function boundedText(value,max = 1500) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) throw Error('ข้อความยาวเกินกำหนดหรือไม่มีข้อความ')
  return value.trim()
}
export function caseOf(world,id) {
  return world.cases.find(item => item.id === id) ?? notFound('ไม่พบเคสนี้')
}
export function targets(world,item) {
  const {variantId,orderId,conversationId,campaignId} = item.entityRefs
  const variant = variantOf(world,variantId)
  const order = orderId ? world.orders.find(row => row.id === orderId) : null
  const conversation = conversationId ? world.conversations.find(row => row.id === conversationId) : null
  const campaign = campaignId ? world.campaigns.find(row => row.id === campaignId) : null
  return {variant,order,conversation,campaign}
}
export function caseFacts(world,item) {
  const {variant,order,conversation,campaign} = targets(world,item)
  return {
    stock:variant.available,
    order:order ? [order.id,order.paymentStatus,order.fulfillmentStatus,Boolean(order.documents)] : null,
    conversation:conversation ? [conversation.id,conversation.owner,conversation.waitingEpisode,conversation.messages.at(-1)?.id] : null,
    customerText:conversation?.messages.filter(message => message.author === 'customer').at(-1)?.text ?? null,
    campaign:campaign ? [campaign.id,campaign.status,campaign.dailyBudget] : null
  }
}
export function analyzeCase(world,{caseId} = {}) {
  const item = caseOf(world,caseId)
  const {variant,order,campaign} = targets(world,item)
  let options
  if (item.type === 'product') {
    options = [{
      label:'ตอบตามจำนวนที่เหลือขาย',reason:'ตรวจสต็อกกลางของ ' + variant.sellerSku + ' แล้ว เหลือขาย ' + variant.available + ' ชิ้น',
      action:{type:'customer_reply',text:variant.available ? 'สินค้ารุ่นนี้มีพร้อมขาย ' + variant.available + ' ชิ้นค่ะ หากสนใจสามารถสั่งผ่านหน้าสินค้าได้เลยค่ะ' : 'ขณะนี้สินค้ารุ่นนี้หมดแล้วค่ะ ขอบคุณที่สนใจนะคะ'}
    }]
  } else if (item.type === 'preparation') {
    options = [{
      label:'เตรียมรายการหยิบและใบปะหน้า',reason:'คำสั่งซื้อ ' + order.id + ' ชำระแล้วและรอจัดเตรียม',
      action:{type:'prepare_order'}
    }]
  } else {
    options = [
      {label:'พักแอดชั่วคราว',reason:'เหลือขาย ' + variant.available + ' ชิ้น การพักแอดช่วยลดค่าใช้จ่ายในช่วงสต็อกต่ำ',action:{type:'campaign_pause'}},
      ...(campaign.dailyBudget > 1 ? [{label:'ลดงบรายวันครึ่งหนึ่ง',reason:'ลดค่าใช้จ่ายระหว่างรอตรวจสอบสินค้าคงเหลือ',action:{type:'campaign_reduce',dailyBudget:Math.floor(campaign.dailyBudget / 2)}}] : [])
    ]
  }
  return {caseId,runId:world.runId,expectedVersion:world.revision,options,source:'fixture'}
}

export function validateOption(world,item,option) {
  if (!option || typeof option !== 'object' || !option.action || !allowed[item.type].includes(option.action.type)) throw Error('ตัวเลือกมีงานนอกขอบเขตเคส')
  const {type,text,dailyBudget} = option.action
  const action = {type}
  const permittedKeys = type === 'customer_reply' ? ['type','text'] : ['campaign_reduce','campaign_increase'].includes(type) ? ['type','dailyBudget'] : ['type']
  if (Object.keys(option.action).some(key => !permittedKeys.includes(key))) throw Error('ระบบกำหนดปลายทางจากเคสเท่านั้น')
  if (type === 'customer_reply') action.text = boundedText(text)
  if (['campaign_reduce','campaign_increase'].includes(type)) {
    const campaign = targets(world,item).campaign
    if (typeof dailyBudget !== 'number' || !Number.isFinite(dailyBudget) || dailyBudget < 0 || dailyBudget > 10000 ||
      (type === 'campaign_reduce' ? dailyBudget >= campaign.dailyBudget : dailyBudget <= campaign.dailyBudget)) {
      throw Error('งบใหม่ไม่ตรงเงื่อนไขที่เลือก')
    }
    action.dailyBudget = dailyBudget
  }
  return {label:boundedText(option.label,120),reason:boundedText(option.reason,500),action}
}
export function addManagerProposal(world,{caseId,runId,expectedVersion,options,jobId,source = 'ai'}) {
  if (runId !== world.runId || expectedVersion !== world.revision) conflict('ข้อมูลร้านเปลี่ยนแล้ว กรุณาขอทางเลือกใหม่')
  if (!['ai','fixture'].includes(source)) throw Error('ไม่รู้จักที่มาของข้อเสนอ')
  if (source === 'ai' && world.managerPaused) conflict('ผู้จัดการหยุดทำงานอยู่')
  const item = caseOf(world,caseId)
  if (targets(world,item).conversation?.owner === 'human') conflict('เจ้าของดูแลแชทนี้อยู่')
  if (!Array.isArray(options) || options.length < 1 || options.length > 3) throw Error('ส่งทางเลือกได้ 1 ถึง 3 ข้อ')
  const safeOptions = options.map(option => ({id:'sim-option-' + randomUUID(),...validateOption(world,item,option)}))
  const next = structuredClone(world)
  next.revision += 1
  const proposal = {
    id:'sim-proposal-' + randomUUID(),caseId,options:safeOptions,source,basedOnVersion:next.revision,decision:null,
    status:'awaiting_approval',jobId:jobId ?? null,facts:caseFacts(next,item),at:next.clock
  }
  for (const old of next.proposals) if (old.caseId === item.id && old.status === 'awaiting_approval') old.status = 'stale'
  next.proposals.push(proposal)
  const current = caseOf(next,caseId)
  current.status = 'awaiting_approval'
  current.analysisVersion = next.revision
  current.history.push({at:next.clock,status:current.status,proposalId:proposal.id})
  return {world:next,proposal}
}

// The inbox model only sees fields that are appropriate for this customer.
function replyContext(world,item) {
  const {variant,conversation} = targets(world,item)
  if (!conversation) notFound('ไม่พบบทสนทนาที่ผูกกับเคส')
  const product = world.products.find(row => row.id === variant.productId)
  const orders = world.orders
    .filter(order => order.conversationId === conversation.id && order.customerId === conversation.customerId)
    .map(({id,createdAt,items,paymentStatus,fulfillmentStatus}) => ({
      id,createdAt,paymentStatus,fulfillmentStatus,
      items:items.map(({variantId,quantity,unitPrice}) => ({variantId,quantity,unitPrice}))
    }))
  return {
    shop:{name:world.shop.name,mode:world.shop.mode},runId:world.runId,revision:world.revision,clock:world.clock,
    case:{id:item.id,type:item.type,status:item.status},
    conversation:{
      id:conversation.id,
      messages:conversation.messages.slice(-30).map(({id,author,text,at}) => ({id,author,text,at}))
    },
    products:[{id:product.id,name:product.name,variants:[{
      id:variant.id,sellerSku:variant.sellerSku,name:variant.name,price:variant.price,available:variant.available
    }]}],
    orders,
    contextCoverage:{totalOrders:orders.length,returnedOrders:orders.length,omittedOrders:0,selection:'ออเดอร์ของลูกค้าในบทสนทนานี้'},
    capabilities:{read:true,calculate:false,propose:!world.managerPaused && conversation.owner !== 'human',
      allowedActions:allowed.product,executeRequiresOwnerChoiceOrPolicy:true}
  }
}

export function managerContext(world,{caseId} = {}) {
  if (caseId) {
    const item = caseOf(world,caseId)
    if (item.type === 'product') return replyContext(world,item)
  }
  const state = readWorld(world)
  const item = caseId ? caseOf(state,caseId) : null
  const caseOrders = new Set(state.cases.map(row => row.entityRefs.orderId).filter(Boolean))
  const scopeOrders = item ? state.orders.filter(order =>
    order.id === item.entityRefs.orderId || (item.entityRefs.conversationId && order.conversationId === item.entityRefs.conversationId)) :
    [...state.orders].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).filter((order,index) => index < 50 || caseOrders.has(order.id) || Boolean(order.conversationId))
  return {
    shop:state.shop,runId:state.runId,revision:state.revision,clock:state.clock,defaults:state.defaults,metrics:state.metrics,
    orders:scopeOrders,
    contextCoverage:{totalOrders:state.orders.length,returnedOrders:scopeOrders.length,omittedOrders:state.orders.length-scopeOrders.length,
      selection:item ? 'รายละเอียดเฉพาะออเดอร์หรือบทสนทนาในเคส' : 'ล่าสุด 50 รายการ รวมรายการที่เชื่อมกับเคสหรือแชทลูกค้า',aggregates:'metrics'},
    case:item,cases:item ? undefined : state.cases.map(({id,type,title,status}) => ({id,type,title,status})),
    products:item ? state.products.filter(product => product.variants.some(variant => variant.id === item.entityRefs.variantId)) : state.products,
    supplies:state.supplies,campaigns:item ? state.campaigns.filter(campaign => campaign.id === item.entityRefs.campaignId) : state.campaigns,
    conversation:item?.entityRefs.conversationId ? state.conversations.find(row => row.id === item.entityRefs.conversationId) : null,
    capabilities:{read:true,calculate:true,propose:!state.managerPaused && Boolean(item) && targets(world,item).conversation?.owner !== 'human',
      allowedActions:item ? allowed[item.type] : [],executeRequiresOwnerChoiceOrPolicy:true}
  }
}
