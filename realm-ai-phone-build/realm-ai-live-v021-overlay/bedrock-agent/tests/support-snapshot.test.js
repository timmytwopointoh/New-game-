import test from 'node:test'
import assert from 'node:assert/strict'
import {makeSupportSnapshot} from '../src/support-snapshot.js'
test('one-zip live snapshot includes counts, never copies arbitrary input strings',()=>{
 const bot={
   lastPhase:'pack-request',authState:'negotiating-packs',connected:true,joined:false,spawned:false,
   diagnostics:()=>({phase:'pack-request',packStage:'pack-request',packAdvertisedCount:5,packSkippedOptional:2,packHeaders:0,packChunks:0,loadingRepeatedSignals:45}),
   survival:{
    world:{sections:new Map([[1,{}]]),decodeErrors:0,gameMode:'survival',attributes:{'minecraft:health':19},position:{x:45,y:70,z:50}},
    navigation:{state:'blocked',job:{kind:'follow',name:'do-not-copy'},route:[1,2],snapshot:()=>({physics:{terrainKnown:true,grounded:true}})},
    commandPlans:{snapshot:()=>({pending:2,cards:[{command:'do-not-copy'}],batch:{total:4,remaining:3}})},
    learning:{snapshot:()=>({confirmed:2,blocked:4,interrupted:1})},
    commandVocabulary:{list:()=>({count:36})},
    miningJobs:{snapshot:()=>({active:true})},
    snapshot:()=>({language:{bundledWords:5000}}),
    connection:{packHandler:{snapshot:()=>({requested:3,verified:1})}}
   }
 }
 const result=makeSupportSnapshot(bot,()=>1700000000000)
 assert.equal(result.pack.advertised,5)
 assert.equal(result.pack.optionalSkipped,2)
 assert.equal(result.loading.repeatedSignals,45)
 assert.equal(result.learning.learnedMappings,36)
 assert.equal(result.task.queuePending,2)
 assert.equal(result.world.position.x,45)
 assert.equal(JSON.stringify(result).includes('do-not-copy'),false)
})
test('missing bot and malformed counters still produce safe one-zip status',()=>{
 const s=makeSupportSnapshot({diagnostics:()=>({packAdvertisedCount:-10}),survival:{}},()=>4)
 assert.equal(s.pack.advertised,0);assert.equal(s.task.queuePending,0)
 assert.equal(s.connection.spawned,false)
})
