import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {abilityEvidence,normalizedAbilityLayerType} from '../src/survival/verification.js'
import {WorldView} from '../src/survival/world.js'
import {Connection} from '../src/connection.js'
import {sanitizeDiagnosticReport} from '../src/diagnostic-store.js'
import {makeSupportSnapshot} from '../src/support-snapshot.js'

const base=(type='base')=>({type,allowed:{flying:true,may_fly:true,no_clip:true},enabled:{flying:false,may_fly:false,no_clip:false}})
test('1.26 Bedrock numeric base ability layers truly establish known, grounded Survival movement',()=>{
 assert.equal(normalizedAbilityLayerType(1),'base')
 assert.equal(normalizedAbilityLayerType('1'),'base')
 assert.equal(normalizedAbilityLayerType('Base'),'base')
 assert.equal(normalizedAbilityLayerType(5),'loading_screen')
 assert.equal(normalizedAbilityLayerType(15),null)
 const evidence=abilityEvidence({abilities:[base(1)],command_permission:0})
 assert.equal(evidence.known,true)
 assert.deepEqual(evidence.active,[])
 assert.equal(evidence.effective.flying,false)
 const world=new WorldView()
 world.gameMode='survival'
 world.abilityState=evidence
 assert.equal(world.movementVerified,true)
 assert.equal(world.editModeVerified,true)
})
test('no own BASE packet, unknown numeric layers and temporary loading cannot enable movement',()=>{
 assert.equal(abilityEvidence({abilities:[base(19)]}).known,false)
 assert.equal(abilityEvidence({abilities:[base(0)]}).known,false)
 const world=new WorldView();world.gameMode='survival'
 world.abilityState=abilityEvidence({abilities:[base(0)]})
 assert.equal(world.movementVerified,false)
 world.abilityState=abilityEvidence({abilities:[base(1),{type:5,allowed:{flying:true},enabled:{flying:true}}]})
 assert.equal(world.abilityState.loading,true)
 assert.equal(world.movementVerified,false)
 world.abilityState=abilityEvidence({abilities:[{...base(1),enabled:{flying:true}}]})
 assert.equal(world.movementVerified,false,'confirmed active flight remains a movement gate')
})
test('numeric layers honor authoritative ordering and do not erase later effective restrictions',()=>{
 const state=abilityEvidence({abilities:[
  {type:3,allowed:{flying:true},enabled:{flying:true}},
  {type:1,allowed:{flying:true},enabled:{flying:false}}
 ]})
 assert.equal(state.known,true)
 assert.equal(state.effective.flying,true)
 assert(state.active.includes('flying'))
})
test('only matching own authenticated entity ID can update ability readiness',()=>{
 const world=new WorldView()
 world.uniqueId='501'
 world.gameMode='survival'
 const client=new EventEmitter()
 world.attach(client)
 client.emit('update_abilities',{entity_unique_id:700,abilities:[base(1)]})
 assert.equal(world.abilityReportsSeen,1)
 assert.equal(world.ownAbilityReportsSeen,0)
 assert.equal(world.abilityState,null)
 client.emit('update_abilities',{entity_unique_id:501,abilities:[base(1)]})
 assert.equal(world.ownAbilityReportsSeen,1)
 assert.equal(world.ownAbilityBaseSeen,true)
 assert.equal(world.movementVerified,true)
 world.detach()
})
const probe=world=>{
 const nav={spawned:true,timer:{},state:'stopped',job:null,loading:{},isRespawning:()=>false}
 return Connection.prototype.movementProbe.call({spawned:true,survival:{world,navigation:nav}})
}
test('movement diagnostics show unknown own ability separately from actual terrain and grounding',()=>{
 const world={terrainKnown:()=>true,grounded:()=>true,clearBody:()=>true,
  gameMode:'survival',attributes:{'minecraft:health':20},enabled:true,
  abilityReportsSeen:4,ownAbilityReportsSeen:0,ownAbilityBaseSeen:false,
  abilityState:null,inputLocks:{},position:{x:2,y:65.62,z:3},movementVerified:false}
 const d=probe(world)
 assert.equal(d.movementGate,'abilities-unknown')
 assert.equal(d.movementAbilityStatus,'other-player-only')
 assert.equal(d.movementTerrainKnown,true)
 assert.equal(d.movementGrounded,true)
 assert.equal(d.movementOwnAbilityReportsSeen,0)
})
test('a throwing readiness probe identifies the exact failing stage, never claims ready',()=>{
 const world={terrainKnown:()=>true,grounded:()=>{throw Error('private terrain diagnostic')},
  abilityState:null,gameMode:'survival',movementVerified:false,
  position:{x:1,y:2,z:3}}
 const d=probe(world)
 assert.equal(d.movementGate,'probe-error')
 assert.equal(d.movementProbeStage,'ground')
 assert.equal(d.movementTerrainKnown,true)
 assert.equal(d.movementGrounded,false)
 assert(!JSON.stringify(d).includes('private terrain diagnostic'))
})
test('fully verified healthy movement requires a live navigation loop in the same Realm session',()=>{
 const world={terrainKnown:()=>true,grounded:()=>true,clearBody:()=>true,
  abilityState:{known:true,loading:false,effective:{flying:false},active:[]},
  movementVerified:true,gameMode:'survival',enabled:true,
  position:{x:1.5,y:65.62,z:2.5},attributes:{'minecraft:health':20},
  inputLocks:{},abilityReportsSeen:1,ownAbilityReportsSeen:1,ownAbilityBaseSeen:true}
 const d=probe(world)
 assert.equal(d.movementGate,'ready')
 assert.equal(d.movementAbilityStatus,'confirmed')
 const unlooped=Connection.prototype.movementProbe.call({spawned:true,survival:{
  world,navigation:{spawned:true,timer:null,state:'stopped',isRespawning:()=>false}}})
 assert.equal(unlooped.movementGate,'navigation-loop-not-running')
})
test('one-ZIP receives allowlisted cause and count, never ability payloads or private coordinates',()=>{
 const r=sanitizeDiagnosticReport({phase:'spawned',spawned:true,
  movementGate:'abilities-unknown',movementProbeStage:'complete',
  movementAbilityStatus:'no-own-ability-packet',
  movementOwnAbilityReportsSeen:0,movementAbilityReportsSeen:7,
  movementTerrainKnown:true,movementGrounded:true,
  badPrivateField:'my-private-token',position:{x:7,y:88,z:13}})
 assert.equal(r.movementGate,'abilities-unknown')
 assert.equal(r.movementAbilityReportsSeen,7)
 assert.equal(r.movementGrounded,true)
 assert(!JSON.stringify(r).includes('my-private-token'))
 assert(!JSON.stringify(r).includes('"position"'))
 const mock={lastPhase:'spawned',authState:'spawned',spawned:true,
  diagnostics:()=>r,
  survival:{world:{sections:new Map(),decodeErrors:0,attributes:{'minecraft:health':20}},
   navigation:{state:'stopped',snapshot:()=>({physics:{}})},
   learning:{snapshot:()=>({})},commandVocabulary:{list:()=>({})},
   commandPlans:{snapshot:()=>({})},miningJobs:{snapshot:()=>({})},
   snapshot:()=>({language:{bundledWords:5000}})}
 }
 const sample=makeSupportSnapshot(mock)
 assert.equal(sample.diagnostic.movementGate,'abilities-unknown')
 assert.equal(sample.diagnostic.movementOwnAbilityReportsSeen,0)
})
