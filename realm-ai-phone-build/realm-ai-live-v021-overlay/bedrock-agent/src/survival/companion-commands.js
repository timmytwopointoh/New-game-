import {grantPlot,planUniqueHome,validatePlotBlueprint} from './companion-plot.js'
import {blueprint} from './building.js'
import {constructionExposure,EditConfirmations} from './construction-guard.js'

// Read-only house design and one-job edit consent. Only the bearer-authenticated
// local phone API or an owner-allowlisted in-game command can call this handler.
export class CompanionCommands {
 constructor(controller,scope=null){
  this.c=controller;this.scope=scope||null
  this.plot=null;this.design=null;this.edits=new EditConfirmations()
 }
 setScope(scope){if(scope===this.scope)return;this.scope=scope||null;this.plot=null;this.design=null;this.edits.reset();this.c.world.editApproval=null}
 editScope(){return {realm:this.scope||this.c.commandPlans.scope||null,dimension:this.c.world.dimension}}
 reset(){this.edits.reset();this.c.world.editApproval=null}
 snapshot(){return {plot:this.plot,design:this.design,pendingEdit:this.edits.pending?{kind:this.edits.pending.kind,expires:this.edits.pending.expires}:null}}
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
  if(/^(?:this is your land|claim (?:your |my |a )?(?:companion )?(?:plot|land)(?: here)?|give you (?:a |my )?(?:50(?:x|\/| by )50(?:x|\/| by )50 )?(?:plot|land)(?: here)?)(?: 50(?:x|\/| by )50(?:x|\/| by )50)?$/.test(s)){
   if(!this.c.connection.spawned)return {accepted:false,queued:false,message:'Bot is not spawned. No land assigned.'}
   try{this.plot=grantPlot(this.c.world,this.c.connection.config?.ownerPlayerNames||[]);this.design=null
    return {accepted:true,queued:false,message:'Recorded a 50×50×50 planning area centered on your visible player position. No blocks changed. Say "design your home".',plot:this.plot}}
   catch(e){return {accepted:false,queued:false,message:String(e.message||e)}}
  }
  if(/^(?:design (?:your |a |another )?(?:house|home)|plan (?:your |a |another )?(?:house|home)|redesign (?:your )?(?:house|home)|think of (?:a |another )?(?:house|home) design|go free and think for yourself)$/.test(s)){
   if(!this.plot)return {accepted:false,queued:false,message:'Stand at the plot center and say "this is your land" first. Nothing built.'}
   if(this.plot.dimension!==this.c.world.dimension)return {accepted:false,queued:false,message:'Plot belongs to another dimension. Nothing planned.'}
   try{const d=planUniqueHome(this.plot,{previousStyle:this.design?.style})
    if(!validatePlotBlueprint(this.plot,d))throw Error('Blueprint exceeds the authorized plot.')
    this.design=d
    return {accepted:true,queued:false,message:'Designed '+d.style.replace(/-/g,' ')+' with '+d.rooms.length+' rooms: '+d.rooms.map(x=>x.name.replace(/-/g,' ')).join(', ')+'. Size '+d.footprint.width+'×'+d.footprint.length+'×'+d.footprint.height+'. Preview only; no blocks altered.',design:d}}
   catch(e){return {accepted:false,queued:false,message:String(e.message||e)}}
  }
  if(/^(?:your land|plot status|home design status)$/.test(s))return {accepted:true,queued:false,message:this.plot?this.design?'Plot active: '+this.design.style+' (blueprint only).':'Plot active; say "design your home".':'No plot assigned.',plot:this.plot,design:this.design}
  if(/^(?:start building your home|build your home|execute home design)$/.test(s))return {accepted:false,queued:false,message:'The multi-room design is a preview, not a construction job. Start with individual confirmed blocks, walls or floors after safety testing.'}
  return null
 }
}
