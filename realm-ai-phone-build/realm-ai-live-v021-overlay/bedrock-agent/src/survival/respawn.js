// Complete the normal Bedrock death-screen handshake. Never restore health
// locally, enable immunity, reconnect authentication, or resume interrupted jobs.
export class RespawnRecovery{
 constructor(world,navigation,interrupt=()=>{},report=()=>{}){this.world=world;this.navigation=navigation;this.interrupt=interrupt;this.report=report;this.listeners=[];this.reset()}
 reset(){this.state='alive';this.attempts=0;this.readyAttempts=0;this.startedAt=null;this.lastAttemptAt=null;this.readyPosition=null;this.reason=''}
 attach(client){this.detach();this.reset();this.client=client;const on=(name,fn)=>{client.on(name,fn);this.listeners.push([name,fn])}
  on('respawn',p=>{
   if(String(p.runtime_entity_id)!==this.world.entityId||![0,1].includes(p.state))return
   if(['alive','respawned'].includes(this.state)&&this.world.attributes['minecraft:health']>0)return
   this.begin(Date.now())
   if(p.state===1&&p.position&&Object.values(p.position).every(Number.isFinite)){
    this.readyPosition={...p.position};this.state='server-ready';this.tick(Date.now())
   }
  })
  on('update_attributes',p=>{if(String(p.runtime_entity_id)===this.world.entityId)this.tick(Date.now())})
  on('set_health',()=>this.tick(Date.now()))
 }
 begin(now){
  if(!['alive','respawned'].includes(this.state))return
  this.state=this.world.hardcore?'blocked':'dead';this.startedAt=now;this.attempts=0;this.readyAttempts=0;this.lastAttemptAt=null;this.readyPosition=null
  this.interrupt('Player died; queued work interrupted. Activate again after respawn.');this.navigation.stop('Player died; requesting normal respawn.')
  this.reason='Server confirmed death; requesting normal respawn. Saved login and plans are kept.';this.report(this.reason)
  if(this.world.hardcore){this.state='blocked';this.reason='The server reports Hardcore; automatic respawn is unavailable. Work remains stopped.';this.report(this.reason)}
 }
 tick(now=Date.now()){
  const health=this.world.attributes['minecraft:health']
  if(health===0)this.begin(now)
  if(['alive','respawned'].includes(this.state))return false
  if(this.state==='blocked')return true
  if(health>0&&this.readyAttempts>0){
   this.state='respawned';this.navigation.vy=0;this.navigation.unknownSince=null;this.navigation.loading={state:'waiting-for-terrain',id:null,dimension:false}
   this.reason='Server confirms respawn and positive health. Loading terrain; previous work stays stopped.';this.report(this.reason);return false
  }
  if(now-this.startedAt>15000){this.state='blocked';this.reason='The server did not confirm respawn within 15 seconds. No health or position was invented; retry Respawn or rejoin.';this.report(this.reason);return true}
  if(!this.client||!this.navigation.spawned||this.lastAttemptAt!==null&&now-this.lastAttemptAt<2000)return true
  try{
   if(this.readyPosition&&this.readyAttempts<3){
    this.client.queue('respawn',{position:this.readyPosition,state:2,runtime_entity_id:BigInt(this.world.entityId)})
    const first=!this.readyAttempts;this.readyAttempts++;this.lastAttemptAt=now;this.state='waiting-for-health';this.reason='Pressed Respawn; waiting for server health confirmation.'
    if(first)this.navigation.observeServer({position:this.readyPosition,on_ground:false},now)
   }else if(!this.readyPosition&&this.attempts<3){
    const p=this.world.standPosition();if(!p)return true
    this.client.queue('player_action',{runtime_entity_id:BigInt(this.world.entityId),action:'respawn',position:p,result_position:p,face:0})
    this.attempts++;this.lastAttemptAt=now;this.state='waiting-for-server';this.reason='Requested Respawn; waiting for the server spawn position.'
   }
  }catch{this.state='blocked';this.reason='Could not send the normal respawn input; work remains stopped.';this.report(this.reason)}
  return true
 }
 request(){if(this.world.attributes['minecraft:health']!==0&&['alive','respawned'].includes(this.state))return {accepted:false,queued:false,message:'The server has not reported this player dead; no respawn request sent.'};if(this.state==='blocked'){this.reset();this.begin(Date.now())}this.tick();return {accepted:this.state!=='blocked',queued:this.state!=='blocked',message:this.reason}}
 snapshot(){return {state:this.state,attempts:this.attempts,readyAttempts:this.readyAttempts,reason:this.reason}}
 detach(){for(const [name,fn] of this.listeners)this.client?.off(name,fn);this.listeners=[];this.client=null}
}
