// Walk a bounded displacement in one compass direction using *observed* routes.
// Scan and privately remember visible landmarks along the way and at the end.
const DIRS={north:{x:0,z:-1},south:{x:0,z:1},east:{x:1,z:0},west:{x:-1,z:0}}
export function parseExploreCommand(input){
 const text=String(input||'').trim().toLowerCase().replace(/[.!]+$/,'')
 const m=text.match(/^(?:roam|explore)(?:\s+(north|south|east|west))?(?:\s+(?:for\s+)?(?:30|thirty)\s+blocks?)?$/)
 return m?{direction:m[1]||null,distance:30}:null
}
export function cardinalFromYaw(yaw){const a=Number(yaw)*Math.PI/180;const x=-Math.sin(a),z=Math.cos(a);return Math.abs(x)>Math.abs(z)?{x:Math.sign(x),z:0}:{x:0,z:Math.sign(z)}}
const horizontal=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)
export class ExplorationJobs{
 constructor(controller,memory){this.controller=controller;this.memory=memory;this.active=null;this.last={state:'idle'}}
 get world(){return this.controller.world}
 get navigation(){return this.controller.navigation}
 start(raw){
  const request=parseExploreCommand(raw);if(!request)return null
  const w=this.world,n=this.navigation
  if(this.active||this.controller.resources?.active||n.job||n.survey)return {accepted:false,queued:false,message:'Stop the active job before roaming.'}
  const blocked=n.movementBlock();if(blocked)return {accepted:false,queued:false,message:blocked}
  if(!this.memory.scope)return {accepted:false,queued:false,message:'Waiting for the Realm identity; cannot store unscoped exploration memory.'}
  const start=w.standPosition();if(!start)return {accepted:false,queued:false,message:'Waiting for the server position.'}
  const heading=request.direction?DIRS[request.direction]:cardinalFromYaw(n.yaw||0)
  const now=Date.now()
  this.active={start:{...start},heading,distance:30,state:'planning',started:now,lastAt:0,walkStartedAt:0,poseAt:0,goal:null,progress:0,blockedSince:0,seenBefore:this.memory.entries.length,reason:'Preparing a safe observed route.'}
  this.memory.observe(w,{yaw:null,now})
  this.tick(now)
  return {accepted:true,queued:true,message:`Exploring up to 30 blocks ${request.direction||'in my current facing direction'}, scanning visible blocks along the route and turning 360° at the end. Stops on hazards or unknown routes; Stop cancels it.`,exploration:this.snapshot()}
 }
 cancel(reason='Exploration stopped.'){
  if(!this.active)return
  this.last={state:'interrupted',reason,progress:this.active.progress}
  this.active=null
 }
 finish(reason,state='blocked'){
  if(!this.active)return
  this.last={state,reason,progress:this.active.progress,remembered:this.memory.snapshot()};this.active=null
  this.controller.report?.(reason)
 }
 snapshot(){return this.active?{state:this.active.state,progress:this.active.progress,targetDistance:30,reason:this.active.reason,remembered:this.memory.snapshot()}:this.last}
 tick(now=Date.now()){
  const a=this.active,n=this.navigation,w=this.world
  if(!a||now-a.lastAt<200)return
  a.lastAt=now
  if(now-a.started>180000)return this.finish('Roaming reached the three-minute limit; last confirmed progress '+a.progress+' blocks.','timed-out')
  if(w.attributes['minecraft:health']===0||w.attributes['minecraft:health']>0&&w.attributes['minecraft:health']<=6||n.isRespawning?.())return this.finish('Roaming interrupted by death or low health.')
  if(n.defense?.state!=='idle'&&n.defense?.state!==undefined)return this.finish('Roaming interrupted by hostile-mob defense.')
  if(!w.enabled||!w.movementVerified)return this.finish('Roaming stopped because movement verification was lost.')
  if(a.state==='scanning'){
   if(n.survey)return
   return this.finish(`Exploration completed: ${a.progress}/30 blocks of confirmed directional progress. Remembered ${this.memory.snapshot().trees} tree location(s) and ${this.memory.snapshot().ores} ore location(s) in this Realm.`,`completed`)
  }
  if(a.state==='walking'){
   if(n.state==='stopped'||['failed','blocked'].includes(n.state))return this.finish('Roaming stopped: '+(n.reason||'movement interrupted')+'.')
   const p=w.serverPosition
   if(p&&n.lastPoseAt>a.poseAt&&horizontal(p,{x:a.goal.x+.5,z:a.goal.z+.5})<.55&&Math.abs(p.y-1.62-a.goal.y)<.6){
    a.progress=Math.min(30,Math.max(a.progress,Math.round((a.goal.x-a.start.x)*a.heading.x+(a.goal.z-a.start.z)*a.heading.z)))
    n.stop('',false)
    // Around each waypoint, remember exposed trees beside the route too.
    // Terrain line-of-sight remains checked; the final physical 360° turn is separate.
    this.memory.observe(w,{yaw:null,now})
    a.state='planning';a.goal=null;a.reason='Walking segment verified by server; scanning and continuing.'
   }else if(now-a.walkStartedAt>18000)return this.finish('Roaming stopped: server did not confirm movement to the next safe waypoint.')
   else return
  }
  if(a.state!=='planning')return
  if(a.progress>=30){
   const scan=n.beginSurvey(now)
   if(scan.accepted){a.state='scanning';a.reason='Reached the directional target; turning 360° and remembering visible landmarks.'}
   else this.finish('Arrived at exploration target; final scan could not begin: '+scan.message,'partial')
   return
  }
  if(n.job||n.survey)return this.finish('Another task took control; roaming interrupted.')
  const start=w.standPosition();if(!start)return
  const remaining=30-a.progress
  let chosen=null
  // Short, forward-directed waypoints; detours can move sideways but the
  // progress target always remains in the original compass direction.
  for(const d of [Math.min(6,remaining),Math.min(4,remaining),Math.min(2,remaining),1]){
   if(chosen)break
   for(const sideways of [0,1,-1,2,-2]){
    if(chosen)break
    const lateral={x:-a.heading.z,z:a.heading.x}
    for(const dy of [0,1,-1,2,-2]){
     const p={x:a.start.x+a.heading.x*(a.progress+d)+lateral.x*sideways,y:start.y+dy,z:a.start.z+a.heading.z*(a.progress+d)+lateral.z*sideways}
     if(!w.walkable(p))continue
     const plan=n.routeTo(p,start,{allowDirt:false,maxNodes:800})
     if(plan?.ok){chosen=p;break}
    }
   }
  }
  if(!chosen){
   try{w.requestNearby(n.client)}catch{}
   if(!a.blockedSince)a.blockedSince=now
   if(now-a.blockedSince>6500)return this.finish(`Explored ${a.progress}/30 blocks; next forward route was blocked or not observed. Remembered visible locations are saved.`,'partial')
   a.reason='Waiting for received terrain to plan the next safe forward segment.';return
  }
  a.blockedSince=0
  const began=n.walk(chosen,{allowMining:false})
  if(!began.accepted)return this.finish('Roaming stopped: '+began.message)
  a.goal=chosen;a.poseAt=n.lastPoseAt||0;a.walkStartedAt=now;a.state='walking';a.reason='Walking toward the next observed waypoint; awaiting server position.'
 }
}
