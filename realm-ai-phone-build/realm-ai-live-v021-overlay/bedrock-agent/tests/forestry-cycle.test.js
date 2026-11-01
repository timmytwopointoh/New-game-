import test from 'node:test'
import assert from 'node:assert/strict'
import {axeDurability,bestAxeSlot,chestCheckpoint,storageForTree,trunkIdentity,provisioningPlan} from '../src/survival/forestry-cycle.js'
import {parseResourceGoal,internalResourcePlan} from '../src/survival/internal-skills.js'

const axe=(network_id,damage=0)=>({network_id,count:1,extra:{nbt:{Damage:damage}}})
const registry={items:{11:{name:'wooden_axe',maxDurability:59},12:{name:'stone_axe',maxDurability:131},13:{name:'oak_log'},14:{name:'stick'}}}
test('tree2, tree5 and every third thereafter get chest checkpoints; following trees use current chest',()=>{
 assert.deepEqual([...Array(18)].map((_,i)=>i+1).filter(chestCheckpoint),[2,5,8,11,14,17])
 assert.equal(storageForTree(1),null);assert.equal(storageForTree(3),2);assert.equal(storageForTree(4),2)
 assert.equal(storageForTree(5),5);assert.equal(storageForTree(6),5);assert.equal(storageForTree(15),14)
})
test('six axes are a goal rather than a fabricated crafting result',()=>{
 const plan=provisioningPlan({oak_log:1},0,{needChest:true})
 assert.equal(plan.missingAxes,6);assert.equal(plan.neededSticks,12)
 assert.equal(plan.neededPlanks,36);assert.equal(plan.needLogs,8)
 assert.equal(plan.hasSupplies,false)
 assert.equal(provisioningPlan({oak_log:9},0,{needChest:true}).hasSupplies,true)
 assert.equal(provisioningPlan({oak_planks:18,stick:12,crafting_table:1},6,{hasTable:true}).missingAxes,0)
})
test('hotbar axe rotation prioritizes current usable and never selects broken or missing axes',()=>{
 const world={inventoryKnown:true,selectedSlot:0,registry,inventory:new Map([[0,axe(11,59)],[1,axe(11,20)],[2,axe(12,12)],[6,axe(12,0)]])}
 assert.equal(axeDurability(world.inventory.get(0),registry).remaining,0)
 assert.equal(bestAxeSlot(world),2)
 world.selectedSlot=1;assert.equal(bestAxeSlot(world),1)
 world.inventory.delete(1);assert.equal(bestAxeSlot(world),2)
 world.inventory.delete(2);assert.equal(bestAxeSlot(world),null)
})
test('tree identity groups nearby vertical logs while keeping distant trunks separate',()=>{
 const roots=[{x:8,y:64,z:12}]
 assert.equal(trunkIdentity({x:8,y:71,z:12},roots),roots[0])
 assert.notEqual(trunkIdentity({x:12,y:65,z:12},roots),roots[0])
})
test('get wood is unbounded until Stop but find and mine retains finite budget',()=>{
 const forever=internalResourcePlan('go get wood',{knownInventory:true})
 assert.equal(forever.goal.maxBlocks,null)
 assert.equal(forever.limits.continuous,true)
 assert.equal(parseResourceGoal('find and mine iron ore').maxBlocks,8)
})
