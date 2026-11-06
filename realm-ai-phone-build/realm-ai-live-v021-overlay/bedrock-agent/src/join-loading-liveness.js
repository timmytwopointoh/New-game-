// Non-visual Bedrock loading monitor: evidence-based progress, not a fake bar.
// Ignore repeated status/keepalive packets; never parse downloaded add-on code.
export const JOIN_LOADING_GRACE_MS=17*60*1000
export const MAX_AUTO_RECOVERIES=2
const STAGES=new Set(['pack-request','pack-storage','pack-retry','downloading-packs','pack-cached','packs-ready','world-started','world-data','bedrock-login-accepted'])
const SIGNALS=new Set(['resource_packs_info','resource_pack_data_info','resource_pack_chunk_data','resource_pack_stack','start_game','level_chunk','sub_chunk','play_status'])
const safeInt=n=>Number.isSafeInteger(n)&&n>=0?n:0
export class JoinLoadingLiveness {
 constructor({now=()=>Date.now(),graceMs=JOIN_LOADING_GRACE_MS}={}){
  this.now=now;this.graceMs=graceMs;this.reset()
 }
 reset(){
  this.startedAt=this.now();this.progressAt=this.startedAt;this.lastSignalAt=0
  this.stage='connecting';this.lastSignal='none';this.uniqueCount=0;this.repeatedCount=0
  this.chunkBytes=0;this.seen=new Set();this.recentProgress=0;this.waiting=false
 }
 setStage(stage){
  if(!STAGES.has(stage)||this.stage===stage)return false
  this.stage=stage;this.progressAt=this.now();this.uniqueCount++
  this.waiting=true;return true
 }
 note(name,identity='',bytes=0){
  if(!SIGNALS.has(name))return false
  const id=String(identity||'').slice(0,100)
  // Identity here must be a bounded identifier from caller; it is not logged.
  const signature=name+'|'+id
  this.lastSignalAt=this.now();this.lastSignal=name
  if(this.seen.has(signature)){this.repeatedCount++;return false}
  if(this.seen.size>=2048){ // cap retained fingerprints; do not mistake a reset for progress
    this.repeatedCount++;return false
  }
  this.seen.add(signature);this.uniqueCount++;this.progressAt=this.now()
  if(name==='resource_pack_chunk_data')this.chunkBytes+=safeInt(bytes)
  if(name==='start_game')this.setStage('world-started')
  else if(name==='level_chunk'||name==='sub_chunk')this.setStage('world-data')
  return true
 }
 noteTransferBytes(total){
  if(!Number.isFinite(total)||total<0||total<=this.recentProgress)return false
  this.recentProgress=total
  this.progressAt=this.now();this.uniqueCount++;this.waiting=true
  return true
 }
 snapshot(){
  const now=this.now()
  return {
   loadingStage:this.stage,loadingActive:this.waiting,
   loadingElapsedSeconds:safeInt(Math.floor((now-this.startedAt)/1000)),
   loadingNoProgressSeconds:safeInt(Math.floor((now-this.progressAt)/1000)),
   loadingUniqueSignals:this.uniqueCount,loadingRepeatedSignals:this.repeatedCount,
   loadingReceivedBytes:this.chunkBytes,loadingLastSignal:this.lastSignal,
   loadingGraceSeconds:Math.ceil(this.graceMs/1000)
  }
 }
 stalled(){
  if(!this.waiting||!STAGES.has(this.stage))return false
  // A genuine 15-minute preparation screen without packets is tolerated.
  // Meaningful new chunks / chunk coordinates / stages extend the window.
  return this.now()-this.progressAt>=this.graceMs
 }
}
export function recoveryDecision({stage='',reason='',attempts=0,spawned=false,authPending=false,manualStop=false}={}){
 if(spawned||authPending||manualStop||attempts>=MAX_AUTO_RECOVERIES)return {retry:false,reason:'guarded'}
 const recoverable=['server-no-pack-data','server-pack-stalled','early-transport-close'].includes(reason)||
   // After a successful spawn, a silent transport loss can occur without a
   // kick, protocol error or app shutdown. Retry it twice at most, using the
   // same saved Microsoft session. Never interpret finishing a task as a loss.
   (stage==='spawned'&&reason==='unexpected-session-close')||
   ['pack-request','downloading-packs','packs-ready','world-started','world-data'].includes(stage)&&reason==='loading-stalled'
 if(!recoverable)return {retry:false,reason:'not-transient'}
 return {retry:true,delayMs:attempts===0?15000:45000,reason:'bounded-rejoin'}
}
