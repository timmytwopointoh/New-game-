// One explicitly owner-started test: safely follow the REAL named player,
// approach within ten blocks, then grant their freshly observed feet position
// as home. No guess from the locator marker, no teleport, no fake arrival.
// This runs entirely in the phone bot; a PC emulator can drive the same chat.
export const FIELD_TEST_COMMAND=/^(?:(?:start|run|try) (?:the |a )?(?:home )?field (?:test|trial)|(?:find|follow|come to|come find|come over to) me (?:and |then )(?:make|set|claim|build|start|use)(?: this| my| your| a| the)?(?: new)? home(?: spot| here)?(?: when (?:you are|you're|you get) (?:within|about|close enough|near) (?:10|ten) blocks)?|find me then (?:make|start|build) (?:your|a) home(?: here)?|find me and (?:start building|build your home|make this your home spot))$/i
// A natural alternative to the explicit test phrase, with the same
// owner-approval and fresh-position gate.
const NATURAL_HOME_TEST=/^(?:find|follow|come (?:find|to)) me (?:and |then )?(?:make this your (?:new )?home spot|set this as your (?:new )?home(?: spot)?|claim this (?:as your )?home(?: spot)?|build your home|start (?:your home|building))(?: when (?:you(?:'re| are)|you get) (?:within|about|near|close enough|close to) (?:10|ten) blocks)?$/i
export const isHomeFieldTestCommand=s=>FIELD_TEST_COMMAND.test(s)||NATURAL_HOME_TEST.test(s)
const safePosition=p=>p&&[p.x,p.y,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<30000000)
const ownerName=(c)=>{
 const owners=c?.connection?.config?.ownerPlayerNames||[]
 return owners.length===1&&typeof owners[0]==='string'&&owners[0].trim()?owners[0].trim():null
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)
// Read exact server-updated near-player positions. A remembered locator
// waypoint is useful to FOLLOW, but never sufficient to claim a home spot.
export function verifiedArrival(c,owner,{maxDistance=10,maxAgeMs=8000,now=Date.now(),started=0}={}){
 const w=c?.world,n=c?.navigation
 if(!c?.connection?.spawned)return {ok:false,reason:'Not spawned in the Realm.'}
 if(!w||!n||!Number.isSafeInteger(w.dimension))return {ok:false,reason:'Realm dimension not verified.'}
 if(!safePosition(w.serverPosition)||!Number.isFinite(n.lastPoseAt)||n.lastPoseAt<started||
   now-n.lastPoseAt<0||now-n.lastPoseAt>maxAgeMs)
  return {ok:false,reason:'Waiting for a fresh server-confirmed companion position.'}
 if(w.movementVerified!==true)return {ok:false,reason:'Movement has not been server-verified.'}
 const candidates=[...(w.players?.values?.()||[])].filter(p=>
  p?.name?.toLowerCase()===owner.toLowerCase()&&safePosition(p.position))
 if(candidates.length!==1)return {ok:false,reason:'Owner is not yet an unambiguous nearby player.'}
 const player=candidates[0],id=String(player.uniqueId??'')
 if(!/^-?\d+$/.test(id))return {ok:false,reason:'Owner entity identity has not been confirmed.'}
 const known=w.locator?.known?.get(id)
 if(!known||known.source!=='nearby-entity'||now-known.at<0||now-known.at>maxAgeMs||
   known.at<started||!safePosition(known.position))
  return {ok:false,reason:'Waiting for a fresh named, nearby owner position from the server.'}
 // The current player entity and named locator observation must agree.
 if(distance(known.position,player.position)>.35)
  return {ok:false,reason:'Owner position reports disagree; waiting for a new packet.'}
 const d=distance(w.serverPosition,known.position)
 if(d>maxDistance)return {ok:false,reason:'Owner still '+d.toFixed(1)+' blocks away.',distance:d}
 if(Math.abs(w.serverPosition.y-known.position.y)>4)
  return {ok:false,reason:'The owner is on a different height or floor.',distance:d}
 return {ok:true,owner:player.name,position:{...player.position},distance:d,
  dimension:w.dimension,source:'fresh-nearby-owner-and-server-position'}
}

export class CompanionFieldTrial{
 constructor(companion){this.companion=companion;this.clear()}
 clear(){this.state='idle';this.startedAt=0;this.owner=null;this.dimension=null;this.scope=null;this.reason='';this.result=null;this.lastTick=0}
 snapshot(){return {state:this.state,owner:this.owner,startedAt:this.startedAt,dimension:this.dimension,
  reason:this.reason,result:this.result?.accepted===true?{accepted:true,projectState:this.result?.project?.state}:null}}
 start(now=Date.now()){
  const c=this.companion.c,owner=ownerName(c),scope=this.companion.editScope().realm
  if(!owner||!scope)return {accepted:false,queued:false,message:'Set one actual owner and join a selected Realm before testing.'}
  if(!c.connection?.spawned)return {accepted:false,queued:false,message:'Join and spawn in your Realm first.'}
  if(this.state==='following'||this.state==='awaiting-arrival')
   return {accepted:true,queued:true,message:'I am already looking for '+this.owner+'. '+this.reason}
  if(this.companion.homeProject.state==='running'||this.companion.homeProject.state==='furnishing')
   return {accepted:false,queued:false,message:'I already have a house project underway. Ask for home status first.'}
  if(c.navigation.job||c.navigation.survey||c.resources?.active||c.acquisition?.active||
    c.miningJobs?.active||c.exploration?.active||c.operations?.pending)
   return {accepted:false,queued:false,message:'Another task is running. Say Stop before starting the home field trial.'}
  if(!Number.isSafeInteger(c.world.dimension))return {accepted:false,queued:false,message:'The current Realm dimension is not confirmed.'}
  const followed=c.navigation.follow(owner)
  if(!followed?.accepted)return {...followed,message:'I could not safely start following '+owner+': '+String(followed?.message||'not ready')}
  this.state='following';this.startedAt=now;this.lastTick=0;this.owner=owner
  this.dimension=c.world.dimension;this.scope=scope
  this.reason='Finding '+owner+' by player identity. I will mark home only after both positions are freshly confirmed within 10 blocks.'
  return {accepted:true,queued:true,message:'On my way! I will find you first, then set my new home beside your spot and start building.',fieldTrial:this.snapshot()}
 }
 tick(now=Date.now()){
  if(this.state!=='following'&&this.state!=='awaiting-arrival')return
  if(now-this.lastTick<500)return
  this.lastTick=now
  const c=this.companion.c,n=c.navigation
  if(!c.connection?.spawned||c.world.dimension!==this.dimension||
    this.companion.editScope().realm!==this.scope){
   this.state='paused';this.reason='Realm or dimension changed; home assignment cancelled.';return
  }
  if(now-this.startedAt>10*60*1000){
   this.state='paused';this.reason='Ten-minute follow test timed out without a verified arrival.';return
  }
  if(!n.job||n.job.kind!=='follow'||n.job.name?.toLowerCase()!==this.owner.toLowerCase()){
   // A follow request may be safely queued while the Realm verifies
   // movement. Pending is not arrival: do not claim land or build yet.
   if(n.pendingFollow?.name?.toLowerCase()===this.owner.toLowerCase()){
    this.state='awaiting-arrival'
    this.reason='Follow is waiting for server-confirmed movement readiness. No home assigned.'
    return
   }
   this.state='paused';this.reason='The follow task ended before arrival. No home was assigned.';return
  }
  const at=verifiedArrival(c,this.owner,{now,started:this.startedAt,maxDistance:10})
  this.reason=at.reason||'Owner reached at '+at.distance.toFixed(1)+' blocks using fresh server position packets.'
  if(!at.ok){this.state='awaiting-arrival';return}
  // Stop following before construction starts; the HOME command itself
  // rechecks that the owner is present and inside this same dimension.
  n.stop('Reached the owner safely. Starting home field test.',false)
  this.state='granting-home'
  const result=this.companion.handle('this is your new home spot')
  this.result=result
  this.state=result?.accepted&&result?.project?.state==='running'?'building':'paused'
  this.reason=result?.message||'Home assignment was not confirmed.'
  c.report?.('Field test: '+(this.state==='building'?'home build started':'home assignment paused')+
   ' after '+at.distance.toFixed(1)+'-block verified approach.')
 }
}
