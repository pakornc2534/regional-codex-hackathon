import {applyCommand} from './domain/index.mjs'
const forbidden=()=>{throw Object.assign(Error('ไม่พบการอนุมัติของเจ้าของสำหรับเคสนี้'),{status:403})}
export function executeApproved(shop,{runId,caseId,idempotencyKey}){
  const w=shop.world
  if(w.runId!==runId || !Object.hasOwn(w.ownerApprovals||{},idempotencyKey))forbidden()
  const command=w.ownerApprovals[idempotencyKey]
  if(command.caseId!==caseId||command.runId!==runId)forbidden()
  const out=applyCommand(w,command)
  shop.saveWorld(out.world)
  return out.receipt
}
export function chooseOption(shop,command){
  // Validate authority, target, version and payload before recording the decision.
  // The domain preview is pure. Recheck all facts again when consuming the decision.
  const preview=applyCommand(shop.world,command)
  if(preview.world===shop.world)return preview.receipt
  const next=structuredClone(shop.world)
  const approvals=next.ownerApprovals??={}
  if(Object.hasOwn(approvals,command.idempotencyKey) && JSON.stringify(approvals[command.idempotencyKey])!==JSON.stringify(command))throw Error('รหัสคำสั่งตรงกับการอนุมัติคนละรายการ')
  Object.defineProperty(approvals,command.idempotencyKey,{value:structuredClone(command),enumerable:true,writable:true,configurable:true})
  shop.saveWorld(next)
  return executeApproved(shop,command)
}
