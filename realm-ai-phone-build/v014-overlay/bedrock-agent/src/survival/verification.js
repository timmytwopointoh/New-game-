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
 reset(){this.requested=false;this.pending=false;this.reason='Waiting for own server mode and abilities.';this.listeners=[];this.client=null}
 attach(client){this.detach();this.reset();this.client=client;const on=(e,f)=>{client.on(e,f);this.listeners.push([e,f])}
  on('spawn',()=>this.check())
  for(const e of ['set_player_game_type','update_player_game_type','update_abilities'])on(e,()=>{if(this.navigation.job&&(!this.world.walkingAllowed||(this.navigation.job.kind==='mine'&&!this.world.survivalVerified)))this.navigation.stop('Server no longer permits this movement/mining job.');this.check()})
  on('command_output',p=>{if(this.pending&&p.origin?.request_id===this.requestId&&p.success_count===0){this.pending=false;this.reason='Server denied Survival change. Autonomous work remains paused.';this.report(this.reason)}})
 }
 check(now=Date.now(),{request=false}={}){
  const w=this.world
  if(w.survivalVerified){this.requested=false;this.flightStopped=false;this.pending=false;this.reason='Own server mode and effective abilities verify Survival.';return this.snapshot()}
  // Never send stop-flying or request gamemode changes during passive input ticks.
  if(request&&w.abilityState?.effective.flying&&!this.flightStopped){
   try{const p=w.standPosition()||{x:0,y:0,z:0};this.client?.queue('player_action',{runtime_entity_id:w.actor.runtimeForPacket(),action:'stop_flying',position:p,result_position:p,face:0});this.navigation.pendingFlags.push('stop_flying');this.flightStopped=true}catch(e){this.reason='Could not send normal stop-flying input: '+e.message}
  }
  if(this.pending&&now-this.requestAt>5000){this.pending=false;this.reason='Server has not confirmed Survival with normal abilities. Autonomous work remains paused.'}
  if(w.abilityState?.loading){this.reason='Temporary loading abilities reported; waiting for loading to finish.';return this.snapshot()}
  if(w.gameMode===null||!w.abilityState?.known){this.reason='Own server mode or effective abilities are unknown; autonomous work paused.';return this.snapshot()}
  if(!this.navigation.spawned){this.reason='Waiting to spawn before requesting Survival.';return this.snapshot()}
  if(this.requested||!request)return this.snapshot()
  if(!['operator','automation','host','owner','internal',1,2,3,4,5].includes(w.abilityState.commandPermission)){this.reason='Survival is not verified and the server has not granted command permission. Ask the Realm owner to check this player; PvP/spawn protection is separate.';return this.snapshot()}
  if(!this.client)return this.snapshot()
  this.requested=true;this.pending=true;this.requestAt=now;this.requestId=crypto.randomUUID();this.reason='Requested /gamemode survival @s; waiting for server mode and ability confirmation.'
  try{this.client.queue('command_request',{command:'/gamemode survival @s',origin:{type:'player',uuid:this.requestId,request_id:this.requestId,player_entity_id:w.actor.uniqueForPacket()},internal:false,version:''});this.report(this.reason)}catch(e){this.pending=false;this.reason='Survival request failed: '+e.message}
  return this.snapshot()
 }
 snapshot(){return {verified:this.world.survivalVerified,pending:this.pending,reason:this.reason,mode:this.world.gameMode,abilities:this.world.abilityState}}
 detach(){for(const [e,f] of this.listeners||[])this.client?.off(e,f);this.listeners=[];this.client=null;this.flightStopped=false}
}
