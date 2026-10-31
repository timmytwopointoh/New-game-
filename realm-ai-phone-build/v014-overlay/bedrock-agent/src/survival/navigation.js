import {findPath} from './pathfinder.js'
import {ProgressTracker,miningAssessment,recoveryDecision} from './obstacles.js'
import {Mining} from './mining.js'
import {cameraForward,aimAtBlock,describeControl} from './control-input.js'
const key=p=>`${p.x},${p.y},${p.z}`
const flatDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)
export class Navigation{
 constructor(world,report=()=>{}){
  this.world=world;this.report=report;this.client=null;this.timer=null;this.route=null;this.state='idle';this.reason='';this.tick=0n;this.lastInputAt=0;this.lastPoseAt=0;this.listeners=[];this.lastRequestAt=0
  this.packetsSent=0;this.lastPacketAt=null;this.serverPoseSamples=0;this.lastServerPoseAt=null;this.lastServerPosition=null;this.lastInputError=null
  this.vy=0;this.progress=new ProgressTracker();this.mining=new Mining(world,report);this.job=null;this.flight=null;this.blocked=new Map();this.recoveryAttempts=0;this.decisions=[];this.pendingFlags=[]
 }
 note(action,reason){this.decisions.push({action,reason});this.decisions=this.decisions.slice(-6);this.reason=reason;this.report(reason)}
 attach(client){
  this.detach();this.client=client;this.progress.reset();this.blocked.clear();this.decisions=[];this.recoveryAttempts=0;this.packetsSent=0;this.lastPacketAt=null;this.serverPoseSamples=0;this.lastServerPoseAt=null;this.lastServerPosition=null;this.lastInputError=null
  const on=(e,f)=>{client.on(e,f);this.listeners.push([e,f])}
  on('start_game',p=>{this.tick=BigInt(p.current_tick||0);this.yaw=Number(p.rotation?.z||0);this.pitch=Number(p.rotation?.x||0);this.spawned=false;this.lastPoseAt=Date.now()})
  on('spawn',()=>{this.spawned=true;this.timer=setInterval(()=>this.step(),50);this.timer.unref?.()})
  const correction=p=>this.observeServer(p,Date.now())
  on('move_player',p=>{if(String(p.runtime_id)===this.world.entityId)correction(p)})
  on('correct_player_move_prediction',correction)
  on('change_dimension',()=>{this.stop('Dimension changed; work cancelled.');this.progress.reset();this.blocked.clear()})
  on('close',()=>this.detach());on('disconnect',()=>this.stop('Disconnected. Rejoin the Realm before moving.'))
 }
 observeServer(p,now){
  if(!p.position||![p.position.x,p.position.y,p.position.z].every(Number.isFinite))return
  if(p.delta&&Number.isFinite(p.delta.y))this.vy=p.delta.y;else this.vy=0
  const before=this.world.position;this.world.position={...p.position};this.lastPoseAt=now;this.serverPoseSamples++;this.lastServerPoseAt=now;this.lastServerPosition={...p.position}
  if(p.yaw!==undefined)this.yaw=p.yaw
  if(p.mode==='teleport'){this.pendingFlags.push('handled_teleport');this.stop('Server teleported the player; work cancelled.');this.progress.reset();return}
  if(before&&Math.hypot(before.x-p.position.x,before.y-p.position.y,before.z-p.position.z)>4){this.stop('Large server correction; work paused instead of jumping or digging.');this.progress.reset();return}
  this.progress.observe(p.position,now)
  if(this.progress.feedback==='progressing'&&this.lastRecoveryPosition&&flatDistance(p.position,this.lastRecoveryPosition)>=1){this.recoveryAttempts=0;this.lastRecoveryPosition=null}
  if(this.job&&!this.flight&&this.progress.stalled(now))this.recover('Server feedback shows no forward progress.',now)
 }
 controlStatus(now=Date.now()){return describeControl(this,now)}
 aimAt(block){
  if(!this.spawned||!this.client||!this.world.position)return {accepted:false,queued:false,message:'Join and spawn before aiming.'}
  if(this.job||this.flight||this.mining.job)return {accepted:false,queued:false,message:'Stop the current movement/mining job before aiming.'}
  let aim
  try{aim=aimAtBlock(this.world.position,block)}catch(e){return {accepted:false,queued:false,message:e.message}}
  this.yaw=aim.yaw;this.pitch=aim.pitch
  const before=this.packetsSent
  this.step(Date.now())
  if(this.packetsSent===before)return {accepted:false,queued:false,message:'No control input sent. '+(this.lastInputError||this.reason||'Check connection status.')}
  return {accepted:true,queued:false,message:'Sent first-person-aligned look input towards '+block.x+','+block.y+','+block.z+'. Camera is headless; server acknowledgement of orientation is not guaranteed.',control:this.controlStatus()}
 }
 routeTo(goal,start=this.world.standPosition(),{allowSteps=false,maxNodes=4096}={}){
  const now=Date.now(),w=this.world
  const routeWorld={walkable:p=>w.walkable(p)&&!(this.blocked.get(key(p))>now),canJumpBetween:(a,b)=>w.canJumpBetween?.(a,b),canDropBetween:(a,b)=>w.canDropBetween?.(a,b)}
  return findPath(routeWorld,start,goal,{allowSteps,maxNodes})
 }
 assignRoute(plan){this.route=plan.path.slice(1);this.state=this.route.length?'walking':'arrived-predicted';this.arrivedAt=this.route.length?0:Date.now()}
 walk(goal,{allowMining=false}={}){
  if(!this.world.survivalVerified)return {accepted:false,queued:false,message:'Survival mode is not verified by the server; movement/mining refused.'}
  if(!this.spawned||!this.client)return {accepted:false,queued:false,message:'Join and spawn in the Realm first.'}
  const start=this.world.standPosition()
  if(!start||![goal?.x,goal?.y,goal?.z].every(Number.isSafeInteger)||goal.y!==start.y||Math.abs(goal.x-start.x)+Math.abs(goal.z-start.z)>48)return {accepted:false,queued:false,message:'Choose whole coordinates on the current level within 48 blocks.'}
  if(!this.world.walkable(start)||!this.world.walkable(goal))return {accepted:false,queued:false,message:'Start and destination must be clear, safe, observed standing cells. Use dig for an explicit block target.'}
  this.stop('',false);this.progress.reset();this.recoveryAttempts=0;this.blocked.clear();this.startedAt=Date.now()
  this.job={kind:'solo',goal:{...goal},allowMining};const plan=this.routeTo(goal)
  if(!plan.ok){
   if(allowMining&&this.recover(plan.reason,this.startedAt))return {accepted:true,queued:true,message:this.reason}
   this.job=null;return {accepted:false,queued:false,message:plan.reason}
  }
  this.assignRoute(plan)
  return {accepted:true,queued:!!this.route.length,message:this.route.length?`Solo route: ${this.route.length} steps. I will try another route if blocked${allowMining?', then consider one natural-looking, easy block if necessary':''}.`:'Already in that block according to the client position.'}
 }
 follow(name){
  if(!this.world.survivalVerified)return {accepted:false,queued:false,message:'Survival mode is not verified by the server; movement/mining refused.'}
  if(!this.spawned||!this.client)return {accepted:false,queued:false,message:'Join and spawn in the Realm first.'}
  this.stop('',false);this.progress.reset();this.recoveryAttempts=0;this.blocked.clear();this.job={kind:'follow',name,allowMining:false};this.state='following';this.lastFollowPlan=0
  this.updateFollow(Date.now(),true)
  return {accepted:true,queued:!!this.route?.length,message:`${this.state}: ${name}. ${this.reason||'Route prepared; server movement remains unverified.'}`}
 }
 updateFollow(now,force=false){
  if(this.job?.kind!=='follow'||this.flight)return
  const player=[...this.world.players.values()].find(p=>p.name.toLowerCase()===this.job.name.toLowerCase())
  if(!player){this.route=null;this.state='waiting-for-player';this.reason='Waiting for that player to be visible in the loaded Realm.';return}
  const start=this.world.standPosition(),target=player.position
  if(!start)return
  if(flatDistance(this.world.position,target)<2.2&&Math.abs(this.world.position.y-target.y)<2){this.route=null;this.state='following';this.reason='Close to the followed player.';return}
  if(!force&&now-(this.lastFollowPlan||0)<1000)return
  this.lastFollowPlan=now
  const candidates=[]
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let dy=-2;dy<=2;dy++){
   const p={x:Math.floor(target.x)+dx,y:start.y+dy,z:Math.floor(target.z)+dz}
   if(this.world.walkable(p))candidates.push(p)
  }
  candidates.sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)+Math.abs(a.y-(target.y-1.62))-Math.hypot(b.x-target.x,b.z-target.z)-Math.abs(b.y-(target.y-1.62)))
  for(const goal of candidates.slice(0,4)){
   const plan=this.routeTo(goal,start,{allowSteps:true,maxNodes:768})
   if(plan.ok){this.job.goal=goal;this.assignRoute(plan);return}
  }
  this.route=null;const terrainKnown=this.world.terrainKnown({x:target.x,y:target.y,z:target.z});this.state=terrainKnown?'blocked':'waiting-for-terrain';this.reason=terrainKnown?'Observed obstacles prevent a verified route; waiting for player movement.':'Terrain near the player is unknown; requesting terrain before planning a route.';if(!terrainKnown)try{this.world.requestNearby(this.client)}catch{}
 }
 mine(position,options={}){
  if(!this.world.survivalVerified)return {accepted:false,queued:false,message:'Survival mode is not verified by the server; movement/mining refused.'}
  if(!this.spawned||!this.client)return {accepted:false,queued:false,message:'Join and spawn first.'}
  this.stop('',false);this.progress.reset();const result=this.mining.begin(position,{...options,explicit:true});if(result.accepted){this.job={kind:'mine',allowMining:true};this.state='mining'}return result
 }
 obstacleAhead(){
  const a=this.world.standPosition(),goal=this.route?.[0]||this.job?.goal
  if(!a||!goal)return null
  const dx=goal.x-a.x,dz=goal.z-a.z
  if(!dx&&!dz)return null
  const p={x:a.x+(Math.abs(dx)>=Math.abs(dz)?Math.sign(dx):0),y:a.y,z:a.z+(Math.abs(dx)<Math.abs(dz)?Math.sign(dz):0)}
  const foot=this.world.block(p),head=this.world.block({...p,y:p.y+1})
  if(foot&&['air','cave_air','void_air'].includes(foot.name)&&head&&!['air','cave_air','void_air'].includes(head.name))p.y++
  return p
 }
 recover(reason,now=Date.now()){
  if(!this.job||this.flight||this.mining.job)return false
  const a=this.world.standPosition(),obstacle=this.obstacleAhead(),goal=this.job.goal
  if(!a||!obstacle||!goal){this.stop(reason);return false}
  const landing={...obstacle,y:a.y+1},canJump=this.job.kind==='follow'&&this.world.canJumpBetween?.(a,landing)
  // Temporarily exclude the troublesome cell even when the local block cache says air.
  this.blocked.set(key(obstacle),now+30000);while(this.blocked.size>32)this.blocked.delete(this.blocked.keys().next().value)
  const detour=canJump?{ok:false}:this.routeTo(goal,a,{allowSteps:this.job.kind==='follow'})
  const mine=this.job.allowMining?miningAssessment(this.world,obstacle):null
  const decision=recoveryDecision({mode:this.job.kind,canJump,hasDetour:detour.ok,mine,allowMining:this.job.allowMining,attempts:this.recoveryAttempts})
  this.recoveryAttempts++;this.lastRecoveryPosition={...this.world.position};this.progress.reset();this.note(decision.action,reason+' '+decision.reason)
  if(decision.action==='jump'){
   this.route=[landing];this.afterJumpGoal=goal;this.beginFlight(landing,'jump');return true
  }
  if(decision.action==='detour'){this.assignRoute(detour);return true}
  if(decision.action==='mine'){
   const result=this.mining.begin(obstacle,{},now)
   if(result.accepted){this.route=null;this.state='mining-obstacle';this.clearing=obstacle;return true}
   this.note('pause',result.message)
  }
  this.stop(this.reason);return false
 }
 beginFlight(target,kind){
  const a=this.world.standPosition()
  if(!a||!this.world.grounded())return false
  if(kind==='jump'?!this.world.canJumpBetween?.(a,target):!this.world.canDropBetween?.(a,target))return false
  this.yaw=Math.atan2(-(target.x+.5-this.world.position.x),target.z+.5-this.world.position.z)*180/Math.PI
  this.flight={target:{...target},kind,vy:kind==='jump'?.42:0,started:Date.now(),first:true};this.state=kind==='jump'?'jumping':'stepping-down';return true
 }
 flightStep(now){
  const f=this.flight,p=this.world.position,zero={delta:{x:0,y:0,z:0},move:{x:0,z:0},flags:[]}
  if(!f)return zero
  if(now-f.started>2000){this.flight=null;this.stop('Jump/drop did not finish; stopped instead of retrying blindly.');return zero}
  const landing=f.target,dx=landing.x+.5-p.x,dz=landing.z+.5-p.z,d=Math.hypot(dx,dz),speed=Math.min(.1,d)
  const desired={x:p.x+(d?dx/d*speed:0),y:p.y+f.vy,z:p.z+(d?dz/d*speed:0)},floorY=(this.world.supportHeight(landing)??landing.y)+1.62
  if(f.vy<=0&&desired.y<=floorY&&Math.abs(desired.x-(landing.x+.5))<.35&&Math.abs(desired.z-(landing.z+.5))<.35&&this.world.walkable(landing)){
   desired.y=floorY
   if(this.world.clearBody(desired)){const delta={x:desired.x-p.x,y:desired.y-p.y,z:desired.z-p.z};this.world.position=desired;this.flight=null;this.state='walking';if(this.afterJumpGoal){const goal=this.afterJumpGoal;this.afterJumpGoal=null;const plan=this.routeTo(goal,this.world.standPosition(),{allowSteps:this.job?.kind==='follow'});if(plan.ok)this.assignRoute(plan);else this.route=null}return {delta,move:{x:0,z:1},flags:[]}}
  }
  let next=desired
  if(!this.world.clearBody(next)){
   const vertical={...p,y:desired.y},horizontal={...p,x:desired.x,z:desired.z}
   if(this.world.clearBody(vertical))next=vertical
   else if(f.kind==='drop'&&this.world.clearBody(horizontal)){next=horizontal;f.vy=0}
   else{this.flight=null;this.stop('Jump clearance changed; stopped.');return zero}
  }
  const flags=f.first&&f.kind==='jump'?['start_jumping','jump_down','jumping']:f.kind==='jump'?['jumping']:[];f.first=false
  const delta={x:next.x-p.x,y:next.y-p.y,z:next.z-p.z};this.world.position=next;f.vy=(f.vy-.08)*.98
  return {delta,move:{x:0,z:1},flags}
 }
 stop(reason='Stopped moving and mining.',notify=true){
  const active=!!this.job||this.route!==null||!!this.flight||!!this.mining.job
  if(this.flight)this.vy=this.flight.vy
  this.route=null;this.job=null;this.flight=null;this.afterJumpGoal=null;this.clearing=null;this.state='stopped';this.reason=reason
  this.mining.cancel(reason)
  // Send neutral input now, including abort_break, rather than waiting for the next timer tick.
  if(active&&this.spawned&&this.client&&!this.stopping){this.stopping=true;try{this.step(Date.now())}finally{this.stopping=false}}
  if(active&&notify&&reason)this.report(reason)
 }
 step(now=Date.now()){if(this.inStep)return;this.inStep=true;try{this.inputStep(now)}finally{this.inStep=false}}
 inputStep(now=Date.now()){
  if(!this.spawned||!this.client||!this.world.position)return
  if(now-this.lastInputAt>500&&this.lastInputAt&&(this.job||this.flight))this.stop('Phone paused; work stopped.')
  this.lastInputAt=now
  this.checkVerification?.()
  const health=this.world.attributes['minecraft:health']
  if(health===0){this.stop('Player died; work stopped.');return}
  if(this.job&&health!==undefined&&health<=6)this.stop('Health is low; work stopped.')
  if(this.job&&!this.world.survivalVerified)this.stop('Server Survival verification lost; work stopped.')
  if(this.job&&!this.world.enabled)this.stop('View is off; work stopped.')
  if(this.job?.kind==='solo'&&now-this.startedAt>60000)this.stop('Travel time limit reached.')
  if(this.clearing&&!this.mining.job){
   const goal=this.job?.goal
   if(this.mining.result==='confirmed'&&goal){this.blocked.delete(key(this.clearing));this.clearing=null;const plan=this.routeTo(goal);if(plan.ok)this.assignRoute(plan);else this.recover(plan.reason,now)}
   else if(this.mining.result==='cancelled')this.stop(this.mining.reason)
  }
  if(!this.world.terrainKnown(this.world.position)){
   this.unknownSince??=now
   try{this.world.requestNearby(this.client)}catch{}
   if(now-this.unknownSince>=5000){this.stop('Terrain/clearance could not be verified after five seconds; disconnecting with saved login preserved.');this.report(this.reason);this.client.disconnect?.(this.reason);this.client.close?.();this.detach();return}
  }else this.unknownSince=null
  this.updateFollow(now)
  let delta={x:0,y:0,z:0},move={x:0,z:0},flags=[]
  if(this.flight){({delta,move,flags}=this.flightStep(now))}
  else if(this.route?.length&&!this.mining.job&&this.world.grounded()){
   const target=this.route[0],a=this.world.standPosition(),p=this.world.position
   if(target.y!==a.y){
    if(!this.beginFlight(target,target.y>a.y?'jump':'drop'))this.recover('Step height or headroom is blocked.',now)
    else({delta,move,flags}=this.flightStep(now))
   }else if(!this.world.walkable(target))this.recover('Obstacle appeared on the route.',now)
   else{
    const dx=target.x+.5-p.x,dz=target.z+.5-p.z,d=Math.hypot(dx,dz)
    if(d<.07){this.route.shift();if(!this.route.length){this.route=null;this.state='arrived-predicted';this.arrivedAt=now;this.reason='Route inputs finished; server movement confirmation may still be pending.'}}
    else{
     const speed=Math.min(.1,d),next={x:p.x+dx/d*speed,y:p.y,z:p.z+dz/d*speed}
     const height=this.world.supportHeight(target)
     if(!this.world.clearBody(next)&&height!==null&&height+1.62>p.y&&height+1.62-p.y<=1&&this.world.clearBody({...p,y:height+1.62}))next.y=height+1.62
     const clear=this.world.clearBody(next)&&[-.3,.3].every(x=>[-.3,.3].every(z=>this.world.walkable({x:Math.floor(next.x+x),y:a.y,z:Math.floor(next.z+z)})))
     if(!clear)this.recover('Player clearance is blocked or unknown.',now)
     else{delta={x:next.x-p.x,y:next.y-p.y,z:next.z-p.z};this.world.position=next;move={x:0,z:1};this.state='walking'}
    }
   }
  }
  if(move.z){this.progress.commanded(Math.hypot(delta.x,delta.z));if(delta.x||delta.z)this.yaw=Math.atan2(-delta.x,delta.z)*180/Math.PI}
  if(!this.flight){
   const p=this.world.position
   if(this.world.grounded()){this.vy=0;flags.push('vertical_collision')}
   else{
    // Gravity also runs when idle or stopped. Sweep in short increments to avoid tunnelling.
    this.vy=Math.max(-3.92,(this.vy-.08)*.98)
    let remaining=Math.abs(this.vy),direction=Math.sign(this.vy),moved=0
    while(remaining>.000001){
     const amount=Math.min(.02,remaining),next={...this.world.position,y:this.world.position.y+direction*amount}
     if(!this.world.clearBody(next)){
      // Find the last clear point at the contact surface.
      let low=0,high=amount
      for(let i=0;i<18;i++){const mid=(low+high)/2;if(this.world.clearBody({...this.world.position,y:this.world.position.y+direction*mid}))low=mid;else high=mid}
      this.world.position.y+=direction*low;moved+=direction*low;this.vy=0
      if(this.world.grounded())flags.push('vertical_collision')
      break
     }
     this.world.position=next;moved+=direction*amount;remaining-=amount
    }
    delta.y+=moved
   }
  }
  const mining=this.mining.tick(now)
  if(mining.actions.length)flags.push('block_action')
  if(mining.transaction)flags.push('item_interact')
  if(this.job?.kind==='mine'&&!this.mining.job){this.state=this.mining.result;this.reason=this.mining.reason;this.job=null}
  if(this.job?.kind==='solo'&&this.arrivedAt&&now-this.arrivedAt>10000){this.job=null;this.report('Route inputs finished. No further movement queued.')}
  try{
   this.client.queue('player_auth_input',{pitch:this.pitch||0,yaw:this.yaw||0,position:{...this.world.position},move_vector:move,head_yaw:this.yaw||0,input_data:[...new Set([...(move.z?['up']:[]),'received_server_data',...flags,...this.pendingFlags.splice(0)])],input_mode:'mouse',play_mode:'normal',interaction_model:'crosshair',interact_rotation:{x:this.pitch||0,z:this.yaw||0},tick:++this.tick,delta,transaction:mining.transaction,item_stack_request:null,block_action:mining.actions.length?mining.actions:null,vehicle_rotation:null,predicted_vehicle:null,analogue_move_vector:move,camera_orientation:cameraForward(this.yaw||0,this.pitch||0),raw_move_vector:move})
   this.packetsSent++;this.lastPacketAt=now;this.lastInputError=null
   if(now-this.lastRequestAt>5000){this.lastRequestAt=now;this.world.requestNearby(this.client)}
  }catch(e){this.lastInputError=String(e.message||e).slice(0,140);this.stop('Input packet failed: '+this.lastInputError);this.detach()}
 }
 snapshot(){return {state:this.state,mode:this.job?.kind||'idle',following:this.job?.kind==='follow'?this.job.name:null,remaining:this.route?.length||0,reason:this.reason,progress:this.progress.snapshot(),mining:this.mining.snapshot(),decisions:this.decisions,control:this.controlStatus()}}
 detach(){if(this.timer)clearInterval(this.timer);this.timer=null;for(const [e,f] of this.listeners)this.client?.off(e,f);this.listeners=[];this.route=null;this.job=null;this.flight=null;this.pendingFlags=[];this.mining.reset();this.spawned=false;this.unknownSince=null;this.vy=0}
}
