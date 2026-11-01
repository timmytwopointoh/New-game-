// Bounded, on-device, Realm-scoped map of blocks the bot actually saw.
// A remembered coordinate is a *clue*, never proof that a block still exists.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {isTreeLog} from './internal-skills.js'

const MAX=384
const finite=p=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
export const noteworthy=name=>isTreeLog(name)||/(?:_ore|ancient_debris|chest|crafting_table|spawner|lava|water)$/.test(name)
const kind=name=>isTreeLog(name)?'tree':/(?:_ore|ancient_debris)$/.test(name)?'ore':'landmark'
const identifier=(b)=>`${b.dimension}:${b.kind}:${b.kind==='tree'?`${b.x},${b.z}`:`${b.x},${b.y},${b.z}`}`

export class LandmarkMemory{
 constructor({directory=null,scope=null}={}){this.directory=directory;this.scope=null;this.file=null;this.entries=[];this.checkpoints=[];this.readOnly=false;this.error='';this.setScope(scope)}
 setScope(scope){
  this.scope=scope?String(scope):null;this.entries=[];this.checkpoints=[];this.readOnly=false;this.error=''
  this.file=this.directory&&this.scope?path.join(this.directory,crypto.createHash('sha256').update(this.scope).digest('hex')+'.json'):null
  if(!this.file||!fs.existsSync(this.file))return
  try{
   const data=JSON.parse(fs.readFileSync(this.file,'utf8'))
   if(!Array.isArray(data.entries)||data.entries.length>MAX||data.version!==1)throw Error('invalid format')
   this.checkpoints=(Array.isArray(data.checkpoints)?data.checkpoints:[]).filter(p=>finite(p)&&p.dimension>=0&&p.dimension<=2&&Array.isArray(p.materials)).slice(0,128)
   this.entries=data.entries.filter(b=>finite(b)&&typeof b.name==='string'&&b.name.length<90&&b.dimension>=0&&b.dimension<=2&&['tree','ore','landmark'].includes(b.kind)&&Number.isFinite(b.lastSeenAt)).map(b=>({...b}))
  }catch{this.readOnly=true;this.error='Location memory could not be read; original saved file was preserved.'}
 }
 persist(){
  if(this.readOnly||!this.file)return
  fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})
  const tmp=this.file+'.tmp'
  fs.writeFileSync(tmp,JSON.stringify({version:1,entries:this.entries,checkpoints:this.checkpoints}),{mode:0o600})
  fs.renameSync(tmp,this.file)
 }
 remember(visible,dimension=0,now=Date.now()){
  if(!this.scope||this.readOnly||!Number.isSafeInteger(dimension)||dimension<0||dimension>2)return 0
  let newRecords=0
  for(const p of visible||[]){
   if(!finite(p)||!noteworthy(p.name))continue
   const item={x:p.x,y:p.y,z:p.z,dimension,kind:kind(p.name),name:p.name,lastSeenAt:now}
   const id=identifier(item),existing=this.entries.findIndex(b=>identifier(b)===id)
   if(existing>=0){const previous=this.entries[existing];if(item.kind==='tree'&&previous.y<item.y)item.y=previous.y;this.entries[existing]=item}
   else{this.entries.push(item);newRecords++}
  }
  if(newRecords||visible?.length){this.entries.sort((a,b)=>b.lastSeenAt-a.lastSeenAt);this.entries=this.entries.slice(0,MAX);this.persist()}
  return newRecords
 }
 recordCheckpoint(world,{yaw=null,now=Date.now()}={}){
  if(!this.scope||this.readOnly||!world?.standPosition||typeof world.scan!=='function')return
  const pos=world.standPosition()
  if(!finite(pos))return
  const visible=world.scan(null,{yaw,fov:yaw===null?360:100,range:8})
  // Short aggregate observation, rather than saving thousands of ordinary
  // dirt/stone positions. These are actual exposed, line-of-sight materials.
  const materials=(visible?.counts||[]).slice(0,6).map(([name,count])=>[String(name).slice(0,72),count])
  const entry={...pos,dimension:world.dimension,materials,lastSeenAt:now}
  this.checkpoints=this.checkpoints.filter(p=>p.dimension!==entry.dimension||Math.hypot(p.x-pos.x,p.z-pos.z)>2)
  this.checkpoints.unshift(entry);this.checkpoints=this.checkpoints.slice(0,128)
  this.persist()
 }
 observe(world,{yaw=null,fov=100,now=Date.now()}={}){
  if(!world?.position||typeof world.scan!=='function')return 0
  // World.scan first checks received blocks and real line of sight; no blind
  // chunk-cache probing or scanning through solid terrain is permitted.
  const results=world.scan(null,{yaw,fov,range:8,filter:noteworthy,maxFound:96})
  const updated=this.remember(results?.found,world.dimension,now)
  this.recordCheckpoint(world,{yaw,now})
  return updated
 }
 treeCandidates(dimension,position,{exclude=new Set()}={}){
  if(!position)return []
  return this.entries.filter(p=>p.dimension===dimension&&p.kind==='tree'&&!exclude.has(identifier(p)))
   .sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))
 }
 forgetTree(pos,dimension){const target={...pos,kind:'tree',dimension};const before=this.entries.length;this.entries=this.entries.filter(e=>identifier(e)!==identifier(target));if(before!==this.entries.length)this.persist()}
 snapshot(){return {scopeKnown:!!this.scope,locations:this.entries.length,checkpoints:this.checkpoints.length,trees:this.entries.filter(x=>x.kind==='tree').length,ores:this.entries.filter(x=>x.kind==='ore').length,error:this.error}}
}
