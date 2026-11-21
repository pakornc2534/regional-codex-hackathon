import {dotSummary} from '../../shared/dot-monitor.mjs'
import {stations,workspaceNames} from '../../shared/shop-workspaces.mjs'
import {aggregateOrders,readWorld} from './shop-business.mjs'
import {unpacked} from './simulator.mjs'
import {channelMatch,inPeriod,pageOf,periodCoverage,salesReport} from './live-manager-reports.mjs'

const select = (row,keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(row,key)).map(key => [key,row[key]]))
const normalized = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('th').trim()
const matches = (query,...terms) => !query || terms.some(term => normalized(term).includes(normalized(query)))
const same = (expected,actual) => expected === undefined || normalized(expected) === normalized(actual)
const newest = (rows,key) => [...rows].sort((a,b) => String(b[key] ?? '').localeCompare(String(a[key] ?? '')))
const productVariants = world => world.products.flatMap(product => product.variants.map(v => ({...v,productName:product.name,category:product.category})))
const variantMatches = (variant,input) => same(input.variantId,variant.id) && matches(input.query,variant.sellerSku,variant.name,variant.productName,variant.category)

function stockRecords(world,input) {
  const variants = productVariants(world)
  if (input.kind === 'movements') {
    const byId = new Map(variants.map(row => [row.id,row]))
    const scope = input.from || input.to ? periodCoverage(world,input,world.source.period) : null
    const rows = world.movements.filter(row => {
      const v = byId.get(row.variantId)
      return v && variantMatches(v,input) && same(input.status,row.reason) && (!scope || inPeriod(row.at,scope.coveredPeriod))
    })
    return {...scope,...pageOf(newest(rows,'at'),input,row => ({
      ...select(row,['id','variantId','reason','at','before','after']),sellerSku:byId.get(row.variantId).sellerSku
    }))}
  }
  const channels = new Map(world.channelStock.map(row => [row.variantId,row]))
  const stocked = variants.filter(v => variantMatches(v,input)).filter(v => {
    if (input.status === 'out_of_stock') return v.available === 0
    if (input.status === 'low_stock') return v.available !== null && v.available < 3
    return same(input.status,channels.get(v.id)?.syncStatus)
  }).sort((a,b) => (a.available ?? Infinity) - (b.available ?? Infinity))
  return {...pageOf(stocked,input,v => ({...select(v,['id','sellerSku','productName','name','price','cost','available','physical','reserved','recipe']),
    channelStock:channels.has(v.id) ? select(channels.get(v.id),['platform','desiredQuantity','verifiedQuantity','syncStatus','lastSyncedAt']) : null})),
    lowStockThresholdExclusive:3}
}

const fulfillmentStatuses = ['picking','packing','ready','collected','transit','delivered','taken','cancelled','returned']
function orderRecords(world,input) {
  const {id,status,variantId,query} = input
  if (status && !fulfillmentStatuses.includes(status) && !(input.kind === 'fulfillment' && status === 'overdue')) throw Error('ไม่รู้จักสถานะออเดอร์')
  const filterChannel = channelMatch(input.channel)
  const scope = input.from || input.to ? periodCoverage(world,input,world.source.period) : null
  const byId = new Map(productVariants(world).map(v => [v.id,v]))
  const lines = items => items.map(item => ({...select(item,['variantId','quantity','unitPrice']),sku:byId.get(item.variantId)?.sellerSku ?? null}))
  const overdue = order => Boolean(order.prepareBy && order.prepareBy < world.clock && unpacked.has(order.fulfillmentStatus))
  const matched = world.orders.filter(order => {
    if (!same(id,order.id) || !filterChannel(order)) return false
    if (input.kind === 'fulfillment' && (order.channel !== 'online' || order.paymentStatus !== 'paid')) return false
    if (status === 'overdue' ? !overdue(order) : !same(status,order.fulfillmentStatus)) return false
    if (scope && !inPeriod(order.createdAt,scope.coveredPeriod)) return false
    if (variantId && !order.items.some(item => item.variantId === variantId)) return false
    return matches(query,order.id) || order.items.some(item => {
      const variant = byId.get(item.variantId)
      return variant && matches(query,variant.productName,variant.sellerSku,variant.name)
    })
  })
  const sorted = input.kind === 'fulfillment' && ['overdue','picking','packing'].includes(status)
    ? matched.sort((a,b) => (a.prepareBy ?? 'z').localeCompare(b.prepareBy ?? 'z') || a.createdAt.localeCompare(b.createdAt))
    : newest(matched,'createdAt')
  const records = pageOf(sorted,input,order => {
    const row = {...select(order,['id','createdAt','prepareBy','channel','paymentStatus','fulfillmentStatus','paidAmount']),items:lines(order.items)}
    if (input.kind === 'fulfillment' && id) {
      row.overdue = overdue(order)
      row.tracking = order.tracking ?? null
      row.pickList = order.documents?.pickList?.map(item => select(item,['sellerSku','quantity'])) ?? null
      row.events = order.events?.map(event => select(event,['stage','at'])) ?? []
    }
    return row
  })
  return {...scope,...records}
}

function inbox(world,input) {
  if (input.id) {
    const room = world.conversations.find(item => same(input.id,item.id))
    if (!room) return {conversation:null}
    const messages = room.messages.filter(row => matches(input.query,row.text))
    return {conversation:select(room,['id','title','owner']),messages:pageOf(newest(messages,'at'),input,row => select(row,['author','at','text']))}
  }
  const rooms = world.conversations.filter(room => same(input.status,room.owner) && matches(input.query,room.title,room.id))
  return {acknowledgement:select(world.acknowledgement ?? {},['enabled','text']),...pageOf(rooms,input,room => ({
    ...select(room,['id','title','owner']),messageCount:room.messages.length,lastMessageAt:room.messages.at(-1)?.at ?? null
  }))}
}

function caseDetail(world,input) {
  if (!input.id) throw Error('ระบุรหัสเคสจากรายการเคสก่อน')
  const item = world.cases.find(row => same(input.id,row.id))
  if (!item) return {case:null}
  const proposal = world.proposals.findLast(row => row.caseId === item.id)
  return {case:{...select(item,['id','type','title','status','priority']),
    references:select(item.entityRefs ?? {},['orderId','variantId','campaignId','conversationId']),
    evidence:pageOf(item.evidence ?? [],input),history:pageOf([...(item.history ?? [])].reverse(),input,row => select(row,['at','status'])),
    proposal:proposal ? {...select(proposal,['id','status','source','basedOnVersion','at']),
      options:proposal.options.map(option => ({...select(option,['id','label','reason']),actionType:option.action?.type})),
      chosenOption:proposal.decision?.optionId ?? null} : null}}
}

function scene(world) {
  const state = readWorld(world)
  const {metrics} = state
  const reports = {
    product:{tools:['catalog','inventory','movements'],products:world.products.length,variants:productVariants(world).length},
    picking:{tools:['fulfillment'],status:'picking',...metrics.stages.picking},
    packing:{tools:['fulfillment','supplies'],status:'packing',queueUnits:metrics.queueUnits,capacity:state.capacity},
    staging:{tools:['fulfillment'],status:'ready',...metrics.stages.ready},
    carrier:{tools:['fulfillment'],collected:metrics.stages.collected,transit:metrics.stages.transit},
    returns:{tools:['returns'],transit:world.returns.filter(row => row.stage === 'transit').length,received:world.returns.filter(row => row.stage === 'received').length},
    cashier:{tools:['finance'],sales7d:metrics.sales7d},
    insights:{tools:['sales','health'],orders7d:metrics.orders7d},
    computer:{tools:['settings'],shop:world.shop.name,mode:world.shop.mode}
  }
  return {period:metrics.period,stations:Object.entries(stations).map(([id,station]) => ({
    id,name:station.name,workspace:workspaceNames[station.page],...reports[id]
  }))}
}

function returns(world,input) {
  const byId = new Map(productVariants(world).map(v => [v.id,v]))
  const rows = world.returns.filter(row => (!input.id || same(input.id,row.id) || same(input.id,row.orderId))
    && (same(input.status,row.stage) || same(input.status,row.inspectionStatus))
    && row.items.some(item => same(input.variantId,item.variantId))
    && (matches(input.query,row.id,row.orderId) || row.items.some(item => matches(input.query,byId.get(item.variantId)?.sellerSku,byId.get(item.variantId)?.productName))))
  return pageOf(rows,input,row => ({...select(row,['id','orderId','stage','receivedAt','inspectionStatus']),
    items:row.items.map(item => ({variantId:item.variantId,sku:byId.get(item.variantId)?.sellerSku ?? null,quantity:item.quantity}))}))
}

export function workspaceReport(world,input,owner) {
  const {kind,id,query,status,variantId} = input
  switch (kind) {
    case 'scene': return scene(world)
    case 'finance': case 'sales': return salesReport(world,input,aggregateOrders(world))
    case 'dot': return {...dotSummary(readWorld(world),false),
      schedule:{spikeCheckMinutes:15,morningBriefLocalTime:'08:00',timezone:world.shop.timezone},
      spikeRule:'ภายในหนึ่งชั่วโมงมีออเดอร์ชำระแล้วอย่างน้อย 5 ออเดอร์ และถึง 3 เท่าของจำนวนเฉลี่ยในชั่วโมงเดียวกันย้อนหลัง 7 วัน',
      deliveryStatus:null}
    case 'health': {
      const {health,metrics} = readWorld(world)
      return {platform:select(health,['source','status','observedAt','period','stale']),overdueOrders:metrics.overdueOrders,
        failedStockSyncs:world.channelStock.filter(row => row.syncStatus === 'failed').length,
        variantsWithUnknownCost:productVariants(world).filter(row => row.cost == null).length}
    }
    case 'settings': return {shop:select(world.shop,['name','mode','platform','timezone']),clock:world.clock,
      defaults:select(world.defaults,['cash','packingCapacity']),managerPaused:world.managerPaused,source:select(world.source,['period','completeness']),
      salesChannels:['online','pos'],simulated:true}
    case 'inventory': case 'movements': return stockRecords(world,input)
    case 'orders': case 'fulfillment': {
      const rows = orderRecords(world,input)
      if (kind === 'orders') return rows
      const {metrics,capacity} = readWorld(world)
      return {...rows,currentShop:{stages:metrics.stages,queueUnits:metrics.queueUnits,queueOrders:metrics.queueOrders,overdueOrders:metrics.overdueOrders,capacity}}
    }
    case 'returns': return returns(world,input)
    case 'inbox': return inbox(world,input)
    case 'case_detail': return caseDetail(world,input)
    case 'activity': {
      const scope = input.from || input.to ? periodCoverage(world,input,world.source.period) : null
      const rows = world.audit.filter(row => same(status,row.status) && matches(query,row.type,row.approvedBy)
        && (!id || same(id,row.caseId) || same(id,row.verification?.id)) && (!scope || inPeriod(row.at,scope.coveredPeriod)))
      return {...scope,...pageOf(newest(rows,'at'),input,row => ({
        ...select(row,['type','status','at','revision','approvedBy','caseId']),
        verifiedRecord:row.verification ? select(row.verification,['kind','id']) : null
      }))}
    }
    case 'policies': return pageOf(world.policies.filter(row => same(id,row.id) && same(variantId,row.variantId) && same(status,row.enabled ? 'enabled' : 'disabled') && matches(query,row.actionType,row.label,row.caseId)),input,
      row => select(row,['id','caseId','variantId','enabled','actionType','label','reason','maxStock','maxDailyBudget']))
    case 'memories': {
      if (!owner || owner.runId !== world.runId || !Array.isArray(owner.memories)) return {available:false}
      return {available:true,...pageOf(newest(owner.memories.filter(row => same(id,row.id) && matches(query,row.text)),'at'),input,row => select(row,['id','text','at']))}
    }
    case 'news': return pageOf(newest(world.news.filter(row => same(id,row.id) && matches(query,row.title,row.summary,row.source)),'publishedAt'),input,
      row => select(row,['id','title','summary','source','publishedAt','effectiveAt','checkedAt']))
    case 'competitors': return pageOf(world.competitors.filter(row => same(id,row.id) && matches(query,row.product,row.name)),input,
      row => select(row,['id','name','product','price','source','observedAt']))
    case 'briefs': {
      const scope = input.from || input.to ? periodCoverage(world,input,world.source.period) : null
      const delivery = new Map(world.mail.map(row => [row.briefId,row]))
      const rows = world.briefs.filter(row => (!id || same(id,row.id) || same(id,row.date)) && same(status,delivery.get(row.id)?.status)
        && (!scope || (scope.coveredPeriod && row.date >= scope.coveredPeriod.from && row.date <= scope.coveredPeriod.to)))
      return {...scope,scheduledTimeBangkok:'07:00',...pageOf(newest(rows,'date'),input,row => ({
        ...select(row,['id','date','at','period','sales7d','orders7d','queueUnits','overdueOrders','caseIds','completedCaseIds','lowStock','lowSupplies','activeCampaigns','newsIds']),
        mail:delivery.has(row.id) ? select(delivery.get(row.id),['status','deliveredAt','attempts']) : null}))}
    }
    case 'plans': return pageOf(newest(world.plans.filter(row => same(id,row.id) && same(variantId,row.variantId) && same(input.mode,row.results?.mode)),'savedAt'),input,row => ({
      ...select(row,['id','variantId','savedAt','sourceVersion']),mode:row.results?.mode ?? null,
      decision:select(row.results ?? {},['requiredTotalUnits','requiredAdditionalUnits','revenue','adSpend','lowestCash','warnings']),
      ...(id ? {assumptions:row.inputs} : {})
    }))
    default: throw Error('ไม่รู้จักข้อมูลร้านที่ขอ')
  }
}
