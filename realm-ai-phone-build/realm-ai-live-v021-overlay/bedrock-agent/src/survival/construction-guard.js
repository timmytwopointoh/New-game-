// Construction protection for vanilla Realm bot autonomous edits.
// Minecraft chunks do NOT disclose who placed each block; this is a
// conservative manufactured-block detector, not a claim of true provenance.
export const CONSTRUCTION_BUFFER=15
const artificial=/(?:planks|bricks|tiles|stairs|slab|glass|concrete|terracotta|wool|fence|wall|door|trapdoor|sign|lantern|torch|carpet|polished|chiseled|cut_|smooth_|copper|rail|chain|piston|observer|redstone|button|lever|pressure_plate|scaffolding|stonecutter|campfire|crafting_table|bookshelf|beacon|amethyst_block|iron_bars|tnt|bed$)/
const protectedBlock=/(?:chest|barrel|shulker|furnace|hopper|dispenser|dropper|spawner|bedrock|portal|command_block|structure_block|beehive|bee_nest|vault|trial_spawner|enchanting_table|brewing_stand|loom|smoker|blast_furnace|grindstone|composter|anvil|bell)/
const air=new Set(['air','cave_air','void_air'])
const key=p=>p.x+','+p.y+','+p.z
const valid=p=>!!p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
const nameOf=b=>String(b?.name||'').replace(/^minecraft:/,'')
export function builtBlockEvidence(name) {
 const n=nameOf({name})
 if(!n||air.has(n))return false
 // Add-on blocks are remembered but never classified as natural.
 if(n.includes(':'))return true
 return protectedBlock.test(n)||artificial.test(n)
}
export function approvedEdit(world,kind,positions,now=Date.now()) {
 const grant=world?.editApproval
 if(!grant||grant.kind!==kind||grant.dimension!==world.dimension||grant.expires<=now||!Array.isArray(positions)||!positions.length)return false
 return positions.every(p=>valid(p)&&grant.targets?.has(key(p)))
}
// Work-stage scanning uses a SINGLE expanded box, not 256 separate sphere scans.
// Unloaded cells within three blocks cause a conservative "unverified" state.
// No scanning/chunk loading can establish provenance for all natural materials.
export function constructionExposure(world,positions,{radius=CONSTRUCTION_BUFFER}={}) {
 if(!world?.block||!Array.isArray(positions)||!positions.length||positions.length>256||!positions.every(valid)||radius!==CONSTRUCTION_BUFFER)
  return {state:'unverified',reason:'Valid observed work coordinates are required.'}
 const min={x:Math.min(...positions.map(p=>p.x)),y:Math.min(...positions.map(p=>p.y)),z:Math.min(...positions.map(p=>p.z))}
 const max={x:Math.max(...positions.map(p=>p.x)),y:Math.max(...positions.map(p=>p.y)),z:Math.max(...positions.map(p=>p.z))}
 const vol=(max.x-min.x+1+radius*2)*(max.y-min.y+1+radius*2)*(max.z-min.z+1+radius*2)
 if(vol>270000)return {state:'unverified',reason:'Work area is too large for a safe construction scan. Divide the project into smaller stages.'}
 const bounds={x0:min.x-radius,x1:max.x+radius,y0:min.y-radius,y1:max.y+radius,z0:min.z-radius,z1:max.z+radius}
 // AABB is the fast reject; exact check uses a fifteen-block sphere around
 // any changed block. A large wall may consist of up to 256 changed blocks.
 const distanceSq=(x,y,z)=>positions.reduce((best,p)=>Math.min(best,(p.x-x)**2+(p.y-y)**2+(p.z-z)**2),Infinity)
 let unknownNear=false,near=null,closest=Infinity,seen=0
 const placed=world.ownedPlacements
 if(placed&&typeof placed.values==='function')for(const p of placed.values()){
  if(p.dimension!==world.dimension||!valid(p))continue
  const d=distanceSq(p.x,p.y,p.z)
  if(d<=radius*radius&&d<closest){closest=d;near={position:{x:p.x,y:p.y,z:p.z},name:p.name||'previously-placed block',distance:Math.sqrt(d)}}
 }
 // Scan full observed volume for manufactured/protected structures. Ignore
 // air, but unknown cells close to the edit position remain uncertain.
 for(let y=bounds.y0;y<=bounds.y1;y++)for(let x=bounds.x0;x<=bounds.x1;x++)for(let z=bounds.z0;z<=bounds.z1;z++){
  const d=distanceSq(x,y,z)
  if(d>radius*radius)continue
  const p={x,y,z},block=world.block(p),overlay=world.block(p,1)
  seen++
  if(!block||!overlay){if(d<=9)unknownNear=true;continue}
  for(const b of [block,overlay]){
   if(builtBlockEvidence(b.name)&&d<closest){closest=d;near={position:p,name:b.name,distance:Math.sqrt(d)}}
  }
  // Finding a near structure is conclusive; do not make a dangerous
  // navigation assumption from missing far-away chunks.
  if(near&&closest<=9)return {state:'protected',near,scanned:seen,buffer:radius}
 }
 if(near)return {state:'protected',near,scanned:seen,buffer:radius}
 if(unknownNear)return {state:'unverified',reason:'Nearby chunks or custom-block geometry have not been received. Look around before editing.',scanned:seen}
 return {state:'clear',scanned:seen,buffer:radius}
}
export class EditConfirmations {
 constructor(){this.pending=null}
 reset(){this.pending=null}
 request({kind,positions,description,scope,execute,now=Date.now()}){
  if(!['mine','build'].includes(kind)||!Array.isArray(positions)||!positions.length||positions.length>256||!positions.every(valid)||typeof execute!=='function')
   return {accepted:false,queued:false,message:'Invalid edit request; no work started.'}
  // Numeric confirmation is deliberately separate from any word teaching,
  // command queue or unrelated conversation.
  const code=String(Math.floor(100000+Math.random()*900000))
  this.pending={kind,positions:positions.map(p=>({...p})),description:String(description).slice(0,130),scope,expires:now+120000,code,execute}
  return {accepted:false,queued:false,confirmationRequired:true,message:`Existing construction is within 15 blocks. For this specific ${kind} action: ${description}. Reply "confirm edit ${code}" within two minutes to authorize only these coordinates, or "cancel edit". Nothing has been changed.`}
 }
 confirm(raw,scope,world,now=Date.now()){
  const command=String(raw||'').trim().toLowerCase(),p=this.pending
  if(!p)return {accepted:false,queued:false,message:'No edit approval is pending.'}
  if(command==='cancel edit'||command==='no'){this.reset();return {accepted:true,queued:false,message:'Edit cancelled. No blocks were changed.'}}
  if(!/^(?:yes|confirm edit \d{6})$/.test(command))return {accepted:false,queued:false,message:'Confirm with the requested six-digit edit code, or "yes" while this exact approval is pending.'}
  if(now>p.expires||p.scope?.realm!==scope?.realm||p.scope?.dimension!==scope?.dimension||world.dimension!==p.scope?.dimension){this.reset();return {accepted:false,queued:false,message:'Edit approval expired or the Realm/dimension changed. No work started.'}}
  if(command!=='yes'&&command!==`confirm edit ${p.code}`)return {accepted:false,queued:false,message:'Wrong confirmation code. No work started.'}
  this.reset()
  const prior=world.editApproval
  world.editApproval={kind:p.kind,dimension:world.dimension,targets:new Set(p.positions.map(key)),expires:now+300000}
  try{
   const result=p.execute()
   if(result?.accepted===false){world.editApproval=prior||null}
   return {...result,approval:`Confirmed owner-only ${p.kind} task (${p.positions.length} coordinates).`}
  }catch(e){world.editApproval=prior||null;return {accepted:false,queued:false,message:'Edit could not start: '+String(e.message||e).slice(0,110)}}
 }
}
