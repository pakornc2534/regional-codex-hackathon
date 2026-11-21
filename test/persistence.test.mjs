import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {openShop} from '../server/persistence.mjs'
test('a restart preserves owner memory and shop; reset archives both under original run',()=>{
 const root=mkdtempSync(join(tmpdir(),'raan-test-'))
 try{
   const shop=openShop(root),before=shop.world.runId
   shop.editOwner(o=>o.memories.push({id:'one',text:'สินค้ากล่องใหญ่'}))
   const reopened=openShop(root)
   assert.equal(reopened.owner.memories[0].text,'สินค้ากล่องใหญ่')
   assert.equal(reopened.world.runId,before)
   reopened.reset();assert.notEqual(reopened.world.runId,before);assert.equal(reopened.owner.memories.length,0)
   assert.ok(existsSync(join(root,before,'store.json')))
 }finally{rmSync(root,{recursive:true})}
})
