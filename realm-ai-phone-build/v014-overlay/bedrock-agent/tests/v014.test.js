import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {WorldView} from '../src/survival/world.js'
import {Navigation} from '../src/survival/navigation.js'
import {SurvivalController} from '../src/survival/controller.js'
import {CommandPlans,validateDescriptor,parseDescriptor,renderDescriptor,commandCatalog} from '../src/survival/command-plans.js'
import {abilityEvidence,SurvivalVerification} from '../src/survival/verification.js'
import {createApi} from '../src/api.js'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{createSerializer}=require('bedrock-protocol/src/transforms/serializer')
function fixture(mode=0){
 const w=new WorldView();w.initialize({player_gamemode:mode,world_gamemode:'survival',entity_id:42n,player_position:{x:.5,y:65.62,z:.5},runtime_entity_id:1n,dimension:0})
 w.abilityState={known:true,effective:{},active:[],loading:false}
 const states={};for(const [id,b] of Object.entries(w.registry.blocksByRuntimeId))if(b.stateId===w.registry.blocksByName[b.name]?.defaultState)states[b.name]=Number(id)
 const set=(x,y,z,name,id=states[name])=>{for(const layer of [0,1])w.update({position:{x,y,z},block_runtime_id:layer?states.air:id,layer})}
 for(let x=-2;x<=4;x++)for(let z=-2;z<=2;z++)for(let y=63;y<=72;y++)set(x,y,z,y===63?'stone':'air')
 const client=new EventEmitter(),sent=[],serializer=createSerializer('1.26.60');client.queue=(name,p)=>{serializer.createPacketBuffer({name,params:p});sent.push([name,p])}
 const n=new Navigation(w);w.attach(client);n.attach(client);n.spawned=true
 return {w,set,client,n,sent}
}
test('idle and stopped inputs fall under gravity and land without tunnelling',()=>{
 const {w,n,sent}=fixture();w.position.y+=4;const at=Date.now();n.stop();for(let i=0;i<60;i++)n.step(at+i*50)
 assert(w.grounded());assert(Math.abs(w.position.y-65.62)<.002);assert(sent.some(([name,p])=>name==='player_auth_input'&&p.delta.y<-.1));assert(sent.filter(([name])=>name==='player_auth_input').at(-1)[1].input_data.includes('vertical_collision'));n.detach()
})
test('floor removed by server starts falling even after Stop',()=>{
 const {w,n,set,sent}=fixture();set(0,63,0,'air');set(0,62,0,'stone');n.stop();n.step(Date.now());assert(w.position.y<65.62);assert(!sent.filter(([name])=>name==='player_auth_input').at(-1)[1].input_data.includes('vertical_collision'));n.detach()
})
test('snow layer states use their real partial shapes; powder snow and fluids remain blocked',()=>{
 const {w,set,n}=fixture()
 const snow=Object.entries(w.registry.blocksByRuntimeId).find(([,b])=>b.name==='snow_layer'&&w.Block.fromStateId(b.stateId,0).getProperties().height===3)
 assert(snow);set(1,64,0,'snow_layer',Number(snow[0]));const h=w.supportHeight({x:1,y:64,z:0});assert(h>64&&h<65);assert(w.walkable({x:1,y:64,z:0}));assert(!w.clearBody({x:1.5,y:65.62,z:.5}));assert(w.clearBody({x:1.5,y:h+1.62,z:.5}));
 assert(n.walk({x:2,y:64,z:0}).accepted);const at=Date.now();for(let i=0;i<35;i++)n.step(at+i*50);assert(w.position.x>2);assert(w.grounded())
 set(1,64,0,'powder_snow');assert(!w.walkable({x:1,y:64,z:0}));set(1,64,0,'water');assert(!w.walkable({x:1,y:64,z:0}));n.detach()
})
test('world default does not verify own Survival; mode change cancels active jobs',()=>{
 const {w,n,client}=fixture(undefined);w.gameMode=null;assert(!n.walk({x:2,y:64,z:0}).accepted);assert(!n.follow('Owner').accepted);assert(!n.mine({x:1,y:64,z:0}).accepted)
 client.emit('set_player_game_type',{gamemode:'survival'});assert(w.survivalVerified);assert(n.walk({x:2,y:64,z:0}).accepted)
 client.emit('update_player_game_type',{gamemode:'creative',player_unique_id:99n});assert(w.survivalVerified)
 client.emit('update_player_game_type',{gamemode:'creative',player_unique_id:42n});n.step();assert(!w.survivalVerified);assert.equal(n.job,null);n.detach()
})
test('Stop immediately emits neutral input and aborts mining with no later movement',()=>{
 const {w,n,sent}=fixture();assert(n.walk({x:2,y:64,z:0}).accepted);n.step();const before=sent.length;n.stop();assert.equal(sent.length,before+1);assert.deepEqual(sent.at(-1)[1].move_vector,{x:0,z:0});const x=w.position.x;n.step(Date.now()+50);assert.equal(w.position.x,x);assert.equal(n.job,null);n.detach()
})
test('five Realm-scoped cards persist; selected-only activation, duplicate protection and no restart resume',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vf-plans-'));try{
  const {w,n}=fixture(),connection={config:{ownerPlayerNames:['Owner']},events:[],nextEventId:0,emit(){}};const s=new SurvivalController(connection,{plansDirectory:dir,scope:'realm-A'});s.world=w;s.navigation=n;let calls=0;s.handle=raw=>{calls++;return {accepted:true,queued:false,message:raw}}
  const p=s.commandPlans;for(let i=0;i<5;i++)p.prepare({id:'status',values:{}});assert.equal(calls,0);assert.throws(()=>p.prepare({id:'status',values:{}}),/Five/);assert.throws(()=>p.activate(1),/selected/)
  p.select(4);const r=p.activate(4);assert(r.accepted);assert.equal(calls,1);assert.throws(()=>p.activate(4),/already activated/);p.select(4);p.activate(4);assert.equal(calls,2)
  const restored=new CommandPlans(s,{directory:dir,scope:'realm-A'});assert.equal(restored.cards.length,5);assert.equal(restored.selected,null);assert.equal(restored.running,null);assert(restored.cards.every(c=>c.state==='waiting'))
  const other=new CommandPlans(s,{directory:dir,scope:'realm-B'});assert.equal(other.cards.length,0);restored.delete(1);assert.equal(restored.cards.length,4);assert(!JSON.stringify(JSON.parse(fs.readFileSync(restored.file))).includes('token'));n.detach()
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('API Stop cancels both controllers and rejects delayed requests from before Stop',async()=>{
 const c=new EventEmitter();Object.assign(c,{events:[],nextEventId:0,spawned:true,status:()=>({}),send:()=>({accepted:true})});const calls=[];c.survival={handle:s=>{calls.push(s);return {accepted:true,message:'Stopped.'}}}
 const server=createApi({localAPI:{token:'test-token'}},c,()=>{});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 try{server.controller.planner.plan={state:'running',id:1,steps:[],results:[],current:0};let r=await fetch(url+'/stop?epoch=20',{method:'POST',headers:{Authorization:'Bearer test-token'}});assert.equal(r.status,200);assert.equal(server.controller.planner.plan.state,'cancelled');assert.equal(calls.at(-1),'stop')
 const before=calls.length;r=await fetch(url+'/message',{method:'POST',headers:{Authorization:'Bearer test-token'},body:JSON.stringify({message:'follow Owner',epoch:19})});assert.equal((await r.json()).accepted,false);assert.equal(calls.length,before)
 }finally{await new Promise(r=>server.close(r))}
})

test('shared catalog validates popup ranges and unknown commands before any plan is saved',()=>{
 assert(commandCatalog.length>=20);for(const [id,values] of [['supply',{material:'torch',count:257}],['wall',{material:'stone',width:13,height:2}],['hotbar',{slot:0}],['walk',{x:0,y:'no',z:0}]])assert.throws(()=>validateDescriptor({id,values}))
 assert.throws(()=>parseDescriptor('move forward 3 blocks'),/Unsupported/);assert.equal(renderDescriptor(parseDescriptor('plan build wall 3 by 2 with stone')),'plan build wall 3 by 2 with stone')
})
test('slabs and partial-height supports land at shape height rather than full-cube height',()=>{
 const {w,set,n}=fixture();const state=Object.entries(w.registry.blocksByRuntimeId).find(([,b])=>{if(!b.name.includes('slab'))return false;const shapes=w.Block.fromStateId(b.stateId,0).shapes;return shapes.length===1&&shapes[0][1]===0&&shapes[0][4]===.5})
 assert(state);set(0,63,0,'slab',Number(state[0]));w.position.y=68;const at=Date.now();for(let i=0;i<60;i++)n.step(at+i*50);assert(Math.abs(w.position.y-65.12)<.002);assert(w.grounded());assert.equal(w.standPosition().y,64);n.detach()
})
test('midair Stop preserves gravity and velocity instead of freezing cancelled jumps',()=>{
 const {w,n,set}=fixture();set(1,64,0,'stone');n.job={kind:'follow',name:'Owner'};assert(n.beginFlight({x:1,y:65,z:0},'jump'));n.step();const before=w.position.y;n.stop();assert.equal(n.flight,null);const at=Date.now();for(let i=0;i<45;i++)n.step(at+i*50);assert(w.grounded());assert(w.position.y<before+.1);n.detach()
})
test('temporary loading and unused may-fly differ from active cheating abilities; own identity only',()=>{
 const {w,n,client}=fixture();const packet={entity_unique_id:42n,command_permission:'normal',abilities:[{type:'base',allowed:{may_fly:true,flying:true,invulnerable:true},enabled:{may_fly:true,flying:false,invulnerable:false}}]};client.emit('update_abilities',packet);assert(w.survivalVerified)
 client.emit('update_abilities',{...packet,entity_unique_id:99n,abilities:[{type:'base',allowed:{flying:true},enabled:{flying:true}}]});assert(w.survivalVerified)
 client.emit('update_abilities',{...packet,abilities:[...packet.abilities,{type:'loading_screen',allowed:{invulnerable:true},enabled:{invulnerable:true}}]});assert(!w.survivalVerified);assert(w.abilityState.loading);assert.deepEqual(w.abilityState.active,[]);n.detach()
})
test('permission-gated Ensure Survival sends only @s request, waits for confirmation and handles denial',()=>{
 const {w,n,client,sent}=fixture();w.gameMode='creative';w.abilityState=abilityEvidence({command_permission:'normal',abilities:[{type:'base',allowed:{flying:true},enabled:{flying:true}}]});const guard=new SurvivalVerification(w,n);guard.attach(client);guard.check();assert(!sent.some(([name])=>name==='command_request'));assert(sent.some(([name,p])=>name==='player_action'&&p.action==='stop_flying'))
 w.abilityState.commandPermission='operator';guard.check();const command=sent.find(([name])=>name==='command_request');assert.equal(command[1].command,'/gamemode survival @s');assert(!w.survivalVerified);guard.check();assert.equal(sent.filter(([name])=>name==='command_request').length,1)
 client.emit('command_output',{origin:{request_id:guard.requestId},success_count:0});assert.match(guard.reason,/denied/);guard.check();assert.equal(sent.filter(([name])=>name==='command_request').length,1)
 n.step();assert(sent.filter(([name])=>name==='player_auth_input').length);guard.detach();n.detach()
})
test('unknown terrain triggers bounded terrain requests and disconnect, retaining authentication',()=>{
 const {w,n,client}=fixture();w.updates.clear();w.sections.clear();let closed=0;client.disconnect=()=>closed++;const at=Date.now();n.step(at);n.step(at+5001);assert.equal(closed,1);assert.equal(n.spawned,false);assert.match(n.reason,/five seconds/)
})
test('manual chat and authenticated plan endpoints prepare only; selected plan alone activates',async()=>{
 const c=new EventEmitter();Object.assign(c,{config:{ownerPlayerNames:['Owner']},events:[],nextEventId:0,spawned:true,status(){return {survival:this.survival.snapshot()}},send(){throw Error('No legacy bridge')}});c.survival=new SurvivalController(c);const calls=[];c.survival.handle=raw=>{calls.push(raw);return {accepted:true,queued:false,message:raw}}
 const server=createApi({localAPI:{token:'test-token'}},c,()=>{});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 const post=async(endpoint,body)=>{const r=await fetch(url+endpoint,{method:'POST',headers:{Authorization:'Bearer test-token'},body:JSON.stringify(body)});return r.json()}
 try{await post('/message',{message:'inventory'});await post('/plans/prepare',{descriptor:{id:'look',values:{}}});assert.deepEqual(calls,[]);assert(!(await post('/plans/activate',{id:2})).accepted);await post('/plans/select',{id:1});assert((await post('/plans/activate',{id:1})).accepted);assert.deepEqual(calls,['inventory']);assert(!(await post('/plans/activate',{id:1})).accepted);const auth=await fetch(url+'/plans');assert.equal(auth.status,401)}finally{await new Promise(r=>server.close(r))}
})

test('running plan locks other cards; interruption preserves reusable descriptors',()=>{
 const {w,n}=fixture(),connection={config:{ownerPlayerNames:['Owner']},events:[],nextEventId:0,emit(){}};const s=new SurvivalController(connection);s.world=w;s.navigation=n;s.handle=raw=>{n.job={kind:'follow',name:'Owner'};return {accepted:true,queued:true,message:raw}}
 const p=s.commandPlans;p.prepare({id:'follow',values:{player:'Owner'}});p.prepare({id:'inventory',values:{}});p.select(1);p.activate(1);assert.throws(()=>p.select(2),/Stop/);assert.throws(()=>p.activate(2),/running/);p.interrupt();n.stop();assert.equal(p.cards.length,2);assert.equal(p.cards[0].state,'interrupted');p.select(1);assert(p.activate(1).accepted);n.detach()
})
test('unconfirmed permission-authorized Survival request times out without retry or mode invention',()=>{
 const {w,n,client,sent}=fixture();w.gameMode='creative';w.abilityState={known:true,effective:{},active:[],loading:false,commandPermission:'operator'};const guard=new SurvivalVerification(w,n);guard.attach(client);guard.check(1000);guard.check(6001);assert(!guard.pending);assert.match(guard.reason,/not confirmed/);assert(!w.survivalVerified);guard.check(7000);assert.equal(sent.filter(([name])=>name==='command_request').length,1);guard.detach();n.detach()
})
