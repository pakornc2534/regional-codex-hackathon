import {updateBriefs} from './domain/shop-business.mjs'
const minute=60000, day=86400000, offset=7*60*minute
// Catch up one latest 07:00 briefing when the shop reopens after an absence.
export function tickShop(shop,now=Date.now()){
  const current=shop.world
  if(!Number.isFinite(current.clockAnchor)){shop.saveWorld({...current,clockAnchor:now});return false}
  const elapsed=Math.floor((now-current.clockAnchor)/minute)
  if(elapsed<1)return false
  const next=structuredClone(current),previous=Date.parse(current.clock)
  const target=previous+elapsed*minute
  const localDate=new Date(target+offset).toISOString().slice(0,10)
  let deadline=Date.parse(localDate+'T07:00:00+07:00')
  if(deadline>target)deadline-=day
  if(previous<deadline){
    next.clock=new Date(deadline).toISOString()
    updateBriefs(next)
  }
  next.clock=new Date(target).toISOString()
  next.clockAnchor=current.clockAnchor+elapsed*minute
  next.revision+=1
  shop.saveWorld(next)
  return true
}
