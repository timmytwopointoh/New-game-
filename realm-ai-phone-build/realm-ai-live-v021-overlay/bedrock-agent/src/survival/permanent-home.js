// First owner-confirmed home is fixed for this Realm. Safe, atomic, private
// per-Realm record: neither chat nor learning can quietly move or reset it.
// This is NOT a server-verified Bedrock respawn point (that needs a real bed).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {readPrivateJson,writePrivateJson} from './private-json.js'
import {validatePlotBlueprint,insidePlot} from './companion-plot.js'
import {physicalHomePlan} from './home-architecture.js'

const xyz=p=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
const same=(a,b)=>xyz(a)&&xyz(b)&&['x','y','z'].every(k=>a[k]===b[k])
const scoped=s=>typeof s==='string'&&s.length>0&&s.length<180&&/^[a-z0-9_.:-]+$/i.test(s)
export function validPermanentHome(record){
 if(!record||record.schema!==1||!record.plot||!record.design)return false
 const p=record.plot,d=record.design
 if(!xyz(p.center)||!xyz(p.bounds?.min)||!xyz(p.bounds?.max)||
    !Number.isSafeInteger(p.dimension)||p.dimension<0||p.dimension>2||
    p.permission!=='plan-only'||!p.owner||typeof p.owner!=='string'||p.owner.length>32||
    p.size?.x!==50||p.size?.y!==50||p.size?.z!==50)return false
 if(!['x','y','z'].every(k=>p.bounds.min[k]===p.center[k]-24&&
    p.bounds.max[k]===p.center[k]+25))return false
 if(!insidePlot(p,p.center)||!validatePlotBlueprint(p,d))return false
 if(typeof d.id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(d.id))return false
 const stages=physicalHomePlan(p,d).stages.length
 if(!Number.isSafeInteger(record.verifiedStages)||record.verifiedStages<0||
    record.verifiedStages>stages||typeof record.autoResume!=='boolean')return false
 return true
}
export class PermanentHome {
 constructor({directory=null,scope=null}={}){
  this.directory=directory;this.file=null;this.scope=null;this.record=null;this.error=''
  this.setScope(scope)
 }
 setScope(scope){
  this.scope=scoped(scope)?String(scope):null
  this.file=this.directory&&this.scope?
   path.join(this.directory,crypto.createHash('sha256').update(this.scope).digest('hex')+'.json'):null
  this.record=null;this.error=''
  if(!this.file||!fs.existsSync(this.file))return
  try {
   const value=readPrivateJson(this.file,131072)
   if(!validPermanentHome(value))throw new Error('Invalid saved home record')
   this.record=value
  }catch{
   this.error='Saved home could not be verified. The existing private file was not changed; ask owner to inspect diagnostics.'
  }
 }
 get hasHome(){return !!this.record}
 get isBlocked(){return !!this.error}
 saveFirst(plot,design,{autoResume=true,now=Date.now()}={}){
  if(!this.file)return {ok:false,reason:'A selected Realm is required before saving a permanent home.'}
  if(this.error)return {ok:false,reason:this.error}
  if(this.record||fs.existsSync(this.file))
   return {ok:false,reason:'Permanent home is already set in this Realm. It cannot be replaced.'}
  const value={schema:1,plot,design,verifiedStages:0,autoResume:!!autoResume,createdAt:now,updatedAt:now}
  try {
   if(!validPermanentHome(value))throw new Error('Home or blueprint is not valid for the approved plot.')
   writePrivateJson(this.file,value)
   const saved=readPrivateJson(this.file,131072)
   if(!validPermanentHome(saved))throw new Error('Written home record failed verification.')
   this.record=saved
   return {ok:true,reason:'First owner-assigned home is now locked and saved to private Realm storage.'}
  }catch(e){
   // Do not silently overwrite an unknown or corrupt private record.
   this.error='Could not securely persist permanent home: '+String(e.message||e).slice(0,120)
   return {ok:false,reason:this.error}
  }
 }
 saveProgress({verifiedStages=null,autoResume=null}={}){
  if(!this.record||!this.file||this.error)return false
  const next={...this.record,updatedAt:Date.now()}
  if(verifiedStages!==null){
   if(!Number.isSafeInteger(verifiedStages)||verifiedStages<this.record.verifiedStages)return false
   next.verifiedStages=verifiedStages
  }
  if(autoResume!==null)next.autoResume=autoResume===true
  if(!validPermanentHome(next))return false
  try{writePrivateJson(this.file,next);this.record=next;return true}
  catch{this.error='Could not save home progress. Old record remains intact.';return false}
 }
 summary(){
  return this.record?{
   permanent:true,realmScoped:true,owner:this.record.plot.owner,
   center:{...this.record.plot.center},dimension:this.record.plot.dimension,
   verifiedStages:this.record.verifiedStages,autoResume:this.record.autoResume,
   createdAt:this.record.createdAt,saveError:this.error||null
  }:{permanent:false,realmScoped:true,saveError:this.error||null}
 }
}
