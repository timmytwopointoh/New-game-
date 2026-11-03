import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {JoinLoadingLiveness,JOIN_LOADING_GRACE_MS,recoveryDecision,MAX_AUTO_RECOVERIES} from '../src/join-loading-liveness.js'
import {attachRealmPacks,explainPackFailure} from '../src/realm-packs.js'
import {sanitizeDiagnosticReport} from '../src/diagnostic-store.js'
const min=n=>n*60000
test('an empty but legitimate 15-minute loading phase does not time out after 60 seconds',()=>{
 let now=2000;const l=new JoinLoadingLiveness({now:()=>now})
 l.setStage('pack-request')
 now+=min(15)
 assert.equal(l.stalled(),false)
 assert.equal(l.snapshot().loadingNoProgressSeconds,900)
 now+=min(2)
 assert.equal(l.stalled(),true)
})
test('unique chunks extend the wait even beyond 30 minutes; identical repeated packets do not',()=>{
 let now=0;const l=new JoinLoadingLiveness({now:()=>now})
 l.setStage('pack-request')
 for(let i=0;i<4;i++){
   now+=min(10)
   assert(l.note('resource_pack_chunk_data','pack1:'+i,1024))
   assert.equal(l.stalled(),false)
 }
 assert.equal(l.snapshot().loadingReceivedBytes,4096)
 for(let i=0;i<5;i++){now+=min(3);assert.equal(l.note('resource_pack_chunk_data','pack1:3',1024),false)}
 assert.equal(l.stalled(),false)
 now+=min(2)
 assert.equal(l.stalled(),true)
 assert.equal(l.snapshot().loadingRepeatedSignals,5)
})
test('new world chunk coordinates and world start count as progress, identical loading status does not',()=>{
 let now=0;const l=new JoinLoadingLiveness({now:()=>now})
 l.setStage('packs-ready')
 now+=min(15)
 l.note('start_game','initial')
 assert.equal(l.snapshot().loadingStage,'world-started')
 now+=min(15);l.note('level_chunk','64,41')
 assert.equal(l.snapshot().loadingStage,'world-data')
 now+=min(15);l.note('level_chunk','65,41')
 assert.equal(l.stalled(),false)
 now+=min(15);l.note('play_status','login_success')
 assert.equal(l.stalled(),false)
 now+=min(17);assert.equal(l.stalled(),true)
})
test('repeated status alone cannot keep extending a frozen loading session',()=>{
 let now=0;const l=new JoinLoadingLiveness({now:()=>now})
 l.setStage('world-started');l.note('play_status','login_success')
 for(let i=0;i<10;i++){now+=min(2);l.note('play_status','login_success')}
 assert.equal(l.stalled(),true)
 assert.equal(l.snapshot().loadingRepeatedSignals,10)
})
test('CDN byte progress resets inactivity; same byte count does not',()=>{
 let now=0;const l=new JoinLoadingLiveness({now:()=>now})
 l.setStage('downloading-packs')
 now+=min(15)
 assert(l.noteTransferBytes(200*1024))
 now+=min(15)
 assert.equal(l.noteTransferBytes(200*1024),false)
 assert.equal(l.stalled(),false)
 now+=min(3)
 assert(l.stalled())
})
test('two bounded auto rejoin attempts, no Microsoft sign-in loop, no restart after owner STOP',()=>{
 assert.deepEqual(recoveryDecision({stage:'pack-request',reason:'server-no-pack-data',attempts:0}),{retry:true,delayMs:15000,reason:'bounded-rejoin'})
 assert.deepEqual(recoveryDecision({stage:'world-started',reason:'loading-stalled',attempts:1}),{retry:true,delayMs:45000,reason:'bounded-rejoin'})
 for(const options of [{attempts:MAX_AUTO_RECOVERIES},{authPending:true},{manualStop:true},{spawned:true},{reason:'pack-integrity'},{reason:'auth-rejected'}]){
  assert.equal(recoveryDecision({stage:'pack-request',reason:'server-no-pack-data',...options}).retry,false)
 }
})
test('a quick closed pack transport is eligible for bounded recovery; auth prompts and manual STOP remain guarded',()=>{
 assert.equal(recoveryDecision({stage:'pack-request',reason:'transport-closed',attempts:0}).retry,true)
 assert.equal(recoveryDecision({stage:'downloading-packs',reason:'transport-closed',attempts:1}).retry,true)
 assert.equal(recoveryDecision({stage:'pack-request',reason:'transport-closed',attempts:2}).retry,false)
 assert.equal(recoveryDecision({stage:'pack-request',reason:'transport-closed',manualStop:true}).retry,false)
 assert.equal(recoveryDecision({stage:'pack-request',reason:'transport-closed',authPending:true}).retry,false)
 assert.equal(recoveryDecision({stage:'realm-discovery',reason:'transport-closed'}).retry,false)
})
test('privacy-safe diagnostics include loading-state counters but never raw signal or auth secrets',()=>{
 const out=sanitizeDiagnosticReport({
  phase:'pack-request',loadingActive:true,loadingStage:'world-data',loadingLastSignal:'sub_chunk',
  loadingGraceSeconds:1020,loadingElapsedSeconds:900,loadingRepeatedSignals:40,
  loadingRecoveryAttempts:2,loadingRecoveryScheduled:true,loadingNextRetrySeconds:34,
  accountToken:'VERY_SECRET',loadingRawPacket:'NEVER_LEAK'
 })
 assert.equal(out.loadingGraceSeconds,1020)
 assert.equal(out.loadingRecoveryAttempts,2)
 assert.equal(out.loadingLastSignal,'sub_chunk')
 assert.equal(out.accountToken,undefined)
 assert.equal(out.loadingRawPacket,undefined)
})
test('pack handler default inactivity grace is 17 minutes and a resumed cache cannot impersonate server activity', async t=>{
 const client=new EventEmitter(),events=[]
 let now=1000
 client.write=()=>{}
 client.queue=()=>{}
 const handler=attachRealmPacks(client,'/tmp/realm-ai-only-test-cache',x=>events.push(x),{
   now:()=>now,heartbeatMs:8,
   checkStorage:()=>({freeMB:2000,neededMB:1,reserveMB:256})
 })
 t.after(()=>handler.cleanup())
 client.emit('resource_packs_info',{must_accept:true,texture_packs:[{uuid:'pending',version:'1.0.0',size:7,cdn_url:''}]})
 now+=min(15)
 await new Promise(resolve=>setTimeout(resolve,35))
 assert.equal(handler.snapshot().failed,false)
 now+=min(3)
 for(let i=0;i<30&&!handler.snapshot().failed;i++)await new Promise(resolve=>setTimeout(resolve,8))
 assert.equal(events.at(-1).reason,'server-no-pack-data')
 assert.equal(explainPackFailure({code:'PACK_NO_SERVER_DATA'}).retryable,true)
})
