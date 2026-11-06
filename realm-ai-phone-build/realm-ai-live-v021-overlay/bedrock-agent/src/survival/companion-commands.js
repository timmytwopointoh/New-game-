import {grantPlot,planUniqueHome,validatePlotBlueprint} from './companion-plot.js'
import {blueprint} from './building.js'
import {constructionExposure,EditConfirmations} from './construction-guard.js'
import {HomeProject} from './home-project.js'
import {HomeRoutine} from './home-routine.js'

// Read-only house design and one-job edit consent. Only the bearer-authenticated
// local phone API or an owner-allowlisted in-game command can call this handler.
export class CompanionCommands {
 constructor(controller,scope=null){
  this.c=controller;this.scope=scope||null
  this.plot=null;this.design=null;this.edits=new EditConfirmations();this.homeProject=new HomeProject(controller);this.homeRoutine=new HomeRoutine(controller)
 }
 setScope(scope){if(scope===this.scope)return;this.scope=scope||null;this.plot=null;this.design=null;this.edits.reset();this.homeProject.clear();this.homeRoutine.setPlot(null);this.c.world.editApproval=null}
 editScope(){return {realm:this.scope||this.c.commandPlans.scope||null,dimension:this.c.world.dimension}}
 reset(){this.edits.reset();this.homeProject.stop('Realm session interrupted; owner must confirm before resuming.');this.homeRoutine.reset(true);this.c.world.editApproval=null}
 tick(now=Date.now()){this.homeRoutine.tick(now);this.homeProject.tick(now)}
 onServerTime(p,now=Date.now()){this.homeRoutine.onServerTime(p,now)}
 onServerSystemText(p,now=Date.now()){this.homeRoutine.onSystemText(p,now)}
 snapshot(){return {plot:this.plot,design:this.design,homeProject:this.homeProject.snapshot(),homeRoutine:this.homeRoutine.snapshot(),pendingEdit:this.edits.pending?{kind:this.edits.pending.kind,expires:this.edits.pending.expires}:null}}
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
 handle(raw){
  const s=String(raw||'').trim().toLowerCase().replace(/[.!?]+$/,'').replace(/^(?:please |can you |could you )/,'')
  if(this.edits.pending&&/^(?:yes|no|cancel edit|confirm edit \d{6})$/.test(s))
   return this.edits.confirm(s,this.editScope(),this.c.world)
  if(s==='cancel edit'){this.edits.reset();return {accepted:true,queued:false,message:'Edit approval cancelled. No work started.'}}
  if(/^confirm clearance \d{6}$/.test(s)||s==='cancel clearance')return this.homeProject.confirmClearance(s,String(this.editScope().realm??''))
  if(/^confirm home \d{6}$/.test(s))return this.homeProject.confirm(s,this.editScope().realm)
  if(s==='cancel home')return this.homeProject.confirm(s,this.editScope().realm)
  if(s==='pause home'||s==='stop home building')return this.homeProject.stop()
  if(s==='resume home'||s==='resume building home')return this.homeProject.requestAuthorization(this.editScope().realm)
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
