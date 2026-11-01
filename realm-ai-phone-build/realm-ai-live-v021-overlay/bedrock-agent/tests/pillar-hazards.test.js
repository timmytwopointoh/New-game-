import test from 'node:test'
import assert from 'node:assert/strict'
import {realm} from './helpers/realm.js'
import {Pillaring} from '../src/survival/pillaring.js'
import {mediumAt} from '../src/survival/situation.js'

test('jump-place dirt waits for server height, real block and inventory before counting a pillar',()=>{
 const f=realm();try{f.c.emit('inventory_content',{window_id:0,input:[f.item('dirt',64)]});f.w.selectedSlot=0;f.n.pillar=new Pillaring(f.n,2);const now=Date.now();let placed=0
 for(let t=0;t<6000&&f.n.pillar;t+=50){
  f.n.step(now+t);f.c.emit('correct_player_move_prediction',{position:{...f.w.position},delta:{x:0,y:f.n.flight?.vy||0,z:0}})
  const p=f.n.building.job?.pending
  if(p&&!p.testConfirmed){p.testConfirmed=true;assert(f.w.serverPosition.y-1.62>p.target.y+1);const old=f.w.inventory.get(p.slot);f.c.emit('update_block',{position:p.target,block_runtime_id:f.ids.dirt,layer:0});f.c.emit('inventory_slot',{window_id:0,slot:p.slot,item:{...old,count:old.count-1}});placed++}
 }
 assert.equal(placed,2,JSON.stringify(f.n.snapshot()));assert.equal(f.n.pillar,null);assert.equal(f.w.standPosition().y,66);assert(f.w.grounded());assert(f.sent.some(([name,p])=>name==='player_auth_input'&&p.input_data.includes('start_jumping')));assert(!f.sent.some(([name])=>name==='command_request'||name==='move_player'))
 }finally{f.close()}
})
test('predicted jump height alone cannot place dirt; Stop clears pillar intent and retains gravity',()=>{
 const f=realm();try{f.c.emit('inventory_content',{window_id:0,input:[f.item('dirt',64)]});f.w.selectedSlot=0;f.n.pillar=new Pillaring(f.n,1);const now=Date.now();for(let t=0;t<400;t+=50)f.n.step(now+t)
 assert(!f.sent.some(([name,p])=>name==='player_auth_input'&&p.transaction?.data.action_type==='click_block'));const before=f.w.position.y;f.n.stop();for(let t=400;t<1800;t+=50)f.n.step(now+t);assert.equal(f.n.pillar,null);assert(f.w.position.y<=before);assert(f.w.grounded())
 }finally{f.close()}
})
test('water uses normal swim/jump input and cancels work instead of treating fluid as ground',()=>{
 const f=realm();try{f.set({x:0,y:64,z:0},'water');f.w.serverPosition={...f.w.position};assert.equal(mediumAt(f.w).kind,'water');f.n.job={kind:'solo',goal:{x:2,y:64,z:0}};f.n.step(Date.now());assert.equal(f.n.job,null);const p=f.sent.filter(([name])=>name==='player_auth_input').at(-1)[1];assert(p.input_data.includes('auto_jumping_in_water'));assert(p.input_data.includes('jump_down'));assert(!p.input_data.includes('start_flying'));assert.equal(f.w.gameMode,'survival')
 }finally{f.close()}
})
test('lava remains forbidden to normal routes; emergency handling never grants fire immunity',()=>{
 const f=realm();try{f.set({x:1,y:64,z:0},'lava');assert(!f.w.walkable({x:1,y:64,z:0}));f.set({x:0,y:64,z:0},'lava');f.w.serverPosition={...f.w.position};f.n.step(Date.now());assert.equal(f.n.hazards.kind,'lava');assert(!f.sent.some(([name])=>name==='command_request'||name==='request_ability'));assert.equal(f.w.attributes['minecraft:health'],20)
 }finally{f.close()}
})
