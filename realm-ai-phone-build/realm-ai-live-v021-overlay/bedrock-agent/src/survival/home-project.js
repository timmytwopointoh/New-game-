// Owner-confirmed staged home construction. Never assumes network placement
// succeeded: only the existing server-verified Building transaction completes a
// stage. Does not destroy, replace or "repair" an occupied block automatically.
import {physicalHomePlan,homeCompletion,assessHomeObstacle,inspectHomeCapacity} from './home-architecture.js'
const safeScope=scope=>String(scope??'')
const key=p=>p.x+','+p.y+','+p.z
const distance=(a,b)=>a&&b?Math.hypot(a.x-b.x-.5,a.y-b.y-1.62,a.z-b.z-.5):Infinity
export class HomeProject {
 constructor(controller){this.c=controller;this.clear()}
 clear(){this.plan=null;this.plot=null;this.pending=null;this.state='idle';this.stage=0;this.started=0;this.lastAttempt=0;this.lastReport=0;this.reason='No home project started.';this.moveAttempts=0}
 preview(plot,design){
  this.clear()
  this.plan=physicalHomePlan(plot,design);this.plot=plot;this.state='preview'
  this.reason=`Home shell: ${this.plan.placementsPlanned} block placements in ${this.plan.stages.length} verified stages. A bed, chest, crafting table, furnace and light are separately required.`
  return {accepted:true,queued:false,message:this.reason,project:this.snapshot()}
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
  this.pending=null;this.state='running';this.plan.status='running';this.started=now;this.lastAttempt=0;this.moveAttempts=0
  return {accepted:true,queued:true,message:'Owner approved this exact home shell blueprint. Starting staged building with Realm checks; furniture and bed still need separate confirmation.'}
 }
 stop(reason='Owner paused home construction.'){
  if(this.state==='running'){this.state='paused';this.plan.status='paused';this.reason=reason}
  this.pending=null
  this.c.world.editApproval=null
  return {accepted:true,queued:false,message:reason,project:this.snapshot()}
 }
 proposeUpgrade({storage=null,roomCapacity=null,idleMs=0}={}){
  if(!this.plot||!this.plan)return {action:'none',reason:'No authorized home design.'}
  return inspectHomeCapacity({storage,roomCapacity,idleMs,plot:this.plot,design:{footprint:this.plan.footprint}})
 }
 snapshot(){
  return {state:this.state,reason:this.reason,stage:this.stage,stages:this.plan?.stagesTotal||0,placementsVerified:this.plan?.placementsVerified||0,placementsPlanned:this.plan?.placementsPlanned||0,
   furniture:this.plan?.furniture?.map(x=>({name:x.name,confirmed:x.confirmed}))||[],
   confirmationPending:!!this.pending,completion:this.plan?.completion||'unverified'}
 }
 block(reason){
  if(this.state!=='running')return
  this.reason=String(reason).slice(0,200);this.state='paused';this.plan.status='paused';this.c.world.editApproval=null
  this.c.report?.('Home project paused: '+this.reason+'. No automatic block replacement or destructive retries.')
 }
 tick(now=Date.now()){
  if(this.state!=='running'||!this.plan||!this.plot||now-(this.lastAttempt||0)<500)return
  this.lastAttempt=now
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
   this.stage++;w.editApproval=null;this.moveAttempts=0
   c.report?.(`Home stage ${this.stage}/${this.plan.stagesTotal} verified, ${this.plan.placementsVerified} blocks confirmed.`)
   return
  }
  if(n.job||n.survey||c.miningJobs?.active||c.resources?.active||c.operations?.pending)return
  const problem=assessHomeObstacle({world:w,targets:s.positions,plot:this.plot})
  if(problem.action!=='build')return this.block(problem.reason)
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
  if(w.gameMode!=='creative'&&stock<s.positions.length)return this.block(`Need ${s.positions.length} ${s.material} for this stage; server inventory reports only ${stock}. Craft or gather supplies first.`)
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
