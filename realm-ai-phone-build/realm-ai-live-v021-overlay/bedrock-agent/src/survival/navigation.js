import {findPath} from './pathfinder.js'
import {mediumAt} from './situation.js'
import {ProgressTracker,miningAssessment,recoveryDecision} from './obstacles.js'
import {Mining} from './mining.js'
import {Building} from './building.js'
import {Climbing,dirtStaircase} from './climbing.js'
import {Pillaring} from './pillaring.js'
import {HazardRecovery} from './hazards.js'
import {dirtBridge} from './bridging.js'
import {nearbyHostiles,safestEscape} from './threat-defense.js'
import {meleeTarget,meleePacket} from './combat.js'
import {Pickup,nearestDrop} from './pickup.js'
const key=p=>`${p.x},${p.y},${p.z}`
const flatDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)
export class Navigation{
 constructor(world,report=()=>{}){
  this.world=world;this.report=report;this.client=null;this.timer=null;this.route=null;this.state='idle';this.reason='';this.tick=0n;this.lastInputAt=0;this.lastPoseAt=0;this.listeners=[];this.lastRequestAt=0
  this.hazards=new HazardRecovery(this);this.vy=0;this.progress=new ProgressTracker();this.mining=new Mining(world,report);this.building=new Building(world,report);this.climbing=new Climbing(world,report);this.job=null;this.flight=null;this.pendingFlightRecovery=null;this.blocked=new Map();this.recoveryAttempts=0;this.decisions=[];this.pendingFlags=[];this.survey=null;this.pickup=new Pickup(world);this.defense={lastAttempt:0,lastStrike:0,strikes:0,attackedId:null,state:'idle',reason:'',threat:null}
 }
 note(action,reason){this.decisions.push({action,reason});this.decisions=this.decisions.slice(-6);this.reason=reason;this.report(reason)}
 attach(client){
  this.detach();this.client=client;this.progress.reset();this.blocked.clear();this.decisions=[];this.recoveryAttempts=0
  const on=(e,f)=>{client.on(e,f);this.listeners.push([e,f])}
  on('start_game',p=>{this.tick=BigInt(p.current_tick||0);this.yaw=Number(p.rotation?.z||0);this.pitch=0;this.spawned=false;this.lastPoseAt=Date.now();this.loading={state:'waiting-for-terrain',id:null,dimension:false}})
  on('set_entity_motion',p=>this.observeMotion(p))
  on('spawn',()=>{this.spawned=true;if(this.timer)clearInterval(this.timer);this.loading??={state:'waiting-for-terrain',id:null,dimension:false};this.timer=setInterval(()=>this.step(),50);this.timer.unref?.()})
  const correction=p=>this.observeServer(p,Date.now())
  on('move_player',p=>{if(String(p.runtime_id)===this.world.entityId)correction(p)})
  on('correct_player_move_prediction',p=>{if(p.prediction_type!=='vehicle'&&p.prediction_type!==1)correction(p)})
  on('move_entity',p=>{if(String(p.runtime_entity_id??p.runtime_id)===this.world.entityId)correction(p)})
  on('change_dimension',p=>{this.externalMotion=null;this.motionTick=undefined;this.loading={state:'waiting-for-terrain',id:p.loading_screen_id??null,dimension:true};this.stop('Dimension changed; work cancelled.');this.progress.reset();this.blocked.clear();this.lastServerTick=null;this.vy=0})
  on('close',()=>this.detach());on('disconnect',()=>this.stop('Disconnected. Rejoin the Realm before moving.'))
 }
 // Bedrock supplies actual motion, not a request to teleport or change mode.
 observeMotion(p,now=Date.now()){
  if(String(p.runtime_entity_id)!==this.world.entityId||this.world.attributes['minecraft:health']===0)return false
  const v=p.velocity
  if(!v||!['x','y','z'].every(k=>Number.isFinite(v[k])&&Math.abs(v[k])<=4))return false
  const tick=p.tick===undefined?null:BigInt(p.tick)
  if(tick!==null&&this.motionTick!==undefined&&tick<this.motionTick)return false
  if(tick!==null)this.motionTick=tick
  this.externalMotion={x:v.x,z:v.z,started:now};this.vy=v.y
  this.flight=null;this.afterJumpGoal=null;this.routeAlignment=null
  this.progress.reset()
  return true
 }
 applyMotion(now){
  const m=this.externalMotion,delta={x:0,y:0,z:0}
  if(!m)return delta
  // Sweep each axis, retaining walls and unknown-terrain collision checks.
  for(const axis of ['x','z']){
   let remaining=Math.abs(m[axis]),direction=Math.sign(m[axis])
   while(remaining>.000001){const d=Math.min(.04,remaining),next={...this.world.position,[axis]:this.world.position[axis]+direction*d}
    if(!this.world.clearBody(next)){m[axis]=0;break}
    this.world.position=next;delta[axis]+=direction*d;remaining-=d
   }
  }
  const ground=this.world.grounded()&&this.vy<=0,drag=ground ? .546 : .91
  m.x*=drag;m.z*=drag
  if(ground&&Math.hypot(m.x,m.z)<.01||now-m.started>2000)this.externalMotion=null
  return delta
 }
 observeServer(p,now){
  if(!p.position||![p.position.x,p.position.y,p.position.z].every(Number.isFinite))return
  // Rewind corrections may arrive after newer feedback. Never rewind to an
  // older tick, and never treat a vehicle correction as the player's body.
  const tick=p.tick===undefined?null:BigInt(p.tick)
  if(p.mode!=='teleport'&&tick!==null&&this.lastServerTick!==null&&this.lastServerTick!==undefined&&tick<this.lastServerTick)return
  if(tick!==null)this.lastServerTick=tick
  if(typeof p.on_ground==='boolean')this.world.serverGrounded=p.on_ground
  if(p.on_ground===true&&(!this.externalMotion||this.vy<=0))this.vy=0;else if(p.delta&&Number.isFinite(p.delta.y))this.vy=p.delta.y;else if(!this.externalMotion)this.vy=0
  const before=this.world.position;this.world.position={...p.position};this.world.serverPosition={...p.position};this.lastPoseAt=now
  if(p.yaw!==undefined)this.yaw=p.yaw
  if(p.mode==='teleport'){this.pendingFlags.push('handled_teleport');this.stop('Server teleported the player; work cancelled.');this.progress.reset();return}
  if(before&&Math.hypot(before.x-p.position.x,before.y-p.position.y,before.z-p.position.z)>4){this.stop('Large server correction; work paused instead of jumping or digging.');this.progress.reset();return}
  this.progress.observe(p.position,now)
  if(this.progress.feedback==='progressing'&&this.lastRecoveryPosition&&flatDistance(p.position,this.lastRecoveryPosition)>=1){this.recoveryAttempts=0;this.lastRecoveryPosition=null}
  if(this.job&&!this.flight&&!this.climbing.current&&!this.building.job&&this.progress.stalled(now))this.recover('Server feedback shows no forward progress.',now)
 }
 routeTo(goal,start=this.world.standPosition(),{allowSteps=true,maxNodes=4096,allowDirt=false,avoidHostiles=true,maxDrop=this.job?.maxDrop||(this.job?.kind==='follow'?5:1),allowBridge=this.job?.kind==='follow',allowWater=true}={}){
  const now=Date.now(),w=this.world
  const memo=fn=>{const cache=new Map();return p=>{const id=key(p);if(!cache.has(id))cache.set(id,fn(p));return cache.get(id)}}
  const routeWorld={walkable:memo(p=>w.walkable(p,{avoidHostiles})&&!(this.blocked.get(key(p))>now)),canJumpBetween:(a,b)=>w.canJumpBetween?.(a,b),canDropBetween:(a,b)=>w.canDropBetween?.(a,b,{maxDrop})}
  // Prefer dry routes, but consider short, observed shallow-water crossings.
  const dry=findPath(routeWorld,start,goal,{allowSteps,maxNodes,maxDrop})
  if(dry.ok)return dry
  if(allowWater){
   const wetWorld={...routeWorld,walkable:memo(p=>w.walkable(p,{avoidHostiles,allowWater:true})&&!(this.blocked.get(key(p))>now)),shallowWater:memo(p=>w.shallowWater(p))}
   const wet=findPath(wetWorld,start,goal,{allowSteps,maxNodes,maxDrop,waterBudget:8,waterPenalty:3})
   if(wet.ok&&(!dry.ok||wet.totalCost<dry.totalCost*.75))return wet
  }
  if(dry.ok)return dry
  return !allowDirt||!start?dry:dirtStaircase(w,start,goal,{maxDrop,excluded:p=>this.blocked.get(key(p))>now})||(allowBridge?dirtBridge(w,start,goal,{excluded:p=>this.blocked.get(key(p))>now,maxDrop}):null)||dry
 }
 assignRoute(plan){this.pendingFlightRecovery=null;this.routeAlignment=null;const start=plan.path[0],next=plan.path[1],p=this.world.position;if(start&&next&&p){const axis=next.x!==start.x?'z':'x',value=start[axis]+.5;if(Math.abs(p[axis]-value)>.025)this.routeAlignment={axis,value}}this.climbing.prepare(plan.stairs);this.route=plan.path.slice(1);if(this.job)this.job.waterRouting=!!plan.waterCrossing;this.state=this.route.length?'walking':'arrived-predicted';this.arrivedAt=this.route.length?0:Date.now()}
 shallowWading(){return !!(this.world.position&&this.world.shallowWater(this.world.standPosition())&&mediumAt(this.world,this.world.position).kind==='water')}
 movementBlock(){
  if(this.world.attributes['minecraft:health']===0||this.isRespawning?.())return 'Waiting for server-confirmed respawn; previous work stays stopped.'
  if(this.world.inputLocks?.move)return 'The server has locked movement; waiting for its unlock update.'
  if(this.world.abilityState?.effective.flying)return 'The server still reports active flight. Requesting flight off and waiting for confirmation before walking.'
  if(!this.world.movementVerified)return 'This player’s server mode and grounded movement abilities are not verified; movement is paused.'
  if(!this.world.terrainKnown())return 'Nearby terrain is unknown; requesting it before landing or walking.'
  if(!this.world.clearBody(this.world.position,{allowWater:this.shallowWading()}))return 'Received terrain overlaps the server-reported player body; waiting for a clear authoritative position before walking.'
  if(!this.world.grounded()&&!this.shallowWading())return 'Still landing under gravity; wait for collision-based ground contact, then activate the command again.'
  return null
 }
 finishLoading(){
  if(this.loading?.state!=='waiting-for-terrain'||!this.world.terrainKnown())return
  // set_local_player_as_initialized alone does not end Bedrock's loading
  // abilities. Acknowledge only after the actual nearby terrain has arrived.
  if(this.loading.dimension){const p=this.world.standPosition();this.client.queue('player_action',{runtime_entity_id:BigInt(this.world.entityId),action:'dimension_change_ack',position:p,result_position:p,face:0})}
  this.client.queue('serverbound_loading_screen',{type:2,loading_screen_id:this.loading.id})
  this.loading.state='complete'
 }
 walk(goal,{allowMining=false,maxDrop=1}={}){
  if(!Number.isSafeInteger(maxDrop)||maxDrop<1||maxDrop>5)return {accepted:false,queued:false,message:'Planned drops must be 1–5 blocks.'}
  const blocked=this.movementBlock();if(blocked)return {accepted:false,queued:false,message:blocked}
  if(allowMining&&!this.world.editModeVerified)return {accepted:false,queued:false,message:'Clear-path work requires this player’s verified Survival or grounded Creative mode; no movement or mining started.'}
  if(!this.spawned||!this.client)return {accepted:false,queued:false,message:'Join and spawn in the Realm first.'}
  const start=this.world.standPosition()
  if(!start||![goal?.x,goal?.y,goal?.z].every(Number.isSafeInteger)||Math.abs(goal.x-start.x)+Math.abs(goal.z-start.z)+Math.abs(goal.y-start.y)>48)return {accepted:false,queued:false,message:'Choose whole feet-level coordinates within 48 blocks.'}
  if(!this.world.walkable(start,{allowWater:true})||!this.world.walkable(goal,{allowWater:true}))return {accepted:false,queued:false,message:'Start and destination must be clear, safe, observed standing cells. Use dig for an explicit block target.'}
  this.stop('',false);this.progress.reset();this.recoveryAttempts=0;this.blocked.clear();this.startedAt=Date.now()
  this.job={kind:'solo',goal:{...goal},allowMining,maxDrop};const plan=this.routeTo(goal,start,{allowSteps:true,allowDirt:true})
  if(!plan.ok){
   if(allowMining&&this.recover(plan.reason,this.startedAt))return {accepted:true,queued:true,message:this.reason}
   this.job=null;return {accepted:false,queued:false,message:plan.reason}
  }
  this.assignRoute(plan)
  return {accepted:true,queued:!!this.route.length,message:this.route.length?`Solo route: ${this.route.length} steps${plan.dirtRequired?`, using ${plan.dirtRequired} server-confirmed dirt placements`:""}. I will try another route if blocked${allowMining?', then consider one natural-looking, easy block if necessary':''}.`:'Already in that block according to the client position.'}
 }
 follow(name){
  const blocked=this.movementBlock();if(blocked)return {accepted:false,queued:false,message:blocked}
  if(!this.spawned||!this.client)return {accepted:false,queued:false,message:'Join and spawn in the Realm first.'}
  this.stop('',false);this.progress.reset();this.recoveryAttempts=0;this.blocked.clear();this.job={kind:'follow',name,allowMining:true};this.state='following';this.lastFollowPlan=0
  this.updateFollow(Date.now(),true)
  return {accepted:true,queued:!!this.route?.length,message:`${this.state}: ${name}. ${this.reason||'Route prepared; server movement remains unverified.'}`}
 }
 updateFollow(now,force=false){
  if(this.job?.kind!=='follow'||this.pendingFlightRecovery||this.pillar||this.flight||this.climbing.steps.size||this.mining.job||this.clearing)return
  const player=[...this.world.players.values()].find(p=>p.name.toLowerCase()===this.job.name.toLowerCase())
  if(!player){this.route=null;this.state='waiting-for-player';this.reason='Waiting for that player to be visible in the loaded Realm.';return}
  const start=this.world.standPosition(),target=player.position
  if(!start)return
  if(flatDistance(this.world.position,target)<2.2&&Math.abs(this.world.position.y-target.y)<.6){this.route=null;this.state='following';this.reason='Close to the followed player.';return}
  if(!force&&this.route?.length&&this.followTarget&&flatDistance(this.followTarget,target)<1&&!this.progress.stalled(now))return
  if(!force&&now-(this.lastFollowPlan||0)<1000)return
  this.followTarget={...target}
  this.lastFollowPlan=now
  const candidates=[]
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let dy=-5;dy<=5;dy++){
   const p={x:Math.floor(target.x)+dx,y:start.y+dy,z:Math.floor(target.z)+dz}
   if(this.world.walkable(p,{allowWater:true}))candidates.push(p)
  }
  candidates.sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)+Math.abs(a.y-(target.y-1.62))-Math.hypot(b.x-target.x,b.z-target.z)-Math.abs(b.y-(target.y-1.62)))
  if(candidates.length){const goal=candidates[0];if(this.lastFollowGoal!==key(goal)){this.lastFollowGoal=key(goal);this.recoveryAttempts=0}this.job.goal=goal}
  for(const goal of candidates.slice(0,4)){
   const plan=this.routeTo(goal,start,{allowSteps:true,maxNodes:768,allowDirt:true})
   if(plan.ok){this.job.goal=goal;this.assignRoute(plan);return}
  }
  if(candidates.length){const goal=candidates[0],dirt=new Building(this.world).inventory('dirt').reduce((n,[,i])=>n+i.count,0),rise=goal.y-start.y;if(rise>=2&&rise<=4&&dirt>=rise){this.pillar=new Pillaring(this,rise);this.route=null;return}const adjacent={x:start.x+Math.sign(goal.x-start.x)*(Math.abs(goal.x-start.x)>=Math.abs(goal.z-start.z)?1:0),y:start.y-1,z:start.z+Math.sign(goal.z-start.z)*(Math.abs(goal.x-start.x)<Math.abs(goal.z-start.z)?1:0)},gap=this.world.airAt(adjacent);if((rise>=2&&rise<=4&&dirt<rise||gap&&dirt<2)&&this.onNeedDirt?.(this.job.name,Math.max(2,rise)))return}
  if(candidates.length&&this.recoveryAttempts<3&&this.recover('No open route to the followed player.',now))return
  this.route=null;const detail=this.lastClearanceBlock;const terrainKnown=this.world.terrainKnown({x:target.x,y:target.y,z:target.z});this.state=terrainKnown?'blocked':'waiting-for-terrain';this.reason=terrainKnown?'No safe jump, dirt route or permitted mining route is available; waiting for terrain or player movement.':'Terrain near the player is unknown; requesting terrain before planning a route.';if(detail)this.reason+=' '+detail;if(!terrainKnown)try{this.world.requestNearby(this.client)}catch{}
 }
 // Replan the same continuous Follow task, preserving the single active job.
 retryBlockedFollow(){
  if(this.job?.kind!=='follow'||!['blocked','waiting-for-terrain'].includes(this.state))return {accepted:false,queued:false,message:'No blocked Follow job is available. Do not start a duplicate Follow.'}
  if(!this.client||!this.spawned||!this.world.position)return {accepted:false,queued:false,message:'Realm spawn/position unavailable.'}
  try{this.world.requestNearby(this.client)}catch(e){return {accepted:false,queued:false,message:'Terrain refresh could not be requested: '+String(e.message||e)}}
  if(!this.world.terrainKnown())return {accepted:false,queued:false,message:'Requested missing nearby terrain. Try Again when the server sends those chunks; original Follow stays active.'}
  const gate=this.movementBlock();if(gate)return {accepted:false,queued:false,message:'Still blocked: '+gate}
  this.blocked.clear();this.progress.reset();this.recoveryAttempts=0;this.lastClearanceBlock=null;this.lastFollowGoal=null;this.lastFollowPlan=0
  this.updateFollow(Date.now(),true)
  const blocked=['blocked','waiting-for-terrain'].includes(this.state)
  return {accepted:!blocked,queued:!blocked,message:blocked?`Follow remains blocked after refreshing terrain: ${this.reason}`:`Following ${this.job.name}: route recalculated using current server terrain. The original Follow job was preserved.`,navigation:this.snapshot()}
 }
  mine(position,options={}){
  if(this.world.attributes['minecraft:health']===0||this.isRespawning?.())return {accepted:false,queued:false,message:'Respawn must be confirmed before mining.'}
  if(!this.world.editModeVerified)return {accepted:false,queued:false,message:'This player’s Survival or grounded Creative mode and abilities are not verified; mining is paused.'}
  if(!this.spawned||!this.client)return {accepted:false,queued:false,message:'Join and spawn first.'}
  this.stop('',false);this.progress.reset();const result=this.mining.begin(position,{...options,explicit:true});if(result.accepted){this.job={kind:'mine',allowMining:true,gameMode:this.world.gameMode};this.state='mining'}return result
 }
 build(descriptor){
  if(this.world.attributes['minecraft:health']===0||this.isRespawning?.())return {accepted:false,queued:false,message:'Respawn must be confirmed before building.'}
  if(!this.spawned||!this.client)return {accepted:false,queued:false,message:'Join and spawn first.'}
  if(!this.world.editModeVerified)return {accepted:false,queued:false,message:'Actual block placement requires this player’s verified Survival or grounded Creative mode and abilities.'}
  if(this.job)return {accepted:false,queued:false,message:'Stop the active job before building.'}
  const result=this.building.begin(descriptor)
  if(result.accepted){this.progress.reset();this.job={kind:'build',allowMining:false,gameMode:this.world.gameMode};this.state='building'}
  return result
 }
 collectNearby({names=null}={}){
  if(this.job)return {accepted:false,queued:false,message:'Finish or Stop the current job before collecting.'}
  const blocked=this.movementBlock();if(blocked)return {accepted:false,queued:false,message:blocked}
  if(!this.world.inventoryKnown)return {accepted:false,queued:false,message:'Waiting for server inventory.'}
  const drop=nearestDrop(this.world,{range:9,names});if(!drop)return {accepted:false,queued:false,message:'No identifiable dropped item observed within nine blocks.'}
  const p={x:Math.floor(drop.position.x),y:Math.floor(drop.position.y),z:Math.floor(drop.position.z)}
  const goals=[p,{...p,y:p.y+1},{...p,y:p.y-1}].filter(q=>this.world.walkable(q))
  const route=goals.map(q=>this.routeTo(q,this.world.standPosition(),{allowDirt:false})).find(x=>x.ok)
  if(!route)return {accepted:false,queued:false,message:'No safe observed walking route to the dropped item.'}
  const result=this.pickup.begin(drop);if(!result.accepted)return result
  this.startedAt=Date.now();this.progress.reset();this.job={kind:'solo',goal:route.path.at(-1),pickup:true,allowMining:false};this.assignRoute(route)
  return result
 }
 beginSurvey(now=Date.now()){
  if(!this.spawned||!this.client||!this.world.position)return {accepted:false,queued:false,message:'Join and spawn before looking around.'}
  if(this.job||this.survey)return {accepted:false,queued:false,message:'A task or survey is already running. Stop it before scanning.'}
  if(!this.world.terrainKnown())return {accepted:false,queued:false,message:'Waiting for nearby terrain before scanning.'}
  this.survey={startYaw:this.yaw||0,step:0,lastAt:now-300,startedAt:now,seen:new Set(),counts:new Map(),nearest:[],state:'turning'}
  return {accepted:true,queued:true,message:'Starting an actual 360-degree turn in twelve 30-degree steps. Each view checks line-of-sight against received terrain; nothing hidden behind opaque blocks is claimed visible.'}
 }
 surveyTick(now){
  const survey=this.survey
  if(!survey||now-survey.lastAt<300||this.job)return
  survey.lastAt=now
  if(survey.step>=12){
   this.yaw=survey.startYaw;const names=[...survey.counts].sort((a,b)=>b[1]-a[1]).slice(0,8)
   this.report('360-degree scan finished: '+(names.map(([name,count])=>name+' x'+count).join(', ')||'no exposed blocks were verifiable')+'. Hidden blocks were excluded; this is observed terrain, not an x-ray.')
   this.survey=null;return
  }
  this.yaw=(survey.startYaw+survey.step*30)%360
  const sector=this.world.scan(null,{yaw:this.yaw,fov:34,range:8})
  this.onSurveySector?.(this.yaw,now)
  for(const v of sector.found){const k=key(v);if(survey.seen.has(k))continue;survey.seen.add(k);survey.counts.set(v.name,(survey.counts.get(v.name)||0)+1)}
  survey.step++
 }
 defend(now){
  const danger=nearbyHostiles(this.world,7)
  if(!danger.length){if(this.defense.state!=='idle')this.defense={...this.defense,state:'idle',threat:null,strikes:0,attackedId:null};return}
  const close=danger[0]
  this.defense.threat={type:close.type,distance:+close.distance.toFixed(1)}
  if(close.distance>5.5||this.world.gameMode!=='survival'||this.isRespawning?.()||!this.world.movementVerified||!this.world.grounded())return
  // Prefer a bounded melee defense only for verified, visible hostile mobs.
  // A sent transaction is never reported as a confirmed kill.
  const target=meleeTarget(this.world)
  if(target&&this.defense.strikes<4){
   if(now-this.defense.lastStrike<850)return
   const packet=meleePacket(this.world,target)
   if(packet){
    if(this.defense.attackedId!==target.id){this.defense.strikes=0;this.defense.attackedId=target.id}
    if(this.defense.state!=='fighting'){this.onThreat?.('Hostile mob within melee reach; interrupting work for defense.');this.stop('',false)}
    try{this.lookAt({x:target.position.x,y:target.position.y+.9,z:target.position.z});this.client.queue('inventory_transaction',packet)
      this.defense.strikes++;this.defense.lastStrike=now;this.defense.state='fighting';this.defense.reason='Sent melee attack '+this.defense.strikes+'/4 toward observed hostile; hit and kill unverified.';return
    }catch(e){this.defense.reason='Melee packet rejected locally; falling back to escape.';this.defense.strikes=4}
   }
  }
  if(now-this.defense.lastAttempt<3500)return
  this.defense.lastAttempt=now
  const escape=safestEscape(this,danger)
  if(!escape){this.defense.state='trapped';this.defense.reason='Hostile mob nearby; no safe observed escape route. No teleport or blind digging attempted.';this.report(this.defense.reason);return}
  this.onThreat?.(`Threat: ${close.type} within ${close.distance.toFixed(1)} blocks. Interrupting work and escaping.`)
  this.stop('',false)
  this.survey=null
  this.progress.reset();this.recoveryAttempts=0;this.blocked.clear();this.startedAt=now
  this.job={kind:'solo',goal:escape.goal,allowMining:false,defense:true}
  this.assignRoute(escape.plan)
  this.defense.state='evading';this.defense.reason=`Evading ${close.type} along received terrain. No combat packet sent.`
  this.report(this.defense.reason)
 }
 queueUse(transaction,aim){if(this.pendingUse||this.mining.job||this.building.job||this.climbing.current)return false;this.pendingUse=transaction;if(aim)this.lookAt(aim);return true}
 clearanceMessage(issue,context='Player clearance'){const at=issue.position,description=issue.kind.startsWith('unknown')?'missing terrain/collision data':issue.kind==='unsupported'?'no safe floor':issue.kind==='hazard'?'hazardous '+issue.name:'solid '+issue.name;this.lastClearanceBlock=`${context}: ${description} at ${at.x},${at.y},${at.z}.`;return this.lastClearanceBlock}
 lookAt(target){const eye=this.world.position,dx=target.x-eye.x,dy=target.y-eye.y,dz=target.z-eye.z;this.yaw=Math.atan2(-dx,dz)*180/Math.PI;this.pitch=-Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI}
 obstacleAhead(){
  const a=this.world.standPosition(),goal=this.route?.[0]||this.job?.goal
  if(!a||!goal)return null
  const dx=goal.x-a.x,dz=goal.z-a.z
  if(!dx&&!dz)return null
  const p={x:a.x+(Math.abs(dx)>=Math.abs(dz)?Math.sign(dx):0),y:a.y,z:a.z+(Math.abs(dx)<Math.abs(dz)?Math.sign(dz):0)}
  const foot=this.world.block(p),head=this.world.block({...p,y:p.y+1})
  if(head&&!['air','cave_air','void_air'].includes(head.name)&&(foot&&['air','cave_air','void_air'].includes(foot.name)||!this.world.visible(p)&&this.world.visible({...p,y:p.y+1})))p.y++
  return p
 }
 recover(reason,now=Date.now()){
  if(!this.job||this.flight||this.mining.job||this.climbing.current||this.building.job)return false
  const a=this.world.standPosition(),obstacle=this.obstacleAhead(),goal=this.job.goal
  if(!a||!obstacle||!goal){if(this.job.kind==='follow'){this.route=null;this.state='blocked';this.reason=reason}else this.stop(reason);return false}
  const landing={...obstacle,y:a.y+1},canJump=!(this.blocked.get(key(landing))>now)&&this.world.canJumpBetween?.(a,landing)
  // Temporarily exclude the troublesome cell even when the local block cache says air.
  this.blocked.set(key(obstacle),now+30000);while(this.blocked.size>32)this.blocked.delete(this.blocked.keys().next().value)
  const detour=canJump?{ok:false}:this.routeTo(goal,a,{allowSteps:true,allowDirt:true})
  const mine=this.job.allowMining?miningAssessment(this.world,obstacle):null
  const decision=recoveryDecision({mode:this.job.kind,canJump,hasDetour:detour.ok,mine,allowMining:this.job.allowMining,attempts:this.recoveryAttempts})
  this.recoveryAttempts++;this.lastRecoveryPosition={...this.world.position};this.progress.reset();const front=this.world.block(obstacle),detail=decision.action==='pause'&&mine?.reason?` Front block ${front?.name||'unknown'} at ${key(obstacle)}: ${mine.reason}`:'';this.note(decision.action,reason+' '+decision.reason+detail)
  if(decision.action==='jump'){
   this.routeAlignment=null;this.route=[landing];this.afterJumpGoal=goal;this.beginFlight(landing,'jump',now);return true
  }
  if(decision.action==='detour'){this.assignRoute(detour);return true}
  if(decision.action==='mine'){
   const result=this.mining.begin(obstacle,{},now)
   if(result.accepted){this.route=null;this.state='mining-obstacle';this.clearing=obstacle;return true}
   this.note('pause',result.message)
  }
  if(this.job?.kind==='follow'){this.route=null;this.state='blocked'}else this.stop(this.reason);return false
 }
 // A clearance change during an otherwise legal jump is not a STOP command.
 // Preserve the job, land under ordinary collision physics, then route around
 // the failed landing cell. There is no collision bypass or blind second jump.
 deferFlightRecovery(reason,now=Date.now()){
  if(!this.flight)return false
  const landing=this.flight.target
  const goal=this.afterJumpGoal||this.job?.goal
  this.flight=null;this.afterJumpGoal=null;this.route=null;this.routeAlignment=null
  this.blocked.set(key(landing),now+5000)
  this.vy=Math.min(0,this.vy||0)
  this.pendingFlightRecovery={goal,started:now,landing,attempted:false}
  this.state='landing-for-replan'
  this.note('land-and-replan',`${reason} Landing and checking another route; existing task preserved.`)
  return true
 }
 resumeFlightRecovery(now=Date.now()){
  const recovery=this.pendingFlightRecovery
  if(!recovery||!this.job)return
  if(!this.world.terrainKnown()){
   try{this.world.requestNearby(this.client)}catch{}
   return
  }
  if(!this.world.grounded()){
   if(now-recovery.started>4500){this.pendingFlightRecovery=null;this.stop('Could not verify landing after blocked jump.');}
   return
  }
  if(now-recovery.started<100)return
  this.pendingFlightRecovery=null
  const start=this.world.standPosition(),goal=recovery.goal
  if(!start||!goal){this.state='blocked';this.reason='Landing confirmed but no observed route goal remains.';return}
  this.recoveryAttempts++
  const plan=this.routeTo(goal,start,{allowSteps:true,allowDirt:this.job.kind==='follow'})
  if(plan.ok){this.progress.reset();this.assignRoute(plan);return}
  this.route=null;this.state='blocked'
  this.reason='Landed after jump was blocked; no alternate observed route yet. '+plan.reason
  this.report(this.reason)
 }
 beginFlight(target,kind,now=Date.now()){
  const a=this.world.standPosition()
  if(!a||!this.world.grounded())return false
  if(kind==='jump'?!this.world.canJumpBetween?.(a,target):!this.world.canDropBetween?.(a,target,{maxDrop:this.job?.maxDrop||(this.job?.kind==='follow'?5:1)}))return false
  this.yaw=Math.atan2(-(target.x+.5-this.world.position.x),target.z+.5-this.world.position.z)*180/Math.PI
  this.flight={target:{...target},kind,vy:kind==='jump'?.42:0,started:now,first:true};this.state=kind==='jump'?'jumping':'stepping-down';return true
 }
 flightStep(now){
  const f=this.flight,p=this.world.position,zero={delta:{x:0,y:0,z:0},move:{x:0,z:0},flags:[]}
  if(!f)return zero
  if(now-f.started>2000){this.flight=null;this.stop('Jump/drop did not finish; stopped instead of retrying blindly.');return zero}
  const landing=f.target,dx=landing.x+.5-p.x,dz=landing.z+.5-p.z,d=Math.hypot(dx,dz),speed=Math.min(.1,d)
  const desired={x:p.x+(d?dx/d*speed:0),y:p.y+f.vy,z:p.z+(d?dz/d*speed:0)},floorY=(this.world.supportHeight(landing)??landing.y)+1.62
  const clearTravel=to=>{const distance=Math.hypot(to.x-p.x,to.y-p.y,to.z-p.z),steps=Math.max(1,Math.ceil(distance/.05));for(let i=1;i<=steps;i++)if(!this.world.clearBody({x:p.x+(to.x-p.x)*i/steps,y:p.y+(to.y-p.y)*i/steps,z:p.z+(to.z-p.z)*i/steps}))return false;return true}
  if(f.vy<=0&&desired.y<=floorY&&Math.abs(desired.x-(landing.x+.5))<.35&&Math.abs(desired.z-(landing.z+.5))<.35&&this.world.walkable(landing)){
   desired.y=floorY
   if(clearTravel(desired)){const delta={x:desired.x-p.x,y:desired.y-p.y,z:desired.z-p.z};this.world.position=desired;this.flight=null;this.state='walking';if(this.afterJumpGoal){const goal=this.afterJumpGoal;this.afterJumpGoal=null;const plan=this.routeTo(goal,this.world.standPosition(),{allowSteps:true,allowDirt:true});if(plan.ok)this.assignRoute(plan);else this.route=null}return {delta,move:{x:0,z:1},flags:[]}}
  }
  let next=desired
  if(!clearTravel(next)){
   const vertical={...p,y:desired.y},horizontal={...p,x:desired.x,z:desired.z}
   if(clearTravel(vertical))next=vertical
   else if(f.vy>0&&this.world.bodyIssue(vertical)?.kind==='solid'&&this.world.bodyIssue(vertical).position.y>=Math.floor(p.y+.18)){
    let low=0,high=1;for(let i=0;i<22;i++){const mid=(low+high)/2;if(clearTravel({...p,y:p.y+(vertical.y-p.y)*mid}))low=mid;else high=mid}
    const capped={...p,y:p.y+(vertical.y-p.y)*low},across={...desired,y:capped.y};next=clearTravel(across)?across:capped;f.vy=0
   }else if(f.kind==='drop'&&clearTravel(horizontal)){next=horizontal;f.vy=0}
   else{this.deferFlightRecovery('Jump clearance changed.',now);return zero}
  }
  const flags=f.first&&['jump','pillar'].includes(f.kind)?['start_jumping','jump_down','jumping']:['jump','pillar'].includes(f.kind)?['jumping']:[];f.first=false
  const delta={x:next.x-p.x,y:next.y-p.y,z:next.z-p.z};this.world.position=next;f.vy=(f.vy-.08)*.98
  return {delta,move:{x:0,z:1},flags}
 }
 stop(reason='Stopped moving and mining.',notify=true){
  const active=!!this.job||this.route!==null||!!this.flight||!!this.mining.job
  if(this.flight)this.vy=this.flight.vy
  this.routeAlignment=null;this.pillar=null;this.pendingUse=null;this.route=null;this.job=null;this.flight=null;this.pendingFlightRecovery=null;this.afterJumpGoal=null;this.clearing=null;this.state='stopped';this.reason=reason
  if(this.edgeSneaking){this.pendingFlags.push('stop_sneaking');this.edgeSneaking=false}
  this.pickup.stop();this.mining.cancel(reason);this.building.cancel(reason);this.climbing.cancel(reason);this.survey=null
  // Send neutral input now, including abort_break, rather than waiting for the next timer tick.
  if(active&&this.spawned&&this.client&&!this.stopping){this.stopping=true;try{this.step(Date.now())}finally{this.stopping=false}}
  if(active&&notify&&reason)this.report(reason)
 }
 step(now=Date.now()){
  if(this.inStep)return;this.inStep=true
  const workStarted=Date.now()
  try{this.inputStep(now)}
  catch(e){
   if(now-(this.lastStepFailure||0)>5000){this.lastStepFailure=now;this.reportRuntimeError?.(e);this.report('Movement engine encountered an error and stopped the current action. Export a Bug report ZIP for its source location.')}
   try{this.stop('Movement input failed; no unverified action should continue.',false)}catch{}
  }finally{this.lastWorkDurationMs=Math.max(0,Date.now()-workStarted);this.maxWorkDurationMs=Math.max(this.maxWorkDurationMs||0,this.lastWorkDurationMs);this.inStep=false}
 }
 inputStep(now=Date.now()){
  if(!this.spawned||!this.client||!this.world.position)return
  this.lastSchedulingGapMs=this.lastInputAt?Math.max(0,now-this.lastInputAt-(this.lastWorkDurationMs||0)):0
  if(this.lastSchedulingGapMs>500&&this.lastInputAt&&(this.job||this.flight)){const reason='Phone paused outside the movement loop; work stopped.';this.onSchedulingPause?.(reason);this.stop(reason)}
  this.lastInputAt=now
  if(this.checkRespawn?.(now)){
   this.externalMotion=null;this.vy=0
   // The ordinary movement/physics loop pauses on death, but nearby chunk
   // requests must not be starved through the respawn handshake.
   if(this.world.enabled&&this.world.position&&now-(this.lastRespawnTerrainRequest||0)>=1000){
    this.lastRespawnTerrainRequest=now
    try{if(!this.world.terrainKnown())this.world.requestNearby(this.client)}catch(e){this.reportRuntimeError?.(e)}
   }
   return
  }
  try{this.finishLoading()}catch(e){this.stop('Loading acknowledgement failed: '+String(e.message||e).slice(0,100));this.detach();return}
  this.checkVerification?.()
  this.defend(now)
  this.surveyTick(now)
  const health=this.world.attributes['minecraft:health']
  if(health===0){this.stop('Player died; work stopped.');return}
  if(this.job&&health!==undefined&&health<=6)this.stop('Health is low; work stopped.')
  if(this.job&&((['mine','build'].includes(this.job.kind)&&(this.job.gameMode!==this.world.gameMode||!this.world.editModeVerified))||(!['mine','build'].includes(this.job.kind)&&!this.world.movementVerified)))this.stop('Server mode or required movement abilities changed; work stopped.')
  if(this.job&&this.world.inputLocks?.move)this.stop('The server locked movement; work stopped until it unlocks.')
  if(this.job&&!this.world.enabled)this.stop('View is off; work stopped.')
  if(this.job?.kind==='solo'&&now-this.startedAt>60000)this.stop('Travel time limit reached.')
  if(this.clearing&&!this.mining.job){
   const goal=this.job?.goal
   if(this.mining.result==='confirmed'&&goal){this.blocked.delete(key(this.clearing));this.clearing=null;this.recoveryAttempts=0;const plan=this.routeTo(goal,this.world.standPosition(),{allowDirt:true});if(plan.ok)this.assignRoute(plan);else this.recover(plan.reason,now)}
   else if(this.mining.result==='cancelled')this.stop(this.mining.reason)
  }
  if(!this.world.terrainKnown(this.world.position)){
   this.unknownSince??=now
   try{this.world.requestNearby(this.client)}catch{}
   if(now-this.unknownSince>=5000){this.stop('Terrain/clearance could not be verified after five seconds; disconnecting with saved login preserved.');this.report(this.reason);this.client.disconnect?.(this.reason);this.client.close?.();this.detach();return}
  }else this.unknownSince=null
  const portal=this.portalControl?.(now)
  const hazard=this.job?.waterRouting&&this.shallowWading()?null:this.hazards.control(now)
  this.updateFollow(now)
  this.resumeFlightRecovery(now)
  if(this.pickup.target){
    try{this.pickup.tick(now,this.client)}catch(e){this.pickup.state='failed';this.pickup.reason='Pickup packet could not be sent: '+String(e.message||e).slice(0,90);this.pickup.target=null}
    if(!this.pickup.target){this.report(this.pickup.reason);if(this.job?.pickup){this.job=null;this.route=null}}
  }
  let delta={x:0,y:0,z:0},move={x:0,z:0},flags=[]
  let construction=this.pillar?this.pillar.control(now):this.route?.length?this.climbing.beforeStep(this.route[0],now):{}
  if(construction.error){this.stop(construction.error);construction={waiting:true}}
  if(portal?.active){({delta,move,flags}=portal)}else if(hazard?.active){({delta,move,flags}=hazard)}else if(construction.edgeApproach){
   const p=this.world.position,e=construction.edgeApproach,d=Math.hypot(e.x-p.x,e.z-p.z),speed=Math.min(.035,d),next={x:p.x+(d?(e.x-p.x)/d*speed:0),y:p.y,z:p.z+(d?(e.z-p.z)/d*speed:0)}
   if(!this.world.clearBody(next)||!this.world.grounded(next)){this.stop('Bridge edge lost collision support; stopped.');construction={waiting:true}}
   else{delta={x:next.x-p.x,y:0,z:next.z-p.z};this.world.position=next;move={x:0,z:1};this.state='approaching-bridge-edge'}
  }else if(this.flight){({delta,move,flags}=this.flightStep(now))}
  else if(this.route?.length&&!this.externalMotion&&!this.pendingFlightRecovery&&!construction.waiting&&!this.mining.job&&(this.world.grounded()||this.shallowWading())){
   const target=this.route[0],a=this.world.standPosition(),p=this.world.position
   if(this.routeAlignment&&Math.abs(p[this.routeAlignment.axis]-this.routeAlignment.value)>.025){
    const {axis,value}=this.routeAlignment,next={...p,[axis]:p[axis]+Math.sign(value-p[axis])*Math.min(.215,Math.abs(value-p[axis]))},issue=this.job?.waterRouting&&this.world.shallowWater(this.world.standPosition())?this.world.bodyIssue(next,{allowWater:true}):this.world.standingIssue(next)
    if(issue)this.recover(this.clearanceMessage(issue,'Route alignment'),now)
    else{this.lastClearanceBlock=null;delta={x:next.x-p.x,y:0,z:next.z-p.z};this.world.position=next;move={x:0,z:1};this.state='walking'}
   }else if(target.y!==a.y){this.routeAlignment=null
    if(!this.beginFlight(target,target.y>a.y?'jump':'drop',now))this.recover('Step height or headroom is blocked.',now)
    else({delta,move,flags}=this.flightStep(now))
   }else if(!this.world.walkable(target,{allowWater:!!this.job?.waterRouting}))this.recover('Obstacle appeared on the route.',now)
   else{
    const dx=target.x+.5-p.x,dz=target.z+.5-p.z,d=Math.hypot(dx,dz)
    if(d<.07){this.route.shift();if(!this.route.length){this.route=null;this.state='arrived-predicted';this.arrivedAt=now;this.reason='Route inputs finished; server movement confirmation may still be pending.'}}
    else{
     const speed=Math.min(.215,d),next={x:p.x+dx/d*speed,y:p.y,z:p.z+dz/d*speed}
     const height=this.world.supportHeight(target)
     if(!this.world.clearBody(next)&&height!==null&&height+1.62>p.y&&height+1.62-p.y<=1&&this.world.clearBody({...p,y:height+1.62}))next.y=height+1.62
     const wading=!!this.job?.waterRouting&&(this.shallowWading()||this.world.shallowWater(target))
     const issue=wading?this.world.bodyIssue(next,{allowWater:true}):this.world.standingIssue(next)
     if(issue)this.recover(this.clearanceMessage(issue),now)
     else{this.lastClearanceBlock=null;delta={x:next.x-p.x,y:next.y-p.y,z:next.z-p.z};this.world.position=next;move={x:0,z:1};this.state='walking'}
    }
   }
  }
  if(construction.sneak){flags.push('sneaking','sneak_down');if(!this.edgeSneaking)flags.push('start_sneaking');this.edgeSneaking=true}else if(this.edgeSneaking){flags.push('stop_sneaking');this.edgeSneaking=false}
  if(move.z){this.progress.commanded(Math.hypot(delta.x,delta.z));if(delta.x||delta.z)this.yaw=Math.atan2(-delta.x,delta.z)*180/Math.PI}
  if(this.externalMotion){const impulse=this.applyMotion(now);delta.x+=impulse.x;delta.z+=impulse.z}
  if(!this.flight&&!hazard?.active&&!portal?.active){
   const p=this.world.position
   if(this.vy<=0&&(this.world.grounded()||this.job?.waterRouting&&this.shallowWading())){this.vy=0;flags.push('vertical_collision')}
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
  if(this.pillar)construction={...construction,...this.pillar.afterPhysics(now)}
  if(this.job?.kind==='build'&&!this.route?.length&&!this.flight){
   construction=this.building.tick(now,goal=>this.routeTo(goal,this.world.standPosition(),{allowSteps:true,maxNodes:768}))
   if(construction.route){this.job.goal=construction.route.path.at(-1);this.assignRoute(construction.route)}
   if(!this.building.job){this.state=this.building.state;this.reason=this.building.reason;this.job=null;this.route=null}
  }
   if(construction.selectSlot!==undefined){const slot=construction.selectSlot,held=this.world.inventory.get(slot);try{this.client.queue('player_hotbar',{selected_slot:slot,window_id:'inventory',select_slot:true});this.client.queue('mob_equipment',{runtime_entity_id:BigInt(this.world.entityId),item:held,slot,selected_slot:slot,window_id:'inventory'});this.world.selectedSlot=slot;const builder=this.climbing.current?this.climbing.builder:this.building;if(builder.job)builder.job.equipWaitUntil=now+150}catch(e){this.stop('Equipment update failed; building stopped.');return}}
   if(construction.aim)this.lookAt(construction.aim)
  if(this.mining.job){const m=this.mining.job;this.lookAt({x:m.position.x+m.click.x,y:m.position.y+m.click.y,z:m.position.z+m.click.z})}
  const mining=this.mining.tick(now)
  const legacyBreaking=this.world.serverAuthoritativeBreaking===false
  const standaloneActions=legacyBreaking?mining.actions:[]
  const standaloneTransaction=legacyBreaking&&mining.transaction?{legacy:mining.transaction.legacy,transaction_type:'item_use',actions:mining.transaction.actions,transaction_data:mining.transaction.data}:null
  if(legacyBreaking){mining.actions=[];mining.transaction=null}
  // Placement follows inventory authority, independently of the mining protocol.
  // Carry the use-item click in this tick's input on modern servers, exactly once.
  if(this.pendingUse&&!construction.placement&&!mining.transaction){construction.placement=this.pendingUse;this.pendingUse=null}
  const embeddedPlacement=construction.placement&&this.world.serverAuthoritativeInventory!==false
  const placementTransaction=embeddedPlacement?{legacy:construction.placement.legacy,actions:construction.placement.actions,data:construction.placement.transaction_data}:null
  if(placementTransaction&&mining.transaction){this.stop('Conflicting mining and placement controls; no placement sent.');return}
  const inputTransaction=placementTransaction||mining.transaction
  if(mining.actions.length)flags.push('block_action')
  if(inputTransaction)flags.push('item_interact')
  if(this.job?.kind==='mine'&&!this.mining.job){this.state=this.mining.result;this.reason=this.mining.reason;this.job=null}
  if(this.job?.kind==='solo'&&this.arrivedAt&&!this.job.pickup&&now-this.arrivedAt>10000){this.job=null;this.report('Route inputs finished. No further movement queued.')}
  try{
   this.client.queue('player_auth_input',{pitch:this.pitch||0,yaw:this.yaw||0,position:{...this.world.position},move_vector:move,head_yaw:this.yaw||0,input_data:[...new Set([...(move.z?['up']:[]),'received_server_data',...flags,...this.pendingFlags.splice(0)])],input_mode:'touch',play_mode:'normal',interaction_model:'crosshair',interact_rotation:{x:this.pitch||0,z:this.yaw||0},tick:++this.tick,delta,transaction:inputTransaction,item_stack_request:null,block_action:mining.actions.length?mining.actions:null,vehicle_rotation:null,predicted_vehicle:null,analogue_move_vector:move,camera_orientation:{x:-Math.sin((this.yaw||0)*Math.PI/180)*Math.cos((this.pitch||0)*Math.PI/180),y:-Math.sin((this.pitch||0)*Math.PI/180),z:Math.cos((this.yaw||0)*Math.PI/180)*Math.cos((this.pitch||0)*Math.PI/180)},raw_move_vector:move})
   for(const a of standaloneActions)this.client.queue('player_action',{runtime_entity_id:BigInt(this.world.entityId),action:a.action,position:a.position,result_position:a.position,face:a.face})
   if(standaloneTransaction)this.client.queue('inventory_transaction',{transaction:standaloneTransaction})
   if(construction.placement&&!embeddedPlacement)this.client.queue('inventory_transaction',{transaction:construction.placement})
   if(now-this.lastRequestAt>5000){this.lastRequestAt=now;this.world.requestNearby(this.client)}
  }catch(e){this.stop('Input packet failed: '+String(e.message||e).slice(0,100));this.detach()}
  try{this.onResourceTick?.(now)}catch(e){this.reportRuntimeError?.(e);this.stop('Internal resource task error.');this.onResourceError?.(e)}
 }
 snapshot(){return {pillar:this.pillar?{confirmed:this.pillar.done,total:this.pillar.rise,phase:this.pillar.phase}:null,environmentRecovery:this.hazards.snapshot(),state:this.state,mode:this.job?.kind||'idle',following:this.job?.kind==='follow'?this.job.name:null,remaining:this.route?.length||0,flightRecovery:this.pendingFlightRecovery?{state:this.state,landing:this.pendingFlightRecovery.landing}:null,reason:this.reason,waterRisk:{shallowWading:this.shallowWading(),crossingPlanned:!!this.job?.waterRouting,maxConsecutiveWaterBlocks:8,deepWaterSupported:false},physics:{grounded:this.world.grounded(),terrainKnown:this.world.terrainKnown(),bodyClear:this.world.position?this.world.clearBody(this.world.position):false,feetY:this.world.position?this.world.position.y-1.62:null,verticalVelocity:this.vy,serverGrounded:this.world.serverGrounded??null,lastServerFeedbackAt:this.lastServerTick===null||this.lastServerTick===undefined?null:this.lastPoseAt,inputLocks:{...this.world.inputLocks},loading:this.loading?.state||'not-started'},progress:this.progress.snapshot(),building:this.building.snapshot(),climbing:this.climbing.snapshot(),mining:this.mining.snapshot(),decisions:this.decisions,pickup:this.pickup.snapshot(),survey:this.survey?{state:this.survey.state,step:this.survey.step,total:12,visibleBlocks:this.survey.seen.size}:null,defense:{...this.defense}}}
 detach(){this.externalMotion=null;this.motionTick=undefined;this.followTarget=null;this.routeAlignment=null;this.lastClearanceBlock=null;this.pillar=null;this.portalControl=null;this.pendingUse=null;this.hazards=new HazardRecovery(this);if(this.timer)clearInterval(this.timer);this.timer=null;for(const [e,f] of this.listeners)this.client?.off(e,f);this.listeners=[];this.route=null;this.job=null;this.flight=null;this.pendingFlightRecovery=null;this.pendingFlags=[];this.pickup.reset();this.mining.reset();this.building.reset();this.climbing.reset();this.spawned=false;this.edgeSneaking=false;this.lastFollowGoal=null;this.unknownSince=null;this.vy=0;this.loading=null;this.lastServerTick=null;this.survey=null;this.defense={lastAttempt:0,state:'idle',reason:'',threat:null}}
}
