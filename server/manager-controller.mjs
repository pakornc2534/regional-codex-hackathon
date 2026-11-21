import {randomUUID} from 'node:crypto'
import {executeApproved} from './approved-actions.mjs'
import {Bridge} from './bridge.mjs'
import * as domain from './domain/index.mjs'
const tool=(name,description,properties={},required=[])=>({type:'function',name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}})
const string={type:'string'}
const contextTool=tool('sim_get_context','Read current scoped shop facts and whole-shop totals.')
const growthTools=['sim_calculate_growth','sim_calculate_impact'].map(n=>tool(n,'Calculate the selected SKU plan. Numeric assumptions use baht and fractions.',{variantId:string,mode:{type:'string',enum:['ads','flash','marketing','investment']},inputs:{type:'object',additionalProperties:{type:['number','null']}}}))
const propose=tool('sim_propose_options','Record options for this case. Start by reading context for allowed options. Specify each option using its actionType and text/title (customer_reply requires text).',{options:{type:'array',minItems:1,maxItems:3,items:{type:'object',properties:{actionType:string,title:string,reason:string,text:string,dailyBudget:{type:'number'}},required:['actionType','title','reason'],additionalProperties:false}}},['options'])
const verified=tool('sim_execute_approved','Execute or read back the exact durable owner decision for this run and case, using its approval key.',{idempotencyKey:string},['idempotencyKey'])
export function manager(shop,changed) {
  const bridge=new Bridge(),queue=[]
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
      const options=job.caseId?domain.analyzeCase(shop.world,{caseId:job.caseId}):null
      const history=shop.owner.messages.filter(m=>m.room===job.room && m.caseId===job.caseId && m.text && m.id!==job.id).slice(-8).map(m=>({role:m.role,text:m.text.slice(0,2600)}))
      const prompt=JSON.stringify({room:job.room,caseId:job.caseId,selectedVariant:job.variantId,submittedPlan:job.plan??null,history,ownerPreferences:shop.owner.memories.slice(-15).map(x=>x.text),instruction:job.message,caseOptions:options,requirement:'ใช้ sim_get_context ก่อนตอบ เมื่อเจ้าของขอทางเลือกให้เรียก sim_propose_options ภายในเคส'})
      const answer=await bridge.run({prompt,tools:[contextTool,...growthTools,...(job.caseId?[propose,verified]:[])],signal:job.abort.signal,research:job.research,call:(name,args)=>{
        check()
        if(name==='sim_get_context'){version=shop.world.revision;return ctx()}
        if(name==='sim_calculate_growth'||name==='sim_calculate_impact')return domain.growthPlan(shop.world,{...args.inputs,variantId:args.variantId??job.variantId,mode:args.mode||'ads'})
        if(!job.caseId)throw Error('ต้องเปิดเคสก่อน')
        if(name==='sim_propose_options'){const out=domain.addManagerProposal(shop.world,{caseId:job.caseId,runId:job.runId,expectedVersion:version,options:args.options.map(o=>({label:o.title,reason:o.reason,action:{type:o.actionType,...(o.actionType==="customer_reply"?{text:o.text}:{}),...(["campaign_reduce","campaign_increase"].includes(o.actionType)?{dailyBudget:o.dailyBudget}:{})}})),jobId:job.id});shop.saveWorld(out.world);version=out.world.revision;changed();return out.proposal}
        if(name==='sim_execute_approved'){const receipt=executeApproved(shop,{...args,caseId:job.caseId,runId:job.runId});changed();return receipt}
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
      if(data.caseId && !shop.world.cases.some(x=>x.id===data.caseId))throw Error('ไม่พบเคสนี้')
      if(shop.world.managerPaused)throw Error('ผู้จัดการพักงานอยู่')
      const id=randomUUID(),room=String(data.room??'overview').slice(0,120),caseId=data.caseId||null,createdAt=new Date().toISOString()
      const job={id,room,caseId,runId:shop.world.runId,message,plan:data.plan?domain.growthPlan(shop.world,data.plan):null,research:data.research===true&&room==='research',variantId:data.variantId,abort:new AbortController()}
      shop.editOwner(s=>s.messages.push({id:randomUUID(),role:'owner',text:message,room,caseId,createdAt},{id,role:'manager',text:'',room,caseId,createdAt,status:'queued'}))
      queue.push(job);changed();void next();return {jobId:id,status:'queued'}
    },close(){this.stop();bridge.close()}}
}
