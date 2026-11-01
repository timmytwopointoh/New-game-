import test from 'node:test'
import assert from 'node:assert/strict'
import {parseResourceGoal,internalResourcePlan,mineableKnowledge,selectKnownResource,isTreeLog,treeTrunks} from '../src/survival/internal-skills.js'

test('tree harvest is an internal task, not a button or Google request',()=>{
 const plan=internalResourcePlan('cut down every tree you come across')
 assert.equal(plan.goal.kind,'tree-harvest');assert.equal(plan.noFakeCompletion,true)
 assert.equal(plan.equipment[0].name,'crafting_table');assert.equal(plan.equipment[1].name,'wooden_axe');assert.equal(plan.equipment[2].name,'chest')
 assert.equal(plan.blockedSkills.includes('craft'),true)
 assert.match(plan.storagePolicy,/Do not drop valuable items/i)
})
test('recognized block names map to observed local mining, not invented coordinates',()=>{
 assert.equal(parseResourceGoal('go find and mine iron ore').target,'iron_ore')
 assert.equal(parseResourceGoal('find and mine no_such_block').error.includes('No known'),true)
 assert.equal(parseResourceGoal('hello'),null)
 assert.equal(parseResourceGoal('go chop down wood')?.kind,'tree-harvest')
})
test('can break with the wrong tool without claiming a drop',()=>{
 const b={diggable:true,hardness:1.5,canHarvest:()=>false,digTime:()=>15000}
 const facts=mineableKnowledge(b,null);assert.equal(facts.breakable,true);assert.equal(facts.harvestable,false);assert.equal(facts.estimatedMs,15000)
 assert.match(facts.reason,/not expected to harvest/)
 assert.equal(mineableKnowledge({...b,hardness:-1}).breakable,false)
})
test('only reported and visible logs qualify for harvest, never invented trees',()=>{
 assert.ok(treeTrunks.includes('oak_log'));assert.equal(isTreeLog('stripped_oak_log'),false)
 const world={position:{x:0,y:65,z:0},scan(name){return name==='oak_log'?{found:[{x:2,y:65,z:3,name,distance:3.6}]}:{found:[]}}}
 const goal=parseResourceGoal('chop down trees')
 assert.deepEqual(selectKnownResource(world,goal)?.name,'oak_log')
 assert.equal(selectKnownResource(world,goal,new Set(['2,65,3'])),null)
})
