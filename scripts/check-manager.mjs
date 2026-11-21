// Run against a disposable local DATA_DIR, or set READ_ONLY=1 to test a hosted demo.
const origin=new URL(process.env.TEST_ORIGIN||'http://127.0.0.1:4310').origin
const read=async()=>{const r=await fetch(origin+'/api/state');if(!r.ok)throw Error('state: '+r.status);return r.json()}
const post=async(path,data)=>{const r=await fetch(origin+'/api/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.error);return result}
const wait=ms=>new Promise(r=>setTimeout(r,ms))
let s=await read()
const chosen=s.cases.find(c=>c.type==='product')
const readOnly=process.env.READ_ONLY==='1'
const request=readOnly?{room:'overview',message:'ร้านจำลองนี้ชื่ออะไร และมียอดขาย 7 วันกี่บาท? ตรวจข้อมูลแล้วตอบสั้น ๆ'}:{room:'cases',caseId:chosen.id,message:'โปรดตรวจสต็อก Sonic จาก sim_get_context แล้วเรียก sim_propose_options เพื่อเสนอข้อความบอกจำนวนที่เหลือขายจริงให้ลูกค้า รอฉันอนุมัติก่อนส่ง'}
const {jobId}=await post('chat',{...request,runId:s.runId})
const deadline=Date.now()+180000
let message
while(Date.now()<deadline){await wait(1500);s=await read();message=s.owner.messages.find(m=>m.id===jobId);if(['failed','completed'].includes(message?.status))break}
if(message?.status!=='completed')throw Error(message?.text||'No model answer')
console.log('Model:',message.text)
if(!readOnly){
 const c=s.cases.find(c=>c.id===chosen.id),p=c.proposal
 if(p?.source!=='ai'||p.jobId!==jobId)throw Error('Missing proposal from this AI run')
 const before=s.conversations.find(x=>x.id===c.entityRefs.conversationId).messages.length
 const key=crypto.randomUUID()
 const receipt=await post('sim/command',{actor:'owner',type:'choose_option',caseId:c.id,proposalId:p.id,optionId:p.options[0].id,runId:s.runId,expectedVersion:s.revision,idempotencyKey:key})
 s=await read()
 const room=s.conversations.find(x=>x.id===c.entityRefs.conversationId)
 if(room.messages.length!==before+1||room.messages.at(-1).text!==p.options[0].action.text)throw Error('Readback mismatch')
 console.log('Verified',receipt.status,'in',room.id,'option source',p.source)
}
