import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {WorldView} from '../src/survival/world.js'
import {Navigation} from '../src/survival/navigation.js'
import {SurvivalVerification} from '../src/survival/verification.js'
const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer')

function fixture({mode='creative',height=69.62,loaded=true}={}){
 const c=new EventEmitter(),sent=[],writer=createSerializer('1.26.60'),reader=createDeserializer('1.26.60')
 // Round-trip the real bundled codec, so checks use the actual received shape,
 // ID types and float32 positions rather than only hand-written packet objects.
 const wire=(name,params)=>reader.parsePacketBuffer(writer.createPacketBuffer({name,params})).data.params
 c.queue=(name,p)=>{sent.push([name,wire(name,p)])}
 const w=new WorldView(),n=new Navigation(w),v=new SurvivalVerification(w,n)
 w.attach(c);n.attach(c);v.attach(c);v.desiredMode=mode;n.checkVerification=()=>v.check(n.lastInputAt)
 const start={server_authoritative_block_breaking:true,player_gamemode:mode,entity_id:42n,runtime_entity_id:1n,player_position:{x:.5,y:Math.fround(height),z:.5},dimension:0}
 c.emit('start_game',start);c.emit('spawn');clearInterval(n.timer);n.timer=null
 const ids={};for(const [id,b] of Object.entries(w.registry.blocksByRuntimeId))if(b.stateId===w.registry.blocksByName[b.name]?.defaultState)ids[b.name]=Number(id)
 const fill=()=>{for(let x=-2;x<=4;x++)for(let z=-2;z<=2;z++)for(let y=62;y<=74;y++)for(let layer=0;layer<=1;layer++)w.update({position:{x,y,z},block_runtime_id:!layer&&y===63?ids.stone:ids.air,layer})}
 if(loaded)fill()
 const abilities=({flying=false,loading=false,currentMode=mode,invulnerable=currentMode==='creative',own=42n}={})=>c.emit('update_abilities',wire('update_abilities',{entity_unique_id:own,permission_level:'member',command_permission:'normal',abilities:[{type:'base',allowed:{flying:true,may_fly:true,invulnerable:true,instant_build:true},enabled:{flying,may_fly:currentMode==='creative',invulnerable,instant_build:currentMode==='creative'},fly_speed:.05,vertical_fly_speed:1,walk_speed:.1},...(loading?[{type:'loading_screen',allowed:{flying:true,invulnerable:true},enabled:{flying:true,invulnerable:true},fly_speed:.05,vertical_fly_speed:1,walk_speed:.1}]:[])]}))
 const close=()=>{v.detach();n.detach();w.detach()}
 return {w,n,v,c,sent,wire,abilities,fill,close}
}

test('spawn acknowledges loading only after terrain arrives, once, even with loading abilities active',()=>{
 const f=fixture({loaded:false});try{
 f.abilities({loading:true});f.n.step(1000)
 assert(!f.sent.some(([name])=>name==='serverbound_loading_screen'))
 assert(!f.w.movementVerified);assert.match(f.v.reason,/loading/)
 f.fill();f.n.step(1050);f.n.step(1100)
 const end=f.sent.filter(([name])=>name==='serverbound_loading_screen')
 assert.equal(end.length,1);assert.equal(end[0][1].type,2);assert.equal(end[0][1].loading_screen_id,undefined)
 assert(f.w.abilityState.loading,'sending acknowledgement must not invent a server ability update')
 f.abilities();assert(f.w.creativeMovementVerified)
 }finally{f.close()}
})

test('flight disable uses false ability request, retries with a bound, and waits for own server confirmation',()=>{
 const f=fixture();try{
 const now=Date.now();f.abilities({flying:true})
 for(let at=0;at<=5500;at+=50)f.n.step(now+at)
 const requests=f.sent.filter(([name])=>name==='request_ability')
 assert.equal(requests.length,5);assert(requests.every(([,p])=>p.ability==='flying'&&p.value_type==='bool'&&!p.bool_value))
 assert.equal(f.sent.filter(([name,p])=>name==='player_action'&&p.action==='stop_flying').length,5)
 assert.equal(f.sent.filter(([name,p])=>name==='player_auth_input'&&p.input_data.includes('stop_flying')).length,5)
 assert(!f.w.movementVerified);assert.equal(f.v.flightRecovery.state,'unconfirmed');assert.match(f.v.reason,/not confirmed flight disabled/)
 f.abilities({own:99n});assert(f.w.abilityState.effective.flying,'other players cannot confirm our flight off')
 f.abilities();f.n.step(now+5600);assert.equal(f.v.flightRecovery.state,'disabled');assert(f.w.movementVerified)
 assert(f.w.grounded());assert(f.n.walk({x:2,y:64,z:0}).accepted)
 for(let at=5650;at<7500;at+=50)f.n.step(now+at)
 assert(f.w.position.x>2);assert(f.w.grounded())
 assert(!f.sent.some(([name,p])=>name==='command_request'||name==='client_cheat_ability'||p.ability==='invulnerable'||p.ability==='may_fly'))
 }finally{f.close()}
})

test('early pre-spawn flight evidence is not falsely marked sent and a new flight episode gets its own retry budget',()=>{
 const f=fixture({height:65.62});try{
 f.n.spawned=false;f.abilities({flying:true});f.v.check(1000)
 assert.equal(f.v.flightRecovery.attempts,0);assert(!f.v.flightStopped)
 f.n.spawned=true;f.n.step(1100);assert.equal(f.v.flightRecovery.attempts,1)
 f.abilities();f.n.step(1150);assert(f.v.flightStopped)
 f.abilities({flying:true});f.n.step(1200);assert.equal(f.v.flightRecovery.attempts,1)
 assert.equal(f.sent.filter(([name])=>name==='request_ability').length,2)
 }finally{f.close()}
})

test('mode changes do not clear active abilities locally; Survival waits for flight and immunity confirmation',()=>{
 const f=fixture();try{
 f.abilities({flying:true});f.c.emit('set_player_game_type',{gamemode:'survival'});f.v.desiredMode='survival';f.n.step(1000)
 assert(!f.w.survivalVerified);assert(!f.n.walk({x:2,y:64,z:0}).accepted)
 f.abilities({flying:false,invulnerable:true});f.n.step(1050);assert(!f.w.survivalVerified);assert.match(f.v.reason,/invulnerable/)
 f.abilities({currentMode:'survival'})
 f.n.step(1100);assert(f.w.survivalVerified);assert(!f.w.grounded());assert.match(f.n.walk({x:2,y:64,z:0}).message,/landing/)
 for(let at=1150;at<3500;at+=50)f.n.step(at)
 assert(f.w.grounded());assert(f.n.walk({x:2,y:64,z:0}).accepted)
 }finally{f.close()}
})

test('server movement locks block walking but never suspend gravity or loading completion',()=>{
 const f=fixture({mode:'survival'});try{
 f.abilities();f.c.emit('update_client_input_locks',f.wire('update_client_input_locks',{locks:{move:true,jump:true}}))
 assert.match(f.n.walk({x:2,y:64,z:0}).message,/locked/)
 for(let at=1000;at<3500;at+=50)f.n.step(at)
 assert(f.w.grounded());assert.equal(f.n.snapshot().physics.loading,'complete')
 f.c.emit('update_client_input_locks',f.wire('update_client_input_locks',{locks:{}}));assert(f.n.walk({x:2,y:64,z:0}).accepted)
 }finally{f.close()}
})

test('player corrections reconcile ground reports but stale and vehicle corrections never replace the body',()=>{
 const f=fixture({mode:'survival',height:65.62});try{
 f.abilities()
 const correction=(tick,y,onGround=true,prediction='player')=>f.c.emit('correct_player_move_prediction',f.wire('correct_player_move_prediction',{prediction_type:prediction,position:{x:.5,y,z:.5},delta:{x:0,y:-.08,z:0},rotation:{x:0,z:0},angular_velocity:null,on_ground:onGround,tick:BigInt(tick)}))
 correction(10,65.62);assert.equal(f.w.serverGrounded,true);assert.equal(f.n.vy,0)
 const p={...f.w.position};correction(9,69.62,false);assert.deepEqual(f.w.position,p)
 correction(11,70.62,false,'vehicle');assert.deepEqual(f.w.position,p)
 correction(12,68.62,true);assert(!f.w.grounded(),'server flag alone cannot manufacture a collision floor')
 f.n.step(1000);assert(f.w.position.y<68.62,'gravity continues after authoritative repositioning')
 }finally{f.close()}
})

test('dimension loading uses matching screen ID and does not automatically resume work',()=>{
 const f=fixture({mode:'survival',height:65.62});try{
 f.abilities();assert(f.n.walk({x:2,y:64,z:0}).accepted)
 f.c.emit('change_dimension',{dimension:0,position:{x:.5,y:69.62,z:.5},loading_screen_id:8123})
 assert.equal(f.n.job,null);f.sent.length=0;f.n.step(1000);assert(!f.sent.some(([name])=>name==='serverbound_loading_screen'))
 f.fill();f.n.step(1050);f.n.step(1100)
 assert.equal(f.sent.filter(([name])=>name==='serverbound_loading_screen').length,1)
 assert.equal(f.sent.find(([name])=>name==='serverbound_loading_screen')[1].loading_screen_id,8123)
 assert.equal(f.sent.filter(([name,p])=>name==='player_action'&&p.action==='dimension_change_ack').length,1)
 assert.equal(f.n.job,null)
 }finally{f.close()}
})

test('an explicit same-mode retry is permission-gated, deduplicated and waits for effective abilities',()=>{
 const f=fixture({mode:'survival',height:65.62});try{
 const now=Date.now();f.abilities({invulnerable:true});assert(!f.v.requestMode('survival',now).accepted)
 assert(!f.sent.some(([name])=>name==='command_request'))
 f.w.abilityState.commandPermission='operator'
 assert(f.v.requestMode('survival',now+50).queued);assert(f.v.requestMode('survival',now+60).queued)
 assert.equal(f.sent.filter(([name])=>name==='command_request').length,1)
 assert.equal(f.sent.find(([name])=>name==='command_request')[1].command,'/gamemode survival @s')
 f.c.emit('set_player_game_type',{gamemode:'survival'})
 assert(!f.w.survivalVerified);assert(f.v.pending,'a mode label is not ability confirmation')
 f.abilities();assert(f.w.survivalVerified);assert(!f.v.pending)
 }finally{f.close()}
})

test('Stop during flight recovery cancels intentions, retains the flight-off input and falls to known ground',()=>{
 const f=fixture({mode:'survival'});try{
 f.abilities({flying:true});f.n.stop();const now=Date.now()
 for(let t=0;t<600;t+=50)f.n.step(now+t)
 assert(f.sent.some(([name,p])=>name==='player_auth_input'&&p.input_data.includes('stop_flying')))
 f.abilities();for(let t=600;t<3000;t+=50)f.n.step(now+t)
 assert(f.w.grounded());assert.equal(f.n.job,null)
 assert(f.sent.filter(([name])=>name==='player_auth_input').every(([,p])=>p.move_vector.x===0&&p.move_vector.z===0))
 assert(f.sent.some(([name,p])=>name==='player_auth_input'&&p.delta.y<0))
 assert(!f.sent.some(([name])=>name==='command_request'))
 }finally{f.close()}
})

test('denied same-mode reapply stays denied without automatic retries or invented Survival abilities',()=>{
 const f=fixture({mode:'survival',height:65.62});try{
 f.abilities({invulnerable:true});f.w.abilityState.commandPermission='operator';const now=Date.now()
 f.v.requestMode('survival',now)
 f.c.emit('command_output',{origin:{uuid:f.v.requestId},success_count:0})
 f.n.step(now+1000);f.n.step(now+2000)
 assert.match(f.v.reason,/denied/);assert(!f.v.pending);assert(!f.w.survivalVerified)
 assert.equal(f.sent.filter(([name])=>name==='command_request').length,1)
 }finally{f.close()}
})
