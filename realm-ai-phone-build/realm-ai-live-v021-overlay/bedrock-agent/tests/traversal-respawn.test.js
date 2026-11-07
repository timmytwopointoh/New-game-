import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {WorldView} from '../src/survival/world.js'
import {Navigation} from '../src/survival/navigation.js'
import {RespawnRecovery} from '../src/survival/respawn.js'
import {dirtStaircase} from '../src/survival/climbing.js'
import {parseDescriptor} from '../src/survival/command-plans.js'
const require=createRequire(import.meta.url),{createSerializer}=require('bedrock-protocol/src/transforms/serializer')
function fixture(mode='survival'){
 const w=new WorldView();w.initialize({player_gamemode:mode,server_authoritative_block_breaking:true,entity_id:42n,runtime_entity_id:1n,player_position:{x:.5,y:65.62,z:.5},dimension:0})
 w.abilityState={known:true,loading:false,effective:{build:true,mine:true},active:[]};w.attributes['minecraft:health']=20
 const ids={};for(const [id,b] of Object.entries(w.registry.blocksByRuntimeId))if(b.stateId===w.registry.blocksByName[b.name]?.defaultState)ids[b.name]=Number(id)
 const set=(p,name)=>{for(const layer of [0,1])w.update({position:p,block_runtime_id:layer?ids.air:ids[name],layer})}
 for(let x=-5;x<=9;x++)for(let z=-5;z<=5;z++)for(let y=62;y<=74;y++)set({x,y,z},y===63?'stone':'air')
 const c=new EventEmitter(),sent=[],codec=createSerializer('1.26.60');c.queue=(name,p)=>{codec.createPacketBuffer({name,params:p});sent.push([name,p])};w.attach(c);const n=new Navigation(w);n.attach(c);n.spawned=true
 const held={network_id:w.registry.itemsByName.dirt.id,count:64,metadata:0,has_stack_id:false,stack_id:0,block_runtime_id:ids.dirt,extra:{has_nbt:false,can_place_on:[],can_destroy:[]}}
 w.inventoryKnown=true;w.inventory.set(0,held);w.selectedSlot=0
 const cliff=height=>{for(let x=3;x<=9;x++)for(let z=-5;z<=5;z++)for(let y=64;y<64+height;y++)set({x,y,z},'stone')}
 return {w,n,c,sent,set,cliff,close(){n.detach();w.detach()}}
}
test('ordinary walking plans real one-block jumps and step-downs without teleport commands',()=>{
 const f=fixture();try{
 f.set({x:1,y:64,z:0},'stone');assert(f.n.walk({x:1,y:65,z:0}).accepted);const now=Date.now()
 for(let t=0;t<1500;t+=50)f.n.step(now+t)
 assert(f.w.grounded());assert(Math.abs(f.w.position.y-66.62)<.003)
 assert(f.sent.some(([name,p])=>name==='player_auth_input'&&p.input_data.includes('start_jumping')))
 assert(f.n.walk({x:2,y:64,z:0}).accepted);const second=Date.now();for(let t=0;t<1500;t+=50)f.n.step(second+t)
 assert(f.w.grounded());assert(Math.abs(f.w.position.y-65.62)<.003)
 assert(!f.sent.some(([name])=>name==='command_request'||name==='move_player'||name==='player_teleport'))
 }finally{f.close()}
})
test('three-block cliff gets a supported dirt staircase preview without changing world or inventory',()=>{
 const f=fixture();try{f.cliff(3);const before=f.w.blockRevision,stock=f.w.inventory.get(0).count
 const plan=dirtStaircase(f.w,{x:0,y:64,z:0},{x:4,y:67,z:0});assert(plan?.ok);assert(plan.dirtRequired>=3&&plan.dirtRequired<=6);assert.equal(f.w.blockRevision,before);assert.equal(f.w.inventory.get(0).count,stock);assert.equal(f.sent.length,0)
 assert(plan.stairs.every(s=>s.targets.every(p=>f.w.airAt(p))))
 }finally{f.close()}
})
test('dirt climbing waits for block AND inventory confirmation, then physically jumps onto actual steps',()=>{
 const f=fixture();try{
 f.cliff(3);assert(f.n.walk({x:4,y:67,z:0}).accepted);const now=Date.now();let confirms=0
 for(let t=0;t<12000;t+=50){
  f.w.serverPosition={...f.w.position};f.n.step(now+t)
  // The synthetic test server explicitly acknowledges the actual landing.
  // Production cannot skip this authoritative ground+position check.
  if(f.n.pendingServerLanding)f.n.observeServer({position:{...f.w.position},on_ground:true},now+t+1)
  const b=f.n.climbing.builder,j=b.job?.pending
  if(j){
   assert(!f.n.flight,'never jump while placement is unconfirmed')
   const old=f.w.inventory.get(j.slot);f.set(j.target,'dirt');f.n.step(now+t+1)
   assert(b.job,'block update alone cannot invent Survival consumption')
   f.c.emit('inventory_slot',{window_id:'inventory',slot:j.slot,item:{...old,count:old.count-1}});confirms++
  }
  if(f.n.state==='arrived-predicted')break
 }
 if(confirms<3)console.log('SURVIVAL_CLIMB_DIAGNOSTIC',JSON.stringify({confirms,state:f.n.state,reason:f.n.reason,pose:f.w.position,route:f.n.route,climbing:f.n.climbing.snapshot(),builder:f.n.climbing.builder.snapshot(),decisions:f.n.decisions}))
 assert(confirms>=3);assert(f.w.position.x>3.9);assert(f.w.grounded());assert(Math.abs(f.w.position.y-68.62)<.003)
 assert.equal(f.sent.filter(([name,p])=>name==='player_auth_input'&&p.transaction?.data.action_type==='click_block').length,confirms)
 assert(f.sent.filter(([name,p])=>name==='player_auth_input'&&p.input_data.includes('start_jumping')).length>=3)
 }finally{f.close()}
})
test('missing dirt, unknown cells, nearby player builds and locked jump reject dirt staircases',()=>{
 for(const change of [f=>f.w.inventory.clear(),f=>f.w.updates.clear(),f=>{for(let x=-4;x<=8;x++)for(let z=-4;z<=4;z++)f.set({x,y:64,z},'oak_planks')},f=>f.w.inputLocks.jump=true]){
  const f=fixture();try{f.cliff(3);change(f);assert.equal(dirtStaircase(f.w,{x:0,y:64,z:0},{x:4,y:67,z:0}),null);assert(!f.sent.some(([name])=>name==='inventory_transaction'))}finally{f.close()}
 }
})
test('Stop cancels a pending dirt placement and preserves gravity and already-confirmed blocks',()=>{
 const f=fixture();try{f.cliff(3);assert(f.n.walk({x:4,y:67,z:0}).accepted);f.n.step();const count=f.sent.filter(([name])=>name==='inventory_transaction').length;f.n.stop();assert.equal(f.n.climbing.steps.size,0);assert.equal(f.n.climbing.builder.job,null);f.n.step(Date.now()+50);assert.equal(f.sent.filter(([name])=>name==='inventory_transaction').length,count);assert(f.w.grounded())}finally{f.close()}
})
test('Creative staircase uses actual held dirt, waits for server blocks and does not consume the stack',()=>{
 const f=fixture('creative');try{f.cliff(3);f.w.inventory.set(0,{...f.w.inventory.get(0),count:1});assert(f.n.walk({x:4,y:67,z:0}).accepted);const now=Date.now();let placed=0
 for(let t=0;t<12000;t+=50){f.w.serverPosition={...f.w.position};f.n.step(now+t);if(f.n.pendingServerLanding)f.n.observeServer({position:{...f.w.position},on_ground:true},now+t+1);const pending=f.n.climbing.builder.job?.pending;if(pending){f.set(pending.target,'dirt');placed++}if(f.n.state==='arrived-predicted')break}
 if(placed<3)console.log('CREATIVE_CLIMB_DIAGNOSTIC',JSON.stringify({placed,state:f.n.state,reason:f.n.reason,pose:f.w.position,route:f.n.route,climbing:f.n.climbing.snapshot(),builder:f.n.climbing.builder.snapshot(),decisions:f.n.decisions}))
 assert(placed>=3);assert(f.w.grounded());assert(f.w.position.x>3.9);assert.equal(f.w.inventory.get(0).count,1)
 }finally{f.close()}
})
test('low ceilings prevent jump input instead of forcing the player through blocks',()=>{
 const f=fixture();try{f.set({x:1,y:64,z:0},'stone');for(let x=-1;x<=2;x++)for(let z=-1;z<=1;z++)f.set({x,y:66,z},'stone');assert(!f.n.walk({x:1,y:65,z:0}).accepted);f.n.step();assert(!f.sent.some(([name,p])=>name==='player_auth_input'&&p.input_data.includes('start_jumping')))}finally{f.close()}
})
test('death sends normal Respawn action, acknowledges own server-ready position, waits for real health and never resumes work',()=>{
 const f=fixture(),interrupts=[],r=new RespawnRecovery(f.w,f.n,m=>interrupts.push(m));try{
 r.attach(f.c);f.n.checkRespawn=now=>r.tick(now);assert(f.n.walk({x:2,y:64,z:0}).accepted)
 f.c.emit('set_health',{health:0});assert.equal(f.n.job,null);assert.equal(interrupts.length,1);assert(f.sent.some(([name,p])=>name==='player_action'&&p.action==='respawn'))
 f.c.emit('respawn',{runtime_entity_id:99n,state:1,position:{x:4.5,y:69.62,z:.5}});assert.equal(r.readyPosition,null)
 const now=Date.now(),pressed=f.sent.filter(([name])=>name==='respawn').length;f.c.emit('respawn',{runtime_entity_id:1n,state:0,position:{x:4.5,y:69.62,z:.5}});assert.equal(f.sent.filter(([name])=>name==='respawn').length,pressed);assert.equal(f.w.position.y,65.62,'searching position is not a teleport')
 f.c.emit('respawn',{runtime_entity_id:1n,state:1,position:{x:4.5,y:69.62,z:.5}});r.tick(now+2100)
 assert(f.sent.some(([name,p])=>name==='respawn'&&p.state===2));assert.equal(f.w.attributes['minecraft:health'],0);assert.equal(f.n.job,null)
 f.c.emit('set_health',{health:20});assert.equal(r.state,'respawned');assert.equal(f.n.job,null)
 for(let t=2200;t<5000;t+=50)f.n.step(now+t)
 assert(f.w.grounded());assert.equal(f.n.job,null);assert.equal(parseDescriptor('respawn').id,'respawn')
 }finally{r.detach();f.close()}
})
test('Hardcore and an unconfirmed respawn stay stopped; no fake health or repeated unlimited inputs',()=>{
 const f=fixture(),r=new RespawnRecovery(f.w,f.n);try{r.attach(f.c);f.w.hardcore=true;f.c.emit('set_health',{health:0});assert.equal(r.state,'blocked');assert.equal(f.sent.length,0);assert.match(r.reason,/Hardcore/);assert.equal(f.w.attributes['minecraft:health'],0)}finally{r.detach();f.close()}
 const g=fixture(),s=new RespawnRecovery(g.w,g.n);try{s.attach(g.c);assert(!s.request().accepted);g.c.emit('set_health',{health:0});const now=Date.now();for(let t=0;t<=16000;t+=500)s.tick(now+t);assert.equal(s.state,'blocked');assert.equal(g.sent.filter(([name,p])=>name==='player_action'&&p.action==='respawn').length,3);assert.equal(g.w.attributes['minecraft:health'],0)}finally{s.detach();g.close()}
})
