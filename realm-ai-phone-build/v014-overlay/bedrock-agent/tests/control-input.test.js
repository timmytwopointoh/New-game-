import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {aimAtBlock,cameraForward} from '../src/survival/control-input.js'
import {Navigation} from '../src/survival/navigation.js'
import {WorldView} from '../src/survival/world.js'
import {SurvivalController} from '../src/survival/controller.js'
import {commandCatalog,parseDescriptor,renderDescriptor} from '../src/survival/command-plans.js'

const require=createRequire(import.meta.url)
const {createSerializer}=require('bedrock-protocol/src/transforms/serializer')
function fixture(){
 const w=new WorldView()
 w.initialize({player_gamemode:0,world_gamemode:'survival',entity_id:42n,player_position:{x:.5,y:65.62,z:.5},runtime_entity_id:1n,dimension:0})
 w.abilityState={known:true,effective:{},active:[],loading:false}
 const states={}
 for(const [id,b] of Object.entries(w.registry.blocksByRuntimeId))if(b.stateId===w.registry.blocksByName[b.name]?.defaultState)states[b.name]=Number(id)
 for(let x=-2;x<=4;x++)for(let z=-2;z<=2;z++)for(let y=63;y<=70;y++)for(const layer of [0,1]){
  w.update({position:{x,y,z},block_runtime_id:y===63&&layer===0?states.stone:states.air,layer})
 }
 const client=new EventEmitter(),sent=[],serializer=createSerializer('1.26.60')
 client.queue=(name,p)=>{serializer.createPacketBuffer({name,params:p});sent.push([name,p])}
 const n=new Navigation(w)
 w.attach(client);n.attach(client);n.spawned=true;n.lastRequestAt=Date.now()
 const conn={client,spawned:true,config:{ownerPlayerNames:['Owner']},events:[],nextEventId:0,emit(){}}
 const controller=new SurvivalController(conn);controller.world=w;controller.navigation=n;controller.verification.world=w
 return {w,n,client,sent,controller}
}
test('headless camera orientation is unit length and incorporates pitch',()=>{
 for(const [yaw,pitch] of [[0,0],[90,0],[-90,0],[15,-45],[180,45]]){
  const v=cameraForward(yaw,pitch)
  assert(Math.abs(Math.hypot(v.x,v.y,v.z)-1)<1e-9)
 }
 assert(Math.abs(cameraForward(90,0).x+1)<1e-9)
 assert(cameraForward(0,-35).y>0)
 assert(cameraForward(0,35).y<0)
})
test('aim at block uses eye position, includes vertical aim and refuses unsafe positions',()=>{
 const from={x:.5,y:65.62,z:.5}
 const result=aimAtBlock(from,{x:2,y:64,z:0})
 assert(result.yaw<-80&&result.yaw>-100)
 assert(result.pitch>0)
 assert.throws(()=>aimAtBlock(from,{x:100,y:64,z:0}),/within 16/)
 assert.throws(()=>aimAtBlock(from,{x:0.5,y:64,z:0}),/whole-number/)
 assert.throws(()=>aimAtBlock(from,{x:NaN,y:64,z:0}),/not known/)
})
test('direct aim sends serialized first-person-aligned input with no motion or fake camera commands',()=>{
 const {w,n,sent,controller}=fixture()
 try{
  const result=controller.handle('look at 2 64 0')
  assert(result.accepted,result.message)
  const inputs=sent.filter(([name])=>name==='player_auth_input')
  assert.equal(inputs.length,1)
  const p=inputs[0][1]
  assert.equal(p.play_mode,'normal')
  assert.equal(p.input_mode,'mouse')
  assert.deepEqual(p.move_vector,{x:0,z:0})
  assert.deepEqual(p.raw_move_vector,{x:0,z:0})
  assert.equal(p.interact_rotation.x,p.pitch)
  assert.equal(p.interact_rotation.z,p.yaw)
  assert(p.pitch>0&&p.camera_orientation.y<0)
  assert(Math.abs(Math.hypot(...Object.values(p.camera_orientation))-1)<1e-6)
  assert(!sent.some(([name])=>name==='command_request'||name==='camera'))
  assert.equal(n.controlStatus().packetsSent,1)
  assert.equal(n.controlStatus().serverPoseSamples,0)
  assert.match(controller.handle('control status').message,/normally sends no reply/)
 }finally{n.detach();w.detach()}
})
test('server position evidence is distinct from predicted input output',()=>{
 const {w,n,client,controller}=fixture()
 try{
  n.step(Date.now())
  assert.equal(n.controlStatus().serverPoseSamples,0)
  client.emit('move_player',{runtime_id:1n,position:{x:.7,y:65.62,z:.5},mode:'normal'})
  assert.equal(n.controlStatus().serverPoseSamples,1)
  assert.equal(n.controlStatus().lastConfirmedPosition.x,.7)
  assert.match(controller.handle('control status').message,/recent server correction \/ position packet received/)
  client.emit('correct_player_move_prediction',{position:{x:.8,y:65.62,z:.5}})
  assert.equal(n.controlStatus().serverPoseSamples,2)
 }finally{n.detach();w.detach()}
})
test('aiming cannot interrupt an active mining or movement job and cannot execute while disconnected',()=>{
 const {w,n,controller}=fixture()
 try{
  n.job={kind:'mine'}
  assert.equal(controller.handle('look at 2 64 0').accepted,false)
  n.job=null;n.spawned=false
  assert.equal(controller.handle('look at 2 64 0').accepted,false)
 }finally{n.detach();w.detach()}
})
test('mobile command catalog has executable look-at and read-only control-status cards',()=>{
 assert.equal(parseDescriptor('look at 2 64 -1').id,'look_at')
 assert.equal(renderDescriptor(parseDescriptor('look at 2 64 -1')),'look at 2 64 -1')
 assert.equal(parseDescriptor('control status').id,'control_status')
 assert.equal(commandCatalog.find(x=>x.id==='control_status').fields.length,0)
 assert.throws(()=>parseDescriptor('look at 1.5 64 0'),/Unsupported/)
})
