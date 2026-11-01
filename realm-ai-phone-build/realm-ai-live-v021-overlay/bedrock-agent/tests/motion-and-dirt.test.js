import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {realm} from './helpers/realm.js'
import {RealmEditGrant} from '../src/survival/realm-edit-grant.js'
import {MiningJobs} from '../src/survival/mining-jobs.js'
import {selectKnownResource} from '../src/survival/internal-skills.js'
import {miningAssessment,recoveryDecision} from '../src/survival/obstacles.js'

test('own server knockback survives Stop and ordinary position feedback, then lands within normal ticks',()=>{
 const f=realm();try{
  const now=Date.now(),start={...f.w.position}
  assert.equal(f.n.observeMotion({runtime_entity_id:99n,velocity:{x:.3,y:.4,z:0}}),false)
  f.c.emit('set_entity_motion',{runtime_entity_id:1n,velocity:{x:.3,y:.4,z:0},tick:1n})
  f.n.stop('',false)
  f.n.observeServer({position:{...f.w.position},on_ground:false},now)
  assert.equal(f.n.vy,.4)
  assert.equal(f.n.observeMotion({runtime_entity_id:1n,velocity:{x:0,y:0,z:0},tick:0n},now),false)
  for(let i=0;i<26;i++)f.n.step(now+i*50)
  assert(f.w.position.x>start.x+.5)
  assert(f.w.grounded(),JSON.stringify(f.n.snapshot()))
  assert.equal(f.n.externalMotion,null)
  assert(Math.abs(f.w.position.y-start.y)<.003)
  assert(f.sent.every(([name])=>name!=='move_player'))
 }finally{f.close()}
})
test('knockback respects a wall instead of clipping through it',()=>{
 const f=realm();try{
  f.set({x:1,y:64,z:0},'stone');f.set({x:1,y:65,z:0},'stone')
  f.n.observeMotion({runtime_entity_id:1n,velocity:{x:.8,y:0,z:0}},1000)
  for(let i=0;i<12;i++)f.n.step(1000+i*50)
  assert(f.w.position.x<=.70001);assert(f.w.clearBody(f.w.position))
 }finally{f.close()}
})
test('repeated collision queries reuse block states while actual block updates remain authoritative',()=>{
 const f=realm();try{
  f.w.blockStates.clear();let creates=0;const original=f.w.Block.fromStateId
  f.w.Block.fromStateId=function(...args){creates++;return original.apply(this,args)}
  try{for(let i=0;i<100;i++)assert(f.w.grounded());assert(creates<5,`constructed ${creates} blocks`)
   f.set({x:0,y:63,z:0},'air');assert.equal(f.w.grounded(),false)
  }finally{f.w.Block.fromStateId=original}
 }finally{f.close()}
})
test('dirt search recognizes grass-covered dirt and skips the supporting block underfoot',()=>{
 const world={position:{x:.5,y:65.62,z:.5},standPosition:()=>({x:0,y:64,z:0}),scan(name){return {found:name==='dirt'?[{x:0,y:63,z:0,name,distance:1}]:name==='grass_block'?[{x:1,y:63,z:0,name,distance:2}]:[]}}}
 assert.equal(selectKnownResource(world,{target:'dirt',maxDistance:8}).name,'grass_block')
})
test('dirt quarry starts without manufacturing an unnecessary pickaxe or shovel prerequisite',()=>{
 const c={world:{gameMode:'survival',items:()=>({}),standPosition:()=>({x:0,y:64,z:0})},workshop:{ensure(){throw Error('dirt does not need a crafting prerequisite')}},report(){}}
 const m=new MiningJobs(c);m.active={request:{kind:'quarry',material:'dirt'},heading:{x:1,z:0}}
 m.provision(1000);assert.equal(m.active.state,'excavating');assert(m.active.layout.points.length>0)
})
test('owner clearing grant persists only for the first identified Realm, never another Realm',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-grant-'));try{
  const grant=new RealmEditGrant(dir);assert.equal(grant.allows(null),false);assert(grant.allows('realm-one'))
  const restored=new RealmEditGrant(dir);assert(restored.allows('realm-one'));assert.equal(restored.allows('realm-two'),false)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('owner-authorized construction mining still checks tool, server permission and breakability',()=>{
 const f=realm();try{
  f.w.inventoryKnown=true;f.w.selectedSlot=0;f.w.inventory.set(0,{network_id:0,count:0})
  const p={x:1,y:64,z:0};f.set(p,'oak_planks')
  assert.equal(miningAssessment(f.w,p,{explicit:true}).ok,false)
  f.w.allowBuiltMining=true;assert(miningAssessment(f.w,p,{explicit:true}).ok)
  f.w.abilityState.effective.mine=false;assert.equal(miningAssessment(f.w,p,{explicit:true}).ok,false)
  f.w.abilityState.effective.mine=true;f.set(p,'bedrock');assert.equal(miningAssessment(f.w,p,{explicit:true}).ok,false)
 }finally{f.close()}
 assert.equal(recoveryDecision({mode:'follow',canJump:true,attempts:5}).action,'jump')
 assert.equal(recoveryDecision({mode:'follow',canJump:true,attempts:6}).action,'pause')
})
