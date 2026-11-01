import test from 'node:test'
import assert from 'node:assert/strict'
import {realm} from './helpers/realm.js'
import {stripLayout,quarryLayout} from '../src/survival/mining-layouts.js'
import {MiningJobs} from '../src/survival/mining-jobs.js'
import {Workshop} from '../src/survival/workshop.js'
import {StackOperations} from '../src/survival/stack-operations.js'
import {Crafting} from '../src/survival/crafting.js'
import {ResourceJobs} from '../src/survival/resource-jobs.js'
import {parseDescriptor} from '../src/survival/command-plans.js'
function controller(f){const c={world:f.w,navigation:f.n,connection:{client:f.c},report(){},resources:{active:null},exploration:{active:null}};c.operations=new StackOperations(f.w);c.operations.client=f.c;c.crafting=new Crafting(f.w,c.operations);c.workshop=new Workshop(c);c.miningJobs=new MiningJobs(c);return c}
test('strip legs are exactly 30 two-high stations, with four-block connectors and no loop into the old lane',()=>{
 const plan=stripLayout({x:0,y:0,z:0},{x:0,z:-1},{depth:-20,rows:3})
 assert.equal(plan.points.filter(p=>p.stage==='descent').length,20);assert.equal(plan.points.filter(p=>p.stage==='tunnel').length,90);assert.equal(plan.points.filter(p=>p.stage==='connector').length,8)
 const first=plan.points.find(p=>p.stage==='tunnel'&&p.row===1),second=plan.points.find(p=>p.stage==='tunnel'&&p.row===2),third=plan.points.find(p=>p.stage==='tunnel'&&p.row===3)
 assert.equal(second.cell.x-first.cell.x,4);assert.equal(third.cell.x-second.cell.x,4);assert(plan.points.every(p=>p.clear.every(b=>b.x===p.cell.x&&b.z===p.cell.z)))
 assert.equal(new Set(plan.points.filter(p=>p.stage==='tunnel').map(p=>JSON.stringify(p.cell))).size,90)
})
test('quarry is 15 by 15 by two, and continuation starts in an adjacent fresh patch',()=>{
 const p=quarryLayout({x:0,y:64,z:0},{x:1,z:0});assert.equal(p.points.filter(p=>p.stage==='quarry').length,225)
 const cells=p.points.filter(p=>p.stage==='quarry');assert(cells.every(p=>p.clear.length===2));assert.equal(cells[0].cell.y,62)
 const last=p.points.at(-1).cell,l=p.lateral,next=quarryLayout({x:last.x+l.x,y:last.y,z:last.z+l.z},{x:-1,z:0},{descend:false,lateral:l})
 assert.equal(Math.abs(next.points[0].cell.x-last.x)+Math.abs(next.points[0].cell.z-last.z),1);const known=new Set(cells.map(p=>JSON.stringify(p.cell)));assert(next.points.every(p=>!known.has(JSON.stringify(p.cell))))
})
test('new command forms validate the layouts and default unspecified building material to dirt',()=>{
 assert.deepEqual(parseDescriptor('strip mine').values,{rows:8,depth:-20});assert.equal(parseDescriptor('mine dirt').id,'quarry');assert.equal(parseDescriptor('gather 640 dirt').values.quantity,640);assert.throws(()=>parseDescriptor('gather 2305 dirt'));assert.throws(()=>parseDescriptor('strip mine 17 rows at -20'));assert.equal(parseDescriptor('place a block at 2 64 0').values.material,'dirt')
})
test('mining preflight requests a real pickaxe when missing and reserves 64 actual dirt',()=>{
 const f=realm(),c=controller(f);try{f.c.emit('inventory_content',{window_id:0,input:[]});let requested=null;c.workshop.ensure=(name)=>{requested=name;return {state:'working',reason:'Waiting for tools'}};assert(c.miningJobs.start('strip mine 1 rows at 64').accepted);c.miningJobs.tick(Date.now()+200);assert.equal(requested,'stone_pickaxe');assert.equal(c.miningJobs.active.state,'provision');assert.equal(c.miningJobs.active.layout,null);assert(!f.sent.some(([name,p])=>name==='player_auth_input'&&p.transaction))}finally{f.close()}
})
test('controlled strip excavation waits for real breaks and positions; Creative does not invent pickups',()=>{
 const f=realm(),c=controller(f);try{f.w.gameMode='creative';f.w.abilityState.effective.instant_build=true;f.w.abilityState.active=['instant_build'];f.c.emit('inventory_content',{window_id:0,input:[f.item('dirt',1)]});f.w.selectedSlot=0;f.set({x:0,y:64,z:1},'stone');f.set({x:0,y:65,z:1},'stone')
 assert(c.miningJobs.start('strip mine 1 rows at 64').accepted);const now=Date.now();c.miningJobs.tick(now+200);c.miningJobs.active.layout.points=c.miningJobs.active.layout.points.slice(0,2)
 for(let t=250;t<10000&&c.miningJobs.active;t+=50){f.n.step(now+t);f.c.emit('correct_player_move_prediction',{position:{...f.w.position}});c.miningJobs.tick(now+t);const m=f.n.mining.job;if(m&&now+t-m.started>300)f.c.emit('update_block',{position:m.position,block_runtime_id:f.ids.air,layer:0});if(c.miningJobs.active?.state==='preparing-home'||c.miningJobs.active?.state==='storage')break}
 assert.equal(c.miningJobs.active?.breaks,2);assert(f.w.serverPosition.z>1.5);assert.equal(c.miningJobs.active?.pickups,0)
 }finally{f.close()}
})
test('a partial inventory never triggers the 640-item dirt storage threshold',()=>{
 const f=realm(),c=controller(f);try{f.w.gameMode='creative';f.c.emit('inventory_content',{window_id:0,input:Array.from({length:10},(_,i)=>f.item('dirt',1,i+1))});f.w.selectedSlot=0;assert(c.miningJobs.start('mine dirt').accepted);const now=Date.now();c.miningJobs.tick(now+200);assert.equal(c.miningJobs.active.state,'excavating');c.miningJobs.tick(now+400);assert.notEqual(c.miningJobs.active.state,'preparing-home');assert.equal(c.workshop.deposit('dirt').stored,false)}finally{f.close()}
})
test('owned chest placement is real, reusable and does not grant permission to other player containers',()=>{
 const f=realm(),c=controller(f);try{f.c.emit('inventory_content',{window_id:0,input:[f.item('chest',2)]});f.w.selectedSlot=0;assert.equal(c.workshop.place('chest').state,'working');const now=Date.now();f.n.step(now);const p=f.n.building.job.pending;assert(p);f.c.emit('update_block',{position:p.target,block_runtime_id:f.ids.chest,layer:0});f.c.emit('inventory_slot',{window_id:0,slot:0,item:f.item('chest',1)});f.n.step(now+50);c.workshop.tick(now+50);assert.equal(c.workshop.known('chest').length,1);assert.equal(c.workshop.open({x:4,y:64,z:0}).state,'blocked')
 const own=c.workshop.known('chest')[0];assert.equal(c.workshop.open(own,now+100).state,'working');f.n.step(now+150);f.c.emit('container_open',{window_id:7,window_type:'container',coordinates:own});f.c.emit('inventory_content',{window_id:7,input:Array.from({length:54},()=>({network_id:0,count:0}))});assert.equal(c.workshop.open(own,now+200).state,'ready')
 }finally{f.close()}
})
test('a latched deposit continues below 640 and cannot claim two singles are a double chest',()=>{
 const f=realm(),c=controller(f);try{f.c.emit('inventory_content',{window_id:0,input:Array.from({length:10},(_,i)=>f.item('dirt',64,i+1))});f.w.selectedSlot=0
 const chest={x:2,y:64,z:0,dimension:0,name:'chest'};f.set(chest,'chest');c.workshop.records.push(chest);f.w.ownedPlacements.set('0:2,64,0',chest);c.workshop.opening={position:chest,started:Date.now()};f.c.emit('container_open',{window_id:7,window_type:'container',coordinates:chest});f.c.emit('inventory_content',{window_id:7,input:Array.from({length:27},()=>({network_id:0,count:0}))})
 assert.equal(c.workshop.deposit('dirt').state,'working');assert(c.workshop.depositing);f.c.emit('inventory_slot',{window_id:0,slot:0,item:{network_id:0,count:0}});c.operations.pending=null;assert.equal(c.workshop.deposit('dirt').state,'working','576 is still part of the same deposit')
 c.workshop.records.push({x:3,y:64,z:0,dimension:0,name:'chest'});f.set({x:3,y:64,z:0},'chest');c.operations.pending=null;assert.match(c.workshop.deposit('dirt',{minimum:1,double:true}).reason,/54-slot/)
 }finally{f.close()}
})
test('furnace processing consumes real input/fuel and credits metal only after output and transfer receipts',()=>{
 const f=realm(),c=controller(f);try{f.c.emit('inventory_content',{window_id:0,input:[f.item('raw_iron',1,1),f.item('coal',1,2)]});f.w.selectedSlot=0;const p={x:2,y:64,z:0,dimension:0,name:'furnace'};f.set(p,'furnace');c.workshop.records.push(p);f.w.ownedPlacements.set('0:2,64,0',p);c.workshop.opening={position:p,started:Date.now()};f.c.emit('container_open',{window_id:7,window_type:'furnace',coordinates:p});f.c.emit('inventory_content',{window_id:7,input:Array.from({length:3},()=>({network_id:0,count:0}))});let now=Date.now()
 assert.equal(c.workshop.ensure('iron_ingot',1,now).state,'working');let id=c.operations.pending.id
 f.c.emit('item_stack_response',{responses:[{status:'ok',request_id:id,containers:[{slot_type:{container_id:'hotbar_and_inventory'},slots:[{slot:0,count:0}]},{slot_type:{container_id:'furnace_ingredient'},slots:[{slot:0,count:1,item_stack_id:11}]}]}]});c.operations.tick(now+100)
 assert.equal(c.workshop.ensure('iron_ingot',1,now+200).state,'working');id=c.operations.pending.id
 f.c.emit('item_stack_response',{responses:[{status:'ok',request_id:id,containers:[{slot_type:{container_id:'hotbar_and_inventory'},slots:[{slot:1,count:0}]},{slot_type:{container_id:'furnace_fuel'},slots:[{slot:1,count:0}]}]}]});c.operations.tick(now+300)
 assert.equal(c.operations.state,'confirmed');assert.equal(c.workshop.ensure('iron_ingot',1,now+400).state,'working');assert.equal(f.w.items().iron_ingot,undefined);assert.equal(c.operations.pending,null,'burning fuel must not be reinserted every tick')
 f.c.emit('inventory_slot',{window_id:7,slot:0,item:{network_id:0,count:0}});f.c.emit('inventory_slot',{window_id:7,slot:2,item:f.item('iron_ingot',1,30)});assert.equal(c.workshop.ensure('iron_ingot',1,now+11000).state,'working');id=c.operations.pending.id
 f.c.emit('item_stack_response',{responses:[{status:'ok',request_id:id,containers:[{slot_type:{container_id:'furnace_output'},slots:[{slot:2,count:0}]},{slot_type:{container_id:'hotbar_and_inventory'},slots:[{slot:0,count:1,item_stack_id:30}]}]}]});c.operations.tick(now+11100);assert.equal(c.workshop.ensure('iron_ingot',1,now+11200).state,'ready');assert.equal(f.w.items().iron_ingot,1)
 }finally{f.close()}
})
test('a full hotbar swaps a known tool with backpack contents instead of discarding items',()=>{
 const f=realm(),c=controller(f);try{f.c.emit('inventory_content',{window_id:0,input:[...Array.from({length:9},(_,i)=>f.item('dirt',64,i+1)),f.item('stone_pickaxe',1,50)]});f.w.selectedSlot=0;assert.equal(c.workshop.hotbar('stone_pickaxe',Date.now()).state,'working');const request=f.sent.find(([name])=>name==='item_stack_request')[2].requests[0];assert.equal(request.actions[0].type_id,'swap');assert.equal(f.w.items().dirt,576);f.receipt(request.request_id,[[0,1,51],[9,64,52]]);c.operations.tick();assert.equal(f.w.registry.items[f.w.inventory.get(0).network_id].name,'stone_pickaxe');assert.equal(f.w.items().dirt,576)}finally{f.close()}
})
test('finishing a dirt deposit closes the job, and strip storage releases each previous material latch',()=>{
 const f=realm(),c=controller(f);try{f.w.gameMode='creative';f.c.emit('inventory_content',{window_id:0,input:[f.item('dirt',1)]});f.w.selectedSlot=0;c.miningJobs.start('mine dirt');c.miningJobs.active.state='storage';c.miningJobs.active.storeMaterials=['dirt'];c.workshop.depositing={material:'dirt'};f.c.emit('inventory_content',{window_id:0,input:[]});c.miningJobs.tick(Date.now()+200);assert.equal(c.miningJobs.active,null);assert.equal(c.miningJobs.last.state,'completed');assert.equal(c.workshop.depositing,null)
 f.c.emit('inventory_content',{window_id:0,input:[f.item('cobblestone',64)]});c.miningJobs.start('strip mine 1 rows at 64');c.miningJobs.active.state='storage';c.miningJobs.active.storeMaterials=['dirt','cobblestone'];c.workshop.depositing={material:'dirt'};let material=null;c.workshop.deposit=name=>{material=name;return {state:'working',reason:'Waiting for receipt'}};const now=Date.now()+400;c.miningJobs.tick(now);assert.equal(c.workshop.depositing,null);c.miningJobs.tick(now+200);assert.equal(material,'cobblestone')
 }finally{f.close()}
})
