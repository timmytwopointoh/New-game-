// The FIRST owner-verified home is permanent for this Realm on this phone.
// Saves only the scoped position, blueprint and server-confirmed stage count.
// Never saves token, passwords, client packets or invented terrain.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {insidePlot,validatePlotBlueprint} from './companion-plot.js'
const position=p=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
const copy=x=>JSON.parse(JSON.stringify(x))
export class PermanentHome {
 constructor({directory=null,scope=null}={}){
  this.directory=directory;this.scope=null;this.file=null;this.record=null;this.readOnly=false;this.error=''
  this.setScope(scope)
 }
 setScope(scope){
  this.scope=typeof scope==='string'||typeof scope==='number'?String(scope).trim():null
  if(!this.scope)this.scope=null
  this.file=this.directory&&this.scope?path.join(this.directory,crypto.createHash('sha256').update(this.scope).digest('hex')+'.json'):null
  this.record=null;this.readOnly=false;this.error=''
  if(!this.file||!fs.existsSync(this.file))return
  try{
   const stat=fs.statSync(this.file)
   if(stat.size>1000000||stat.size<16)throw Error('bad size')
   const saved=JSON.parse(fs.readFileSync(this.file,'utf8'))
   if(!validHomeRecord(saved))throw Error('bad home record')
   this.record=saved
  }catch{
   // A damaged home file is NOT an invitation to pick a different spot.
   // Keep it intact for diagnostics or manual recovery, never overwrite.
   this.readOnly=true
   this.error='Saved permanent home cannot be read; original file preserved. No replacement home can be assigned.'
  }
 }
 hasHome(){return !!this.record}
 snapshot(){return this.record?copy(this.record):null}
 persist(record){
  if(!this.file||this.readOnly)return false
  try{
   fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})
   const tmp=this.file+'.tmp'
   fs.writeFileSync(tmp,JSON.stringify(record),{mode:0o600,flag:'w'})
   fs.renameSync(tmp,this.file)
   this.record=copy(record);this.error=''
   return true
  }catch(e){
   this.error='Cannot safely save permanent home to private phone storage.'
   return false
  }
 }
 claim(plot,design){
  if(this.readOnly)return {ok:false,message:this.error}
  if(this.record)return {ok:false,locked:true,message:'I already have one permanent home, and it cannot be relocated.'}
  if(!this.scope||!this.file)return {ok:false,message:'Wait for a verified Realm identity before assigning my permanent home.'}
  if(!validPlot(plot)||!validatePlotBlueprint(plot,design))
   return {ok:false,message:'The proposed home has not passed owner plot and blueprint checks.'}
  const record={schema:1,plot:copy(plot),design:copy(design),completedStages:0,createdAt:Date.now(),updatedAt:Date.now()}
  if(!this.persist(record))return {ok:false,message:this.error}
  return {ok:true,record:this.snapshot()}
 }
 updateVerifiedProgress(project){
  if(!this.record||!project?.plan||!Array.isArray(project.plan.stages))return false
  if(project.plan.designId!==this.record.design.id)return false
  const complete=project.plan.stages.filter((s,i)=>i<project.stage&&s.status==='confirmed'&&s.serverConfirmed===s.positions.length).length
  // Never roll back a server-verified stage because of a temporary reset.
  if(complete<=this.record.completedStages)return false
  if(complete>project.plan.stages.length)return false
  const next={...this.record,completedStages:complete,updatedAt:Date.now()}
  return this.persist(next)
 }
}
export function validPlot(plot){
 return !!plot&&plot.schema===1&&plot.permission==='plan-only'&&
  typeof plot.owner==='string'&&plot.owner.length>=2&&plot.owner.length<=60&&
  Number.isSafeInteger(plot.dimension)&&position(plot.center)&&
  plot.size?.x===50&&plot.size?.y===50&&plot.size?.z===50&&
  position(plot.bounds?.min)&&position(plot.bounds?.max)&&
  insidePlot(plot,plot.center,plot.dimension)&&
  ['x','y','z'].every(k=>plot.bounds.max[k]-plot.bounds.min[k]===49)
}
export function validHomeRecord(r){
 return !!r&&r.schema===1&&validPlot(r.plot)&&
  validatePlotBlueprint(r.plot,r.design)&&
  Number.isSafeInteger(r.completedStages)&&r.completedStages>=0&&r.completedStages<=256&&
  Number.isSafeInteger(r.createdAt)&&r.createdAt>0&&
  Number.isSafeInteger(r.updatedAt)&&r.updatedAt>=r.createdAt
}
