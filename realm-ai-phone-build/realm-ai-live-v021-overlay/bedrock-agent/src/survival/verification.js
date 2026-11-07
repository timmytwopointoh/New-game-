import crypto from 'node:crypto'
const active=['flying','invulnerable','instant_build','no_clip','world_builder','privileged_builder']
// Bedrock serializes layer.type as uint16, but protocol libraries may
// surface either a numeric value or the normalized enum label.
const layerTypes=['cache','base','spectator','commands','editor','loading_screen']
export const normalizedAbilityLayerType=value=>{
 if(Number.isSafeInteger(value)&&value>=0&&value<layerTypes.length)return layerTypes[value]
 if(typeof value==='string'){
  const label=value.trim().toLowerCase().replace(/[- ]/g,'_')
  if(layerTypes.includes(label))return label
  if(/^[0-5]$/.test(label))return layerTypes[Number(label)]
 }
 return null
}
export function abilityEvidence(packet){
 const layers=Array.isArray(packet?.abilities)?packet.abilities:[]
 const effective={},loading=[]
 const ordered=layers.map(layer=>({...layer,normalizedType:normalizedAbilityLayerType(layer?.type)}))
  .sort((a,b)=>{
   const i=layerTypes.indexOf(a.normalizedType),j=layerTypes.indexOf(b.normalizedType)
   return (i<0?99:i)-(j<0?99:j)
  })
 for(const layer of ordered){
  if(layer.normalizedType==='loading_screen'){
   if(active.some(k=>layer.allowed?.[k]&&layer.enabled?.[k]))loading.push('temporary loading abilities')
   continue
  }
  if(layer.normalizedType===null||layer.normalizedType==='cache')continue
  for(const [key,allowed] of Object.entries(layer.allowed||{}))
   if(allowed)effective[key]=!!layer.enabled?.[key]
 }
 return {known:layers.some(l=>normalizedAbilityLayerType(l?.type)==='base'),
  effective,loading:loading.length>0,active:active.filter(k=>effective[k]),
  commandPermission:packet?.command_permission}
}
export class SurvivalVerification{
 constructor(world,navigation,report=()=>{}){this.world=world;this.navigation=navigation;this.report=report;this.reset()}
 reset(){this.desiredMode=this.desiredMode||'survival';this.requested=false;this.pending=false;this.pendingMode=null;this.reapplyMode=false;this.reason='Waiting for this player’s server mode and abilities.';this.listeners=[];this.client=null;this.resetFlightRecovery()}
 resetFlightRecovery(){this.flightRecovery={state:'idle',attempts:0,lastAttemptAt:null};this.flightStopped=false}
 attach(client){this.detach();this.reset();this.client=client;const on=(e,f)=>{client.on(e,f);this.listeners.push([e,f])}
  on('spawn',()=>this.check())
  for(const e of ['set_player_game_type','update_player_game_type','update_abilities'])on(e,()=>{const job=this.navigation.job;if(job&&((['mine','build'].includes(job.kind)&&(job.gameMode!==this.world.gameMode||!this.world.editModeVerified))||(!['mine','build'].includes(job.kind)&&!this.world.movementVerified)))this.navigation.stop('Server mode or required abilities changed; work stopped.');this.check()})
  on('command_output',p=>{if(this.pending&&p.origin?.uuid===this.requestId&&p.success_count===0){this.pending=false;this.requested=true;this.reason=`Server denied the requested ${this.pendingMode} mode. No Realm settings or permissions were changed.`;this.report(this.reason)}})
 }
 requestMode(mode,now=Date.now()){
  if(!['survival','creative'].includes(mode))return {accepted:false,queued:false,message:'Choose Survival or Creative.',verification:this.snapshot()}
  if(this.desiredMode!==mode){this.desiredMode=mode;this.requested=false;this.pending=false;this.pendingMode=null;this.reapplyMode=false}
  else if(this.requested&&!this.pending){this.requested=false}
  if(this.flightRecovery.state==='unconfirmed')this.resetFlightRecovery()
  const safe=mode==='survival'?this.world.survivalVerified:this.world.creativeMovementVerified
  // An explicit mode-button retry may ask the server to reapply the same mode
  // when stale active abilities remain. Duplicate taps cannot duplicate it.
  if(!safe&&!this.pending&&this.world.gameMode===mode){this.reapplyMode=true;this.requested=false}
  const state=this.check(now)
  return {accepted:safe||state.pending,queued:!!state.pending,message:state.reason,verification:state}
 }
 stopFlying(now){
  const w=this.world,f=this.flightRecovery
  // A sent request is not confirmation. Only this player's subsequent server
  // abilities can clear flight; unused may_fly is permission, not active flight.
  if(!w.abilityState?.known){f.state='waiting-for-abilities';return}
  if(!w.abilityState.effective.flying){f.state=f.attempts?'disabled':'not-flying';this.flightStopped=true;return}
  if(['disabled','not-flying'].includes(f.state)){f.attempts=0;f.lastAttemptAt=null}
  this.flightStopped=false
  if(!this.client||!this.navigation.spawned){f.state='waiting-for-spawn';return}
  if(w.abilityState.loading){f.state='waiting-for-loading';return}
  if(f.attempts>=5){f.state='unconfirmed';return}
  if(f.lastAttemptAt!==null&&now-f.lastAttemptAt<1000)return
  f.attempts++;f.lastAttemptAt=now;f.state='waiting-for-server'
  try{
   const p=w.standPosition();if(!p)throw Error('Player position has not arrived.')
   this.client.queue('request_ability',{ability:'flying',value_type:'bool',bool_value:false,float_val:0})
   this.client.queue('player_action',{runtime_entity_id:BigInt(w.entityId),action:'stop_flying',position:p,result_position:p,face:0})
   this.navigation.pendingFlags.push('stop_flying')
  }catch(e){f.state='send-failed';f.error=String(e.message||e).slice(0,100)}
 }
 readyReason(prefix){
  const w=this.world
  if(w.inputLocks?.move)return prefix+' The server has locked movement; waiting for it to unlock.'
  if(!w.terrainKnown())return prefix+' Waiting for received terrain before landing or walking.'
  if(!w.clearBody(w.position))return prefix+' Received terrain overlaps the reported player body; movement is paused.'
  if(!w.grounded())return prefix+' Flight is off; gravity is landing the player before walking.'
  return prefix+' Ground contact is verified from received block collision shapes; ready to walk.'
 }
 check(now=Date.now()){
  const w=this.world
  this.stopFlying(now)
  if(this.pending&&now-this.requestAt>5000){this.pending=false;this.requested=true;this.reason=`Server has not confirmed ${this.pendingMode} mode. Autonomous work remains paused.`}
  if(w.abilityState?.loading){this.reason='Temporary loading abilities reported; waiting for loading to finish.';return this.snapshot()}
  if(w.gameMode===null){this.reason='The server has not reported this player’s effective game mode; autonomous work is paused.';return this.snapshot()}
  if(!w.abilityState?.known){this.reason=`The server reports this player in ${w.gameMode}${w.gameModeSource?.includes('fallback')?' (inherited from the reported world default)':''}, but has not sent this player’s effective ability layers; autonomous work is paused.`;return this.snapshot()}
  if(w.gameMode===this.desiredMode){
   const safe=this.desiredMode==='survival'?w.survivalVerified:w.creativeMovementVerified
   if(safe){this.pending=false;this.requested=false;this.pendingMode=null;this.reapplyMode=false;this.reason=this.readyReason(this.desiredMode==='survival'?'This player’s mode and effective abilities verify Survival.':'This player’s Creative mode and grounded abilities are verified. Creative damage immunity and instant building are normal for this mode.');return this.snapshot()}
   if(this.reapplyMode&&this.requested&&!this.pending)return this.snapshot()
   const abilities=w.abilityState.active.join(', ')||'unverified movement abilities'
   this.reason=`${w.gameMode} mode is reported, but active abilities (${abilities}) still pause work.`
   if(w.abilityState.effective.flying)this.reason+=this.flightRecovery.state==='unconfirmed'?' The server has not confirmed flight disabled after five requests; use the mode button to retry.':` Requesting flight off; waiting for server confirmation (${this.flightRecovery.attempts}/5).`
   if(!this.reapplyMode||this.requested)return this.snapshot()
  }
  if(!this.navigation.spawned){this.reason=`Waiting to spawn before requesting ${this.desiredMode}.`;return this.snapshot()}
  if(this.requested)return this.snapshot()
  if(!['operator','automation','host','owner','internal',1,2,3,4,5].includes(w.abilityState.commandPermission)){this.reason=`The server has not granted permission to request /gamemode ${this.desiredMode} @s. No permission or Realm setting was changed.`;return this.snapshot()}
  if(!this.client)return this.snapshot()
  this.requested=true;this.pending=true;this.pendingMode=this.desiredMode;this.requestAt=now;this.requestId=crypto.randomUUID();this.reason=`Requested /gamemode ${this.desiredMode} @s; waiting for this player’s server mode and ability confirmation.`
  try{this.client.queue('command_request',{command:`/gamemode ${this.desiredMode} @s`,origin:{type:'player',uuid:this.requestId,request_id:'',player_entity_id:BigInt(w.uniqueId)},internal:false,version:'latest'});this.report(this.reason)}catch(e){this.pending=false;this.requested=false;this.reason=this.desiredMode+' request failed: '+e.message}
  return this.snapshot()
 }
 snapshot(){return {verified:this.world.survivalVerified,movementVerified:this.world.movementVerified,creativeMovementVerified:this.world.creativeMovementVerified,grounded:this.world.grounded(),flightRecovery:{...this.flightRecovery},desiredMode:this.desiredMode,pending:this.pending,pendingMode:this.pendingMode,reason:this.reason,mode:this.world.gameMode,modeSource:this.world.gameModeSource,abilities:this.world.abilityState}}
 detach(){for(const [e,f] of this.listeners||[])this.client?.off(e,f);this.listeners=[];this.client=null;this.flightStopped=false}
}
