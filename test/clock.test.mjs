import test from 'node:test'
import assert from 'node:assert/strict'
import {seedWorld} from '../server/domain/index.mjs'
import {tickShop} from '../server/demo-clock.mjs'
test('elapsed time crosses Bangkok 07:00 exactly once and catches up the latest missed briefing',()=>{
  const s={world:seedWorld(),saveWorld(w){this.world=w}}
  const t=1000000
  tickShop(s,t);tickShop(s,t+600000);assert.equal(s.world.briefs.length,1)
  tickShop(s,t+660000);assert.equal(s.world.briefs.length,1)
  tickShop(s,t+3*86400000);assert.equal(s.world.briefs.length,2);assert.equal(s.world.mail.length,2)
})
