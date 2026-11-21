import {randomUUID} from 'node:crypto'
import {atShop,dayMs,unpacked,roundMoney,variantOf} from './simulator.mjs'
import {conflict,notFound} from './manager-tools.mjs'

export const orderOf = (world,id) => world.orders.find(order => order.id === id) ?? notFound('ไม่พบคำสั่งซื้อนี้')
export function numberAtLeast(value,min,max,whole = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) throw Error('จำนวนที่ระบุไม่ถูกต้อง')
  return value
}
export function sync(world,variant,fail = false) {
  const record = world.channelStock.find(item => item.variantId === variant.id)
  record.desiredQuantity = variant.available
  record.syncStatus = fail ? 'failed' : 'synced'
  if (!fail) {
    record.verifiedQuantity = record.desiredQuantity
    record.lastSyncedAt = world.clock
  }
  return record
}
function adjust(world,variant,physical,reserved,reason,fail) {
  const before = {physical:variant.physical,reserved:variant.reserved,available:variant.available}
  variant.physical += physical
  variant.reserved += reserved
  if (variant.reserved < 0 || variant.physical < variant.reserved) conflict('สต็อกหรือยอดจองไม่พอ')
  variant.available = variant.physical - variant.reserved
  variant.updatedAt = world.clock
  const after = {physical:variant.physical,reserved:variant.reserved,available:variant.available}
  const movement = {id:'sim-movement-' + randomUUID(),variantId:variant.id,reason,before,after,at:world.clock}
  world.movements.push(movement)
  if (before.available !== after.available) sync(world,variant,fail)
  return movement
}
export function createSale(world,input) {
  const online = input.type === 'accept_order'
  const variant = variantOf(world,input.variantId)
  const quantity = numberAtLeast(input.quantity,1,10000,true)
  if (quantity > variant.available) conflict('เหลือขาย ' + variant.available + ' ชิ้น')
  const id = 'sim-order-' + randomUUID()
  const paidAmount = roundMoney(variant.price * quantity)
  const stage = online ? 'picking' : 'taken'
  const order = {
    id,channel:online ? 'online' : 'pos',customerId:'sim-customer-' + randomUUID(),conversationId:null,
    items:[{variantId:variant.id,quantity,unitPrice:variant.price}],paymentStatus:'paid',fulfillmentStatus:stage,paidAmount,createdAt:world.clock,
    prepareBy:online ? new Date(Date.parse(world.clock) + dayMs).toISOString() : null,
    settlement:online ? null : {amount:paidAmount,date:world.clock},costs:{product:variant.cost === null ? null : roundMoney(variant.cost * quantity),fee:online ? roundMoney(paidAmount * .12) : 0},
    tracking:null,events:[{stage,at:world.clock}]
  }
  adjust(world,variant,online ? 0 : -quantity,online ? quantity : 0,input.type,input.failSync)
  world.orders.push(order)
  return {before:null,after:order,verification:{kind:'order',id}}
}
function move(world,order,stage) {
  order.fulfillmentStatus = stage
  order.events.push({stage,at:world.clock})
}
export function prepareOrder(world,order) {
  if (order.paymentStatus !== 'paid' || order.channel !== 'online' || !unpacked.has(order.fulfillmentStatus)) conflict('คำสั่งซื้อนี้ไม่อยู่ในคิวเตรียมส่ง')
  order.documents ??= {
    pickList:order.items.map(item => ({...item,sellerSku:variantOf(world,item.variantId).sellerSku})),
    label:'SIM-LABEL-' + order.id.toUpperCase(),
    at:world.clock
  }
}
export function actOnOrder(world,input) {
  const order = orderOf(world,input.orderId)
  const before = structuredClone(order)
  if (order.channel !== 'online' || order.paymentStatus !== 'paid') conflict('ใช้ได้กับคำสั่งซื้อออนไลน์ที่ชำระแล้วเท่านั้น')
  switch (input.type) {
    case 'prepare_order':
      prepareOrder(world,order)
      break
    case 'start_packing':
      if (order.fulfillmentStatus !== 'picking') conflict('คำสั่งซื้อไม่อยู่ในคิวรอหยิบ')
      move(world,order,'packing')
      break
    case 'pack': {
      if (!unpacked.has(order.fulfillmentStatus)) conflict('คำสั่งซื้อไม่อยู่ในคิวรอจัดเตรียม')
      const quantities = {}
      for (const {variantId,quantity} of order.items) {
        const variant = variantOf(world,variantId)
        if (!variant.recipe) conflict('ยังไม่ทราบวัสดุที่ต้องใช้')
        for (const [id,value] of Object.entries(variant.recipe)) quantities[id] = (quantities[id] ?? 0) + quantity * value
      }
      for (const [id,value] of Object.entries(quantities)) {
        const supply = world.supplies.find(item => item.id === id)
        if (!supply || supply.quantity === null || supply.quantity < value) conflict('วัสดุแพ็กไม่พอหรือยังไม่ทราบจำนวน')
        supply.quantity = roundMoney(supply.quantity - value)
        supply.updatedAt = world.clock
      }
      order.packMaterials = quantities
      move(world,order,'ready')
      break
    }
    case 'pickup':
      if (order.fulfillmentStatus !== 'ready') conflict('ต้องแพ็กเสร็จก่อนยืนยันว่าขนส่งรับแล้ว')
      for (const {variantId,quantity} of order.items) adjust(world,variantOf(world,variantId),-quantity,-quantity,input.type,input.failSync)
      order.tracking ??= 'SIM-' + order.id.toUpperCase()
      move(world,order,'collected')
      break
    case 'ship':
      if (order.fulfillmentStatus !== 'collected') conflict('ขนส่งยังไม่รับพัสดุ')
      move(world,order,'transit')
      break
    case 'deliver':
      if (order.fulfillmentStatus !== 'transit') conflict('พัสดุยังไม่อยู่ระหว่างทาง')
      move(world,order,'delivered')
      break
    case 'cancel_order':
      if (!atShop.has(order.fulfillmentStatus)) conflict('คำสั่งซื้อออกจากร้านแล้ว')
      for (const {variantId,quantity} of order.items) adjust(world,variantOf(world,variantId),0,-quantity,input.type,input.failSync)
      order.paymentStatus = 'cancelled'
      move(world,order,'cancelled')
      break
  }
  return {before,after:order,verification:{kind:'order',id:order.id}}
}
