import test from 'node:test'
import assert from 'node:assert/strict'
import {GOALS,understandMinecraftGoal} from '../src/survival/minecraft-goal-knowledge.js'

const ask=(q,options)=>understandMinecraftGoal(q,options)
test('recognizes core survival, crafting, biome and progression goals',()=>{
 const examples={
  'build a starter shelter':'starter-shelter',
  'how do I farm wheat':'wheat-farm',
  'plan to breed cows':'livestock',
  'how can we get iron equipment':'iron-equipment',
  'find diamonds':'diamond-mining',
  'prepare for the nether':'nether-prep',
  'plan enchanting':'enchanting',
  'how do we brew potions':'brewing',
  'make a chest room':'storage',
  'smelt some ores':'smelting',
  'plan redstone machine':'redstone',
  'prepare for the end portal':'end-expedition',
  'protect villagers':'village',
  'fish from dry land':'fishing',
  'explore the area':'exploration'
 }
 for(const [prompt,goal] of Object.entries(examples)){
  const result=ask(prompt)
  assert.equal(result?.goal,goal,prompt)
  assert.equal(result.planningOnly,true)
  assert.equal(result.acceptedActions,0)
  assert(result.steps.length>=3)
  assert(result.steps.every(s=>s.confirmed===false&&typeof s.abilityStatus==='string'))
 }
 assert.equal(GOALS.length,15)
})
test('live inventory is factored without inventing ownership or crafting',()=>{
 const known=ask('how to mine diamonds',{inventoryKnown:true,inventory:{iron_pickaxe:1,coal:8},dimension:0,health:20})
 assert(known.knownMissing.includes('diamond_ore'))
 assert(!known.knownMissing.includes('iron_pickaxe'))
 assert(known.steps[0].inInventory.includes('iron_pickaxe'))
 const unknown=ask('how to mine diamonds',{inventoryKnown:false})
 assert.equal(unknown.knownMissing.length,0)
 assert.equal(unknown.inventoryKnown,false)
 assert.equal(unknown.steps.some(s=>s.confirmed),false)
})
test('low health and world dimension appear as risks but never send commands',()=>{
 const a=ask('make a wheat farm',{dimension:1,health:4})
 assert(a.risks.some(x=>x.includes('Overworld')))
 assert(a.risks.some(x=>x.includes('low health')))
 const b=ask('prepare for the nether')
 assert(b.notes.some(x=>x.includes('Nether beds explode')))
 assert(b.steps.some(s=>s.ability==='dimension-travel'&&s.abilityStatus.includes('not generally automated')))
})
test('non destructive item-dependency plans use versioned recipes and observed inventory',()=>{
 const plan=ask('plan to make a diamond pickaxe',{inventoryKnown:true,inventory:{}})
 assert.equal(plan.kind,'minecraft-item-plan')
 assert.equal(plan.item,'diamond_pickaxe')
 assert.equal(plan.planningOnly,true)
 assert(plan.steps.length>0)
 assert(plan.knownMissing.length>0)
 assert(plan.steps.every(s=>s.confirmed===false))
})
test('unrecognized and dangerous chat cannot become destructive execution',()=>{
 for(const s of ['stop','follow me','this is your new home spot','go home','clear path to 3 64 9','mine 20 logs','run plan','inventory','tell me everything']){
  assert.equal(ask(s),null,s)
 }
 assert.equal(ask('how can I craft skibidiblock666')?.kind,'minecraft-goal-unknown')
 assert.equal(ask('build castle'),null,'unspecified large structural edit cannot be assumed actionable')
 assert.equal(ask('x'.repeat(300)),null)
})
