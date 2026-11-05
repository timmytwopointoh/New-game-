import test from 'node:test'
import assert from 'node:assert/strict'
import {Navigation} from '../src/survival/navigation.js'

function setup(){
 const outgoing=[],notices=[],closed={disconnect:0,close:0}
 const world={
  attributes:{'minecraft:health':20},position:{x:.5,y:4096,z:.5},
  terrainKnown:()=>false,requestNearby:()=>{},enabled:true,
  gameMode:'survival',inputLocks:{}
 }
 const nav=new Navigation(world,message=>notices.push(message))
 nav.client={queue:(name,data)=>outgoing.push({name,data}),disconnect:()=>closed.disconnect++,close:()=>closed.close++}
 nav.spawned=true
 nav.tick=0n
 nav.finishLoading=()=>{}
 nav.checkVerification=()=>{}
 nav.defend=()=>{}
 nav.surveyTick=()=>{}
 nav.checkRespawn=()=>false
 return {nav,world,outgoing,notices,closed}
}
test('missing terrain for over five seconds leaves Realm connection alive and queues neutral input',()=>{
 const h=setup()
 h.nav.inputStep(1000)
 h.nav.inputStep(8000)
 h.nav.inputStep(16000)
 assert.equal(h.closed.disconnect,0,'bot may not disconnect itself when terrain is slow')
 assert.equal(h.closed.close,0,'bot may not close transport when terrain is slow')
 assert.equal(h.nav.spawned,true)
 assert.equal(h.outgoing.length,3,'keep sending harmless neutral input while chunks stream')
 assert.ok(h.outgoing.every(p=>p.name==='player_auth_input'))
 assert.ok(h.outgoing.every(p=>p.data.move_vector.x===0&&p.data.move_vector.z===0))
 assert.ok(h.outgoing.every(p=>p.data.delta.y===0))
 assert.ok(h.outgoing.every(p=>p.data.block_action===null))
 assert.ok(h.notices.some(x=>x.includes('Waiting for server terrain')))
})
test('unknown terrain never executes queued movement or mining while loading',()=>{
 const h=setup()
 h.nav.inputStep(1100)
 assert.equal(h.nav.world.position.y,4096,'no speculative gravity or teleport')
 assert.equal(h.outgoing[0].data.transaction,null)
 assert.deepEqual(h.outgoing[0].data.input_data,['received_server_data'])
})
