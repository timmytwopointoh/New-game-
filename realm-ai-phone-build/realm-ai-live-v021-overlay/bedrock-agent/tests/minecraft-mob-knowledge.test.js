import test from 'node:test'
import assert from 'node:assert/strict'
import {minecraftMobExplanation} from '../src/survival/minecraft-mob-knowledge.js'
test('common vanilla mobs are explained without creating a combat task',()=>{
 const questions={
  'what is a creeper':'creeper',
  'what do you know about zombies':'zombie',
  'tell me about cave spiders':'cave_spider',
  'how do i avoid endermen':'enderman',
  'is a piglin brute hostile':'piglin_brute',
  'how should we survive the warden':'warden',
  'tell me about the ender dragon':'ender_dragon',
  'what do villagers do':'villager',
  'explain bees':'bee',
  'what is a wolf':'wolf',
  'how can i approach an iron golem':'iron_golem'
 }
 for(const [q,expected] of Object.entries(questions)){
  const x=minecraftMobExplanation(q)
  assert.equal(x?.name,expected,q)
  assert.equal(x.planningOnly,true)
  assert.equal(x.combatStarted,false)
  assert.equal(x.liveEvidence.seen,false)
 }
})
test('nearby entities are counted only from live Realm positions and correct mob type',()=>{
 const world={position:{x:0,y:65,z:0},entities:new Map([
  ['a',{type:'minecraft:creeper',position:{x:5,y:65,z:0}}],
  ['b',{type:'minecraft:creeper',position:{x:8,y:65,z:0}}],
  ['c',{type:'minecraft:zombie',position:{x:1,y:65,z:0}}]
 ])}
 const x=minecraftMobExplanation('tell me about creepers',{world,realmSpawned:true})
 assert.equal(x.name,'creeper')
 assert.equal(x.liveEvidence.count,2)
 assert.equal(x.liveEvidence.nearestBlocks,5)
 assert.equal(minecraftMobExplanation('tell me about creepers',{world,realmSpawned:false}).liveEvidence.seen,false)
})
test('unrelated chat, instructions and dangerous action requests do not produce fake mob execution',()=>{
 for(const s of ['go home','follow me','fight all zombies','kill the village','what is your name','stop','start goal']){
  assert.equal(minecraftMobExplanation(s),null,s)
 }
 assert.equal(minecraftMobExplanation('x'.repeat(200)),null)
})
