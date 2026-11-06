// Owner-confirmed staged home construction. Never assumes network placement
// succeeded: only the existing server-verified Building transaction completes a
// stage. Does not destroy, replace or "repair" an occupied block automatically.
import {physicalHomePlan,homeCompletion,inspectHomeCapacity} from './home-architecture.js'
import {nextHomeObstruction,homeProjectOwnedCoordinates} from './home-clearance.js'
import {HomeSupply} from './home-supply.js'
import {constructionExposure} from './construction-guard.js'
const safeScope=scope=>String(scope??'')
const key=p=>p.x+','+p.y+','+p.z
const distance=(a,b)=>a&&b?Math.hypot(a.x-b.x-.5,a.y-b.y-1.62,a.z-b.z-.5):Infinity
export class HomeProject {
 constructor(controller){this.c=controller;this.supply=new HomeSupply(controller);this.clear()}
 clear(){this.plan=null;this.plot=null;this.pending=null;this.review=null;this.clearance=null;this.supply.reset();this.state='idle';this.stage=0;this.started=0;this.lastAttempt=0;this.lastReport=0;this.reason='No home project started.';this.moveAttempts=0;this.ownerScope=null;this.ownerPauseRequested=false;this.proximityReview=null;this.proximityApproval=null}
 preview(plot,design){
  this.clear()
  this.plan=physicalHomePlan(plot,design);this.plot=plot;this.state='preview'
  this.reason=`Home shell: ${this.plan.placementsPlanned} block placements in ${this.plan.stages.length} verified stages. A bed, chest, crafting table, furnace and light are separately required.`
  return {accepted:true,queued:false,message:this.reason,project:this.snapshot()}
 }
 // Resuming after a new socket/session requires server observation of ALL
 // previously confirmed construction stages. We never replay old placements
 // or assume a stale saved record proves that blocks are present today.
 restoreSaved(record,scope){
  this.preview(record.plot,record.design)
  this.ownerScope=safeScope(scope)
  this.restoreTarget=record.verifiedStages
  this.restoreAutoResume=record.autoResume===true
  this.state='restoring'
  this.plan.status='rechecking'
  this.reason='Permanent home remembered. Waiting for actual Realm blocks before resuming.'
  return this.snapshot()
 }
 recheckSavedStages(now){
  const c=this.c,w=c.world,n=c.navigation
  if(!c.connection?.spawned||w.dimension!==this.plot?.dimension||
      !w.editModeVerified||!w.position)return
  const count=this.restoreTarget??0
  for(let i=0;i<count;i++){
   const stage=this.plan.stages[i]
   if(!stage)return this.block('Saved stage count exceeds restored blueprint.')
   for(const p of stage.positions){
    const actual=w.block(p)
    if(!actual){
     if(now-(this.lastReport||0)>10000){
      this.lastReport=now;this.reason='Home remembered; waiting for the server to load previously built blocks.'
      try{w.requestNearby?.(n.client)}catch{}
     }
     return
    }
    const blockName=String(actual.name||'').replace(/^minecraft:/,'')
    if(blockName!==stage.material){
     this.state='paused';this.plan.status='paused'
     this.reason='Saved home stage '+(i+1)+' does not match server blocks at '+key(p)+'. Paused to protect the existing build.'
     this.c.companion?.homeMemory?.saveProgress({autoResume:false})
     c.report?.(this.reason)
     return
    }
   }
  }
  for(let i=0;i<count;i++){
   const stage=this.plan.stages[i]
   stage.status='confirmed';stage.serverConfirmed=stage.positions.length
  }
  this.stage=count
  this.plan.placementsVerified=this.plan.stages.slice(0,count).reduce((sum,st)=>sum+st.positions.length,0)
  this.plan.status=this.restoreAutoResume?'running':'paused'
  this.state=this.restoreAutoResume?'running':'paused'
  this.started=now;this.lastAttempt=0;this.moveAttempts=0
  this.restoreTarget=null
  this.reason=this.restoreAutoResume?
   'Saved home verified against current Realm blocks. Continuing the next unfinished stage.':
   'Home and progress restored. Owner previously paused automatic work.'
  c.report?.(this.reason)
 }
 requestAuthorization(scope,now=Date.now()){
  if(!this.plan||!this.plot)return {accepted:false,queued:false,message:'First ask me to design a home and preview its physical build.'}
  if(this.state!=='preview'&&this.state!=='paused')return {accepted:false,queued:false,message:'Home project is already active or finished.'}
  const code=String(Math.floor(100000+Math.random()*900000))
  this.pending={code,expires:now+120000,scope:safeScope(scope),dimension:this.plot.dimension,designId:this.plan.designId}
  return {accepted:false,queued:false,confirmationRequired:true,message:
   `This is a REAL home construction proposal (${this.plan.placementsPlanned} placements, ${this.plan.stages.length} stages) inside your assigned plot. It will not replace existing blocks. Reply "confirm home ${code}" within 2 minutes or "cancel home". A missing tool, material, route or obstructed cell stops the project.`}
 }
 confirm(raw,scope,now=Date.now()){
  const text=String(raw||'').trim().toLowerCase(),p=this.pending
  if(text==='cancel home'){this.pending=null;return {accepted:true,queued:false,message:'Home confirmation cancelled. No blocks changed.'}}
  if(!p)return {accepted:false,queued:false,message:'No home construction confirmation is pending.'}
  if(text!==`confirm home ${p.code}`||p.expires<now||p.scope!==safeScope(scope)||p.dimension!==this.c.world.dimension||p.designId!==this.plan?.designId){
   return {accepted:false,queued:false,message:'Home confirmation missing, mismatched or expired. No work started.'}
  }
  this.pending=null;this.review=null;this.ownerScope=safeScope(scope);this.state='running';this.plan.status='running';this.started=now;this.lastAttempt=0;this.moveAttempts=0
  return {accepted:true,queued:true,message:'Owner approved this exact home shell blueprint. Starting staged building with Realm checks; furniture and bed still need separate confirmation.'}
 }
 // "This is your new home spot" is the owner's explicit invitation to start
 // this newly created starter shelter, not blanket demolition permission.
 // The plot and blueprint must be fresh, exact and linked to the same Realm.
 beginFromLandGift(scope,now=Date.now()){
  const realm=safeScope(scope)
  if(!realm||!this.plan||!this.plot||this.state!=='preview'||this.c.world.dimension!==this.plot.dimension)
   return {accepted:false,queued:false,message:'No fresh, scoped owner home gift. Starter construction did not begin.'}
  if(!this.c.connection.spawned||this.c.companion?.plot!==this.plot)
   return {accepted:false,queued:false,message:'Owner plot or Realm spawn changed. Starter construction did not begin.'}
  this.pending=null;this.review=null;this.ownerScope=realm;this.state='running'
  this.plan.status='running';this.plan.approvalSource='explicit-new-home-spot'
  this.started=now;this.lastAttempt=0;this.moveAttempts=0
  this.reason='Starter shelter invited by the owner. Checking observed terrain and resources; never overwrite other builds.'
  return {accepted:true,queued:true,message:this.reason,project:this.snapshot()}
 }
 // Home construction is the default companion job. An owner request
 // temporarily suspends it, with the exact stage and materials retained.
 pauseForOwner(reason='Helping my owner with another task.'){
  if(this.state!=='running')return false
  const nav=this.c.navigation
  const building=this.plan?.stages?.[this.stage]?.status==='building'&&(nav?.job?.kind==='build'||nav?.building?.job)
  if(building){this.ownerPauseRequested=true;this.reason='Finishing the already-sent block stage before helping the owner.';return true}
  this.ownerPauseRequested=false
  if(this.supply.childStarted)this.c.acquisition?.cancel?.('Home supply work yielded to owner.')
  if(nav?.job&&['walk','mine','build'].includes(nav.job.kind))nav.stop?.('Owner needs the companion.',false)
  this.state='owner-paused';this.plan.status='owner-paused';this.reason=reason
  this.c.world.editApproval=null;this.supply.reset()
  return true
 }
 resumeAfterOwnerTask(scope){
  if(this.state!=='owner-paused')return {accepted:false,queued:false,message:'Home is not in an owner-task pause.'}
  if(this.ownerScope!==safeScope(scope)||!this.c.connection.spawned||
     this.c.world.dimension!==this.plot?.dimension||this.c.companion?.plot!==this.plot)
   return {accepted:false,queued:false,message:'Cannot resume home automatically without the same owner Realm, dimension, and plot.'}
  this.state='running';this.plan.status='running';this.lastAttempt=0
  this.reason='Back to my house! Rechecking terrain and supplies for the saved stage.'
  return {accepted:true,queued:true,message:this.reason}
 }
 stop(reason='Owner paused home construction.'){
  if(this.state==='running'||this.state==='restoring'){this.state='paused';if(this.plan)this.plan.status='paused';this.reason=reason}
  this.pending=null;this.review=null;this.clearance=null;this.proximityReview=null;this.ownerPauseRequested=false
  if(this.supply.childStarted)this.c.acquisition?.cancel?.('Owner paused the parent home project.')
  this.supply.reset()
  this.c.world.editApproval=null
  return {accepted:true,queued:false,message:reason,project:this.snapshot()}
 }
 proposeUpgrade({storage=null,roomCapacity=null,idleMs=0}={}){
  if(!this.plot||!this.plan)return {action:'none',reason:'No authorized home design.'}
  return inspectHomeCapacity({storage,roomCapacity,idleMs,plot:this.plot,design:{footprint:this.plan.footprint}})
 }
 snapshot(){
  return {state:this.state,reason:this.reason,stage:this.stage,stages:this.plan?.stagesTotal||0,placementsVerified:this.plan?.placementsVerified||0,placementsPlanned:this.plan?.placementsPlanned||0,
   ownerPauseRequested:this.ownerPauseRequested,proximityReview:this.proximityReview?{stage:this.stage,nearby:this.proximityReview.nearby,expires:this.proximityReview.expires}:null,
   furniture:this.plan?.furniture?.map(x=>({name:x.name,confirmed:x.confirmed}))||[],
   confirmationPending:!!this.pending,clearanceReview:this.review?{position:this.review.position,expires:this.review.expires,reason:this.review.reason}:null,supply:this.supply.snapshot(),completion:this.plan?.completion||'unverified'}
 }
 requestClearance(decision,now){
  if(this.review)return
  const code=String(Math.floor(100000+Math.random()*900000))
  this.review={position:{...decision.position},name:decision.name,reason:decision.reason,code,
    expires:now+120000,scope:this.ownerScope,dimension:this.plot.dimension,stage:this.stage}
  this.reason='Before I remove '+decision.name+' at '+key(decision.position)+': '+decision.reason+
    ' Reply "confirm clearance '+code+'" to allow this one block, or "cancel clearance".'
  this.c.report?.(this.reason)
 }
 requestProximityReview(risk,now=Date.now()){
  if(this.proximityReview?.stage===this.stage)return
  const code=String(Math.floor(100000+Math.random()*900000))
  this.proximityReview={code,stage:this.stage,dimension:this.plot.dimension,
   scope:this.ownerScope,expires:now+120000,
   nearby:risk.near?.name||'unidentified construction'}
  this.reason='I found '+this.proximityReview.nearby+
   ' within 15 blocks of this house stage. Can I build nearby without changing it? '+
   'Reply "confirm home proximity '+code+'" to allow this EXACT stage, or "cancel home proximity".'
  this.c.report?.(this.reason)
 }
 confirmProximity(raw,scope,now=Date.now()){
  const s=String(raw||'').toLowerCase().trim(),p=this.proximityReview
  if(s==='cancel home proximity'){
   this.proximityReview=null;this.state='paused';this.plan.status='paused'
   this.reason='Owner declined building near protected construction; saved stage was not changed.'
   return {accepted:true,queued:false,message:this.reason}
  }
  if(!p||s!=='confirm home proximity '+p.code||p.expires<now||
    p.scope!==safeScope(scope)||p.dimension!==this.c.world.dimension||p.stage!==this.stage)
   return {accepted:false,queued:false,message:'No matching current home proximity approval; no edit was sent.'}
  this.proximityApproval={stage:this.stage,scope:p.scope,dimension:p.dimension}
  this.proximityReview=null
  this.reason='Owner authorized only this empty-cell home stage near existing construction; no neighboring block removal is authorized.'
  return {accepted:true,queued:true,message:this.reason}
 }
 confirmClearance(raw,scope,now=Date.now()){
  const v=String(raw||'').trim().toLowerCase(),p=this.review
  if(v==='cancel clearance'){this.review=null;this.state='paused';this.reason='Owner declined removing the obstruction. The home plan remains saved.';return {accepted:true,queued:false,message:this.reason}}
  if(!p)return {accepted:false,queued:false,message:'There is no obstacle clearance request.'}
  if(now>p.expires||scope!==p.scope||p.dimension!==this.c.world.dimension||p.stage!==this.stage){
   this.review=null;return {accepted:false,queued:false,message:'Clearance expired or the stage, Realm or dimension changed.'}
  }
  if(v!=='confirm clearance '+p.code)return {accepted:false,queued:false,message:'Confirm the exact six-digit clearance code shown for this one block.'}
  this.review=null;this.clearance={position:p.position,name:p.name,approved:true,attempts:0,started:0}
  this.state='running';this.reason='Specific obstruction approved. Checking server and tool requirements before clearing.'
  return {accepted:true,queued:true,message:this.reason}
 }
 prepareClearance(decision,now){
  const c=this.c,w=c.world,n=c.navigation,p=decision.position
  if(!this.clearance||key(this.clearance.position)!==key(p)){
   this.clearance={position:{...p},name:decision.name,approved:decision.action==='auto-mine',attempts:0,started:0}
  }
  const job=this.clearance
  if(job.started>0){
   if(w.airAt(p)){
    this.clearance=null;w.editApproval=null;this.reason='Server confirms '+job.name+' was removed; continuing home construction.'
    return
   }
   if(n.job||n.mining.job)return
   if(now-job.started<1500)return
   job.attempts++
   job.started=0;w.editApproval=null
   if(job.attempts>=3)return this.block('Could not confirm natural obstacle removal after three attempts. Owner can inspect and retry.')
  }
  if(n.job||c.operations?.pending||c.acquisition?.active||c.resources?.active||c.miningJobs?.active)return
  const standing=w.standPosition()
  if(!standing)return
  const dis=Math.hypot(standing.x-p.x,standing.y-p.y,standing.z-p.z)
  if(dis>3||standing.x===p.x&&standing.z===p.z){
   if(this.moveAttempts>8)return this.block('Could not find safe footing next to obstruction; owner needs to inspect.')
   const goals=[]
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]]){
    const g={x:p.x+dx,y:standing.y,z:p.z+dz}
    if(w.walkable(g))goals.push(g)
   }
   const goal=goals.find(g=>Math.hypot(g.x-standing.x,g.z-standing.z)>.2)
   if(!goal){w.requestNearby?.(n.client);return}
   const movement=n.walk(goal,{allowMining:false,maxDrop:1})
   if(movement.accepted){this.moveAttempts++;this.reason='Repositioning to mine the natural obstacle safely.'}
   else{this.moveAttempts++;this.reason=movement.message||'Waiting for a safe route.'}
   return
  }
  // The owner approved an exact house blueprint. The temporary permit is
  // only for the target block, never an arbitrary neighbor or player build.
  w.editApproval={kind:'mine',dimension:w.dimension,targets:new Set([key(p)]),expires:now+90000,projectId:this.plan.designId}
  const result=n.mine(p,{allowAbove:true,allowLowerForward:true})
  if(result?.accepted){job.started=now;this.reason='Mining '+job.name+' at '+key(p)+'; waiting for server-confirmed air.'}
  else{
   w.editApproval=null
   const msg=String(result?.message||'Cannot mine this block.').slice(0,170)
   if(/tool|harvest|difficult|pickaxe|shovel|durability/i.test(msg)){
    const need=/stone|deepslate|granite|diorite|andesite|tuff/.test(job.name)?'stone_pickaxe':'wooden_shovel'
    const supply=this.supply.begin(need,1,now)
    this.reason='Preparing '+need+' for obstacle: '+supply.reason
    if(supply.state==='requires-owner')this.block(supply.reason)
   }else if(/unknown|unobserved|out of reach|not visible/i.test(msg)){w.requestNearby?.(n.client);this.reason='Observing obstacle before a bounded retry.'}
   else this.block(msg)
  }
 }
 block(reason){
  if(this.state!=='running')return
  this.reason=String(reason).slice(0,200);this.state='paused';this.plan.status='paused';this.c.world.editApproval=null
  this.c.report?.('Home project paused: '+this.reason+'. No automatic block replacement or destructive retries.')
 }
 tick(now=Date.now()){
  if(this.state==='restoring'){this.recheckSavedStages(now);return}
  if(this.state!=='running'||!this.plan||!this.plot||now-(this.lastAttempt||0)<500)return
  this.lastAttempt=now
  if(this.ownerPauseRequested&&this.plan?.stages?.[this.stage]?.status!=='building'){
   this.ownerPauseRequested=false;this.pauseForOwner();return
  }
  const c=this.c,w=c.world,n=c.navigation
  if(!c.connection.spawned||w.dimension!==this.plot.dimension||!w.editModeVerified)return this.block('Realm, dimension or player build permission is not confirmed')
  if(w.attributes['minecraft:health']!==undefined&&w.attributes['minecraft:health']<=6)return this.block('Health too low to continue construction')
  if(now-this.started>2*60*60*1000)return this.block('Two-hour project session limit reached; owner must resume explicitly')
  const s=this.plan.stages[this.stage]
  if(!s){
   // Never conflate completing shell with a usable, occupied house.
   this.state='furnishing';this.plan.status='shell-confirmed'
   this.plan.completion=homeCompletion(this.plan)?'confirmed':'needs-furnishings'
   this.reason='Server confirms the house shell stages. The bed, safe spawn, storage, workstations and lighting are separate tasks; home is not yet complete.'
   c.report?.(this.reason);w.editApproval=null
   return
  }
  if(s.status==='building'){
   if(n.building.job||n.job?.kind==='build')return
   if(n.building.state!=='confirmed')return this.block(n.building.reason||'The server did not confirm this build stage')
   const correct=s.positions.every(p=>w.block(p)?.name===s.material)
   const verified=s.positions.every(p=>w.ownedPlacements?.has(`${w.dimension}:${key(p)}`))
   if(!correct||!verified)return this.block('A stage ended without server-confirmed matching blocks at every target')
   s.serverConfirmed=s.positions.length;s.status='confirmed';this.plan.placementsVerified+=s.positions.length
   // The learner receives evidence ONLY after matching server block updates
   // and the owned placement registry verified every voxel in this stage.
   const useKind=s.label?.startsWith('foundation')?'foundation':'build-stage'
   c.mind?.record?.(useKind,s.material,{outcome:'confirmed',
    biome:w.biomeAt?.()?.name||null,evidence:'verified-construction-stage'})
   this.stage++;w.editApproval=null;this.moveAttempts=0;this.supply.reset();this.clearance=null;this.proximityApproval=null
   this.c.companion?.rememberProgress?.(this.stage)
   c.report?.(`Home stage ${this.stage}/${this.plan.stagesTotal} verified, ${this.plan.placementsVerified} blocks confirmed.`)
   if(this.ownerPauseRequested){this.ownerPauseRequested=false;this.pauseForOwner();return}
   return
  }
  if(this.proximityReview){
   if(now>this.proximityReview.expires){
    this.proximityReview=null;this.state='paused';this.plan.status='paused'
    this.reason='Home stage near other construction was not approved; no edit was made.'
   }
   return
  }
  if(this.review){
   if(now>this.review.expires){this.review=null;this.reason='Obstruction approval timed out; home project remains saved for later owner confirmation.';this.state='paused'}
   return
  }
  // The dependency task and original goal are separate. Keep resolving
  // missing supplies while nested acquisition/crafting is running.
  if(this.supply.material){
   const result=this.supply.tick(now)
   if(result.state==='ready')this.supply.reset()
   else if(result.state==='requires-owner'||result.state==='suggest-substitute')return this.block(result.reason)
   else{this.reason=result.reason;return}
  }
  if(n.job||n.survey||c.miningJobs?.active||c.resources?.active||c.acquisition?.active||c.operations?.pending)return
  const owned=homeProjectOwnedCoordinates(w,this.plan.stages,this.stage)
  const problem=nextHomeObstruction(w,this.plot,s.positions,{ownedProjectBlocks:owned})
  if(problem.action==='observe'){w.requestNearby?.(n.client);this.reason=problem.reason;return}
  if(problem.action==='ask'){
   if(this.clearance?.approved&&key(this.clearance.position)===key(problem.position)){this.prepareClearance(problem,now);return}
   this.requestClearance(problem,now);return
  }
  if(problem.action==='stop')return this.block(problem.reason)
  if(problem.action==='auto-mine'){this.prepareClearance(problem,now);return}
  if(problem.action!=='build')return
  // Being invited to create a home never authorizes damaging neighboring
  // builds. Recognized nearby construction must be reviewed separately.
  const risk=constructionExposure(w,s.positions,{ignoreVerifiedProjectBlocks:owned})
  if(risk.state==='protected'){
   if(!this.proximityApproval||this.proximityApproval.stage!==this.stage||
      this.proximityApproval.dimension!==w.dimension||this.proximityApproval.scope!==this.ownerScope){
    this.requestProximityReview(risk,now);return
   }
  }
  if(risk.state==='unverified'){w.requestNearby?.(n.client);this.reason=risk.reason||'Waiting for reliable construction safety evidence.';return}
  // Recheck authorization against this exact blueprint at every stage.
  if(!s.positions.every(p=>p.x>=this.plot.bounds.min.x&&p.x<=this.plot.bounds.max.x&&p.y>=this.plot.bounds.min.y&&p.y<=this.plot.bounds.max.y&&p.z>=this.plot.bounds.min.z&&p.z<=this.plot.bounds.max.z))
   return this.block('Stage no longer fits the approved land bounds')
  if(!w.position)return this.block('Server position is unknown')
  const origin=s.positions[0],distanceTo=distance(w.position,origin)
  if(distanceTo>9){
   if(this.moveAttempts>=3)return this.block('Cannot safely reach this construction stage after three route attempts')
   let candidate=null
   for(let d=2;d<=5&&!candidate;d++)for(const [dx,dz] of [[d,0],[-d,0],[0,d],[0,-d]]){
    const p={x:origin.x+dx,y:Math.floor(w.position.y-1.62),z:origin.z+dz}
    if(w.walkable(p)){candidate=p;break}
   }
   if(!candidate)return this.block('No observed safe standing cell near the construction site')
   const result=n.walk(candidate,{allowMining:false,maxDrop:1})
   if(!result.accepted)return this.block('No safe route to home stage: '+result.message)
   this.moveAttempts++;this.reason='Walking toward next building stage; server position must confirm arrival.'
   return
  }
  const stock=w.items()[s.material]||0
  if(w.gameMode!=='creative'&&stock<s.positions.length){
   const result=this.supply.begin(s.material,s.positions.length,now)
   this.reason=result.reason
   if(result.state==='requires-owner'||result.state==='suggest-substitute')return this.block(result.reason)
   return
  }
  const supply=c.workshop?.hotbar?.(s.material,now)
  if(supply?.state==='working'||supply?.state==='need')return
  if(supply?.state==='blocked')return this.block(supply.reason)
  if(supply?.state!=='ready')return this.block('Could not verify matching material in hotbar')
  // This specific confirmed project stage is the only exception permitted to
  // the 15-block buffer. Unrelated commands never receive a blanket exemption.
  w.editApproval={kind:'build',dimension:w.dimension,targets:new Set(s.positions.map(key)),expires:now+300000,projectId:this.plan.designId}
  const result=n.build({shape:'custom',material:s.material,origin,positions:s.positions})
  if(!result?.accepted){w.editApproval=null;return this.block(result?.message||'Build refused; no blocks placed')}
  s.status='building';this.reason=`Placing stage ${this.stage+1}/${this.plan.stagesTotal}: ${s.label}. Awaiting server updates.`
  c.report?.(this.reason)
 }
}
