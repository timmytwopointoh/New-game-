import test from 'node:test'
import assert from 'node:assert/strict'
import {realm} from './helpers/realm.js'
import {DimensionTravel,materialDimension,portalFrame} from '../src/survival/dimension-travel.js'
import {acquisitionPlan} from '../src/survival/acquisition-jobs.js'
import {Workshop} from '../src/survival/workshop.js'
import {StackOperations} from '../src/survival/stack-operations.js'
function controller(f){const c={world:f.w,navigation:f.n,connection:{client:f.c},report(){}};c.operations=new StackOperations(f.w);c.operations.client=f.c;c.workshop=new Workshop(c);c.handle=s=>{const m=s.match(/^select slot (\d)$/);if(m){f.w.selectedSlot=Number(m[1])-1;return {accepted:true}}};return c}
test('resource plans know Nether and End prerequisites and do not treat scheduled supplies as inventory',()=>{
 const f=realm();try{assert.equal(materialDimension('ancient_debris'),1);assert.equal(materialDimension('warped_stem'),1);assert.equal(materialDimension('elytra'),2);assert.equal(materialDimension('stone'),0)
 const p=acquisitionPlan(f.w,'ancient_debris',8);assert.equal(p.dimension,1);assert(p.stages.some(s=>s.includes('portal')));assert.equal(p.alreadyOwned,0);assert(p.noInventedSupplies)
 const b=acquisitionPlan(f.w,'bedrock',1);assert(b.unobtainableNormally)
 }finally{f.close()}
})
test('a supported portal frame is 14 blocks; no portal is claimed until server dimension changes',()=>{
 const f=realm(),c=controller(f),travel=new DimensionTravel(c);try{assert.equal(portalFrame({x:0,y:64,z:2}).positions.length,14);travel.start(1);travel.tick();assert.equal(travel.state,'preparing');assert.equal(travel.needed.material,'obsidian');assert.equal(travel.needed.quantity,14);assert.equal(f.w.dimension,0);assert(!f.sent.some(([name])=>name==='command_request'))
 f.w.dimension=1;travel.tick();assert.equal(travel.state,'completed')
 }finally{f.close()}
})
test('an observed cornerless inactive portal uses ignition instead of demanding a replacement frame',()=>{
 const f=realm(),c=controller(f),travel=new DimensionTravel(c);try{
 const frame=portalFrame({x:0,y:64,z:2});for(const p of frame.positions)if(!([64,68].includes(p.y)&&[0,3].includes(p.x)))f.set(p,'obsidian')
 f.c.emit('inventory_content',{window_id:0,input:[f.item('flint_and_steel',1)]});f.w.selectedSlot=0;travel.start(1);travel.tick();assert.equal(travel.state,'ignite');assert.equal(travel.needed,null);assert(f.n.pendingUse);f.n.step(Date.now());assert(f.sent.some(([name,p])=>name==='player_auth_input'&&p.transaction?.data.action_type==='click_block'));assert.equal(f.w.dimension,0);assert.equal(travel.state,'ignite')
 }finally{f.close()}
})
test('End requests never invent a stronghold or assume a missing dragon is dead',()=>{
 const f=realm(),c=controller(f),travel=new DimensionTravel(c);try{travel.start(2);travel.tick();assert.equal(travel.state,'preparing');assert.equal(travel.needed.material,'ender_eye');assert.match(travel.reason,/stronghold/);assert.equal(f.w.dragonState,'unknown')
 f.w.dimension=2;f.c.emit('add_entity',{runtime_id:9n,unique_id:90n,entity_type:'minecraft:ender_dragon',position:{x:2,y:65,z:2}});assert.equal(f.w.dragonState,'alive');f.c.emit('remove_entity',{entity_id_self:90n});assert.equal(f.w.dragonState,'alive')
 f.c.emit('add_entity',{runtime_id:9n,unique_id:90n,entity_type:'minecraft:ender_dragon',position:{x:2,y:65,z:2}});f.c.emit('entity_event',{runtime_entity_id:9n,event_id:'ender_dragon_death'});assert.equal(f.w.dragonState,'defeated')
 }finally{f.close()}
})
test('actual eye filling targets a received End frame and waits for its updated state and item consumption',()=>{
 const f=realm(),c=controller(f),travel=new DimensionTravel(c);try{f.set({x:2,y:64,z:0},'end_portal_frame');f.c.emit('inventory_content',{window_id:0,input:[f.item('ender_eye',2)]});f.w.selectedSlot=0;travel.start(2);travel.tick();assert(travel.eyePending);assert.equal(f.w.items().ender_eye,2);f.n.step(Date.now());assert(f.sent.some(([name,p])=>name==='player_auth_input'&&p.transaction?.data.held_item.network_id===f.w.registry.itemsByName.ender_eye.id));assert.equal(f.w.dimension,0)
 }finally{f.close()}
})
test('new frame construction uses real obsidian, confirmed dirt scaffolds and server-confirmed ignition',()=>{
 const f=realm(),c=controller(f),travel=new DimensionTravel(c);try{
 f.c.emit('inventory_content',{window_id:0,input:[f.item('obsidian',14,4),f.item('dirt',64,5),f.item('flint_and_steel',1,6)]});f.w.selectedSlot=0;travel.start(1);const now=Date.now();let obsidian=0,dirt=0
 for(let t=0;t<60000;t+=50){
  travel.tick(now+t);f.n.step(now+t);f.c.emit('correct_player_move_prediction',{position:{...f.w.position},delta:{x:0,y:f.n.flight?.vy||0,z:0}})
  const p=f.n.building.job?.pending
  if(p&&!p.testConfirmed){p.testConfirmed=true;const held=f.w.inventory.get(p.slot),name=f.w.registry.items[held.network_id].name;f.c.emit('update_block',{position:p.target,block_runtime_id:f.ids[name],layer:0});f.c.emit('inventory_slot',{window_id:0,slot:p.slot,item:{...held,count:held.count-1}});if(name==='obsidian')obsidian++;if(name==='dirt')dirt++}
  if(travel.ignitedAt)break
  if(travel.state==='blocked')break
 }
 assert.equal(obsidian,14,JSON.stringify({...travel.snapshot(),nav:f.n.snapshot()}));assert(dirt>=1);assert(travel.ignitedAt,JSON.stringify(travel.snapshot()));assert.equal(f.w.dimension,0);assert.notEqual(travel.state,'completed')
 }finally{f.close()}
})
