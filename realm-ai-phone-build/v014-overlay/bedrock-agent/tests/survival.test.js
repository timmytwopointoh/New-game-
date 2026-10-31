import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {Reader,decodeSection,blockIndex} from '../src/survival/chunks.js'
import {findPath} from '../src/survival/pathfinder.js'
import {WorldView} from '../src/survival/world.js'
import {Navigation} from '../src/survival/navigation.js'
import {resolveMaterial,searchCatalog,recipeInfo,supplyPlan,catalogCounts} from '../src/survival/catalog.js'
import {SurvivalController} from '../src/survival/controller.js'
const require=createRequire(import.meta.url)
const {createSerializer}=require('bedrock-protocol/src/transforms/serializer')
function varint(n){n=n>>>0;const b=[];do{const v=n&127;n>>>=7;b.push(v|(n?128:0))}while(n);return Buffer.from(b)}
const signed=n=>varint(((n<<1)^(n>>31))>>>0)
const singleton=(y,id)=>Buffer.concat([Buffer.from([9,1,y&255,1]),signed(id)])
function world(){const w=new WorldView();w.initialize({player_gamemode:0,player_position:{x:.5,y:65.62,z:.5},runtime_entity_id:1n,dimension:'overworld',block_network_ids_are_hashes:true});w.abilityState={known:true,effective:{},active:[],loading:false};return w}
const runtimeCaches=new WeakMap()
function runtimeId(w,name){
 let ids=runtimeCaches.get(w)
 if(!ids){ids={};for(const [id,b] of Object.entries(w.registry.blocksByRuntimeId))if(b.stateId===w.registry.blocksByName[b.name]?.defaultState)ids[b.name]=Number(id);runtimeCaches.set(w,ids)}
 return ids[name]
}
function fill(w,x,y,z,name){assert(w.registry.blocksByName[name],name);w.update({position:{x,y,z},block_runtime_id:runtimeId(w,name),layer:0});w.update({position:{x,y,z},block_runtime_id:runtimeId(w,'air'),layer:1})}
function floor(w){for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){fill(w,x,63,z,'stone');fill(w,x,64,z,'air');fill(w,x,65,z,'air')}}
test('v9 negative subchunk Y and signed hashed singleton are decoded',()=>{const s=decodeSection(singleton(-4,-2144268767),0);assert.equal(s.y,-4);assert.equal(s.layers[0][4095],-2144268767);assert.equal(blockIndex(1,2,3),306)})
test('mixed network palette uses x-z-y indexing and rejects truncation',()=>{
 const words=Buffer.alloc(512);words.writeUInt32LE(1<<4,0)
 const data=Buffer.concat([Buffer.from([9,1,4,3]),words,signed(2),signed(10),signed(20)])
 const s=decodeSection(data,0);assert.equal(s.layers[0][4],20);assert.equal(s.layers[0][3],10)
 assert.throws(()=>decodeSection(data.subarray(0,-1),0));assert.throws(()=>decodeSection(Buffer.from([10,1]),0))
})
test('unknown world cells never become traversable and water blocks walking',()=>{const w=world();assert.equal(w.walkable({x:0,y:64,z:0}),false);floor(w);assert(w.walkable({x:0,y:64,z:0}));fill(w,0,64,0,'water');assert.equal(w.walkable({x:0,y:64,z:0}),false)})
test('A* detours around walls and refuses unreachable and vertical goals',()=>{
 const walls=new Set(['1,0','1,1']),grid={walkable:p=>p.y===64&&Math.abs(p.x)<=3&&Math.abs(p.z)<=3&&!walls.has(`${p.x},${p.z}`)}
 const a={x:0,y:64,z:0},b={x:2,y:64,z:0},path=findPath(grid,a,b)
 assert(path.ok);assert(path.path.length>3);assert(path.path.every(p=>grid.walkable(p)))
 assert.equal(findPath(grid,a,{x:2,y:65,z:0}).ok,false)
 assert.equal(findPath({walkable:p=>p.x===0},a,b).ok,false)
 assert.equal(findPath(grid,a,b,{maxNodes:1}).ok,false)
})
test('collision shape support and changed obstacles invalidate route',()=>{const w=world();floor(w);assert(findPath(w,{x:0,y:64,z:0},{x:2,y:64,z:0}).ok);fill(w,1,64,0,'stone');assert.equal(w.walkable({x:1,y:64,z:0}),false);const p=findPath(w,{x:0,y:64,z:0},{x:2,y:64,z:0});assert(p.ok);assert(p.path.some(p=>p.z!==0))})
test('world mode maps signed hashed runtime IDs and handles singleton chunk payload',()=>{
 const w=world(),runtime=Number(Object.entries(w.registry.blocksByRuntimeId).find(([,b])=>b.name==='stone')[0]);w.receiveChunk({x:0,z:0,dimension:0,cache_enabled:false,sub_chunk_count:1,payload:singleton(3,runtime)},{queue(){}})
 assert.equal(w.block({x:1,y:63,z:1}).name,'stone');assert.equal(w.block({x:1,y:64,z:1}),null)
})
test('subchunk requests are bounded, deduplicated and use real serializer',()=>{
 const w=world(),sent=[],writer=createSerializer('1.26.60'),client={queue:(name,params)=>{writer.createPacketBuffer({name,params});sent.push(params)}}
 w.requestNearby(client);w.requestNearby(client);assert.equal(sent.length,1);assert.equal(sent[0].requests.length,27)
})
test('real 1.26.60 auth-input serializer accepts idle/walking; no teleport packets',()=>{
 const w=world();floor(w);const sent=[],writer=createSerializer('1.26.60'),client=new EventEmitter()
 client.queue=(name,p)=>{writer.createPacketBuffer({name,params:p});sent.push([name,p])}
 const n=new Navigation(w);n.attach(client);client.emit('start_game',{current_tick:0n,rotation:{x:0,z:0}});n.spawned=true
 assert(n.walk({x:2,y:64,z:0}).accepted);n.step(1000);assert.equal(sent[0][0],'player_auth_input');assert(w.position.x>.5)
 assert(sent.filter(([name])=>name==='player_auth_input').every(([,p])=>Math.hypot(p.delta.x,p.delta.z)<=.101))
 client.emit('correct_player_move_prediction',{position:{x:.5,y:65.62,z:.5}});client.emit('correct_player_move_prediction',{position:{x:-8,y:65.62,z:.5}})
 assert.equal(n.route,null);n.detach()
})
test('low health or changed terrain stops movement',()=>{const w=world();floor(w);const c=new EventEmitter();c.queue=()=>{};const n=new Navigation(w);n.attach(c);n.spawned=true;n.walk({x:2,y:64,z:0});w.attributes['minecraft:health']=4;n.step();assert.equal(n.route,null);n.detach()})
test('catalog looks up all shipped block/item names and plural phrases',()=>{assert(catalogCounts.blocks>1000&&catalogCounts.items>2000);assert.equal(resolveMaterial('stone pickaxes'),'stone_pickaxe');assert.equal(resolveMaterial('oak logs'),'oak_log');assert(searchCatalog('copper').length>0);assert(recipeInfo('stone_pickaxe')[0].verified)})
test('supply plans round crafting batches, reserve shared supplies and do not invent execution',()=>{
 const p=supplyPlan('stone_pickaxe',1,{oak_log:2,cobblestone:3},true);assert(p.ok);assert.deepEqual(p.missing,{});assert(p.steps.some(s=>s.item==='crafting_table'));assert.equal(p.executable,false)
 const have=supplyPlan('torch',4,{torch:4},true);assert.equal(have.steps.length,0)
 assert.equal(supplyPlan('torch',999).ok,false)
})
test('no-addon controller never sends legacy behavior-pack commands',()=>{
 const c={events:[],nextEventId:0,emit(){},send(){throw Error('Must not invoke legacy bridge')},reconnect:()=>({accepted:true,message:'rejoined'})},s=new SurvivalController(c)
 assert(s.handle('rejoin realm').accepted);assert.match(s.handle('mine 5 iron ore').message,/not implemented/i);assert.match(s.handle('start plan').message,/not implemented/i);assert.match(s.handle('plan get 8 torches').message,/plan/i)
})

test('manual reconnect resets dead transport state without forcing a Microsoft cache refresh',async()=>{
 const {Connection}=await import('../src/connection.js')
 const c=new Connection({minecraft:{mode:'realm',username:'saved-player'},ownerPlayerNames:[]},()=>{})
 let closed=0,started=0;const old=new EventEmitter();old._closed=true;old.close=()=>{closed++};old.on('unused',()=>{})
 c.client=old;c.lastError='Transport closed';c.start=()=>{started++}
 const r=c.reconnect();assert(r.accepted);assert.equal(started,1);assert.equal(closed,1);assert.equal(c.lastError,'');assert.equal(old.listenerCount('unused'),0)
 assert.equal(c.reconnect().accepted,false)
 c.spawned=true;assert.match(c.reconnect().message,/Already joined/)
})

test('server inventory snapshots and disconnect cleanup do not retain an active walk',()=>{
 const w=world(),c=new EventEmitter();c.queue=()=>{};w.attach(c)
 const item=Object.values(w.registry.items).find(i=>i.name==='stone_pickaxe');assert(item)
 c.emit('inventory_content',{window_id:'inventory',input:[{network_id:item.id,count:1}]});assert.equal(w.items().stone_pickaxe,1)
 c.emit('inventory_slot',{window_id:'inventory',slot:0,item:{network_id:0,count:0}});assert.equal(w.items().stone_pickaxe,undefined)
 const n=new Navigation(w);n.attach(c);n.spawned=true;c.emit('close');assert.equal(n.spawned,false);assert.equal(n.timer,null);w.detach()
})

test('generic version-data recipes expand beyond the starter recipe list',()=>{
 const p=supplyPlan('diamond_sword',1,{diamond:2,stick:1,crafting_table:1},true)
 assert(p.ok);assert.equal(p.missing.diamond,undefined);assert(p.steps.some(s=>s.action==='craft'&&s.item==='diamond_sword'))
})

test('shelter planning accounts for doorway, walls, floor and roof without placing blocks',()=>{
 const c={events:[],nextEventId:0,emit(){},send(){throw Error('No world edits allowed')}}
 const s=new SurvivalController(c),r=s.handle('plan build a small shelter with cobblestone')
 assert.equal(r.supplyPlan.count,96);assert.equal(r.supplyPlan.blueprint.width,5);assert.equal(r.supplyPlan.executable,false)
 assert.match(r.message,/not executable/)
})
