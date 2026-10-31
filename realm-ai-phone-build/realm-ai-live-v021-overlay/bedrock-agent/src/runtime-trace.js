import fs from 'node:fs'
import {readPrivateJson,writePrivateJson} from './survival/private-json.js'
import {sanitizeDiagnosticReport} from './diagnostic-store.js'
const kinds=new Set(['sample','session_start','process_exit','runtime_error','input_error','api_request','api_rejected'])
const codes=new Set(['flight_unconfirmed','loading_wait','unknown_terrain','body_collision','server_stuck','work_blocked','terrain_decode','runtime_error','input_error','process_restart','respawn_unconfirmed'])
const modes=new Set(['survival','creative','adventure','spectator'])
const jobs=new Set(['idle','solo','follow','mine','build'])
const states=new Set('idle stopped walking following waiting-for-player waiting-for-terrain waiting-for-position blocked jumping stepping-down mining mining-obstacle building confirmed cancelled interrupted arrived-predicted waiting-for-placement approaching'.split(' '))
const packets=new Set('player_auth_input player_action request_ability command_request inventory_transaction player_hotbar mob_equipment subchunk_request serverbound_loading_screen start_game spawn update_abilities correct_player_move_prediction move_player update_block inventory_slot update_client_input_locks disconnect error respawn set_health'.split(' '))
const num=(n,min=-30000000,max=30000000)=>Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n*10000)/10000)):null
const count=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,Number.MAX_SAFE_INTEGER):0
const word=(v,set)=>set.has(v)?v:'unknown'
export function cleanState(s={}){
 if(!s||typeof s!=='object')s={}
 const out={life:['alive','dead','waiting-for-server','server-ready','waiting-for-health','respawned','blocked'].includes(s.life)?s.life:'unknown',phase:sanitizeDiagnosticReport({phase:s.phase}).phase,mode:word(s.mode,modes),desiredMode:word(s.desiredMode,modes),job:word(s.job,jobs),navigation:word(s.navigation,states)}
 for(const k of ['spawned','loading','flying','mayFly','invulnerable','instantBuild','noClip','grounded','serverGrounded','terrainKnown','bodyClear','modePending','moveLocked','jumpLocked'])out[k]=typeof s[k]==='boolean'?s[k]:null
 for(const k of ['remaining','climbPlaced','climbTotal','decodeErrors','sections','blockRevision','flightAttempts'])out[k]=count(s[k])
 out.health=num(s.health,0,1000);out.verticalVelocity=num(s.verticalVelocity,-10,10)
 if(s.position&&['x','y','z'].every(k=>Number.isFinite(s.position[k])))out.position={x:num(s.position.x),y:num(s.position.y,-1024,4096),z:num(s.position.z)}
 out.feedback=['progressing','stalled','unverified','waiting-for-server','no-feedback','idle','unconfirmed'].includes(s.feedback)?s.feedback:'unknown'
 return out
}
function cleanEvent(e={}){
 if(!e||typeof e!=='object')e={}
 const out={at:count(e.at),kind:word(e.kind,kinds)}
 if(e.state)out.state=cleanState(e.state)
 if(['TypeError','RangeError','SyntaxError','ReferenceError','Error'].includes(e.errorClass))out.errorClass=e.errorClass
 if(Array.isArray(e.frames))out.frames=e.frames.slice(0,6).filter(f=>f&&/^src\/[a-z0-9_./-]+\.js$/.test(f.file)&&!f.file.includes('..')).map(f=>({file:f.file,line:count(f.line),column:count(f.column)}))
 return out
}
export function cleanTrace(input={}){
 if(!input||typeof input!=='object')input={}
 const out={schema:1,savedAt:count(input.savedAt),events:(Array.isArray(input.events)?input.events:[]).slice(-240).map(cleanEvent),issues:[],packets:{}}
 for(const i of (Array.isArray(input.issues)?input.issues:[]).slice(-24))if(i&&codes.has(i.code))out.issues.push({code:i.code,count:count(i.count),firstAt:count(i.firstAt),lastAt:count(i.lastAt),state:cleanState(i.state)})
 for(const [name,n] of Object.entries(input.packets||{}))if(packets.has(name)||name==='other')out.packets[name]=count(n)
 return out
}
export class RuntimeTrace{
 constructor(file,{clock=()=>Date.now()}={}){
  this.file=file;this.clock=clock;this.data={events:[],issues:[],packets:{}};this.lastWrite=0;this.lastSample=0;this.waiting={};this.lastIssue={};this.writeFailed=false
  if(file&&fs.existsSync(file))try{this.data=cleanTrace(readPrivateJson(file,524288))}catch{}
  this.record('session_start');this.flush()
 }
 record(kind,extra={}){if(!kinds.has(kind))return;this.data.events.push(cleanEvent({at:this.clock(),kind,...extra}));this.data.events=this.data.events.slice(-240)}
 issue(code,state={}){
  if(!codes.has(code))return
  const now=this.clock();if(this.lastIssue[code]!==undefined&&now-this.lastIssue[code]<10000)return
  this.lastIssue[code]=now
  let item=this.data.issues.find(i=>i.code===code)
  if(!item){item={code,count:0,firstAt:now};this.data.issues.push(item)}
  item.count++;item.lastAt=now;item.state=cleanState(state)
 }
 error(error,kind='runtime_error'){
  const frames=[]
  for(const m of String(error?.stack||'').matchAll(/\/(src\/[a-z0-9_./-]+\.js):(\d+):(\d+)/g))frames.push({file:m[1],line:Number(m[2]),column:Number(m[3])})
  this.record(kind,{errorClass:error?.name,frames});this.issue(kind);this.flush()
 }
 attachClient(client){
  this.detachClient?.();const queue=client.queue,trace=this
  function wrapped(name,...args){const k=packets.has(name)?name:'other';trace.data.packets[k]=count(trace.data.packets[k])+1;try{return queue.call(this,name,...args)}catch(e){trace.error(e,'input_error');throw e}}
  client.queue=wrapped
  const listeners=[]
  for(const name of packets)if(!['player_auth_input','player_action','request_ability','command_request','inventory_transaction','player_hotbar','mob_equipment','subchunk_request','serverbound_loading_screen'].includes(name)){const fn=()=>{trace.data.packets[name]=count(trace.data.packets[name])+1};client.on(name,fn);listeners.push([name,fn])}
  this.detachClient=()=>{if(client.queue===wrapped)client.queue=queue;for(const [name,fn] of listeners)client.off(name,fn)}
 }
 capture(bot,force=false){
  try{
   const w=bot.survival.world,n=bot.survival.navigation,v=bot.survival.verification,a=w.abilityState?.effective||{},p=n.snapshot().physics
   const s=cleanState({life:bot.survival.respawn?.state,phase:bot.lastPhase,spawned:bot.spawned,mode:w.gameMode,desiredMode:v.desiredMode,job:n.job?.kind||'idle',navigation:n.state,loading:!!w.abilityState?.loading,flying:a.flying,mayFly:a.may_fly,invulnerable:a.invulnerable,instantBuild:a.instant_build,noClip:a.no_clip,grounded:p.grounded,serverGrounded:p.serverGrounded,terrainKnown:p.terrainKnown,bodyClear:p.bodyClear,position:w.position,verticalVelocity:p.verticalVelocity,modePending:v.pending,moveLocked:w.inputLocks?.move,jumpLocked:w.inputLocks?.jump,remaining:n.route?.length,climbPlaced:n.climbing?.placed,climbTotal:n.climbing?.total,decodeErrors:w.decodeErrors,sections:w.sections.size,blockRevision:w.blockRevision,flightAttempts:v.flightRecovery.attempts,health:w.attributes['minecraft:health'],feedback:n.progress.feedback})
   const now=this.clock()
   if(force||now-this.lastSample>=2000){this.record('sample',{state:s});this.lastSample=now}
   const checks={respawn_unconfirmed:bot.survival.respawn?.state==='blocked',flight_unconfirmed:v.flightRecovery.state==='unconfirmed',loading_wait:s.spawned&&s.loading,unknown_terrain:s.spawned&&!s.terrainKnown,body_collision:s.spawned&&s.terrainKnown&&!s.bodyClear,server_stuck:s.spawned&&n.progress.stalled(now),work_blocked:['blocked','cancelled','interrupted'].includes(n.state),terrain_decode:w.decodeErrors>0}
   for(const [code,on] of Object.entries(checks)){
    if(!on){delete this.waiting[code];continue}
    this.waiting[code]??=now
    if(code==='respawn_unconfirmed'||code==='work_blocked'||code==='flight_unconfirmed'||code==='terrain_decode'||now-this.waiting[code]>=5000)this.issue(code,s)
   }
   if(now-this.lastWrite>=5000)this.flush()
  }catch{this.writeFailed=true} // Recording must never interrupt the bot.
 }
 flush(){try{this.data=cleanTrace({...this.data,savedAt:this.clock()});writePrivateJson(this.file,this.data);this.lastWrite=this.clock();this.writeFailed=false;return true}catch{this.writeFailed=true;return false}}
 summary(){return {events:this.data.events.length,issueTypes:this.data.issues.length,issueCount:this.data.issues.reduce((n,i)=>n+i.count,0),savedAt:this.lastWrite,writeFailed:this.writeFailed,remoteAccess:false}}
}
