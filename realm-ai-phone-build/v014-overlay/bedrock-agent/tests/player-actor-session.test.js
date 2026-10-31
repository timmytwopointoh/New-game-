import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {actorId,PlayerActorSession} from '../src/survival/player-actor-session.js'
import {WorldView} from '../src/survival/world.js'
import {Navigation} from '../src/survival/navigation.js'
import {SurvivalController} from '../src/survival/controller.js'

function sessionFixture(){
 const client=new EventEmitter(),sent=[]
 client.queue=(name,params)=>{sent.push({name,params})}
 const world=new WorldView()
 world.attach(client)
 const navigation=new Navigation(world)
 navigation.attach(client)
 const packet={player_gamemode:'fallback',world_gamemode:'survival',runtime_entity_id:200n,entity_id:-42n,player_position:{x:.5,y:65.62,z:.5},dimension:0}
 client.emit('start_game',packet)
 const connection={client,spawned:true,connected:true,config:{ownerPlayerNames:['Owner']},events:[],nextEventId:0,emit(){}}
 const controller=new SurvivalController(connection);controller.world=world;controller.navigation=navigation;controller.verification.world=world
 navigation.spawned=true
 return {client,sent,world,navigation,controller,packet,close:()=>{navigation.detach();world.detach()}}
}
test('strict protocol ID normalization preserves 64-bit actor IDs without number precision loss',()=>{
 const x=new PlayerActorSession()
 assert.equal(actorId(0n),'0')
 assert.equal(actorId(-42n),'-42')
 assert.equal(actorId('000200'),'200')
 assert.equal(actorId(9007199254740992),null)
 assert.equal(actorId('200abc'),null)
 assert.equal(x.start({runtime_entity_id:'9223372036854775807',entity_id:'-9223372036854775808'}),true)
 assert.equal(x.runtimeForPacket(),9223372036854775807n)
 assert.equal(x.uniqueForPacket(),-9223372036854775808n)
 assert(x.checkRuntime('9223372036854775807'))
 assert(x.checkUnique('-9223372036854775808'))
 assert.equal(x.checkRuntime(-9223372036854775808n),false)
})
test('start_game actor is used consistently for own game mode, abilities, health and equipment',()=>{
 const f=sessionFixture()
 try{
  assert.equal(f.world.actor.ready,true)
  assert.equal(f.world.actor.runtimeId,'200')
  assert.equal(f.world.actor.uniqueId,'-42')
  assert.equal(f.world.entityId,'200')
  assert.equal(f.world.uniqueId,'-42')
  f.client.emit('update_abilities',{entity_unique_id:99n,abilities:[{type:'base',allowed:{invulnerable:true},enabled:{invulnerable:true}}]})
  assert.equal(f.world.abilityState,null)
  f.client.emit('update_abilities',{entity_unique_id:-42n,command_permission:'normal',abilities:[{type:'base',allowed:{invulnerable:true},enabled:{invulnerable:false}}]})
  assert.equal(f.world.survivalVerified,true)
  f.client.emit('update_attributes',{runtime_entity_id:99n,attributes:[{name:'minecraft:health',current:3}]})
  assert.equal(f.world.attributes['minecraft:health'],undefined)
  f.client.emit('update_attributes',{runtime_entity_id:200n,attributes:[{name:'minecraft:health',current:20}]})
  assert.equal(f.world.attributes['minecraft:health'],20)
  f.client.emit('inventory_content',{window_id:0,input:[{network_id:0,count:0}]})
  f.client.emit('mob_equipment',{runtime_entity_id:99n,selected_slot:4})
  assert.equal(f.world.selectedSlot,null)
  f.client.emit('mob_equipment',{runtime_entity_id:200n,selected_slot:0})
  assert.equal(f.world.selectedSlot,0)
  assert.equal(f.world.actor.snapshot().rejectedForeignActorPackets,3)
 }finally{f.close()}
})
test('movement correction targets only own runtime actor ID; other players still work',()=>{
 const f=sessionFixture()
 try{
  const p=f.world.position
  f.client.emit('move_player',{runtime_id:999n,position:{x:6,y:65.62,z:6},mode:'normal'})
  assert.equal(f.navigation.serverPoseSamples,0)
  assert.deepEqual(f.world.position,p)
  f.client.emit('add_player',{runtime_id:999n,unique_id:88n,username:'Owner',position:{x:6,y:65.62,z:6}})
  assert.equal(f.world.players.size,1)
  f.client.emit('move_player',{runtime_id:200n,position:{x:.7,y:65.62,z:.5},mode:'normal'})
  assert.equal(f.navigation.serverPoseSamples,1)
  assert.equal(f.world.position.x,.7)
  assert.equal(f.world.actor.snapshot().matchedRuntimePackets>=1,true)
 }finally{f.close()}
})
test('select hotbar emits authenticated local actor runtime ID, never another entity ID',()=>{
 const f=sessionFixture()
 try{
  f.client.emit('inventory_content',{window_id:0,input:[{network_id:0,count:0}]})
  const result=f.controller.handle('select slot 1')
  assert.equal(result.accepted,true)
  const msg=f.sent.find(x=>x.name==='mob_equipment')
  assert(msg)
  assert.equal(msg.params.runtime_entity_id,200n)
  assert.equal(f.world.actor.runtimeForPacket(),200n)
  assert.equal(f.world.actor.uniqueForPacket(),-42n)
 }finally{f.close()}
})
test('no actor identifier from server -> no fake movement packet or fabricated player session',()=>{
 const f=sessionFixture()
 try{
  f.world.actor.reset()
  assert.equal(f.world.actor.ready,false)
  const blocked=f.controller.handle('look at 2 64 0')
  assert.equal(blocked.accepted,false)
  assert.match(blocked.message,/player actor/)
  assert.equal(f.navigation.packetsSent,0)
  assert.equal(f.world.actor.snapshot().controlBinding.includes('authenticated connection'),true)
 }finally{f.close()}
})
