import {randomUUID} from 'node:crypto'
import {executeApproved} from './approved-actions.mjs'
import {createBridge} from './bridge.mjs'
import * as domain from './domain/index.mjs'
const tool=(name,description,properties={},required=[])=>({type:'function',name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}})
const string={type:'string'}
const contextTool=tool('sim_get_context','Read the current facts visible in this room.')
const growthTools=['sim_calculate_growth','sim_calculate_impact'].map(n=>tool(n,'Calculate the selected SKU plan. Numeric assumptions use baht and fractions.',{variantId:string,mode:{type:'string',enum:['ads','flash','marketing','investment']},inputs:{type:'object',additionalProperties:{type:['number','null']}}}))
const propose=tool('sim_propose_options','Record options for this case. Start by reading context for allowed options. Specify each option using its actionType and text/title (customer_reply requires text).',{options:{type:'array',minItems:1,maxItems:3,items:{type:'object',properties:{actionType:string,title:string,reason:string,text:string,dailyBudget:{type:'number'}},required:['actionType','title','reason'],additionalProperties:false}}},['options'])
const verified=tool('sim_execute_approved','Execute or read back the exact durable owner decision for this run and case, using its approval key.',{idempotencyKey:string},['idempotencyKey'])
// Older saved conversations may contain answers produced with store-wide context.
const replyContextVersion = 1

function replyReceipt(receipt) {
  const {id,conversationId} = receipt.verification
  const message = receipt.after?.messages?.find(row => row.id === id)
  if (!message || receipt.verification.kind !== 'message' || receipt.after?.id !== conversationId) {
    throw Error('ไม่พบข้อความที่ยืนยันในบทสนทนานี้')
  }
  return {status:receipt.status,caseId:receipt.caseId,verification:{kind:'message',id,conversationId},
    message:{id:message.id,text:message.text,at:message.at}}
}

export function manager(shop,changed,bridge = createBridge()) {
  const queue=[]
  let active=null,lastError=''
  const status=()=>({status:active?'thinking':bridge.status,detail:lastError||bridge.detail})
  const update=(id,patch)=>{shop.editOwner(s=>{const item=s.messages.find(x=>x.id===id);if(item)Object.assign(item,patch)});changed()}
  async function next(){
    if(active||!queue.length)return
    const job=queue.shift();active=job;lastError=''
    const check=()=>{
      if(job.abort.signal.aborted||job.runId!==shop.world.runId||shop.world.managerPaused)throw Error('งานหยุดหรือรอบร้านเปลี่ยนแล้ว')
      if(job.caseId){const c=shop.world.cases.find(x=>x.id===job.caseId);if(!c)throw Error('ไม่พบเคส');if(c.entityRefs.conversationId && shop.world.conversations.find(x=>x.id===c.entityRefs.conversationId)?.owner==='human')throw Error('เจ้าของร้านรับช่วงแชทแล้ว')}
    }
    try{
      check();update(job.id,{status:'thinking'})
      let version=shop.world.revision
      const ctx=()=>domain.managerContext(shop.world,{caseId:job.caseId})
      const {replyCase} = job
      const questionIndex = shop.owner.messages.findIndex(message => message.id === job.questionId)
      const history = shop.owner.messages.slice(0,questionIndex)
        .filter(message => message.room === job.room && message.caseId === job.caseId && message.text)
        .filter(message => !replyCase || (
          message.replyContextVersion === replyContextVersion && message.runId === job.runId &&
          (message.role === 'owner' || message.status === 'completed')
        ))
        .slice(-8).map(message => ({role:message.role,text:message.text.slice(0,2600)}))
      const prompt = JSON.stringify({
        room:job.room,caseId:job.caseId,selectedVariant:job.variantId,history,instruction:job.message,
        ...(replyCase ? {} : {
          submittedPlan:job.plan,ownerPreferences:shop.owner.memories.slice(-15).map(x=>x.text),
          caseOptions:job.caseId ? domain.analyzeCase(shop.world,{caseId:job.caseId}) : null
        }),
        requirement:'ใช้ sim_get_context ก่อนตอบ เมื่อเจ้าของขอทางเลือกให้เรียก sim_propose_options ภายในเคส'
      })
      const tools = [contextTool,...(replyCase ? [] : growthTools),...(job.caseId ? [propose,verified] : [])]
      const answer=await bridge.run({prompt,tools,signal:job.abort.signal,research:job.research,call:(name,args)=>{
        check()
        if (!tools.some(tool => tool.name === name)) throw Error('ไม่อนุญาตให้ใช้เครื่องมือนี้ในห้องนี้')
        if(name==='sim_get_context'){version=shop.world.revision;return ctx()}
        if(name==='sim_calculate_growth'||name==='sim_calculate_impact')return domain.growthPlan(shop.world,{...args.inputs,variantId:args.variantId??job.variantId,mode:args.mode||'ads'})
        if(!job.caseId)throw Error('ต้องเปิดเคสก่อน')
        if (name === 'sim_propose_options') {
          const out = domain.addManagerProposal(shop.world,{
            caseId:job.caseId,runId:job.runId,expectedVersion:version,jobId:job.id,
            options:args.options.map(option => ({
              label:option.title,reason:option.reason,
              action:{type:option.actionType,
                ...(option.actionType === 'customer_reply' ? {text:option.text} : {}),
                ...(['campaign_reduce','campaign_increase'].includes(option.actionType) ? {dailyBudget:option.dailyBudget} : {})
              }
            }))
          })
          shop.saveWorld(out.world)
          version = out.world.revision
          changed()
          if (replyCase) {
            const {id,caseId,status,options} = out.proposal
            return {id,caseId,status,options}
          }
          return out.proposal
        }
        if (name === 'sim_execute_approved') {
          const receipt = executeApproved(shop,{...args,caseId:job.caseId,runId:job.runId})
          changed()
          return replyCase ? replyReceipt(receipt) : receipt
        }
        throw Error('ไม่อนุญาตให้ใช้เครื่องมือนี้')
      }})
      check();update(job.id,{text:answer,status:'completed'})
    }catch(e){if(shop.world.runId===job.runId)update(job.id,{text:e.message,status:'failed'});lastError=e.message}
    finally{active=null;changed();void next()}
  }
  return {status, async reconnect(){await bridge.connect();lastError='';changed();return status()},
    cancel(id){if(active?.id===id)active.abort.abort();const i=queue.findIndex(x=>x.id===id);if(i>=0){queue.splice(i,1);update(id,{text:'ยกเลิกงานแล้ว',status:'failed'})}},
    stop(){if(active)active.abort.abort();for(const j of queue.splice(0))update(j.id,{text:'ยกเลิกงานแล้ว',status:'failed'})},
    enqueue(data){
      if(queue.length>=4)throw Error('คิวผู้จัดการเต็ม กรุณารอสักครู่')
      const message=String(data.message??'').trim();if(!message||message.length>4000)throw Error('กรอกข้อความไม่เกิน 4,000 ตัวอักษร')
      const item = data.caseId ? shop.world.cases.find(x=>x.id===data.caseId) : null
      if ((data.caseId || data.room === 'case') && !item) throw Error('ไม่พบเคสนี้')
      if(shop.world.managerPaused)throw Error('ผู้จัดการพักงานอยู่')
      const replyCase = item?.type === 'product'
      const room = replyCase ? 'case' : String(data.room ?? 'overview').slice(0,120)
      const caseId = item?.id ?? null
      const id = randomUUID(), questionId = randomUUID(), runId = shop.world.runId
      const job={id,questionId,room,caseId,runId,message,replyCase,plan:!replyCase && data.plan ? domain.growthPlan(shop.world,data.plan) : null,
        research:!replyCase && data.research===true && room==='research',
        variantId:replyCase ? item.entityRefs.variantId : data.variantId,abort:new AbortController()}
      const metadata = {room,caseId,createdAt:new Date().toISOString(),...(replyCase ? {replyContextVersion,runId} : {})}
      shop.editOwner(s=>s.messages.push({id:questionId,role:'owner',text:message,...metadata},{id,role:'manager',text:'',...metadata,status:'queued'}))
      queue.push(job);changed();void next();return {jobId:id,status:'queued'}
    },close(){this.stop();bridge.close()}}
}
