import {dayKey,dayMs,plus,roundQty,type Shop,type Order,type Variant} from './model'
export const unpacked=(o:Order)=>o.paid && o.channel==='online' && (o.stage==='waiting'||o.stage==='packing')
export const atShop=(o:Order)=>unpacked(o)||(o.paid && o.channel==='online'&&o.stage==='ready')
export const recipe=(large:boolean)=>[large?0:1,large?1:0,large?1.5:0.5,1.5,1,0.15]
export const channelKey=(v:Variant)=>['shopee-th','sim-shop',v.productId,v.id].join('|')
export function facts(s:Shop){
 const end=dayKey(s.clock),start=dayKey(plus(s.clock,-28*dayMs)),week=dayKey(plus(s.clock,-6*dayMs))
 const per=Object.fromEntries(s.variants.map(v=>[v.id,{online:0,pos:0,reserved:0,queue:0}]))
 const trend=Array.from({length:7},(_,i)=>({date:dayKey(plus(s.clock,(i-6)*dayMs)),sales:0,count:0}))
 const byDay=new Map(trend.map(t=>[t.date,t]))
 let paid=0,sales=0,settled=0,queue=0,parcels=0
 for(const o of s.orders){if(!o.paid||o.stage==='cancelled')continue
  const p=per[o.variantId],date=dayKey(o.createdAt)
  if(date>=start&&date<end)p[o.channel]+=o.qty
  if(atShop(o))p.reserved+=o.qty
  if(unpacked(o)){p.queue+=o.qty;queue+=o.qty;parcels++}
  const daily=byDay.get(date);if(daily){daily.sales+=o.paidAmount;daily.count++}
  paid++;sales+=o.paidAmount;settled+=o.settlement?.amount??0
 }
 const variants=s.variants.map(v=>({...v,...per[v.id],available:v.physical-per[v.id].reserved}))
 const supplies=s.supplies.map((m,i)=>{
  const committed=variants.reduce((a,v)=>a+v.queue*recipe(v.large)[i],0)
  const rate=variants.reduce((a,v)=>a+v.online/28*recipe(v.large)[i],0),free=roundQty(m.quantity-committed)
  const days=rate>0?Math.max(0,free/rate):null
  return {...m,free,reserved:roundQty(committed),rate,days,orderBy:days===null?null:dayKey(plus(s.clock,Math.floor(days-m.lead)*dayMs))}
 })
 return {variants,supplies,total:s.orders.length,paid,sales,settled,queue,parcels,week,start,end,trend,weekSales:trend.reduce((n,t)=>n+t.sales,0),weekCount:trend.reduce((n,t)=>n+t.count,0)}
}
export type Facts=ReturnType<typeof facts>
