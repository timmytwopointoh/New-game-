import {grantPlot,planUniqueHome,validatePlotBlueprint} from './companion-plot.js'
import {blueprint} from './building.js'
import {constructionExposure,EditConfirmations} from './construction-guard.js'
import {HomeProject} from './home-project.js'
import {HomeRoutine} from './home-routine.js'
import {NEW_HOME_SPOT,decideFirstHome} from './home-instinct.js'
import {HomeSocialLoop} from './home-social-loop.js'

// Read-only house design and one-job edit consent. Only the bearer-authenticated
// local phone API or an owner-allowlisted in-game command can call this handler.
export class CompanionCommands {
 constructor(controller,scope=null){
  this.c=controller;this.scope=scope||null
  this.plot=null;this.design=null;this.firstHomeDecision=null;this.edits=new EditConfirmations();this.homeProject=new HomeProject(controller);this.homeRoutine=new HomeRoutine(controller);this.social=new HomeSocialLoop(this)
 }
 setScope(scope){if(scope===this.scope)return;this.scope=scope||null;this.plot=null;this.design=null;this.firstHomeDecision=null;this.edits.reset();this.homeProject.clear();this.homeRoutine.setPlot(null);this.social.reset();this.c.world.editApproval=null}
 editScope(){return {realm:this.scope||this.c.commandPlans.scope||null,dimension:this.c.world.dimension}}
 reset(){this.edits.reset();this.homeProject.stop('Realm session interrupted; owner must confirm before resuming.');this.homeRoutine.reset(true);this.social.manualHold();this.c.world.editApproval=null}
 tick(now=Date.now()){this.social.tick(now);this.homeRoutine.tick(now);this.homeProject.tick(now)}
 onServerTime(p,now=Date.now()){this.homeRoutine.onServerTime(p,now)}
 onServerSystemText(p,now=Date.now()){this.homeRoutine.onSystemText(p,now)}
 snapshot(){return {plot:this.plot,design:this.design,firstHomeDecision:this.firstHomeDecision,social:this.social.snapshot(),homeProject:this.homeProject.snapshot(),homeRoutine:this.homeRoutine.snapshot(),pendingEdit:this.edits.pending?{kind:this.edits.pending.kind,expires:this.edits.pending.expires}:null}}
 check(kind,descriptor,positions,execute){
  const c=this.c
  if(!c.connection.spawned)return {accepted:false,queued:false,message:'Join and spawn in the Realm before editing.'}
  const risk=constructionExposure(c.world,positions)
  if(risk.state==='unverified')return {accepted:false,queued:false,message:risk.reason||'Load the nearby terrain first. No blocks changed.'}
  if(risk.state==='protected'){
   const near=risk.near
   const task=kind==='mine'?positions[0].x+','+positions[0].y+','+positions[0].z:
     descriptor.shape+' '+descriptor.material+' at '+Object.values(descriptor.origin).join(',')
   return this.edits.request({kind,positions,description:task+' near '+near.name+' ('+near.distance.toFixed(1)+' blocks)',scope:this.editScope(),execute})
  }
  return execute()
 }
 build(descriptor,execute){
  try{return this.check('build',descriptor,blueprint(descriptor).positions,execute)}
  catch(e){return {accepted:false,queued:false,message:String(e.message||e).slice(0,180)}}
 }
 mine(position,execute){return this.check('mine',null,[position],execute)}
 hearName(message,now=Date.now()){return this.social.hearName(message,now)}
 beforeOwnerAction(raw,now=Date.now()){return this.social.beforeOwnerAction(raw,now)}
 afterOwnerAction(raw,result,now=Date.now()){return this.social.afterOwnerAction(raw,result,now)}
 handle(raw){
  const s=String(raw||'').trim().toLowerCase().replace(/[.!?]+$/,'').replace(/^(?:please |can you |could you )/,'')
  if(this.edits.pending&&/^(?:yes|no|cancel edit|confirm edit \d{6})$/.test(s))
   return this.edits.confirm(s,this.editScope(),this.c.world)
  if(/^confirm home proximity \\d{6}$/.test(s)||s==='cancel home proximity')
   return this.homeProject.confirmProximity(s,this.editScope().realm)
  if(s==='resume working on your house'||s==='go back to your house'||s==='resume house work'){
   this.social.mode='house'
   const result=this.homeProject.resumeAfterOwnerTask(this.editScope().realm)
   if(result.accepted)return result
   return this.homeProject.requestAuthorization(this.editScope().realm)
  }
  if(s==='cancel edit'){this.edits.reset();return {accepted:true,queued:false,message:'Edit approval cancelled. No work started.'}}
  if(/^confirm clearance \d{6}$/.test(s)||s==='cancel clearance')return this.homeProject.confirmClearance(s,String(this.editScope().realm??''))
  if(/^confirm home \d{6}$/.test(s))return this.homeProject.confirm(s,this.editScope().realm)
  if(s==='cancel home')return this.homeProject.confirm(s,this.editScope().realm)
  if(s==='pause home'||s==='stop home building'){this.social.manualHold();return this.homeProject.stop()}
  if(s==='resume home'||s==='resume building home'){this.social.mode='house';const result=this.homeProject.resumeAfterOwnerTask(this.editScope().realm);return result.accepted?result:this.homeProject.requestAuthorization(this.editScope().realm)}
  if(s==='home status'||s==='check home')return {accepted:true,queued:false,message:this.homeRoutine.inspect().message+' '+this.homeProject.snapshot().reason,home:this.homeRoutine.snapshot(),project:this.homeProject.snapshot()}
  if(s==='bed supplies'||s==='how to get a bed'||s==='how do you get a bed'||s==='find home bed')return this.homeRoutine.inspect()
  if(s==='craft home bed'||s==='make a home bed'||s==='craft a bed')return this.homeRoutine.craftBed()
  if(s==='place home bed'||s==='put down home bed')return this.homeRoutine.placeBed()
  if(s==='use home bed'||s==='sleep in home bed'||s==='set home spawn'||s==='sleep at home')return this.homeRoutine.useBed()
  if(s==='home improvement'||s==='home improvements'||s==='expand home'){
   return {accepted:true,queued:false,message:'I can evaluate an upward or downward expansion using observed storage and room capacity. I will not build from an unverified estimate or expand outside your land.',proposal:this.homeProject.proposeUpgrade({idleMs:120000})}
  }
  if(s==='plan home construction'||s==='preview home build')return this.plot&&this.design?this.homeProject.preview(this.plot,this.design):{accepted:false,queued:false,message:'Design a home on your assigned land first.'}
  if(s==='build your home'||s==='start building your home'||s==='execute home design'||s==='begin home construction')return this.homeProject.requestAuthorization(this.editScope().realm)
  if(NEW_HOME_SPOT.test(s)){
   const connection=this.c.connection,n=this.c.navigation
   if(!connection.spawned)return {accepted:false,queued:false,message:'Please let me join the Realm before assigning a home.'}
   if(this.homeProject.state==='running'||this.homeProject.state==='furnishing')
    return {accepted:true,queued:true,message:'Thanks! I already have an active home project. '+this.homeProject.snapshot().reason,project:this.homeProject.snapshot()}
   if(this.c.resources?.active||this.c.acquisition?.active||this.c.miningJobs?.active||
      this.c.operations?.pending||(n.job&&n.job.kind!=='follow'))
    return {accepted:false,queued:false,message:'I have another active job. Say "stop", then tell me this is my new home spot.'}
   let plot,decision
   try{
    plot=grantPlot(this.c.world,connection.config?.ownerPlayerNames||[])
    decision=decideFirstHome(this.c.world,plot,{
     serverTime:this.homeRoutine.serverTime,serverTimeAt:this.homeRoutine.serverTimeAt
    })
    this.plot=plot;this.design=decision.design;this.social.mode='house';this.firstHomeDecision={
     choice:decision.choice,daylight:decision.daylight,site:decision.site,
     materials:decision.materials,priority:decision.priority}
    this.homeRoutine.setPlot(plot)
    this.homeProject.preview(plot,this.design)
    const begin=this.homeProject.beginFromLandGift(this.editScope().realm)
    if(!begin.accepted)return begin
    // Following the owner is a safe task to yield; never interrupt an
    // in-progress resource/mining/build transaction to acquire a plot.
    if(n.job?.kind==='follow'||n.survey)n.stop('Owner assigned a home; switching to building.',false)
    this.c.world.enabled=true
    try{this.c.world.requestNearby?.(connection.client)}catch(e){this.c.world.lastError=String(e.message||e)}
    const time=decision.daylight.phase==='unknown'?'I will check the sky first':
     decision.daylight.urgent?'Night is close, so I will prioritize shelter':'I am using the daylight to build shelter first'
    const message='Thank you for giving me a place to call home! I picked a '+decision.choice.width+
     ' by '+decision.choice.width+' '+decision.choice.kind+' starter with '+decision.choice.foundation+
     '. '+time+'. I will improvise as I learn this land!'
    const globalChatQueued=connection.say(message)
    this.c.report?.('New home spot: '+decision.choice.style+' ('+decision.choice.foundation+
     '), site '+decision.site.readiness+', '+decision.daylight.phase+'. Starter project running.')
    return {accepted:true,queued:true,message:'Home assigned to '+plot.owner+
     '. '+this.homeProject.snapshot().reason+
     (globalChatQueued?' Thank-you and creative plan sent to global Realm chat.':' Global chat was not available; view diagnostics.'),
     plot,decision:this.firstHomeDecision,project:this.homeProject.snapshot(),globalChatQueued}
   }catch(e){return {accepted:false,queued:false,message:'I could not safely set that home spot: '+String(e.message||e).slice(0,150)}}
  }
  if(/^(?:this is your land|claim (?:your |my |a )?(?:companion )?(?:plot|land)(?: here)?|give you (?:a |my )?(?:50(?:x|\/| by )50(?:x|\/| by )50 )?(?:plot|land)(?: here)?)(?: 50(?:x|\/| by )50(?:x|\/| by )50)?$/.test(s)){
   if(!this.c.connection.spawned)return {accepted:false,queued:false,message:'Bot is not spawned. No land assigned.'}
   try{this.plot=grantPlot(this.c.world,this.c.connection.config?.ownerPlayerNames||[]);this.design=null;this.homeRoutine.setPlot(this.plot);this.homeProject.clear()
    return {accepted:true,queued:false,message:'Recorded a 50×50×50 planning area centered on your visible player position. No blocks changed. Say "design your home".',plot:this.plot}}
   catch(e){return {accepted:false,queued:false,message:String(e.message||e)}}
  }
  if(/^(?:design (?:your |a |another )?(?:house|home)|plan (?:your |a |another )?(?:house|home)|redesign (?:your )?(?:house|home)|think of (?:a |another )?(?:house|home) design|go free and think for yourself)$/.test(s)){
   if(!this.plot)return {accepted:false,queued:false,message:'Stand at the plot center and say "this is your land" first. Nothing built.'}
   if(this.plot.dimension!==this.c.world.dimension)return {accepted:false,queued:false,message:'Plot belongs to another dimension. Nothing planned.'}
   try{const d=planUniqueHome(this.plot,{previousStyle:this.design?.style})
    if(!validatePlotBlueprint(this.plot,d))throw Error('Blueprint exceeds the authorized plot.')
    this.design=d;const project=this.homeProject.preview(this.plot,d)
    return {accepted:true,queued:false,message:'Designed '+d.style.replace(/-/g,' ')+' with '+d.rooms.length+' rooms: '+d.rooms.map(x=>x.name.replace(/-/g,' ')).join(', ')+'. Size '+d.footprint.width+'×'+d.footprint.length+'×'+d.footprint.height+'. '+project.message+' Preview only; no blocks altered.',design:d,project:project.project}}
   catch(e){return {accepted:false,queued:false,message:String(e.message||e)}}
  }
  if(/^(?:your land|plot status|home design status)$/.test(s))return {accepted:true,queued:false,message:this.plot?this.design?'Plot active: '+this.design.style+' (blueprint only).':'Plot active; say "design your home".':'No plot assigned.',plot:this.plot,design:this.design}
  // All building begins at the explicit, scoped owner confirmation above.
  return null
 }
}
