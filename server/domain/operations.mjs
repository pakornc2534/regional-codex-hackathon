import {createHash,randomUUID} from 'node:crypto'
import {dayMs,roundMoney,variantOf} from './simulator.mjs'
import {growthPlan} from './growth-planner.mjs'
import {updateBriefs} from './shop-business.mjs'
import {actOnOrder,createSale,numberAtLeast,prepareOrder,sync} from './fulfillment.mjs'
import {boundedText,caseFacts,caseOf,conflict,notFound,targets,validateOption} from './manager-tools.mjs'

const saleTypes = new Set(['pos_sale','accept_order'])
const parcelTypes = new Set(['prepare_order','start_packing','pack','pickup','ship','deliver','cancel_order'])
const autoCampaignTypes = new Set(['campaign_pause','campaign_reduce'])
const ref = (kind,item) => ({kind,id:item.id})
const couple = (before,after,verification) => ({before,after,verification})
const find = (records,id,label) => records.find(item => item.id === id) ?? notFound('ไม่พบ' + label)
const makeId = suffix => 'sim-' + suffix + '-' + randomUUID()
const signature = value => JSON.stringify(value,(_key,item) => item && typeof item === 'object' && !Array.isArray(item) ?
  Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item)
const snapshot = value => structuredClone(value)
const checkBoolean = value => {
  if (typeof value !== 'boolean') throw Error('ระบุสถานะเปิดหรือปิด')
  return value
}
function writeMessage(world,conversation,author,text) {
  const message = {id:makeId('message'),author,text,at:world.clock}
  conversation.messages.push(message)
  return message
}
function setCaseStatus(world,item,status,details = {}) {
  item.status = status
  item.analysisVersion = world.revision
  item.history.push({at:world.clock,status,...details})
}
function allowAgent(world,conversation) {
  if (world.managerPaused) conflict('ผู้จัดการหยุดทำงานอยู่')
  if (conversation?.owner === 'human') conflict('เจ้าของดูแลแชทนี้อยู่')
}
function runOption(world,item,option,authority) {
  const {variant,conversation,order,campaign} = targets(world,item)
  allowAgent(world,conversation)
  validateOption(world,item,option)
  const action = option.action
  if (authority.policyId && item.type === 'ads' && !autoCampaignTypes.has(action.type)) conflict('ต้องได้รับอนุมัติครั้งใหม่')
  let result
  if (action.type === 'customer_reply') {
    const before = snapshot(conversation)
    const message = writeMessage(world,conversation,'agent',action.text)
    const readback = conversation.messages.find(entry => entry.id === message.id)
    if (readback?.text !== action.text) conflict('ตรวจสอบข้อความที่ส่งไม่สำเร็จ')
    result = couple(before,conversation,{kind:'message',id:message.id,conversationId:conversation.id})
  } else if (action.type === 'prepare_order') {
    const before = snapshot(order)
    prepareOrder(world,order)
    result = couple(before,order,{kind:'order',id:order.id,label:order.documents.label})
  } else {
    if (!campaign.variantIds.includes(variant.id)) conflict('ไม่พบสินค้าในแคมเปญนี้')
    const before = snapshot(campaign)
    if (action.type === 'campaign_pause') campaign.status = 'paused'
    if (action.type === 'campaign_enable') campaign.status = 'active'
    if (action.type === 'campaign_reduce' || action.type === 'campaign_increase') campaign.dailyBudget = action.dailyBudget
    result = couple(before,campaign,ref('campaign',campaign))
  }
  setCaseStatus(world,item,'verified',{decision:authority.decision,policyId:authority.policyId})
  return {...result,caseId:item.id,policyId:authority.policyId,decision:authority.decision}
}
function fromProposal(world,input) {
  const item = caseOf(world,input.caseId)
  const proposal = find(world.proposals,input.proposalId,'ข้อเสนอ')
  if (proposal.caseId !== item.id) conflict('ข้อเสนอนี้เป็นของเคสอื่น')
  const option = find(proposal.options,input.optionId,'ทางเลือก')
  return {item,proposal,option}
}
function checkPolicies(world,item) {
  const {variant,conversation,campaign} = targets(world,item)
  if (world.managerPaused || conversation?.owner === 'human') return null
  const policy = world.policies.find(row => row.enabled && row.caseId === item.id && row.runId === world.runId
    && row.shopId === world.shop.id && row.variantId === variant.id
    && (row.maxStock === null || variant.available <= row.maxStock)
    && (item.type !== 'product' || (row.lastUsedEpisode !== conversation?.waitingEpisode && variant.available === row.verifiedStock && conversation?.messages.filter(message => message.author === 'customer').at(-1)?.text === row.triggerText))
    && (item.type !== 'ads' || (
      autoCampaignTypes.has(row.action.type) && campaign?.status === 'active' &&
      (row.action.type !== 'campaign_reduce' || row.action.dailyBudget < campaign.dailyBudget) &&
      (row.maxDailyBudget === null || campaign.dailyBudget <= row.maxDailyBudget)
    )))
  if (!policy) return null
  const result = runOption(world,item,{label:policy.label,reason:policy.reason,action:policy.action},{decision:null,policyId:policy.id})
  if (item.type === 'product') policy.lastUsedEpisode = conversation.waitingEpisode
  world.audit.push({at:world.clock,type:policy.action.type,status:'verified',caseId:item.id,approvedBy:'policy',...snapshot(result)})
  return result
}
function onStockChange(world,variant) {
  for (const item of world.cases.filter(entry => entry.entityRefs.variantId === variant.id)) {
    if (item.type !== 'ads' && item.type !== 'product') continue
    item.evidence = ['ข้อมูลล่าสุด ' + variant.sellerSku + ' เหลือขาย ' + variant.available + ' ชิ้น']
    if (item.type === 'ads' && variant.available <= 1) {
      item.priority = variant.available === 0 ? 'high' : 'medium'
      setCaseStatus(world,item,'open')
      checkPolicies(world,item)
    }
  }
}
function updateProposals(world) {
  for (const proposal of world.proposals) {
    if (proposal.status !== 'awaiting_approval') continue
    const item = caseOf(world,proposal.caseId)
    if (signature(proposal.facts) === signature(caseFacts(world,item))) continue
    proposal.status = 'stale'
    if (item.status === 'awaiting_approval') setCaseStatus(world,item,'stale',{proposalId:proposal.id})
  }
}
function command(world,input) {
  if (saleTypes.has(input.type)) {
    const result = createSale(world,input)
    onStockChange(world,variantOf(world,input.variantId))
    return result
  }
  if (parcelTypes.has(input.type)) {
    const result = actOnOrder(world,input)
    if (input.type === 'cancel_order') {
      for (const row of result.after.items) onStockChange(world,variantOf(world,row.variantId))
    }
    return result
  }
  switch (input.type) {
    case 'retry_sync': {
      const variant = variantOf(world,input.variantId)
      const before = snapshot(world.channelStock.find(row => row.variantId === variant.id))
      return couple(before,sync(world,variant),{kind:'channel_stock',id:variant.id})
    }
    case 'receive_supply': {
      const supply = find(world.supplies,input.supplyId,'วัสดุ')
      const quantity = numberAtLeast(input.quantity,0.01,100000,['small','large','label'].includes(supply.id))
      if (supply.quantity === null) conflict('ยังไม่มีข้อมูลจำนวนวัสดุเดิม')
      const before = snapshot(supply)
      supply.quantity = roundMoney(supply.quantity + quantity)
      supply.updatedAt = world.clock
      return couple(before,supply,ref('supply',supply))
    }
    case 'receive_return': {
      const item = find(world.returns,input.returnId,'รายการคืน')
      if (item.stage !== 'transit') conflict('ร้านรับรายการคืนนี้แล้ว')
      const before = snapshot(item)
      item.stage = 'received'
      item.inspectionStatus = 'waiting'
      item.receivedAt = world.clock
      return couple(before,item,ref('return',item))
    }
    case 'advance_clock': {
      const before = world.clock
      const minutes = numberAtLeast(input.minutes,1,60*24*90,true)
      world.clock = new Date(Date.parse(world.clock) + minutes*60_000).toISOString()
      for (const order of world.orders) {
        const due = new Date(Date.parse(order.createdAt) + 7 * dayMs).toISOString()
        if (order.channel === 'online' && order.paymentStatus === 'paid' && !order.settlement &&
          order.fulfillmentStatus === 'delivered' && due <= world.clock) order.settlement = {amount:roundMoney(order.paidAmount * .88),date:due}
      }
      updateBriefs(world,input.failMail === true)
      return couple(before,world.clock,{kind:'clock',id:world.runId})
    }
    case 'retry_mail': {
      const mail = world.mail.find(item => item.date === input.date) ?? notFound('ไม่พบอีเมลบรีฟ')
      const before = snapshot(mail)
      if (mail.status !== 'delivered') {
        mail.status = 'delivered'
        mail.deliveredAt = world.clock
        mail.attempts += 1
      }
      return couple(before,mail,ref('mail',mail))
    }
    case 'customer_message': {
      const conversation = find(world.conversations,input.conversationId,'แชท')
      const before = snapshot(conversation)
      const waiting = conversation.messages.at(-1)?.author === 'customer' || conversation.messages.at(-1)?.acknowledgement
      if (!waiting) conversation.waitingEpisode += 1
      const message = writeMessage(world,conversation,'customer',boundedText(input.text))
      const item = world.cases.find(entry => entry.entityRefs.conversationId === conversation.id)
      if (item) setCaseStatus(world,item,'open')
      if (!world.managerPaused && conversation.owner === 'agent' && world.acknowledgement.enabled && conversation.acknowledgedEpisode !== conversation.waitingEpisode) {
        writeMessage(world,conversation,'agent',world.acknowledgement.text).acknowledgement = true
        conversation.acknowledgedEpisode = conversation.waitingEpisode
      }
      if (item) checkPolicies(world,item)
      return couple(before,conversation,{kind:'message',id:message.id,conversationId:conversation.id})
    }
    case 'take_over':
    case 'resume_agent': {
      const conversation = find(world.conversations,input.conversationId,'แชท')
      const before = snapshot(conversation)
      conversation.owner = input.type === 'take_over' ? 'human' : 'agent'
      return couple(before,conversation,ref('conversation',conversation))
    }
    case 'human_reply': {
      const conversation = find(world.conversations,input.conversationId,'แชท')
      if (conversation.owner !== 'human') conflict('รับช่วงดูแลแชทก่อนส่งข้อความ')
      const before = snapshot(conversation)
      const message = writeMessage(world,conversation,'human',boundedText(input.text))
      return couple(before,conversation,{kind:'message',id:message.id,conversationId:conversation.id})
    }
    case 'pause_manager': {
      const before = world.managerPaused
      world.managerPaused = checkBoolean(input.paused)
      if (world.managerPaused) {
        for (const proposal of world.proposals) if (proposal.status === 'awaiting_approval' && proposal.source === 'ai') {
          proposal.status = 'stale'
          const item = caseOf(world,proposal.caseId)
          if (item.status === 'awaiting_approval') setCaseStatus(world,item,'stale',{proposalId:proposal.id})
        }
      }
      return couple(before,world.managerPaused,{kind:'manager',id:world.runId})
    }
    case 'set_acknowledgement': {
      const before = snapshot(world.acknowledgement)
      const text = boundedText(input.text ?? before.text,240)
      if (input.enabled && /(?:[0-9๐-๙]|ราคา|บาท|รับประกัน|ส่งให้|ทันวันนี้|ส่งได้|พร้อมส่ง|พร้อมขาย|ของเหลือ|หมดแล้ว|ส่วนลด)/u.test(text)) {
        conflict('ข้อความรับทราบควรขอเวลาตรวจสอบโดยไม่ยืนยันสต็อก ราคา หรือวันส่ง')
      }
      world.acknowledgement = {enabled:checkBoolean(input.enabled),text}
      return couple(before,world.acknowledgement,{kind:'acknowledgement',id:world.runId})
    }
    case 'choose_option': {
      const {item,proposal,option} = fromProposal(world,input)
      if (proposal.status !== 'awaiting_approval' || signature(proposal.facts) !== signature(caseFacts(world,item))) {
        conflict('ข้อเสนอหมดอายุหรือข้อมูลเปลี่ยนแล้ว กรุณาขอทางเลือกใหม่')
      }
      const decision = {approvedBy:'owner',at:world.clock,optionId:option.id}
      const result = runOption(world,item,option,{decision,policyId:null})
      proposal.decision = decision
      proposal.status = 'verified'
      proposal.verification = result.verification
      return {...result,proposalId:proposal.id,policyQuestion:'งานแบบนี้ครั้งหน้าให้ทำเองตามกฎ หรือถามทุกครั้ง?'}
    }
    case 'defer_case': {
      const item = caseOf(world,input.caseId)
      const before = snapshot(item)
      for (const proposal of world.proposals) if (proposal.caseId === item.id && proposal.status === 'awaiting_approval') proposal.status = 'stale'
      setCaseStatus(world,item,'deferred')
      return couple(before,item,ref('case',item))
    }
    case 'set_policy': {
      if (input.policyId) {
        const policy = find(world.policies,input.policyId,'กฎ')
        if (input.enabled && !['customer_reply',...autoCampaignTypes].includes(policy.actionType)) conflict('งานนี้ต้องให้เจ้าของเลือกทุกครั้ง')
        const before = snapshot(policy)
        policy.enabled = checkBoolean(input.enabled)
        if (input.maxStock !== undefined) policy.maxStock = input.maxStock === null ? null : numberAtLeast(input.maxStock,0,100000,true)
        if (input.maxDailyBudget !== undefined) policy.maxDailyBudget = input.maxDailyBudget === null ? null : numberAtLeast(input.maxDailyBudget,0,10000)
        return couple(before,policy,ref('policy',policy))
      }
      const {item,proposal,option} = fromProposal(world,input)
      if (proposal.status !== 'verified' || proposal.decision?.optionId !== option.id) conflict('เลือกและตรวจสอบผลของการทำงานครั้งแรกก่อนตั้งกฎ')
      const enabled = checkBoolean(input.enabled)
      if (enabled && (item.type === 'preparation' || item.type === 'ads' && !autoCampaignTypes.has(option.action.type))) conflict('งานนี้ต้องให้เจ้าของเลือกทุกครั้ง')
      const {variant,conversation} = targets(world,item)
      const triggerText = proposal.facts.customerText
      const before = snapshot(world.policies.find(row => row.caseId === item.id && row.action.type === option.action.type) ?? null)
      if (before) world.policies.find(row => row.id === before.id).enabled = false
      const policy = {id:makeId('policy'),runId:world.runId,shopId:world.shop.id,caseId:item.id,variantId:variant.id,
        actionType:option.action.type,label:option.label,reason:option.reason,action:snapshot(option.action),enabled,
        maxStock:input.maxStock === undefined ? proposal.facts.stock : input.maxStock === null ? null : numberAtLeast(input.maxStock,0,100000,true),
        maxDailyBudget:input.maxDailyBudget == null ? null : numberAtLeast(input.maxDailyBudget,0,10000),
        verifiedStock:proposal.facts.stock,triggerText,lastUsedEpisode:conversation?.waitingEpisode ?? null,ownerDecision:{at:world.clock,optionId:option.id,proposalId:proposal.id}}
      world.policies.push(policy)
      return couple(before,policy,ref('policy',policy))
    }
    case 'save_plan': {
      if (!input.plan || typeof input.plan !== 'object') throw Error('ยังไม่ได้เลือกแผน')
      const results = growthPlan(world,input.plan)
      const plan = {id:makeId('plan'),variantId:results.variantId,inputs:results.inputs,sourceVersion:world.revision,results,savedAt:world.clock}
      world.plans.push(plan)
      return couple(null,plan,ref('plan',plan))
    }
    default:
      throw Error('ไม่รู้จักคำสั่งนี้')
  }
}
export function applyCommand(world,input) {
  if (!input || typeof input !== 'object' || input.actor !== undefined && input.actor !== 'owner') throw Object.assign(Error('คำสั่งนี้ต้องมาจากเจ้าของร้าน'),{status:403})
  const {runId,expectedVersion,idempotencyKey} = input
  if (runId !== world.runId) conflict('คำสั่งเป็นของรอบร้านก่อนหน้า')
  if (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{5,120}$/u.test(idempotencyKey)) throw Error('ไม่มีรหัสคำสั่งที่ใช้ตรวจสอบการส่งซ้ำ')
  const payloadHash = createHash('sha256').update(signature(input)).digest('hex')
  if (Object.hasOwn(world.receipts,idempotencyKey)) {
    const receipt = world.receipts[idempotencyKey]
    if (receipt.payloadHash !== payloadHash) conflict('รหัสคำสั่งเดิมถูกใช้กับข้อมูลที่เปลี่ยนไป')
    return {world,receipt}
  }
  if (world.revision !== expectedVersion) conflict('ข้อมูลร้านเปลี่ยนแล้ว กรุณาตรวจสอบและลองใหม่')
  const next = snapshot(world)
  const result = command(next,input)
  next.revision += 1
  updateProposals(next)
  const receipt = {
    idempotencyKey,payloadHash,status:'verified',type:input.type,runId:next.runId,revision:next.revision,at:next.clock,
    approvedBy:'owner',...snapshot(result)
  }
  next.receipts[idempotencyKey] = receipt
  next.audit.push(receipt)
  return {world:next,receipt}
}
