// Complete the normal Bedrock death-screen handshake. Never restore health
// locally, enable immunity, reconnect authentication, or resume interrupted jobs.
export function respawnState(state){
 if(state===0||state==='0'||state==='searching_for_spawn'||state==='SearchingForSpawn')return 0
 if(state===1||state==='1'||state==='ready_to_spawn'||state==='ReadyToSpawn')return 1
 return null
}
export class RespawnRecovery{
 constructor(world,navigation,interrupt=()=>{},report=()=>{}){this.world=world;this.navigation=navigation;this.interrupt=interrupt;this.report=report;this.listeners=[];this.reset()}
 reset(){this.state='alive';this.attempts=0;this.readyAttempts=0;this.startedAt=null;this.lastAttemptAt=null;this.readyPosition=null;this.searchPosition=null;this.deathHealthRevision=0;this.healthAtDeath=null;this.reason=''}
 attach(client){this.detach();this.reset();this.client=client;const on=(name,fn)=>{client.on(name,fn);this.listeners.push([name,fn])}
  on('respawn',p=>{
   // Different protocol decoders may expose the enum as a number or a label.
   const state=respawnState(p?.state)
   const id=String(p?.runtime_entity_id),own=id===this.world.entityId,dead=!['alive','respawned'].includes(this.state)||this.world.attributes['minecraft:health']===0||!!this.world.deathReportedAt
   if(![0,1].includes(state)||(!own&&!(id==='0'&&dead)))return
   if(!own&&!dead)return
   this.begin(Date.now())
   if(state===0&&p.position&&['x','y','z'].every(k=>Number.isFinite(p.position[k])))this.searchPosition={...p.position}
   if(state===1&&p.position&&['x','y','z'].every(k=>Number.isFinite(p.position[k]))){
    this.readyPosition={...p.position};this.state='server-ready';this.tick(Date.now())
   }
  })
  on('update_attributes',p=>{if(String(p.runtime_entity_id)===this.world.entityId)this.tick(Date.now())})
  on('set_health',()=>this.tick(Date.now()))
  on('entity_event',p=>{if(String(p.runtime_entity_id)===this.world.entityId&&(p.event_id==='death_animation'||p.event_id===3)){this.begin(Date.now());this.tick(Date.now())}})
  on('death_info',()=>{this.begin(Date.now());this.tick(Date.now())})
 }
 begin(now){
  if(!['alive','respawned'].includes(this.state))return
  this.state=this.world.hardcore?'blocked':'dead';this.startedAt=now;this.attempts=0;this.readyAttempts=0;this.lastAttemptAt=null;this.readyPosition=null;this.searchPosition=null;this.deathHealthRevision=this.world.healthRevision||0;this.healthAtDeath=this.world.attributes['minecraft:health']
  this.interrupt('Player died; queued work interrupted. Activate again after respawn.');this.navigation.stop('Player died; requesting normal respawn.')
  this.reason='Server confirmed death; requesting normal respawn. Saved login and plans are kept.';this.report(this.reason)
  if(this.world.hardcore){this.state='blocked';this.reason='The server reports Hardcore; automatic respawn is unavailable. Work remains stopped.';this.report(this.reason)}
 }
 tick(now=Date.now()){
  const health=this.world.attributes['minecraft:health']
  if(health===0)this.begin(now)
  if(['alive','respawned'].includes(this.state))return false
  // Positive health is server-sourced evidence of recovery even if the phone
  // never observed ReadyToSpawn, or it arrived after our 15-second timeout.
  // A sent Respawn/ClientReady packet is NOT required as evidence of success.
  if(health>0&&((this.world.healthRevision||0)>this.deathHealthRevision||this.healthAtDeath===0)){
   this.state='respawned';this.world.deathReportedAt=null;this.navigation.vy=0;this.navigation.unknownSince=null;this.navigation.loading={state:'waiting-for-terrain',id:null,dimension:false}
   this.reason='Server reports positive health after death. Previous work remains stopped; waiting for observed terrain.';this.report(this.reason);return false
  }
  if(this.state==='blocked')return true
  if(now-this.startedAt>15000){this.state='blocked';this.reason='The server did not confirm respawn within 15 seconds. No health or position was invented; retry Respawn or rejoin.';this.report(this.reason);return true}
  // A fresh server ReadyToSpawn must be acknowledged promptly. The two-second
  // cooldown applies to retries, not the first ClientReadyToSpawn response.
  const firstReady=!!this.readyPosition&&this.readyAttempts===0
  if(!this.client||!this.navigation.spawned||(!firstReady&&this.lastAttemptAt!==null&&now-this.lastAttemptAt<2000))return true
  try{
   if(this.readyPosition&&this.readyAttempts<3){
    this.client.queue('respawn',{position:this.readyPosition,state:2,runtime_entity_id:BigInt(this.world.entityId)})
    const first=!this.readyAttempts;this.readyAttempts++;this.lastAttemptAt=now;this.state='waiting-for-health';this.reason='Pressed Respawn; waiting for server health confirmation.'
    if(first)this.navigation.observeServer({position:this.readyPosition,on_ground:false},now)
   }else if(!this.readyPosition&&this.attempts<3){
    const p=this.world.standPosition();if(!p)return true
    this.client.queue('player_action',{runtime_entity_id:BigInt(this.world.entityId),action:'respawn',position:p,result_position:p,face:0})
    // Some servers wait for ClientReadyToSpawn before sending ReadyToSpawn.
    // Acknowledge only the server-provided search/death position; never move
    // the local body to it until the server supplies a ready spawn position.
    const pos=this.searchPosition||this.world.serverPosition
    if(pos&&['x','y','z'].every(k=>Number.isFinite(pos[k])))this.client.queue('respawn',{position:{...pos},state:2,runtime_entity_id:BigInt(this.world.entityId)})
    this.attempts++;this.lastAttemptAt=now;this.state='waiting-for-server';this.reason='Requested Respawn; waiting for the server spawn position.'
   }
  }catch{this.state='blocked';this.reason='Could not send the normal respawn input; work remains stopped.';this.report(this.reason)}
  return true
 }
 request(){if(this.world.attributes['minecraft:health']!==0&&['alive','respawned'].includes(this.state))return {accepted:false,queued:false,message:'The server has not reported this player dead; no respawn request sent.'};if(this.state==='blocked'){this.reset();this.begin(Date.now())}this.tick();return {accepted:this.state!=='blocked',queued:this.state!=='blocked',message:this.reason}}
 snapshot(){return {state:this.state,attempts:this.attempts,readyAttempts:this.readyAttempts,reason:this.reason}}
 detach(){for(const [name,fn] of this.listeners)this.client?.off(name,fn);this.listeners=[];this.client=null}
}
