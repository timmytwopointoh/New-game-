import crypto from 'node:crypto'
const active=['flying','invulnerable','instant_build','no_clip','world_builder','privileged_builder']
export function abilityEvidence(packet){
 const effective={},loading=[]
 const order={cache:0,base:1,spectator:2,commands:3,editor:4}
 for(const layer of [...(packet.abilities||[])].sort((a,b)=>(order[a.type]??9)-(order[b.type]??9))){
  if(layer.type==='loading_screen'){if(active.some(k=>layer.allowed?.[k]&&layer.enabled?.[k]))loading.push('temporary loading abilities');continue}
  if(layer.type==='cache')continue
  for(const [key,allowed] of Object.entries(layer.allowed||{}))if(allowed)effective[key]=!!layer.enabled?.[key]
 }
 return {known:(packet.abilities||[]).some(l=>l.type==='base'),effective,loading:loading.length>0,active:active.filter(k=>effective[k]),commandPermission:packet.command_permission}
}
export class SurvivalVerification{
 constructor(world,navigation,report=()=>{}){this.world=world;this.navigation=navigation;this.report=report;this.reset()}
 reset(){this.desiredMode=this.desiredMode||'survival';this.requested=false;this.pending=false;this.pendingMode=null;this.reason='Waiting for this player’s server mode and abilities.';this.listeners=[];this.client=null;this.flightStopped=false}
 attach(client){this.detach();this.reset();this.client=client;const on=(e,f)=>{client.on(e,f);this.listeners.push([e,f])}
  on('spawn',()=>this.check())
  for(const e of ['set_player_game_type','update_player_game_type','update_abilities'])on(e,()=>{const job=this.navigation.job;if(job&&(['mine','build'].includes(job.kind)?!this.world.survivalVerified:!this.world.movementVerified))this.navigation.stop('Server mode or required abilities changed; work stopped.');this.check()})
  on('command_output',p=>{if(this.pending&&p.origin?.uuid===this.requestId&&p.success_count===0){this.pending=false;this.requested=true;this.reason=`Server denied the requested ${this.pendingMode} mode. No Realm settings or permissions were changed.`;this.report(this.reason)}})
 }
 requestMode(mode,now=Date.now()){
  if(!['survival','creative'].includes(mode))return {accepted:false,queued:false,message:'Choose Survival or Creative.',verification:this.snapshot()}
  if(this.desiredMode!==mode){this.desiredMode=mode;this.requested=false;this.pending=false;this.pendingMode=null}
  else if(this.requested&&!this.pending){this.requested=false}
  const state=this.check(now),safe=mode==='survival'?this.world.survivalVerified:this.world.creativeMovementVerified
  return {accepted:safe||state.pending,queued:!!state.pending,message:state.reason,verification:state}
 }
 check(now=Date.now()){
  const w=this.world
  if(w.abilityState?.effective.flying&&!this.flightStopped){
   try{const p=w.standPosition()||{x:0,y:0,z:0};this.client?.queue('player_action',{runtime_entity_id:BigInt(w.entityId),action:'stop_flying',position:p,result_position:p,face:0});this.navigation.pendingFlags.push('stop_flying');this.flightStopped=true}catch(e){this.reason='Could not send normal stop-flying input: '+e.message}
  }else if(!w.abilityState?.effective.flying)this.flightStopped=false
  if(this.pending&&now-this.requestAt>5000){this.pending=false;this.requested=true;this.reason=`Server has not confirmed ${this.pendingMode} mode. Autonomous work remains paused.`}
  if(w.abilityState?.loading){this.reason='Temporary loading abilities reported; waiting for loading to finish.';return this.snapshot()}
  if(w.gameMode===null){this.reason='The server has not reported this player’s effective game mode; autonomous work is paused.';return this.snapshot()}
  if(!w.abilityState?.known){this.reason=`The server reports this player in ${w.gameMode}${w.gameModeSource?.includes('fallback')?' (inherited from the reported world default)':''}, but has not sent this player’s effective ability layers; autonomous work is paused.`;return this.snapshot()}
  if(w.gameMode===this.desiredMode){
   this.pending=false;this.requested=false;this.pendingMode=null
   if(this.desiredMode==='survival'&&w.survivalVerified){this.reason='This player’s mode and effective abilities verify Survival.';return this.snapshot()}
   if(this.desiredMode==='creative'&&w.creativeMovementVerified){this.reason='This player’s Creative mode and grounded movement abilities are verified. Mining and building remain paused.';return this.snapshot()}
   if(this.desiredMode==='survival'){this.reason='Survival mode is reported, but this player still has an active ability that prevents Survival work.';return this.snapshot()}
   this.reason='Creative mode is reported, but flight, noclip or privileged movement is still active; grounded movement remains paused.';return this.snapshot()
  }
  if(!this.navigation.spawned){this.reason=`Waiting to spawn before requesting ${this.desiredMode}.`;return this.snapshot()}
  if(this.requested)return this.snapshot()
  if(!['operator','automation','host','owner','internal',1,2,3,4,5].includes(w.abilityState.commandPermission)){this.reason=`This player is not in ${this.desiredMode}, and the server has not granted permission to request that change. No permission or Realm setting was changed.`;return this.snapshot()}
  if(!this.client)return this.snapshot()
  this.requested=true;this.pending=true;this.pendingMode=this.desiredMode;this.requestAt=now;this.requestId=crypto.randomUUID();this.reason=`Requested /gamemode ${this.desiredMode} @s; waiting for this player’s server mode and ability confirmation.`
  try{this.client.queue('command_request',{command:`/gamemode ${this.desiredMode} @s`,origin:{type:'player',uuid:this.requestId,request_id:'',player_entity_id:BigInt(w.uniqueId)},internal:false,version:'latest'});this.report(this.reason)}catch(e){this.pending=false;this.requested=false;this.reason=this.desiredMode+' request failed: '+e.message}
  return this.snapshot()
 }
 snapshot(){return {verified:this.world.survivalVerified,movementVerified:this.world.movementVerified,creativeMovementVerified:this.world.creativeMovementVerified,desiredMode:this.desiredMode,pending:this.pending,pendingMode:this.pendingMode,reason:this.reason,mode:this.world.gameMode,modeSource:this.world.gameModeSource,abilities:this.world.abilityState}}
 detach(){for(const [e,f] of this.listeners||[])this.client?.off(e,f);this.listeners=[];this.client=null;this.flightStopped=false}
}
