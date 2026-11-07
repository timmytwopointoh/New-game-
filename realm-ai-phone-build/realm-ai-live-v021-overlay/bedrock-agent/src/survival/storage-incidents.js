// Chest disappearance and dropped-item evidence, confined to structures this
// companion has already placed/recorded. Never guesses chest contents, culprit,
// item ownership or amount. Read-only: NO automatic player/container edits.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const posKey=p=>[p.dimension,p.x,p.y,p.z].join(':')
const valid=p=>p&&[p.x,p.y,p.z,p.dimension].every(Number.isSafeInteger)
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<=4
export class StorageIncidents{
 constructor(controller,{directory=null,scope=null}={}){
  this.c=controller;this.directory=directory;this.file=null;this.scope=null;this.incidents=[];this.error='';this.readOnly=false;this.lastReportAt=0
  this.setScope(scope)
 }
 setScope(scope){
  this.scope=scope?String(scope):null;this.incidents=[];this.error='';this.readOnly=false
  this.file=this.scope&&this.directory?path.join(this.directory,crypto.createHash('sha256').update(this.scope).digest('hex')+'.json'):null
  if(!this.file||!fs.existsSync(this.file))return
  try{
   const a=JSON.parse(fs.readFileSync(this.file,'utf8'))
   if(!Array.isArray(a)||a.length>64)throw Error('Bad record')
   this.incidents=a.filter(i=>valid(i.position)&&['missing-observed','removed-server-update','reappeared-observed'].includes(i.status)&&
    Number.isSafeInteger(i.seenAt)&&i.seenAt>=0).slice(-64).map(i=>({...i,nearbyDrops:Array.isArray(i.nearbyDrops)?i.nearbyDrops.slice(0,16):[]}))
  }catch{this.readOnly=true;this.error='Chest incident memory unreadable; original file preserved.'}
 }
 persist(){
  if(!this.file||this.readOnly)return
  try{
   fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})
   fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.incidents.slice(-64)),{mode:0o600})
   fs.renameSync(this.file+'.tmp',this.file)
  }catch{this.error='Chest incident could not be saved.'}
 }
 observe(now=Date.now()){
  const w=this.c.world,ws=this.c.workshop
  if(!w?.enabled||!w.registry||!ws?.records)return
  let changed=false
  const seen=new Set()
  for(const p of ws.records){
   if(p.name!=='chest'||p.dimension!==w.dimension||!valid(p)||seen.has(posKey(p)))continue
   seen.add(posKey(p))
   const b=w.block(p)
   if(!b)continue // Unknown or unloaded is NOT confirmation of destruction.
   const index=this.incidents.findIndex(i=>posKey(i.position)===posKey(p)&&i.status!=='reappeared-observed')
   if(b.name==='chest'){
    if(index>=0){
     this.incidents[index].status='reappeared-observed'
     this.incidents[index].reappearedAt=now
     this.incidents[index].note='Chest block observed again. Prior contents have NOT been verified.'
     this.c.report?.('Saved chest at '+p.x+','+p.y+','+p.z+' is visible again; contents still need a real container inspection.')
     changed=true
    }
    continue
   }
   const revision=w.blockRevisions?.get(p.x+','+p.y+','+p.z+',0')||0
   const status=revision>0?'removed-server-update':'missing-observed'
   if(index<0){
    this.incidents.push({position:{x:p.x,y:p.y,z:p.z,dimension:p.dimension},status,
     seenAt:now,lastObservedBlock:b.name,nearbyDrops:[],note:'Container contents not observed; no item recovery has been claimed.'})
    if(this.incidents.length>64)this.incidents.shift()
    this.c.report?.('Saved chest is no longer present at '+p.x+','+p.y+','+p.z+
     (revision>0?' (server block update).':' (newly observed terrain).')+
     ' Checking nearby dropped items. I will not assume what was inside or take items automatically.')
    changed=true
   }else if(status==='removed-server-update'&&this.incidents[index].status==='missing-observed'){
    this.incidents[index].status=status;changed=true
   }
  }
  for(const i of this.incidents){
   if(i.status==='reappeared-observed'||i.position.dimension!==w.dimension)continue
   const drops=[...(w.drops?.values?.()||[])].filter(d=>d?.position&&near(i.position,d.position)&&typeof d.name==='string')
     .slice(0,16).map(d=>({name:d.name,count:Number.isSafeInteger(d.count)?d.count:1}))
   const prev=JSON.stringify(i.nearbyDrops||[])
   // Nearby items are evidence only of ground entities, NOT proof they came
   // from this chest, nor evidence that they remain after the next update.
   if(prev!==JSON.stringify(drops)){
    i.nearbyDrops=drops;i.dropsObservedAt=now
    changed=true
   }
  }
  if(changed)this.persist()
 }
 latest(){return this.incidents.at(-1)||null}
 snapshot(){const latest=this.latest();return {incidentCount:this.incidents.length,latest,
  recoveryRequiresObservedDrops:true,automaticContainerLoot:false,
  chestContentsKnown:false,error:this.error}}
}
