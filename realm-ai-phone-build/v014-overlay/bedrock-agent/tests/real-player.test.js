import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {readGameMode,defaultGameMode,gameModeFromStart,gameModeFromUpdate,realPlayerEvidence} from '../src/survival/real-player.js'
import {WorldView} from '../src/survival/world.js'
import {SurvivalController} from '../src/survival/controller.js'
import {parseDescriptor} from '../src/survival/command-plans.js'
import {describeControl} from '../src/survival/control-input.js'

test('Bedrock 1.26.60 player gamemode wire enums and symbolic variants are resolved without inventing Survival',()=>{
 for(const x of [0,'0','Survival','survival'])assert.equal(readGameMode(x),'survival')
 for(const x of [1,'1','Creative'])assert.equal(readGameMode(x),'creative')
 for(const x of [2,'Adventure'])assert.equal(readGameMode(x),'adventure')
 for(const x of [6,3,4,'Spectator'])assert.equal(readGameMode(x),'spectator')
 for(const x of [5,'5','Default','world_default','WorldDefault'])assert.equal(defaultGameMode(x),true)
 assert.equal(readGameMode(5),null)
 assert.equal(readGameMode(-1),null)
 assert.equal(readGameMode('undefined'),null)
})
test('only explicit player Default inherits actual world gamemode; missing or bad mode remains unknown',()=>{
 assert.deepEqual(gameModeFromStart({player_gamemode:'Default',world_gamemode:'Survival'}),{mode:'survival',source:'start_game world default',playerRaw:'Default',worldRaw:'Survival',inherited:true})
 assert.equal(gameModeFromStart({player_gamemode:5,world_gamemode:1}).mode,'creative')
 assert.equal(gameModeFromStart({player_gamemode:5}).mode,null)
 assert.equal(gameModeFromStart({world_gamemode:'survival'}).mode,null)
 assert.equal(gameModeFromStart({player_gamemode:'unknown',world_gamemode:'survival'}).mode,null)
 assert.equal(gameModeFromUpdate({game_type:0}).mode,'survival')
 assert.equal(gameModeFromUpdate({gamemode:'Creative'}).mode,'creative')
})
test('server start_game identifies the actual PLAYER actor, not a custom mob, and abilities remain server verified',()=>{
 const w=new WorldView()
 w.initialize({player_gamemode:'Default',world_gamemode:'Survival',entity_id:42n,runtime_entity_id:99n,player_position:{x:1.5,y:65.62,z:2.5},dimension:0})
 assert.equal(w.gameMode,'survival')
 assert.equal(w.survivalVerified,false)
 let e=realPlayerEvidence(w,{connected:true,spawned:true,username:'ActualGamertag'})
 assert.equal(e.connectionType.includes('custom mob'),true)
 assert.equal(e.playerActorIdentified,true)
 assert.equal(e.ownMode,'survival')
 assert.equal(e.abilitiesReceived,false)
 assert.match(e.whyPaused,/abilities/)
 w.abilityState={known:true,active:[],loading:false,effective:{invulnerable:false}}
 assert.equal(w.survivalVerified,true)
 assert.equal(w.playerEvidence().survivalVerified,true)
 w.detach()
})
test('own game-type changes are applied only to the bot identity, without creative grants or silent survival fallback',()=>{
 const w=new WorldView(),emitter=new EventEmitter()
 w.attach(emitter)
 emitter.emit('start_game',{player_gamemode:0,world_gamemode:0,entity_id:42n,runtime_entity_id:99n,player_position:{x:1.5,y:65.62,z:2.5},dimension:0})
 emitter.emit('update_player_game_type',{player_unique_id:43n,game_type:1})
 assert.equal(w.gameMode,'survival')
 emitter.emit('update_player_game_type',{player_unique_id:42n,game_type:1})
 assert.equal(w.gameMode,'creative')
 emitter.emit('set_player_game_type',{game_type:0})
 assert.equal(w.gameMode,'survival')
 assert.match(w.modeEvidence.source,/set_player/)
 emitter.emit('set_player_game_type',{gamemode:5})
 assert.equal(w.gameMode,'survival') // own Default explicitly inherits actual server world mode
 emitter.emit('set_player_game_type',{gamemode:-1})
 assert.equal(w.gameMode,null)
 w.detach()
})
test('Player Identity card surfaces server packet evidence and preserves movement safety when unknown',()=>{
 const client=new EventEmitter()
 const connection={connected:true,spawned:true,username:'ActualGamertag',events:[],nextEventId:0,emit(){},client}
 const c=new SurvivalController(connection)
 c.world.initialize({player_gamemode:5,world_gamemode:'creative',entity_id:42n,runtime_entity_id:99n,player_position:{x:1,y:65.62,z:2},dimension:0})
 assert.equal(parseDescriptor('player identity').id,'diagnostics')
 const r=c.handle('player identity')
 assert.equal(r.accepted,true)
 assert.match(r.message,/server-provided player identity/)
 assert.match(r.message,/Own mode creative/)
 assert.match(r.message,/playerRaw 5/)
 assert.match(r.message,/no custom mob spawn is required/)
 assert.equal(c.world.survivalVerified,false)
})
test('no server correction is normal for accepted Bedrock input and is not a failure assertion',()=>{
 const nav={client:{},spawned:true,packetsSent:3835,lastPacketAt:1700,serverPoseSamples:0,lastServerPoseAt:null,lastServerPosition:null,yaw:0,pitch:0}
 const status=describeControl(nav,2000)
 assert.match(status.serverFeedback,/normally sends no reply/)
 assert.doesNotMatch(status.serverFeedback,/rejected|unverified/)
})
