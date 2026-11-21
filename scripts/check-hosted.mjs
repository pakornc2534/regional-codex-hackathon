import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const site=process.env.SITE_URL
if(new URL(site).protocol!=='https:')throw Error('Set SITE_URL to the public demo')
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']})
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const resp=await page.goto(site,{waitUntil:'domcontentloaded'});assert.equal(resp.status(),200)
 const field=page.getByRole('textbox',{name:'ข้อความถึงผู้จัดการ AI'})
 await field.waitFor({timeout:60000})
 await page.getByText('เดโมสาธารณะ ทุกคนเห็นและแก้ข้อมูลร้านจำลองร่วมกัน กรุณาอย่ากรอกข้อมูลส่วนตัว').waitFor()
 const state=await (await page.request.get(site+'/api/state')).json()
 assert.equal(state.hosted.publicDemo,true);assert.equal(state.hosted.stale,false)
 const q='ช่วยดูยอดขายที่ชำระแล้วในช่วง 7 วันจากข้อมูลร้านจำลอง แล้วสรุปสั้น ๆ ให้หน่อยครับ'
 const submitted=page.waitForResponse(r=>r.url().endsWith('/api/chat')&&r.request().method()==='POST',{timeout:45000})
 await field.fill(q);await page.getByRole('button',{name:'ส่งให้ผู้จัดการ AI'}).click()
 const ack=await submitted;assert.ok(ack.ok(),await ack.text())
 const {jobId}=await ack.json();console.log('Hosted job accepted')
 const until=Date.now()+180000
 let reply
 while(Date.now()<until){
   await new Promise(r=>setTimeout(r,2500))
   const s=await (await page.request.get(site+'/api/state')).json()
   reply=s.owner?.messages.find(m=>m.id===jobId)
   if(['completed','failed'].includes(reply?.status))break
 }
 assert.equal(reply?.status,'completed',reply?.text);console.log('Hosted model:',reply.text)
 await page.waitForFunction(id=>Array.from(document.querySelectorAll('[data-message-id]')).some(el=>el.dataset.messageId===id && el.querySelector('.desk-answer')?.textContent.trim()),jobId,{timeout:25000})
 await mkdir('docs/screenshots',{recursive:true})
 await page.screenshot({path:'docs/screenshots/hosted-demo.png'})
 assert.deepEqual(errors,[])
}finally{await browser.close()}
