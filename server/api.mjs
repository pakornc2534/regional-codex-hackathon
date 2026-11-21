import http from 'node:http'
import {resolve,extname,sep} from 'node:path'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {dotSummary} from '../shared/dot-monitor.mjs'
import {tickShop} from './demo-clock.mjs'
import {openShop} from './persistence.mjs'
import * as domain from './domain/index.mjs'
import {chooseOption} from './approved-actions.mjs'
import {customerChat} from './customer-chat.mjs'
import {manager} from './manager-controller.mjs'
import {liveManagerSessions} from './live-manager-session.mjs'
const port=Number(process.env.PORT||4310), root=resolve('dist/client')
const shop=openShop(resolve(process.env.DATA_DIR||'.data')),events=new Set(),boot=randomUUID()
let version=0
const changed=()=>{version++;for(const client of events)client.write('data: '+version+'\n\n')}
if(process.env.DEMO_CLOCK!=='manual'){
  tickShop(shop)
  setInterval(()=>{if(tickShop(shop))changed()},60000).unref()
}
const agent=manager(shop,changed), customer=customerChat(shop)
const liveManager=liveManagerSessions(shop)
const allowed=new Set([port,...(port===4311?[4310]:[])].flatMap(p=>['localhost:'+p,'127.0.0.1:'+p]))
function reject(status,message){throw Object.assign(Error(message),{status})}
const server=http.createServer(async(req,res)=>{
  const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))}
  try {
    if(!allowed.has(req.headers.host))reject(403,'ชื่อโฮสต์ไม่ตรงกัน')
    if(req.headers.origin && ![...allowed].some(h=>req.headers.origin==='http://'+h))reject(403,'ต้นทางไม่ตรงกัน')
    const path=new URL(req.url,'http://localhost').pathname
    if(path==='/api/dot-summary'){
      if(req.method!=='GET'){res.setHeader('Allow','GET');reject(405,'ต้องใช้ GET')}
      return json(dotSummary(domain.readWorld(shop.world),false))
    }
    if(req.method==='GET'){
      if(path==='/api/state')return json({...domain.readWorld(shop.world),owner:shop.owner,connection:agent.status(),liveManagerAvailable:liveManager.available})
      if(path==='/api/stamp')return json({version:boot+'-'+version})
      if(path==='/api/events'){
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': ready\n\n');events.add(res);req.on('close',()=>events.delete(res));return
      }
      if(path.startsWith('/api/'))reject(404,'ไม่พบข้อมูล')
      const file=resolve(root,'.'+decodeURIComponent(path.endsWith('/')?path+'index.html':path))
      if(!file.startsWith(root+sep))reject(403,'เส้นทางไม่ถูกต้อง')
      const bytes=await readFile(file).catch(()=>reject(404,'ไม่พบไฟล์'))
      res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg','.zip':'application/zip'})[extname(file)]||'application/octet-stream'});return res.end(bytes)
    }
    if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))reject(415,'ต้องส่งข้อมูล JSON')
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32000)reject(413,'ข้อมูลยาวเกินกำหนด');chunks.push(chunk)}
    const b=JSON.parse(Buffer.concat(chunks).toString()||'{}')
    if(!b||typeof b!=='object'||Array.isArray(b))reject(400,'รูปแบบข้อมูลไม่ถูกต้อง')
    if(b.runId && b.runId!==shop.world.runId)reject(409,'รอบร้านเปลี่ยนแล้ว กรุณาโหลดใหม่')
    switch(path){
      case '/api/sim/growth':case '/api/sim/impact':return json(domain.growthPlan(shop.world,b))
      case '/api/sim/analyze':{
        const fixture=domain.analyzeCase(shop.world,b)
        const out=domain.addManagerProposal(shop.world,{...fixture,jobId:randomUUID(),source:'fixture'})
        shop.saveWorld(out.world);changed();return json(out.proposal)
      }
      case '/api/sim/command':{
        if(b.type==='reset_run'){if(b.actor!=='owner'||b.runId!==shop.world.runId||b.expectedVersion!==shop.world.revision||!b.idempotencyKey)reject(409,'ตรวจสอบรอบร้านและสิทธิ์ก่อนเริ่มใหม่');agent.stop();shop.reset();changed();return json({status:'verified',runId:shop.world.runId})}
        if(b.type==='choose_option'){const result=chooseOption(shop,b);changed();return json(result)}
        const out=domain.applyCommand(shop.world,b);shop.saveWorld(out.world);if(shop.world.managerPaused)agent.stop();changed();return json(out.receipt)
      }
      case '/api/manager/live/session':
      case '/api/manager/live/avatar':
      case '/api/manager/live/end': {
        if (!req.headers.origin) reject(403,'เปิดการคุยสดจากหน้าเว็บร้านเท่านั้น')
        if (path.endsWith('/session')) return json(await liveManager.start())
        if (path.endsWith('/avatar')) return json(await liveManager.avatar(b))
        return json(await liveManager.end(b))
      }
      case '/api/manager/live/read':return json(liveManager.read(b,req.headers))
      case '/api/customer/ask':return json(customer.submit(b))
      case '/api/customer/status':return json(customer.status(b.id))
      case '/api/chat':return json(agent.enqueue(b),202)
      case '/api/chat/cancel':agent.cancel(b.jobId);return json({ok:true})
      case '/api/memories':{if(typeof b.text!=='string'||!b.text.trim()||b.text.length>2000)reject(400,'กรอกความจำไม่เกิน 2,000 ตัวอักษร');const row={id:randomUUID(),text:b.text.trim(),at:shop.world.clock};shop.editOwner(o=>o.memories.push(row));changed();return json(row)}
      case '/api/reconnect':return json(await agent.reconnect())
      default:reject(404,'ไม่พบคำสั่ง')
    }
  }catch(e){if(!res.headersSent)json({error:e.message},e.status||400);else res.end()}
})
server.listen(port,'127.0.0.1',()=>{console.log('ร้านเรา http://127.0.0.1:'+port);agent.reconnect().catch(()=>changed())})
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{customer.close();agent.close();for(const c of events)c.end();server.close();setTimeout(()=>process.exit(),250).unref()})
