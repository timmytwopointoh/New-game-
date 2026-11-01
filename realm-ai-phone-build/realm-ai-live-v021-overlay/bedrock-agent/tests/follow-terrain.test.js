import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {WorldView} from '../src/survival/world.js'
import {Navigation} from '../src/survival/navigation.js'
import {findPath} from '../src/survival/pathfinder.js'
import {dirtBridge} from '../src/survival/bridging.js'
const require=createRequire(import.meta.url),{createSerializer}=require('bedrock-protocol/src/transforms/serializer')
function fixture(){
 const w=new WorldView();w.initialize({player_gamemode:'survival',server_authoritative_inventory:true,server_authoritative_block_breaking:true,entity_id:42n,runtime_entity_id:1n,player_position:{x:.5,y:65.62,z:.5},dimension:0})
 w.abilityState={known:true,loading:false,effective:{build:true,mine:true},active:[]};w.attributes['minecraft:health']=20
 const ids={};for(const [id,b] of Object.entries(w.registry.blocksByRuntimeId))if(b.stateId===w.registry.blocksByName[b.name]?.defaultState)ids[b.name]=Number(id)
 const set=(p,name)=>{for(const layer of [0,1])w.update({position:p,block_runtime_id:layer?ids.air:ids[name],layer})}
 for(let x=-4;x<=8;x++)for(let z=-4;z<=4;z++)for(let y=55;y<=73;y++)set({x,y,z},y===63?'stone':'air')
 const c=new EventEmitter(),sent=[],codec=createSerializer('1.26.60');c.queue=(name,p)=>{codec.createPacketBuffer({name,params:p});sent.push([name,p])};w.attach(c);const n=new Navigation(w);n.attach(c);n.spawned=true
 c.emit('inventory_content',{window_id:0,input:[{network_id:w.registry.itemsByName.dirt.id,count:64,metadata:0,has_stack_id:false,stack_id:0,block_runtime_id:ids.dirt,extra:{has_nbt:false,can_place_on:[],can_destroy:[]}}]});w.selectedSlot=0
 const trench=()=>{for(let x=1;x<=2;x++)for(let z=-4;z<=4;z++)set({x,y:63,z},'air')}
 const owner=p=>w.players.set('owner',{name:'Owner',position:p})
 return {w,n,c,sent,ids,set,trench,owner,close(){n.detach();w.detach()}}
}
test('observed five-block drops are follow-only by policy; six, damaged health and intervening blocks are refused',()=>{
 const f=fixture();try{const a={x:0,y:64,z:0},b={x:1,y:59,z:0};f.set({x:1,y:63,z:0},'air');f.set({x:1,y:58,z:0},'stone')
 assert(!f.w.canDropBetween(a,b));assert(f.w.canDropBetween(a,b,{maxDrop:5}));assert(findPath(f.w,a,b,{allowSteps:true,maxDrop:5}).ok);assert(!findPath(f.w,a,b,{allowSteps:true}).ok)
 f.set({x:1,y:61,z:0},'stone');assert(!f.w.canDropBetween(a,b,{maxDrop:5}));f.set({x:1,y:61,z:0},'air')
 f.w.attributes['minecraft:health']=7;assert(!f.w.canDropBetween(a,b,{maxDrop:5}));f.w.attributes['minecraft:health']=20
 f.set({x:1,y:58,z:0},'air');f.set({x:1,y:57,z:0},'stone');assert(!f.w.canDropBetween(a,{...b,y:58},{maxDrop:99}))
 }finally{f.close()}
})
test('following performs a five-block physical descent without teleport and refuses six',()=>{
 const f=fixture();try{f.set({x:1,y:63,z:0},'air');f.set({x:1,y:58,z:0},'stone');f.n.job={kind:'follow',name:'Owner',goal:{x:1,y:59,z:0},allowMining:true};f.n.route=[{x:1,y:59,z:0}]
 assert(f.n.beginFlight(f.n.route[0],'drop'));const now=Date.now();for(let t=0;t<2000&&f.n.flight;t+=50)f.n.step(now+t)
 assert(f.w.grounded());assert(Math.abs(f.w.position.y-60.62)<.003);assert(!f.sent.some(([name])=>name==='move_player'||name==='command_request'))
 }finally{f.close()}
})
test('short dirt bridge planning uses known air and actual supplies without changing the world',()=>{
 const f=fixture();try{f.trench();const before=f.w.blockRevision,stock=f.w.inventory.get(0).count,plan=dirtBridge(f.w,{x:0,y:64,z:0},{x:4,y:64,z:0})
 assert(plan?.ok);assert.equal(plan.dirtRequired,2);assert(plan.stairs.every(s=>s.kind==='bridge'));assert.equal(f.w.blockRevision,before);assert.equal(f.w.inventory.get(0).count,stock)
 f.c.emit('inventory_slot',{window_id:0,slot:0,item:{...f.w.inventory.get(0),count:1}});assert.equal(dirtBridge(f.w,{x:0,y:64,z:0},{x:4,y:64,z:0}),null)
 }finally{f.close()}
})
test('following creeps to a supported edge and confirms each dirt bridge block before crossing',()=>{
 const f=fixture();try{f.trench();f.owner({x:6.5,y:65.62,z:.5});assert(f.n.follow('Owner').accepted);assert(f.n.climbing.steps.size>0);const now=Date.now();let confirmations=0
 for(let t=0;t<14000;t+=50){
  f.n.step(now+t);f.c.emit('correct_player_move_prediction',{position:{...f.w.position}})
  const b=f.n.climbing.builder,p=b.job?.pending
  if(p&&!p.simulated){p.simulated=true;assert(f.w.grounded());assert.equal(f.w.block(p.target).name,'air');const held=f.w.inventory.get(p.slot)
   f.c.emit('update_block',{position:p.target,block_runtime_id:f.ids.dirt,layer:0});f.n.step(now+t+1);assert(b.job,'block alone cannot authorize crossing')
   f.c.emit('inventory_slot',{window_id:0,slot:p.slot,item:{...held,count:held.count-1}});confirmations++
  }
  if(f.w.position.x>=3.2)break
 }
 assert.equal(confirmations,2,f.n.reason);assert(f.w.position.x>=3.2,JSON.stringify(f.n.snapshot()));assert(f.w.grounded())
 assert(f.sent.some(([name,p])=>name==='player_auth_input'&&p.input_data.includes('start_sneaking')));assert(!f.sent.some(([name])=>name==='command_request'||name==='move_player'))
 }finally{f.close()}
})
test('follow waits while placement is unconfirmed and immediate Stop cancels bridging and sneak intent',()=>{
 const f=fixture();try{f.trench();f.owner({x:4.5,y:65.62,z:.5});f.n.follow('Owner');const now=Date.now()
 for(let t=0;t<2000&&!f.n.climbing.builder.job?.pending;t+=50){f.n.step(now+t);f.c.emit('correct_player_move_prediction',{position:{...f.w.position}})}
 assert(f.n.climbing.builder.job?.pending);assert(f.w.position.x<1.31);const count=f.sent.filter(([name,p])=>name==='player_auth_input'&&p.transaction?.data.action_type==='click_block').length
 f.n.stop();f.n.step(now+2000);assert.equal(f.n.climbing.steps.size,0);assert(!f.n.edgeSneaking);assert.equal(f.sent.filter(([name,p])=>name==='player_auth_input'&&p.transaction?.data.action_type==='click_block').length,count)
 }finally{f.close()}
})
test('follow mines a natural obstruction only after jumps and detours fail, then keeps following',()=>{
 const f=fixture();try{
  for(let z=-4;z<=4;z++)for(let y=64;y<=67;y++)f.set({x:1,y,z},'dirt')
  f.owner({x:4.5,y:65.62,z:.5});assert(f.n.follow('Owner').accepted);assert.equal(f.n.state,'mining-obstacle');assert(f.n.mining.job)
  const now=Date.now();f.n.mining.job.started=now
  for(let t=0;t<200;t+=50)f.n.step(now+t)
  assert(f.n.mining.job,'replanning must not interrupt held mining');const p=f.n.mining.job.position;f.set(p,'air');f.n.step(now+200);f.n.step(now+250)
  assert.equal(f.n.job?.kind,'follow');assert(f.n.mining.job||f.n.route?.length)
 }finally{f.close()}
})
test('protected builds and absent dirt leave follow blocked without sending destructive or placement packets',()=>{
 const f=fixture();try{for(let z=-4;z<=4;z++)for(let y=64;y<=69;y++)f.set({x:1,y,z},'oak_planks');f.w.inventory.clear();f.owner({x:4.5,y:65.62,z:.5});f.n.follow('Owner')
 assert.equal(f.n.job?.kind,'follow');assert.equal(f.n.state,'blocked');assert(!f.n.mining.job);assert(!f.sent.some(([name,p])=>name==='inventory_transaction'||name==='player_auth_input'&&p.transaction))
 }finally{f.close()}
})

test('unknown landing columns, fluids and unknown health forbid damaging follow drops',()=>{
 const f=fixture();try{const a={x:0,y:64,z:0},b={x:1,y:59,z:0};f.set({x:1,y:63,z:0},'air');f.set({x:1,y:58,z:0},'stone');assert(f.w.canDropBetween(a,b,{maxDrop:5}))
 f.w.updates.delete('1,61,0,0');assert(!f.w.canDropBetween(a,b,{maxDrop:5}));f.set({x:1,y:61,z:0},'air');delete f.w.attributes['minecraft:health'];assert(!f.w.canDropBetween(a,b,{maxDrop:5}));f.w.attributes['minecraft:health']=20;f.set(b,'lava');assert(!f.w.canDropBetween(a,b,{maxDrop:5}))
 }finally{f.close()}
})
test('bridge planning refuses unknown supports and spans longer than six cells; Creative still needs real dirt',()=>{
 const f=fixture();try{f.trench();for(let z=-4;z<=4;z++)f.w.updates.delete(`1,63,${z},0`);assert.equal(dirtBridge(f.w,{x:0,y:64,z:0},{x:4,y:64,z:0}),null)
 for(let x=1;x<=7;x++)for(let z=-4;z<=4;z++)f.set({x,y:63,z},'air');assert.equal(dirtBridge(f.w,{x:0,y:64,z:0},{x:8,y:64,z:0}),null)
 for(let x=3;x<=7;x++)for(let z=-4;z<=4;z++)f.set({x,y:63,z},'stone');f.w.gameMode='creative';f.c.emit('inventory_slot',{window_id:0,slot:0,item:{...f.w.inventory.get(0),count:1}})
 assert(dirtBridge(f.w,{x:0,y:64,z:0},{x:4,y:64,z:0})?.ok);f.w.inventory.clear();assert.equal(dirtBridge(f.w,{x:0,y:64,z:0},{x:4,y:64,z:0}),null)
 }finally{f.close()}
})
test('stationary server feedback cannot replace a pending bridge placement with stuck recovery',()=>{
 const f=fixture();try{f.trench();f.owner({x:6.5,y:65.62,z:.5});f.n.follow('Owner');const now=Date.now()
 for(let t=0;t<2000&&!f.n.climbing.builder.job?.pending;t+=50){f.n.step(now+t);f.c.emit('correct_player_move_prediction',{position:{...f.w.position}})}
 const pending=f.n.climbing.builder.job?.pending;assert(pending);f.n.progress.reset()
 f.n.observeServer({position:{...f.w.position}},now+2000);f.n.progress.commanded(1)
 f.n.observeServer({position:{...f.w.position}},now+2500);f.n.observeServer({position:{...f.w.position}},now+3000)
 assert.equal(f.n.climbing.builder.job.pending,pending);assert(f.n.route?.length);assert.equal(f.n.job.kind,'follow')
 }finally{f.close()}
})
