import test from 'node:test'
import assert from 'node:assert/strict'
import {realm} from './helpers/realm.js'
import {RespawnRecovery} from '../src/survival/respawn.js'
import {StackOperations} from '../src/survival/stack-operations.js'
import {Crafting} from '../src/survival/crafting.js'
import {mediumAt,Situation} from '../src/survival/situation.js'
import {Reader,decodeBiomeStores} from '../src/survival/chunks.js'

test('own death animation presses the normal respawn controls even if the old health still says 20',()=>{
 const f=realm(),r=new RespawnRecovery(f.w,f.n);try{r.attach(f.c);f.n.checkRespawn=now=>r.tick(now)
 f.c.emit('entity_event',{runtime_entity_id:99n,event_id:'death_animation'});assert.equal(r.state,'alive')
 f.c.emit('entity_event',{runtime_entity_id:1n,event_id:'death_animation'});assert.equal(r.state,'waiting-for-server');assert(f.sent.some(([name,p])=>name==='respawn'&&p.state===2));assert.equal(f.w.attributes['minecraft:health'],20);r.tick();assert.notEqual(r.state,'respawned','stale health must not clear death')
 f.c.emit('respawn',{runtime_entity_id:0n,state:1,position:{x:2.5,y:65.62,z:.5}});assert.equal(r.state,'waiting-for-health')
 f.c.emit('set_health',{health:20});assert.equal(r.state,'respawned');assert.equal(f.n.job,null)
 }finally{r.detach();f.close()}
})
test('death_info also detects the local death screen; unrelated entity hurt/death does not',()=>{
 const f=realm(),r=new RespawnRecovery(f.w,f.n);try{r.attach(f.c);f.c.emit('entity_event',{runtime_entity_id:7n,event_id:'hurt_animation'});assert.equal(f.w.lastHurtAt,null);f.c.emit('death_info',{cause:'death.attack.zombie',messages:[]});assert.notEqual(r.state,'alive');assert(f.sent.some(([name,p])=>name==='player_action'&&p.action==='respawn'))}finally{r.detach();f.close()}
})
test('hurt state, relative mobs and biome observations use server evidence',()=>{
 const f=realm();try{const s=new Situation({world:f.w,respawn:{state:'alive'}});f.c.emit('set_health',{health:14});f.w.entities.set('9',{type:'minecraft:zombie',position:{x:3.5,y:64,z:.5}});f.w.biomeStores.set('0,4,0',new Int32Array(4096).fill(99));f.w.biomeNames.set(99,'minecraft:snowy_plains');s.tick(Date.now());const x=s.snapshot();assert.equal(x.healthState,'hurt');assert.equal(x.nearbyMobs[0].dx,3);assert.equal(x.biome.name,'minecraft:snowy_plains');assert.equal(x.position.y,64)
 }finally{f.close()}
})
test('biome palette reuse is decoded and missing biome data stays unknown',()=>{
 const f=realm();try{assert.equal(f.w.biomeAt(),null);const a=decodeBiomeStores(new Reader(Buffer.from([1,10,255])),2);assert.equal(a[0][0],5);assert.equal(a[1][4095],5);assert.throws(()=>decodeBiomeStores(new Reader(Buffer.from([255])),1))}finally{f.close()}
})
test('a received recipe crafts with real stack IDs and only a matching server response credits output',()=>{
 const f=realm(),ops=new StackOperations(f.w),craft=new Crafting(f.w,ops);try{ops.client=f.c;craft.attach(f.c);f.c.emit('inventory_content',{window_id:0,input:[f.item('oak_log',2,9)]});f.w.selectedSlot=0
 craft.listener({shapeless_recipes:[{network_id:123,input:[{type:'valid',descriptor_type:'name',name:'minecraft:oak_log',metadata:-1,count:1}],output:[f.item('oak_planks',4)],block:'crafting_table'}]})
 assert(craft.craft('oak_planks').accepted);const request=f.sent.find(([name])=>name==='item_stack_request')[2].requests[0];assert.equal(request.actions[0].recipe_network_id,123);assert.equal(f.w.items().oak_planks,undefined);assert.equal(f.w.items().oak_log,2)
 f.receipt(request.request_id,[[0,1,9],[1,4,10]]);ops.tick();assert.equal(ops.state,'confirmed');assert.equal(f.w.items().oak_planks,4);assert.equal(f.w.items().oak_log,1)
 }finally{craft.detach();f.close()}
})
test('server denied/unsolicited craft replies cannot manufacture items; unsupported recipes stay blocked',()=>{
 const f=realm(),ops=new StackOperations(f.w),craft=new Crafting(f.w,ops);try{ops.client=f.c;craft.attach(f.c);f.c.emit('inventory_content',{window_id:0,input:[f.item('oak_log',2)]});assert(!craft.craft('stone_pickaxe').accepted)
 f.receipt(-77,[[1,64,10]]);assert.equal(f.w.items().stone_pickaxe,undefined)
 assert(!ops.transfer({window:0,slot:0},{window:0,slot:1},64).accepted)
 }finally{craft.detach();f.close()}
})
test('container transfers require the open container, real stack IDs and server receipts on both sides',()=>{
 const f=realm(),ops=new StackOperations(f.w);try{ops.client=f.c;f.c.emit('inventory_content',{window_id:0,input:[f.item('dirt',64,5)]});f.c.emit('container_open',{window_id:7,window_type:'container'});f.c.emit('inventory_content',{window_id:7,input:Array.from({length:54},()=>({network_id:0,count:0}))})
 assert(ops.transfer({window:0,slot:0},{window:7,slot:0},64).accepted);assert.equal(f.w.items().dirt,64);const id=ops.pending.id
 f.c.emit('item_stack_response',{responses:[{status:'ok',request_id:id,containers:[{slot_type:{container_id:'hotbar_and_inventory'},slots:[{slot:0,count:0}]},{slot_type:{container_id:'container'},slots:[{slot:0,count:64,item_stack_id:11}]}]}]});ops.tick();assert.equal(ops.state,'confirmed');assert.equal(f.w.items().dirt,undefined);assert.equal(f.w.inventoryProtocol.containers.get('7').items[0].count,64)
 }finally{f.close()}
})
test('subchunk-request level chunks still retain their server biome payload',()=>{
 const f=realm();try{f.w.biomeNames.set(5,'minecraft:taiga');const payload=Buffer.from([1,10,...Array(23).fill(255)]);f.w.receiveChunk({dimension:0,cache_enabled:false,sub_chunk_count:4294967295,x:0,z:0,payload},f.c);assert.equal(f.w.biomeAt().name,'minecraft:taiga');assert.equal(f.w.biomeDecodeErrors,0)}finally{f.close()}
})
test('Creative supplies use received catalog IDs and are never allowed or credited in Survival',()=>{
 const f=realm(),ops=new StackOperations(f.w),craft=new Crafting(f.w,ops);try{ops.client=f.c;craft.attach(f.c);f.c.emit('inventory_content',{window_id:0,input:[]});f.c.emit('creative_content',{items:[{entry_id:41,item:f.item('dirt',1)}]});assert(!craft.creativeItem('dirt',64).accepted);assert.equal(f.w.items().dirt,undefined)
 f.w.gameMode='creative';f.w.abilityState.effective.instant_build=true;f.w.abilityState.active=['instant_build'];assert(craft.creativeItem('dirt',64).accepted);const request=f.sent.find(([name])=>name==='item_stack_request')[2].requests[0];assert.equal(request.actions[0].item_id,41);assert.equal(request.actions[1].count,64);assert.equal(f.w.items().dirt,undefined);f.receipt(request.request_id,[[0,64,19]]);ops.tick();assert.equal(f.w.items().dirt,64);assert.equal(ops.state,'confirmed');assert(!f.sent.some(([name])=>name==='command_request'||name==='request_ability'))
 }finally{craft.detach();f.close()}
})
test('late stack receipts cannot credit a different chest that reuses a closed window ID',()=>{
 const f=realm(),ops=new StackOperations(f.w);try{ops.client=f.c;f.c.emit('inventory_content',{window_id:0,input:[f.item('dirt',64)]});f.c.emit('container_open',{window_id:7,window_type:'container',coordinates:{x:2,y:64,z:0}});f.c.emit('inventory_content',{window_id:7,input:[{network_id:0,count:0}]});assert(ops.transfer({window:0,slot:0},{window:7,slot:0},64).accepted);const id=ops.pending.id;f.c.emit('container_close',{window_id:7});f.c.emit('container_open',{window_id:7,window_type:'container',coordinates:{x:4,y:64,z:0}});f.c.emit('inventory_content',{window_id:7,input:[{network_id:0,count:0}]})
 f.c.emit('item_stack_response',{responses:[{status:'ok',request_id:id,containers:[{slot_type:{container_id:'hotbar_and_inventory'},slots:[{slot:0,count:0}]},{slot_type:{container_id:'container'},slots:[{slot:0,count:64,item_stack_id:77}]}]}]});ops.tick();assert.equal(f.w.items().dirt,64);assert.equal(f.w.inventoryProtocol.containers.get('7').items[0].count,0);assert.notEqual(ops.state,'confirmed')
 }finally{f.close()}
})
