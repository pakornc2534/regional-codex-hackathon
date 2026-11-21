import {decode,encode,bounded} from './codec.mjs'
const endpoints=new Set(['chat','sim/command','sim/analyze','sim/growth','sim/impact','memories','reconnect','chat/cancel'])
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}})
const getJSON=async(bucket,key)=>(await bucket.get(key))?.json()
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const safeJob=id=>/^[a-f0-9-]{36}$/.test(id)
async function relay(req,env,path){
  if(!env.RELAY_SECRET || req.headers.get('authorization')!=='Bearer '+env.RELAY_SECRET)return json({error:'Unauthorized'},401)
  if(req.method!=='POST')return json({error:'Method'},405)
  const bucket=env.BUCKET
  if(path==='snapshot'){
    const state=await decode(req.body)
    if(state.shop?.mode!=='simulated'||!state.runId || state.hosted)return json({error:'ต้องเป็นร้านจำลอง'},400)
    await bucket.put('snapshot',await encode(state));await bucket.put('seen',JSON.stringify({at:Date.now(),dataAt:Date.now(),runId:state.runId,mode:state.shop.mode}))
    return json({ok:true})
  }
  const data=await decode(req.body)
  if(path==='poll'){
    const seen=await getJSON(bucket,'seen')
    if(!seen||seen.runId!==data.runId)return json({needSnapshot:true})
    await bucket.put('seen',JSON.stringify({...seen,at:Date.now()}))
    const objects=await bucket.list({prefix:'queue/',limit:1})
    if(!objects.objects.length)return json({})
    const k=objects.objects[0].key,job=await getJSON(bucket,k)
    if(!job)return json({})
    const claimed=await bucket.put('claim/'+job.id,'1',{onlyIf:{etagDoesNotMatch:'*'}})
    await bucket.delete(k)
    return json(claimed?{job}:{})
  }
  if(path==='result' && safeJob(data.id)){
    if(!await bucket.head('claim/'+data.id))return json({error:'Unknown claim'},409)
    await bucket.put('result/'+data.id,await encode(data.result),{onlyIf:{etagDoesNotMatch:'*'}})
    return json({ok:true})
  }
  return json({error:'Unknown relay operation'},404)
}
async function fetchWorker(req,env){
  const url=new URL(req.url),path=url.pathname
  if(path.startsWith('/relay/'))return relay(req,env,path.slice(7))
  if(!path.startsWith('/api/'))return serveAsset(path)
  const ep=path.slice(5),bucket=env.BUCKET
  const publicDemo=env.PUBLIC_DEMO_ENABLED==='true'
  if(!publicDemo && (!env.OWNER_SITE_ID || req.headers.get('oai-authenticated-user-id')!==env.OWNER_SITE_ID))return json({error:'ต้องเข้าสู่ระบบเจ้าของร้าน'},403)
  const seen=await getJSON(bucket,'seen')
  if(!seen||seen.mode!=='simulated')return json({error:'รอข้อมูลร้านจำลองจากเครื่องเจ้าของ'},503)
  const ageMs=Date.now()-seen.at,stale=ageMs>15000
  if(req.method==='GET'&&ep==='stamp')return json({version:seen.runId+'-'+seen.dataAt+'-'+stale})
  if(req.method==='GET'&&ep==='state'){
    const stored=await bucket.get('snapshot');if(!stored)return json({error:'รอข้อมูลร้าน'},503)
    const state=await decode(stored.body)
    if(state.shop?.mode!=='simulated')return json({error:'โหมดร้านไม่ตรงกัน'},403)
    state.hosted={publicDemo,stale,ageMs,lastHeartbeat:seen.at,lastDataUpdate:seen.dataAt}
    if(stale)state.connection={status:'disconnected',detail:'เครื่องเจ้าของออฟไลน์ กำลังแสดงข้อมูลล่าสุด'}
    return json(state)
  }
  if(req.method==='GET'&&ep==='events')return new Response('retry: 5000\ndata: '+seen.dataAt+'\n\n',{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store'}})
  if(!endpoints.has(ep)||req.method!=='POST')return json({error:'ไม่พบคำสั่ง'},404)
  if(req.headers.get('origin')!==url.origin || !req.headers.get('content-type')?.includes('application/json'))return json({error:'คำขอต้องมาจากหน้าเดโม'},403)
  if(stale)return json({error:'เครื่องเจ้าของออฟไลน์ ลองใหม่เมื่อเชื่อมต่อแล้ว'},503)
  const body=JSON.parse(new TextDecoder().decode(await bounded(req.body,32000)))
  if(body.runId && body.runId!==seen.runId)return json({error:'ร้านเปลี่ยนรอบแล้ว'},409)
  const open=await bucket.list({prefix:'queue/',limit:10})
  if(open.objects.length>=10)return json({error:'คิวเต็ม กรุณารอสักครู่'},429)
  const id=crypto.randomUUID(),key='queue/'+Date.now()+'-'+id
  await bucket.put(key,JSON.stringify({id,ep,body,runId:seen.runId,expiresAt:Date.now()+45000}))
  for(let n=0;n<35;n++){await wait(500);const obj=await bucket.get('result/'+id);if(obj){const r=await decode(obj.body);return json(r.body,r.status)}}
  return json({error:'รอตรวจสอบผลคำสั่ง กรุณาโหลดสถานะอีกครั้ง',jobId:id},504)
}
export default {async fetch(req,env){try{return await fetchWorker(req,env)}catch(e){return json({error:'ประมวลผลไม่ได้ · '+e.message},400)}}}
