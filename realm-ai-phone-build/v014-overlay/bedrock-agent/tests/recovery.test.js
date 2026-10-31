import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {ProgressTracker,recoveryDecision,miningAssessment,placementEvidence} from '../src/survival/obstacles.js'
import {WorldView} from '../src/survival/world.js'
import {Navigation} from '../src/survival/navigation.js'
import {Mining} from '../src/survival/mining.js'
import {findPath} from '../src/survival/pathfinder.js'
import {SurvivalController} from '../src/survival/controller.js'
const require=createRequire(import.meta.url),{createSerializer}=require('bedrock-protocol/src/transforms/serializer')
const empty={network_id:0,count:0,metadata:0,has_stack_id:false,stack_id:0,block_runtime_id:0,extra:{has_nbt:false,can_place_on:[],can_destroy:[]}}
function fixture(){
 const w=new WorldView();w.initialize({player_gamemode:0,player_position:{x:.5,y:65.62,z:.5},runtime_entity_id:1n,entity_id:42n,dimension:'overworld',block_network_ids_are_hashes:true})
 w.abilityState={known:true,effective:{},active:[],loading:false}
 const ids={};for(const [id,b] of Object.entries(w.registry.blocksByRuntimeId))if(b.stateId===w.registry.blocksByName[b.name]?.defaultState)ids[b.name]=Number(id)
 const set=(x,y,z,name)=>{w.update({position:{x,y,z},block_runtime_id:ids[name],layer:0});w.update({position:{x,y,z},block_runtime_id:ids.air,layer:1})}
 for(let x=-4;x<=5;x++)for(let z=-4;z<=4;z++)for(let y=63;y<=68;y++)set(x,y,z,y===63?'stone':'air')
 w.inventoryKnown=true;w.inventory.set(0,{...empty});w.selectedSlot=0
 return {w,set,ids}
}
function nav(w){const c=new EventEmitter(),sent=[],writer=createSerializer('1.26.60');c.queue=(name,p)=>{writer.createPacketBuffer({name,params:p});sent.push([name,p])};const n=new Navigation(w);n.attach(c);n.spawned=true;return {c,n,sent}}
test('only server position samples can mark stuck; missing feedback is not proof',()=>{
 const p=new ProgressTracker();p.commanded(10);assert.equal(p.stalled(1000),false)
 for(const [time,x] of [[1000,0],[1500,.02],[2000,.01]]){p.commanded(.4);p.observe({x,y:64,z:0},time)}
 assert(p.stalled(2000));assert.equal(p.stalled(4000),false)
 p.reset();for(const [time,x] of [[1000,0],[1500,.4],[2000,.8]]){p.commanded(.4);p.observe({x,y:64,z:0},time)}assert.equal(p.feedback,'progressing')
})
test('follow prefers jump; solo prefers detour; follow never mines',()=>{
 const mine={ok:true};assert.equal(recoveryDecision({mode:'follow',canJump:true,hasDetour:true,mine,allowMining:true}).action,'jump')
 assert.equal(recoveryDecision({mode:'solo',canJump:true,hasDetour:true,mine,allowMining:true}).action,'detour')
 assert.equal(recoveryDecision({mode:'follow',mine,allowMining:true}).action,'pause')
 assert.equal(recoveryDecision({mode:'solo',mine,allowMining:false}).action,'pause')
 assert.equal(recoveryDecision({mode:'solo',mine,allowMining:true}).action,'mine')
 assert.equal(recoveryDecision({mode:'follow',canJump:true,attempts:3}).action,'pause')
})
test('jump route is available only with observed headroom, support and follow-step option',()=>{
 const {w,set}=fixture();set(1,64,0,'stone');const start={x:0,y:64,z:0},goal={x:1,y:65,z:0}
 assert(w.canJumpBetween(start,goal));assert.equal(findPath(w,start,goal).ok,false);assert(findPath(w,start,goal,{allowSteps:true}).ok)
 set(0,67,0,'stone');assert.equal(w.canJumpBetween(start,goal),false)
})
test('following uses actual add-player identity and clears it on remove',()=>{
 const {w}=fixture(),c=new EventEmitter();w.attach(c)
 c.emit('add_player',{runtime_id:99n,unique_id:77n,username:'Owner',position:{x:3.5,y:65.62,z:.5}})
 c.emit('move_player',{runtime_id:99n,position:{x:4.5,y:65.62,z:.5}});assert.equal(w.players.get('99').position.x,4.5)
 c.emit('move_entity_delta',{runtime_entity_id:99n,x:3.5});assert.equal(w.players.get('99').position.x,3.5)
 c.emit('remove_entity',{entity_id_self:77n});assert.equal(w.players.size,0);w.detach()
})
test('physics jump sends normal serialized auth input, rises and lands without teleporting',()=>{
 const {w,set}=fixture();set(1,64,0,'stone');const {n,sent}=nav(w);const base=Date.now()
 n.job={kind:'follow',name:'Owner'};n.route=[{x:1,y:65,z:0}];assert(n.beginFlight(n.route[0],'jump'))
 let high=w.position.y
 for(let i=0;i<30&&n.flight;i++){n.step(base+i*50);high=Math.max(high,w.position.y)}
 assert(high>66.62&&high<67);assert.equal(n.flight,null);assert.equal(w.standPosition().y,65)
 assert(sent.some(([name,p])=>name==='player_auth_input'&&p.input_data.includes('start_jumping')))
 assert(sent.every(([name])=>name!=='move_player'&&name!=='command_request'));n.detach()
})
test('drop from one block follows gravity to known landing and does not teleport',()=>{
 const {w,set}=fixture();set(0,64,0,'stone');w.position.y=66.62;const {n}=nav(w);n.job={kind:'follow',name:'Owner'};n.route=[{x:1,y:64,z:0}]
 assert(n.beginFlight(n.route[0],'drop'));const at=Date.now();for(let i=0;i<40&&n.flight;i++)n.step(at+i*50)
 assert.equal(n.flight,null);assert.equal(w.standPosition().y,64);n.detach()
})
test('stationary server corrections trigger bounded reroute instead of trusting predicted position',()=>{
 const {w}=fixture(),{n}=nav(w),now=Date.now();assert(n.walk({x:3,y:64,z:0}).accepted)
 for(let i=0;i<3;i++){n.progress.commanded(.4);n.observeServer({position:{x:.5,y:65.62,z:.5}},now+i*500)}
 assert(n.decisions.some(x=>x.action==='detour'));assert(n.route.some(p=>p.z!==0));assert.equal(n.mining.job,null);n.detach()
})
test('follow recovery jumps over one-block obstacle and never starts mining',()=>{
 const {w,set}=fixture(),{n}=nav(w);n.job={kind:'follow',name:'Owner',goal:{x:2,y:64,z:0},allowMining:true};n.route=[{x:1,y:64,z:0}];set(1,64,0,'dirt')
 assert(n.recover('blocked'));assert(n.flight);assert.equal(n.mining.job,null);assert.equal(n.decisions.at(-1).action,'jump');n.detach()
})
test('containers/build-looking blocks and difficult/wrong-tool blocks are refused',()=>{
 const {w,set}=fixture();set(1,64,0,'chest');assert.equal(miningAssessment(w,{x:1,y:64,z:0},{explicit:true}).ok,false)
 set(1,64,0,'oak_planks');assert.equal(placementEvidence(w,{x:1,y:64,z:0}).classification,'likely-built');assert.equal(miningAssessment(w,{x:1,y:64,z:0}).ok,false)
 set(1,64,0,'stone');assert.equal(miningAssessment(w,{x:1,y:64,z:0}).ok,false)
 set(1,64,0,'obsidian');assert.equal(miningAssessment(w,{x:1,y:64,z:0}).ok,false)
})
test('mining dirt uses actual block actions/transaction and waits for server update',()=>{
 const {w,set}=fixture();set(1,64,0,'dirt');const {n,sent}=nav(w),now=Date.now()
 assert(n.mine({x:1,y:64,z:0}).accepted);n.mining.job.started=now
 n.step(now);assert(sent.some(([,p])=>p.block_action?.some(a=>a.action==='start_break')))
 const duration=n.mining.job.duration;for(let t=50;t<=duration;t+=50)n.step(now+t);const finish=sent.find(([,p])=>p.transaction)
 assert(finish);assert.equal(finish[1].transaction.data.action_type,'break_block');assert.equal(finish[1].transaction.data.held_item.network_id,0)
 assert.equal(w.block({x:1,y:64,z:0}).name,'dirt');assert(n.mining.job)
 set(1,64,0,'air');n.step(now+duration+50);assert.equal(n.mining.result,'confirmed');n.detach()
})
test('no block confirmation means timeout/abort; local world is never set to air',()=>{
 const {w,set}=fixture();set(1,64,0,'dirt');const m=new Mining(w),now=Date.now();assert(m.begin({x:1,y:64,z:0},{},now).accepted)
 m.tick(now);const out=m.tick(now+10000);assert.equal(m.result,'cancelled');assert(out.actions.some(a=>a.action==='abort_break'));assert.equal(w.block({x:1,y:64,z:0}).name,'dirt')
})
test('tool changes, fluids and nearby constructions cancel or block mining',()=>{
 const {w,set}=fixture();set(1,64,0,'dirt');set(2,64,0,'glass');assert.equal(miningAssessment(w,{x:1,y:64,z:0}).ok,false)
 set(2,64,0,'air');assert(miningAssessment(w,{x:1,y:64,z:0}).ok);const m=new Mining(w),now=Date.now();m.begin({x:1,y:64,z:0},{},now)
 w.inventory.set(0,{...empty,network_id:9999,count:1});m.tick(now+500);assert.equal(m.result,'cancelled')
 w.inventory.set(0,{...empty});set(2,64,0,'water');assert.equal(miningAssessment(w,{x:1,y:64,z:0}).ok,false)
})
test('stop/disconnect cancels jump, follow and mining; unknown target does not move',()=>{
 const {w}=fixture(),{n,c}=nav(w);assert(n.follow('Absent').accepted);assert.equal(n.state,'waiting-for-player');assert.equal(n.route,null)
 n.stop();assert.equal(n.job,null);assert.equal(n.flight,null);c.emit('close');assert.equal(n.spawned,false);assert.equal(n.mining.job,null)
})
test('controller routes explicit follow, clear-path and dig jobs rather than old bridge commands',()=>{
 const connection={config:{ownerPlayerNames:['Owner']},events:[],nextEventId:0,emit(){},spawned:true},s=new SurvivalController(connection),calls=[]
 s.navigation.follow=name=>{calls.push(['follow',name]);return {accepted:true}}
 s.navigation.walk=(goal,options)=>{calls.push(['walk',goal,options]);return {accepted:true}}
 s.navigation.mine=goal=>{calls.push(['mine',goal]);return {accepted:true}}
 s.handle('follow me');s.handle('clear path to 2 64 3');s.handle('dig 1 64 0')
 assert.equal(calls[0][1],'Owner');assert(calls[1][2].allowMining);assert.equal(calls[2][0],'mine')
})

test('tool eligibility uses the selected real item and unknown equipment blocks mining',()=>{
 const {w,set}=fixture();set(1,64,0,'stone');assert.equal(miningAssessment(w,{x:1,y:64,z:0}).ok,false)
 const tool=w.registry.itemsByName.iron_pickaxe;assert(tool);w.inventory.set(0,{...empty,network_id:tool.id,count:1})
 assert(miningAssessment(w,{x:1,y:64,z:0}).ok)
 w.selectedSlot=null;assert.equal(miningAssessment(w,{x:1,y:64,z:0}).ok,false)
})

test('equipment selection serializes current server inventory stack without inventing an item',()=>{
 const {w}=fixture(),writer=createSerializer('1.26.60'),sent=[]
 const connection={spawned:true,config:{ownerPlayerNames:['Owner']},events:[],nextEventId:0,emit(){},client:{queue:(name,params)=>{writer.createPacketBuffer({name,params});sent.push([name,params])}}}
 const s=new SurvivalController(connection);s.world=w
 assert.match(s.handle('select slot 1').message,/Selected/);assert.equal(sent[1][0],'mob_equipment');assert.equal(sent[1][1].item.network_id,0)
 assert.match(s.handle('select slot 2').message,/not been received/)
})

test('jump recovery cannot start another jump while the player is already airborne',()=>{
 const {w,set}=fixture();set(1,64,0,'stone');const {n}=nav(w);w.position.y+=.3
 assert.equal(n.beginFlight({x:1,y:65,z:0},'jump'),false);assert.equal(n.flight,null);n.detach()
})

test('invalid or unobserved clear-path destinations never start destructive recovery',()=>{
 const {w}=fixture(),{n}=nav(w)
 for(const goal of [{x:Infinity,y:64,z:0},{x:999,y:64,z:0},{x:2,y:65,z:0},{x:40,y:64,z:0}]){
  assert.equal(n.walk(goal,{allowMining:true}).accepted,false);assert.equal(n.mining.job,null);assert.equal(n.job,null)
 }
 n.detach()
})

test('recovery identifies a blocking head-height block rather than trying to mine air',()=>{
 const {w,set}=fixture(),{n}=nav(w);set(1,65,0,'dirt');n.job={kind:'solo',goal:{x:2,y:64,z:0},allowMining:true};n.route=[{x:1,y:64,z:0}]
 assert.deepEqual(n.obstacleAhead(),{x:1,y:65,z:0});n.detach()
})

test('mining interaction face matches the visible side of a head-height obstacle',()=>{
 const {w,set}=fixture();set(1,65,0,'dirt');const m=new Mining(w),now=Date.now();assert(m.begin({x:1,y:65,z:0},{explicit:true},now).accepted)
 assert.equal(m.job.face,4);assert.equal(m.tick(now).actions[0].face,4)
 const finish=m.tick(now+m.job.duration);assert.equal(finish.transaction.data.face,4);assert.equal(finish.transaction.data.click_pos.x,0)
})
