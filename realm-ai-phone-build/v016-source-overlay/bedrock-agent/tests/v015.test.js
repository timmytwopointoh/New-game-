import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {WorldView} from '../src/survival/world.js'
import {Navigation} from '../src/survival/navigation.js'
import {SurvivalVerification,abilityEvidence} from '../src/survival/verification.js'
import {Building,blueprint} from '../src/survival/building.js'
import {parseDescriptor,renderDescriptor,validateDescriptor} from '../src/survival/command-plans.js'
const require=createRequire(import.meta.url),{createSerializer}=require('bedrock-protocol/src/transforms/serializer')
const empty={network_id:0,count:0,metadata:0,has_stack_id:false,stack_id:0,block_runtime_id:0,extra:{has_nbt:false,can_place_on:[],can_destroy:[]}}
function fixture(authoritative=false){
 const w=new WorldView();w.initialize({server_authoritative_block_breaking:authoritative,player_gamemode:'survival',entity_id:42n,player_position:{x:.5,y:65.62,z:.5},runtime_entity_id:1n,dimension:0});w.abilityState={known:true,effective:{mine:true,build:true},active:[],loading:false}
 const ids={};for(const [id,b] of Object.entries(w.registry.blocksByRuntimeId))if(b.stateId===w.registry.blocksByName[b.name]?.defaultState)ids[b.name]=Number(id)
 const set=(p,name)=>{for(const layer of [0,1])w.update({position:p,block_runtime_id:layer?ids.air:ids[name],layer})}
 for(let x=-3;x<=8;x++)for(let z=-3;z<=8;z++)for(let y=62;y<=75;y++)set({x,y,z},y===63?'stone':'air')
 const c=new EventEmitter(),sent=[],serializer=createSerializer('1.26.60');c.queue=(name,p)=>{serializer.createPacketBuffer({name,params:p});sent.push([name,p])};w.attach(c);const n=new Navigation(w);n.attach(c);n.spawned=true
 const dirt=w.registry.itemsByName.dirt.id;w.inventoryKnown=true;w.inventory.set(0,{...empty,network_id:dirt,count:64,block_runtime_id:ids.dirt});w.inventory.set(1,{...empty,network_id:dirt,count:64,block_runtime_id:ids.dirt});w.selectedSlot=0
 return {w,n,c,sent,ids,set}
}
const design=(shape='block',extra={})=>({shape,origin:{x:2,y:64,z:0},material:'dirt',width:1,height:1,...extra})
test('start-game fallback resolves the bot own inherited mode, never the Realm default for an explicit mode',()=>{
 const w=new WorldView(),base={entity_id:42n,runtime_entity_id:1n,player_position:{x:.5,y:65.62,z:.5},dimension:0}
 w.initialize({...base,player_gamemode:'fallback',world_gamemode:'creative'});assert.equal(w.gameMode,'creative');assert.match(w.gameModeSource,/player fallback/);assert(!w.survivalVerified)
 const verify=new SurvivalVerification(w,{stop(){},pendingFlags:[]});assert.match(verify.check().reason,/reports this player in creative.*has not sent.*ability layers/)
 w.initialize({...base,player_gamemode:'survival',world_gamemode:'creative'});assert.equal(w.gameMode,'survival');assert.match(w.gameModeSource,/player-specific/)
 w.initialize({...base,player_gamemode:'fallback',world_gamemode:'fallback'});assert.equal(w.gameMode,null);assert.equal(w.gameModeSource,null)
})
test('loading abilities are temporary, unused flight permission is not active, and only own effective layers are checked',()=>{
 const state=abilityEvidence({command_permission:0,abilities:[{type:'loading_screen',allowed:{flying:true,invulnerable:true},enabled:{flying:true,invulnerable:true}},{type:'base',allowed:{flying:true,invulnerable:true,instant_build:true},enabled:{flying:false,invulnerable:false,instant_build:false}}]});assert.equal(state.known,true);assert.equal(state.loading,true);assert.deepEqual(state.active,[]);assert.equal(state.effective.flying,false)
 const normal=abilityEvidence({command_permission:0,abilities:[{type:'base',allowed:{flying:true},enabled:{flying:false}}]});assert.equal(normal.loading,false);assert.deepEqual(normal.active,[]);assert.equal(normal.commandPermission,0)
})
test('mode requests require server permission, send only the selected self mode, suppress duplicate taps, and await own confirmation',()=>{
 const w=new WorldView();w.initialize({player_gamemode:'survival',entity_id:42n,runtime_entity_id:1n,player_position:{x:.5,y:65.62,z:.5},dimension:0});w.abilityState={known:true,effective:{},active:[],loading:false,commandPermission:0}
 const nav={spawned:true,pendingFlags:[],job:null,stop(){this.stopped=true}},c=new EventEmitter(),sent=[];c.queue=(name,p)=>sent.push([name,p]);const v=new SurvivalVerification(w,nav);v.attach(c);let r=v.requestMode('creative');assert.equal(r.accepted,false);assert.match(r.message,/has not granted permission/);assert.equal(sent.length,0)
 w.abilityState.commandPermission=1;r=v.requestMode('creative');assert.equal(r.queued,true);assert.equal(sent.length,1);assert.equal(sent[0][1].command,'/gamemode creative @s');assert.equal(sent[0][1].version,'latest');const uuid=sent[0][1].origin.uuid;v.requestMode('creative');assert.equal(sent.length,1,'duplicate taps must not send a second mode request')
 w.gameMode='creative';w.gameModeSource='per-player server update';c.emit('update_player_game_type',{});assert.equal(v.snapshot().creativeMovementVerified,true);assert.match(v.reason,/Creative mode and grounded movement abilities are verified/);assert.equal(v.pending,false);assert.equal(v.requested,false)
 v.detach();assert.equal(uuid.length,36)
})
test('denied mode request is reported, and a manual retry still uses the same safe self-only command',()=>{
 const w=new WorldView();w.initialize({player_gamemode:'creative',entity_id:42n,runtime_entity_id:1n,player_position:{x:.5,y:65.62,z:.5},dimension:0});w.abilityState={known:true,effective:{},active:[],loading:false,commandPermission:2};const nav={spawned:true,pendingFlags:[],job:null,stop(){}},c=new EventEmitter(),sent=[],reports=[];c.queue=(name,p)=>sent.push([name,p]);const v=new SurvivalVerification(w,nav,m=>reports.push(m));v.attach(c)
 const first=v.requestMode('survival');assert.equal(first.queued,true);c.emit('command_output',{origin:{uuid:sent[0][1].origin.uuid},success_count:0});assert.equal(v.pending,false);assert.match(v.reason,/Server denied/);assert.equal(reports.length,2)
 const retry=v.requestMode('survival');assert.equal(retry.queued,true);assert.equal(sent.length,2);assert.equal(sent[1][1].command,'/gamemode survival @s');assert.equal(sent[1][1].origin.player_entity_id,42n);assert.equal(v.requestMode('unknown').accepted,false);v.detach()
})
test('confirmed Creative allows grounded walking through ordinary inputs, never teleport, mining or building',()=>{
 const {w,n,sent}=fixture();w.gameMode='creative';w.gameModeSource='per-player server update';assert(w.creativeMovementVerified);assert(n.walk({x:2,y:64,z:0}).accepted);n.step();assert(sent.some(([name,p])=>name==='player_auth_input'&&p.move_vector.z>0));assert(!sent.some(([name])=>name==='player_teleport'||name==='command_request'));assert.equal(n.mine({x:1,y:64,z:0}).accepted,false);assert.equal(n.build(design()).accepted,false)
 w.abilityState.effective.flying=true;w.abilityState.active=['flying'];assert(!w.creativeMovementVerified);assert.equal(n.walk({x:2,y:64,z:0}).accepted,false);n.detach()
})
test('legacy server uses standalone start/continue/break packets, not ignored auth-input block actions',()=>{
 const {w,n,c,sent,ids,set}=fixture(false),now=Date.now();set({x:1,y:64,z:0},'dirt');assert(n.mine({x:1,y:64,z:0}).accepted);n.mining.job.started=now;const duration=n.mining.job.duration
 for(let t=0;t<=duration+50;t+=50)n.step(now+t)
 assert(sent.some(([name,p])=>name==='player_action'&&p.action==='start_break'));assert(sent.some(([name,p])=>name==='player_action'&&p.action==='continue_break'));assert(sent.some(([name,p])=>name==='inventory_transaction'&&p.transaction.transaction_data.action_type==='break_block'))
 assert(sent.filter(([name])=>name==='player_auth_input').every(([,p])=>!p.block_action&&!p.transaction&&!p.input_data.includes('block_action')));assert.equal(w.block({x:1,y:64,z:0}).name,'dirt')
 c.emit('update_subchunk_blocks',{x:0,y:4,z:0,blocks:[{position:{x:1,y:64,z:0},runtime_id:ids.air}],extra:[]});n.step(now+duration+100);assert.equal(n.mining.result,'confirmed');n.detach()
})
test('authoritative server keeps mining in auth input and emits sustained continuation',()=>{
 const {n,sent,set}=fixture(true),now=Date.now();set({x:1,y:64,z:0},'dirt');assert(n.mine({x:1,y:64,z:0}).accepted);n.mining.job.started=now;n.step(now);n.step(now+50)
 assert(sent.some(([name,p])=>name==='player_auth_input'&&p.block_action?.some(a=>a.action==='continue_break')));assert(!sent.some(([name])=>name==='player_action'));assert(sent.some(([name,p])=>name==='player_auth_input'&&Math.abs(p.yaw)>1));n.detach()
})
test('synced and batched updates confirm actual world changes in both layers at absolute negative coordinates',()=>{
 const {w,c,n,ids}=fixture();const p={x:-2,y:64,z:-1};c.emit('update_subchunk_blocks',{x:-1,y:4,z:-1,blocks:[{position:p,runtime_id:ids.dirt}],extra:[{position:p,runtime_id:ids.water}]});assert.equal(w.block(p).name,'dirt');assert.equal(w.block(p,1).name,'water');const before=w.blockVersion(p);c.emit('update_block_synced',{position:p,block_runtime_id:ids.air,layer:0});assert(w.blockVersion(p)>before);assert.equal(w.block(p).name,'air');n.detach()
})
test('one-block building emits real placement against a visible support; waits for block AND inventory',()=>{
 const {w,n,c,sent,ids}=fixture(),now=Date.now();assert(n.build(design()).accepted);n.step(now);const packet=sent.find(([name])=>name==='inventory_transaction');assert(packet);const data=packet[1].transaction.transaction_data;assert.equal(data.action_type,'click_block');assert.deepEqual(data.block_position,{x:2,y:63,z:0});assert.equal(data.face,1);assert.equal(data.hotbar_slot,0);assert.equal(data.held_item.count,64);assert.equal(w.block({x:2,y:64,z:0}).name,'air');assert.equal(n.building.placed,0)
 c.emit('update_block',{position:{x:2,y:64,z:0},block_runtime_id:ids.dirt,layer:0});n.step(now+50);assert.equal(n.building.placed,0);assert(n.building.job)
 c.emit('inventory_slot',{window_id:'inventory',slot:0,item:{...w.inventory.get(0),count:63}});n.step(now+100);assert.equal(n.building.placed,1);assert.equal(n.building.state,'confirmed');assert.equal(n.job,null);n.detach()
})
test('wall blueprint executes each confirmed block in order without inventing inventory',()=>{
 const {w,n,c,sent,ids}=fixture(),now=Date.now();assert(n.build(design('wall',{width:2,height:2})).accepted)
 let confirmed=0
 for(let i=0;i<400&&n.job;i++){
  n.step(now+i*50);c.emit('correct_player_move_prediction',{position:{...w.position}});const pending=n.building.job?.pending
  if(pending){const held=w.inventory.get(pending.slot);c.emit('update_block',{position:pending.target,block_runtime_id:ids.dirt,layer:0});c.emit('inventory_slot',{window_id:'inventory',slot:pending.slot,item:{...held,count:held.count-1}});confirmed++}
 }
 assert.equal(n.building.state,'confirmed');assert.equal(n.building.placed,4);assert.equal(confirmed,4);assert.equal(sent.filter(([name])=>name==='inventory_transaction').length,4);assert.equal(w.inventory.get(0).count,60);n.detach()
})
test('floor and shelter blueprints are finite, contiguous and preserve a two-block doorway',()=>{
 assert.equal(blueprint(design('floor',{width:3,height:2})).positions.length,6);const shelter=blueprint(design('shelter'));assert.equal(shelter.positions.length,96);const keys=new Set(shelter.positions.map(p=>`${p.x},${p.y},${p.z}`));assert.equal(keys.size,96);assert(!keys.has('4,65,0'));assert(!keys.has('4,66,0'));assert(keys.has('4,67,0'));assert(keys.has('4,68,0'))
})
test('insufficient supplies, occupied footprint, nearby builds, missing terrain and disabled permissions send no placement',()=>{
 const {w,n,set,sent}=fixture();w.inventory.set(0,{...w.inventory.get(0),count:8});w.inventory.delete(1);assert.match(n.build(design('shelter')).message,/Need 96/);assert.equal(n.job,null)
 set({x:2,y:64,z:0},'stone');assert.match(n.build(design()).message,/occupied/);set({x:2,y:64,z:0},'air');set({x:3,y:64,z:0},'oak_planks');assert.match(n.build(design()).message,/existing build|protected/);set({x:3,y:64,z:0},'air');w.abilityState.effective.build=false;assert.match(n.build(design()).message,/disabled/);assert.equal(sent.filter(([name])=>name==='inventory_transaction').length,0);n.detach()
})
test('placement timeout, mismatched update and Stop preserve world state and stop further transactions',()=>{
 const {w,n,sent}=fixture(),now=Date.now();assert(n.build(design('wall',{width:2,height:1})).accepted);n.step(now);assert.equal(w.block({x:2,y:64,z:0}).name,'air');for(let t=50;t<=5050;t+=50)n.step(now+t);assert.equal(n.building.job,null);assert.match(n.building.reason,/did not confirm/);const count=sent.filter(([name])=>name==='inventory_transaction').length;n.step(now+5100);assert.equal(sent.filter(([name])=>name==='inventory_transaction').length,count);n.detach()
 const f=fixture();assert(f.n.build(design()).accepted);f.n.stop();f.n.step();assert.equal(f.sent.filter(([name])=>name==='inventory_transaction').length,0);assert.equal(f.n.building.job,null);f.n.detach()
})
test('building descriptors are explicit executable jobs and remain separate from supply previews',()=>{
 const text='build wall 2 by 3 with dirt at 2 64 0',d=parseDescriptor(text);assert.equal(d.id,'build_wall');assert.equal(renderDescriptor(d),text);assert.equal(parseDescriptor('plan build wall 2 by 3 with dirt').id,'wall');assert.equal(parseDescriptor('mine 1 64 0').id,'dig');assert.throws(()=>parseDescriptor('mine'),/Dig one block/);assert.throws(()=>validateDescriptor({id:'build_wall',values:{material:'dirt',width:2,height:4,x:0,y:64,z:0}}));assert.equal(renderDescriptor(parseDescriptor('build shelter with dirt at 2 64 0')),'build shelter with dirt at 2 64 0')
})

test('effective held tool is faster than empty hand or held dirt, and input remains held after estimated completion until server air',()=>{
 const a=fixture(true),target={x:1,y:64,z:0};a.set(target,'dirt');a.w.inventory.set(0,{...empty});assert(a.n.mine(target).accepted);const bare=a.n.mining.job.duration;a.n.stop();a.w.inventory.set(0,{...empty,network_id:a.w.registry.itemsByName.dirt.id,count:8,block_runtime_id:a.ids.dirt});assert(a.n.mine(target).accepted);assert.equal(a.n.mining.job.duration,bare);a.n.stop()
 a.w.inventory.set(0,{...empty,network_id:a.w.registry.itemsByName.iron_shovel.id,count:1});assert(a.n.mine(target).accepted);const tool=a.n.mining.job.duration;assert(tool<bare);assert(a.n.mining.job.toolEffective);const now=Date.now();a.n.mining.job.started=now;for(let t=0;t<=tool+300;t+=50)a.n.step(now+t);assert(a.n.mining.job);assert(a.n.mining.snapshot().holding);assert.equal(a.w.block(target).name,'dirt');assert(a.sent.filter(([name])=>name==='player_auth_input').at(-1)[1].block_action.some(p=>p.action==='continue_break'));assert.equal(a.sent.filter(([name,p])=>name==='player_auth_input'&&p.transaction).length,1)
 a.c.emit('update_block',{position:target,block_runtime_id:a.ids.air,layer:0});a.n.step(now+tool+350);assert.equal(a.n.mining.snapshot().holding,false);assert.equal(a.n.mining.result,'confirmed');a.n.detach()
})
test('changing the held slot releases mining immediately; own mining-fatigue effect changes the estimate',()=>{
 const a=fixture(true),target={x:1,y:64,z:0};a.set(target,'dirt');a.w.inventory.set(0,{...empty,network_id:a.w.registry.itemsByName.iron_shovel.id,count:1});assert(a.n.mine(target).accepted);a.w.selectedSlot=1;a.n.step();assert.equal(a.n.mining.job,null);assert.equal(a.n.mining.result,'cancelled');a.w.selectedSlot=0
 const fatigue=a.w.registry.effectsByName.MiningFatigue;assert(fatigue);a.c.emit('mob_effect',{runtime_entity_id:99n,event_id:'add',effect_id:fatigue.id,amplifier:3,duration:1200});assert.equal(a.w.effects.size,0);a.c.emit('mob_effect',{runtime_entity_id:1n,event_id:'add',effect_id:fatigue.id,amplifier:3,duration:1200});assert(!a.n.mine(target).accepted);a.c.emit('mob_effect',{runtime_entity_id:1n,event_id:'remove',effect_id:fatigue.id});assert(a.n.mine(target).accepted);a.n.detach()
})
test('complete floor and 96-block shelter execute with observed approach feedback and per-block inventory confirmation',()=>{
 for(const descriptor of [design('floor',{width:3,height:2}),design('shelter')]){
  const f=fixture(),now=Date.now();assert(f.n.build(descriptor).accepted);let transactions=0
  for(let i=0;i<1400&&f.n.job;i++){
   f.n.step(now+i*50)
   // Simulate an accepting server independently confirming movement and both changes.
   f.c.emit('correct_player_move_prediction',{position:{...f.w.position}})
   const pending=f.n.building.job?.pending
   if(pending&&!pending.simulated){pending.simulated=true;const held=f.w.inventory.get(pending.slot);f.c.emit('update_block',{position:pending.target,block_runtime_id:f.ids.dirt,layer:0});f.c.emit('inventory_slot',{window_id:'inventory',slot:pending.slot,item:{...held,count:held.count-1}});transactions++}
  }
  assert.equal(f.n.building.state,'confirmed',f.n.building.reason);assert.equal(f.n.building.placed,descriptor.shape==='shelter'?96:6);assert.equal(transactions,f.n.building.placed);f.n.detach()
 }
})

test('legacy mining also keeps holding after its single completion request and releases immediately on Stop',()=>{
 const f=fixture(false),target={x:1,y:64,z:0},now=Date.now();f.set(target,'dirt');assert(f.n.mine(target).accepted);f.n.mining.job.started=now;const duration=f.n.mining.job.duration;for(let t=0;t<=duration+150;t+=50)f.n.step(now+t)
 assert(f.n.mining.snapshot().holding);assert.equal(f.sent.filter(([name])=>name==='inventory_transaction').length,1);assert(f.sent.some(([name,p])=>name==='player_action'&&p.action==='continue_break'));const before=f.sent.length;f.n.stop();assert(f.sent.slice(before).some(([name,p])=>name==='player_action'&&p.action==='abort_break'));assert(!f.n.mining.snapshot().holding);f.n.detach()
})
