import test from 'node:test'
import assert from 'node:assert/strict'
import {gzipSync} from 'node:zlib'
import {encode,decode,rawLimit} from '../web-host/codec.mjs'
import worker from '../web-host/worker.mjs'
const stream=x=>new Blob([x]).stream()
test('small and large Thai snapshots preserve all orders and numeric values',async()=>{
 const small={id:'sim-one',items:[0,null,'ร้านจำลอง']};assert.equal(await encode(small),JSON.stringify(small))
 const records=Array.from({length:30000},(_,id)=>({id,description:'หนึ่งออเดอร์มีสินค้าหลายชิ้น',total:59.95}))
 const wire=await encode({records});assert.equal(JSON.parse(wire).encoding,'gzip-base64')
 assert.deepEqual((await decode(stream(wire))).records,records)
})
test('rejects corrupt transport, oversized JSON, and excessive decompression',async()=>{
 await assert.rejects(decode(stream(JSON.stringify({encoding:'gzip-base64',data:'AAAA'}))))
 await assert.rejects(encode('x'.repeat(rawLimit+1)))
 const data=gzipSync(Buffer.alloc(rawLimit+1)).toString('base64')
 await assert.rejects(decode(stream(JSON.stringify({encoding:'gzip-base64',data}))))
})
class Bucket{
 rows=new Map()
 async get(k){const v=this.rows.get(k);return v===undefined?null:{body:stream(v),json:async()=>JSON.parse(v)}}
 async head(k){return this.rows.has(k)?{}:null}
 async put(k,v,opts){if(opts?.onlyIf?.etagDoesNotMatch==='*' && this.rows.has(k))return null;this.rows.set(k,v);return {}}
 async delete(k){this.rows.delete(k)}
 async list({prefix,limit}){return {objects:[...this.rows.keys()].filter(k=>k.startsWith(prefix)).sort().slice(0,limit).map(key=>({key}))}}
}
test('gateway requires relay secret and simulated snapshots, disables writes on stale data',async()=>{
 const env={BUCKET:new Bucket(),PUBLIC_DEMO_ENABLED:'true',RELAY_SECRET:'test-only'}
 const invoke=(p,method='GET',body,headers={})=>worker.fetch(new Request('https://shop.example'+p,{method,headers,body:body?JSON.stringify(body):undefined}),env)
 const relay={authorization:'Bearer test-only'},source={origin:'https://shop.example','Content-Type':'application/json'}
 const snap={shop:{mode:'simulated'},runId:'sim-run-test',connection:{status:'ready'}}
 assert.equal((await invoke('/relay/snapshot','POST',snap)).status,401)
 assert.equal((await invoke('/relay/snapshot','POST',{...snap,shop:{mode:'live'}},relay)).status,400)
 assert.equal((await invoke('/relay/snapshot','POST',snap,relay)).status,200)
 assert.equal((await (await invoke('/api/state')).json()).shop.mode,'simulated')
 assert.equal((await invoke('/api/chat','POST',{},{})).status,403)
 const h=await (await env.BUCKET.get('seen')).json();await env.BUCKET.put('seen',JSON.stringify({...h,at:Date.now()-16000}))
 assert.equal((await (await invoke('/api/state')).json()).connection.status,'disconnected')
 assert.equal((await invoke('/api/chat','POST',{},source)).status,503)
 env.PUBLIC_DEMO_ENABLED='false';assert.equal((await invoke('/api/state')).status,403)
})

test('Dot receives the same read-only shop counts and no order or owner records',async()=>{
  const env={BUCKET:new Bucket(), PUBLIC_DEMO_ENABLED:'true', RELAY_SECRET:'test-only'}
  const url='https://shop.example/api/dot-summary'
  const read=()=>worker.fetch(new Request(url),env)
  assert.equal((await read()).status,503)
  const clock='2026-10-02T08:00:00+07:00'
  const snapshot={
    shop:{mode:'simulated'},runId:'seed-1',revision:8,clock,
    orders:Array.from({length:5},(_,i)=>({id:'order-'+i,createdAt:clock,paymentStatus:'paid',paidAmount:200,customerId:'secret-customer'})),
    metrics:{queueOrders:5},cases:[{status:'awaiting_approval'}],returns:[],supplies:[],
    owner:{messages:[{text:'private conversation'}]},
  }
  const publish=await worker.fetch(new Request('https://shop.example/relay/snapshot',{
    method:'POST',headers:{authorization:'Bearer test-only'},body:JSON.stringify(snapshot),
  }),env)
  assert.equal(publish.status,200)
  const response=await read()
  assert.equal(response.status,200)
  assert.equal(response.headers.get('cache-control'),'no-store')
  const expected={runId:'seed-1',revision:8,clock,stale:false,orders:5,baseline:0,amount:1000,spike:true,
    overdue:null,queue:5,approval:1,returns:0,supplies:0}
  assert.deepEqual(await response.json(),expected)
  const write=await worker.fetch(new Request(url,{method:'POST'}),env)
  assert.equal(write.status,405)
  assert.equal(write.headers.get('allow'),'GET')
  assert.equal((await env.BUCKET.list({prefix:'queue/',limit:1})).objects.length,0)
  const heartbeat=await (await env.BUCKET.get('seen')).json()
  await env.BUCKET.put('seen',JSON.stringify({...heartbeat,at:Date.now()-20000}))
  assert.deepEqual(await (await read()).json(),{...expected,stale:true,spike:null})
  env.PUBLIC_DEMO_ENABLED='false'
  assert.equal((await read()).status,403)
})
