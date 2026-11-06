import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {Navigation} from '../src/survival/navigation.js'
const readyWorld=()=>({
 enabled:true,position:{x:5.5,y:66.62,z:5.5},serverPosition:{x:5.5,y:66.62,z:5.5},entityId:'77',
 attributes:{'minecraft:health':20},inputLocks:{},abilityState:{effective:{flying:false}},
 movementVerified:true,terrainKnown:()=>true,grounded:()=>true,clearBody:()=>true,players:new Map()
})
function setup(){
 const world=readyWorld(),nav=new Navigation(world),client=new EventEmitter()
 nav.attach(client)
 return {world,nav,client}
}
test('a verified live Bedrock spawn can restore a detached movement timer once',()=>{
 const {nav,client}=setup()
 try{
  // The connection is alive and world abilities are server-verified, but
  // navigation missed its spawn loop after an isolated process event.
  const result=nav.recoverFromLiveSpawn(client,{serverSpawned:true})
  assert.deepEqual(result,{ok:true,recovered:true})
  assert.equal(nav.spawned,true)
  assert(nav.timer)
  assert.equal(nav.loading.state,'complete')
  assert.equal(nav.route,null)
  assert.equal(nav.job,null)
 }finally{nav.detach()}
})
test('a fabricated spawn, different client or unsafe terrain cannot restart navigation',()=>{
 const {world,nav,client}=setup()
 try{
  assert.equal(nav.recoverFromLiveSpawn(client,{serverSpawned:false}).ok,false)
  assert.equal(nav.recoverFromLiveSpawn(new EventEmitter(),{serverSpawned:true}).ok,false)
  world.terrainKnown=()=>false
  assert.equal(nav.recoverFromLiveSpawn(client,{serverSpawned:true}).ok,false)
  assert.equal(nav.spawned,false)
 }finally{nav.detach()}
})
test('navigation reattachment is bounded per session and never loops on errors',()=>{
 const {nav,client}=setup()
 try{
  assert.equal(nav.recoverFromLiveSpawn(client,{serverSpawned:true}).ok,true)
  nav.detach()
  const second=nav.recoverFromLiveSpawn(client,{serverSpawned:true})
  assert.equal(second.ok,false)
  assert.match(second.reason,/already attempted/)
 }finally{nav.detach()}
})
