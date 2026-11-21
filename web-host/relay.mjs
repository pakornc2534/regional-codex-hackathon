import {spawn} from 'node:child_process'
import {mkdirSync,readFileSync,existsSync,writeFileSync,renameSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {encode} from './codec.mjs'
const base=process.env.SITE_URL
if(!base||new URL(base).protocol!=='https:')throw Error('Set SITE_URL to the deployed HTTPS origin')
const dir=resolve(process.env.RELAY_DIR||'.data-relay'),port=Number(process.env.DEMO_PORT||4321)
mkdirSync(dir,{recursive:true,mode:0o700})
const secret=process.env.RELAY_SECRET||readFileSync(join(dir,'secret'),'utf8').trim()
const origin='http://127.0.0.1:'+port
const child=spawn(process.execPath,['server/api.mjs'],{stdio:['ignore','inherit','inherit'],env:{...process.env,DATA_DIR:join(dir,'world'),PORT:String(port),DEMO_RUNTIME:'true'}})
let stopped=false
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{stopped=true;child.kill()})
child.on('exit',code=>{stopped=true;process.exitCode=code||0})
const journal=join(dir,'delivery.json')
function writeJournal(data){writeFileSync(journal+'.tmp',JSON.stringify(data),{mode:0o600,flush:true});renameSync(journal+'.tmp',journal)}
async function send(path,value){
  const response=await fetch(new URL('/relay/'+path,base),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body:await encode(value),signal:AbortSignal.timeout(14000),redirect:'error'})
  if(!response.ok)throw Error('Site '+path+' HTTP '+response.status)
  return response.json()
}
const wait=ms=>new Promise(r=>setTimeout(r,ms))
let hash='',version='',runId='',backoff=1000
while(!stopped){
 try {
   let pending=existsSync(journal)?JSON.parse(readFileSync(journal)):null
   if(pending){await send('result',{id:pending.id,result:pending.result||{status:409,body:{error:'คำสั่งอาจดำเนินการแล้ว โปรดตรวจสอบสถานะก่อนลองใหม่'}}});writeJournal(null)}
   const stamp=await (await fetch(origin+'/api/stamp')).json()
   if(stamp.version!==version){
     const state=await (await fetch(origin+'/api/state')).json()
     if(state.shop?.mode!=='simulated')throw Error('Relay accepts simulated shops only')
     const digest=createHash('sha256').update(JSON.stringify(state)).digest('hex')
     if(digest!==hash){await send('snapshot',state);hash=digest}
     runId=state.runId;version=stamp.version
   }
   const {job,needSnapshot}=await send('poll',{runId})
   if(needSnapshot){version='';hash='';continue}
   if(job){
     writeJournal({id:job.id})
     let result
     if(job.runId!==runId||Date.now()>job.expiresAt)result={status:409,body:{error:'คำสั่งหมดอายุหรือรอบร้านเปลี่ยนแล้ว'}}
     else {
       const r=await fetch(origin+'/api/'+job.ep,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({...job.body,runId:job.runId}),signal:AbortSignal.timeout(12000)})
       result={status:r.status,body:await r.json()}
     }
     writeJournal({id:job.id,result})
     if((await (await fetch(origin+'/api/stamp')).json()).version!==version){
       const state=await (await fetch(origin+'/api/state')).json()
       await send('snapshot',state);hash=createHash('sha256').update(JSON.stringify(state)).digest('hex');version=''
     }
     await send('result',{id:job.id,result});writeJournal(null)
   }
   backoff=1000;await wait(job?150:2200)
 } catch(e){if(!stopped)console.error('Relay:',e.message);await wait(backoff);backoff=Math.min(backoff*2,8000)}
}
