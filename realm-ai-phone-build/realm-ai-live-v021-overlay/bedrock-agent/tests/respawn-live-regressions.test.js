import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {RespawnRecovery,respawnState} from '../src/survival/respawn.js'

function setup(){
 const client=new EventEmitter(),sent=[]
 client.queue=(kind,p)=>sent.push({kind,p})
 const world={entityId:'5',hardcore:false,attributes:{'minecraft:health':20},standPosition:()=>({x:0,y:65,z:0}),position:{x:.5,y:66.62,z:.5}}
 client.on('set_health',p=>{world.attributes['minecraft:health']=p.health})
 const navigation={spawned:true,job:{kind:'follow'},stop(){this.job=null},observeServer(p){world.position=p.position},loading:null,unknownSince:123,vy:0}
 const messages=[],r=new RespawnRecovery(world,navigation,()=>{},msg=>messages.push(msg));r.attach(client)
 return {client,world,navigation,messages,r,sent,close:()=>r.detach()}
}
test('respawn accepts numeric and named Bedrock packet states',()=>{
 assert.equal(respawnState(0),0);assert.equal(respawnState('SearchingForSpawn'),0)
 assert.equal(respawnState(1),1);assert.equal(respawnState('ReadyToSpawn'),1)
 assert.equal(respawnState('ClientReadyToSpawn'),null)
})
test('server positive health after death is enough to unblock even without ReadyToSpawn event',()=>{
 const f=setup();try{
 f.client.emit('set_health',{health:0});assert.equal(f.r.state,'waiting-for-server')
 assert.equal(f.sent.filter(s=>s.kind==='player_action').length,1)
 f.client.emit('set_health',{health:20})
 assert.equal(f.r.state,'respawned')
 assert.equal(f.navigation.job,null)
 assert.equal(f.navigation.unknownSince,null)
 assert.equal(f.world.attributes['minecraft:health'],20)
 }finally{f.close()}
})
test('a delayed positive-health server update can recover after timeout without resuming jobs',()=>{
 const f=setup();try{
 f.client.emit('set_health',{health:0});f.r.tick(f.r.startedAt+16000)
 assert.equal(f.r.state,'blocked')
 f.client.emit('set_health',{health:20})
 assert.equal(f.r.state,'respawned');assert.equal(f.navigation.job,null)
 }finally{f.close()}
})
test('server ready state is acknowledged only with a real position, preserving player health',()=>{
 const f=setup();try{
 f.client.emit('set_health',{health:0});f.client.emit('respawn',{runtime_entity_id:5n,state:'ReadyToSpawn',position:{x:2,y:70,z:3}})
 assert(f.sent.some(s=>s.kind==='respawn'&&s.p.state===2));assert.equal(f.world.attributes['minecraft:health'],0)
 }finally{f.close()}
})
test('wrong actor respawn packets do not trigger acknowledgements',()=>{
 const f=setup();try{
 f.client.emit('set_health',{health:0});f.client.emit('respawn',{runtime_entity_id:9n,state:1,position:{x:2,y:70,z:3}})
 assert.equal(f.sent.filter(s=>s.kind==='respawn').length,0)
 }finally{f.close()}
})
