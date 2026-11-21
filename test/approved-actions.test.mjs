import test from 'node:test'
import assert from 'node:assert/strict'
import {chooseOption,executeApproved} from '../server/approved-actions.mjs'
import {seedWorld,addManagerProposal,analyzeCase} from '../server/domain/index.mjs'
test('model execution consumes only a matching durable owner choice and verifies duplicate reads',()=>{
 const shop={world:seedWorld(),saveWorld(next){this.world=next}}
 const caseId=shop.world.cases[0].id
 const {world,proposal}=addManagerProposal(shop.world,analyzeCase(shop.world,{caseId}));shop.saveWorld(world)
 const input={type:'choose_option',actor:'owner',caseId,proposalId:proposal.id,optionId:proposal.options[0].id,runId:world.runId,expectedVersion:world.revision,idempotencyKey:'demo-choice'}
 assert.throws(()=>executeApproved(shop,input))
 const result=chooseOption(shop,input);assert.equal(result.status,'verified')
 assert.throws(()=>executeApproved(shop,{...input,caseId:world.cases[1].id}))
 assert.deepEqual(executeApproved(shop,input),result)
 assert.throws(()=>chooseOption(shop,{...input,optionId:'other'}))
})
