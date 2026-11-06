// World-grounded vanilla companion home planning. Plans do not place blocks.
// Existing Build jobs must verify each proposed voxel from the Realm server.
// A home isn't marked complete until the required stages and stations/bed
// have separate authoritative confirmation. Never modify outside owner land.
import {insidePlot} from './companion-plot.js'
const WOOL_COLORS=['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black']
const positive=n=>Number.isSafeInteger(n)&&n>0
const integer=p=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
const name=x=>String(x||'').replace(/^minecraft:/,'')
const k=p=>p.x+','+p.y+','+p.z
const dirs=[{x:0,z:1},{x:0,z:-1},{x:1,z:0},{x:-1,z:0}]
export const HOME_STAGE_LIMIT=64

export function bedAcquisition(stock={}, {recipesReceived=false}={}){
 const items=Object.fromEntries(Object.entries(stock).map(([k,v])=>[name(k),Number.isSafeInteger(v)&&v>0?v:0]))
 const ownedBed=Object.keys(items).find(x=>/^(?:[a-z]+_)?bed$/.test(x)&&x!=='bedrock'&&items[x]>0)
 if(ownedBed)return {phase:'bed-in-inventory',item:ownedBed,missing:[],canCraft:false,needsStation:false,provenance:'server inventory'}
 const wool=WOOL_COLORS.map(color=>({color,name:color+'_wool',count:items[color+'_wool']||0})).sort((a,b)=>b.count-a.count)[0]
 const color=wool.count? wool.color:'white'
 const woolHave=wool.count
 const planks=Object.entries(items).filter(([n])=>/_planks$/.test(n)).reduce((n,[,v])=>n+v,0)
 const logs=Object.entries(items).filter(([n])=>/_(?:log|wood|stem|hyphae)$/.test(n)).reduce((n,[,v])=>n+v,0)
 const missing=[]
 const woolNeed=Math.max(0,3-woolHave),planksNeed=Math.max(0,3-planks)
 if(woolNeed)missing.push({material:color+'_wool',count:woolNeed,options:[
   'Shear observed sheep for wool of a matching color; requires verified shears and reachable sheep.',
   'Craft wool from four string per wool when the correct server recipe is available.',
   'Find an unused bed in confirmed inventory, chest or village only with permission.'
 ]})
 if(planksNeed)missing.push({material:'planks',count:planksNeed,options:logs>0?
  ['Craft planks from observed logs; check received recipe and inventory.']:
  ['Collect a tree/log where mining is allowed; craft planks with received server recipe.']})
 return {phase:missing.length?'gather-materials':'craft-ready',item:color+'_bed',color,
   have:{wool:woolHave,planks,logs,string:items.string||0},missing,
   canCraft:!missing.length&&recipesReceived,needsStation:true,
   note:!recipesReceived?'Need the server craft recipe, not a guessed inventory transaction.':'The server recipe and crafting station must be checked immediately before crafting.'}
}
export function findBedFootprint(world,plot,anchor=plot?.center){
 if(!plot||plot.dimension!==0||!integer(anchor)||!world?.airAt||!world?.block||!world?.position)return null
 const near=[]
 for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){
  const foot={x:anchor.x+dx,y:anchor.y+1,z:anchor.z+dz}
  for(const d of dirs){
   const head={x:foot.x+d.x,y:foot.y,z:foot.z+d.z}
   if(!insidePlot(plot,foot,0)||!insidePlot(plot,head,0))continue
   if(!world.airAt(foot)||!world.airAt(head))continue
   // Bed feet and head both require solid observed support and no liquids.
   const supports=[{...foot,y:foot.y-1},{...head,y:head.y-1}]
   if(supports.some(p=>{
    const a=world.block(p),b=world.block(p,1)
    return !a||!b||!Array.isArray(a.shapes)||!a.shapes.length||!['air','cave_air','void_air'].includes(b.name)
   }))continue
   const reach=Math.hypot(world.position.x-(foot.x+.5),world.position.y-(foot.y-.2),world.position.z-(foot.z+.5))
   if(reach>4||reach<1)continue
   near.push({foot,head,orientation:d,distance:reach})
  }
 }
 near.sort((a,b)=>a.distance-b.distance)
 return near[0]||null
}
const allowed=(plot,points)=>points.every(p=>insidePlot(plot,p,plot.dimension))
function stageList(material,positions,label,plot,stageLimit=HOME_STAGE_LIMIT){
 if(!allowed(plot,positions))throw Error('The proposed structure extends beyond the owner-assigned plot.')
 const unique=new Set(positions.map(k))
 if(unique.size!==positions.length)throw Error('Duplicate placement in home blueprint.')
 const stages=[]
 for(let i=0;i<positions.length;i+=stageLimit)stages.push({type:'place-voxels',material,
   label:label+' '+(1+Math.floor(i/stageLimit)),positions:positions.slice(i,i+stageLimit),
   status:'preview',serverConfirmed:0})
 return stages
}
export function physicalHomePlan(plot,design,{stageLimit=HOME_STAGE_LIMIT}={}){
 if(!plot||!design||plot.dimension!==design.dimension||!positive(stageLimit)||stageLimit>256)throw Error('A valid owner-authorized house design is required.')
 const f=design.footprint
 if(!integer(f?.origin)||![f.width,f.length,f.height].every(positive)||f.width>32||f.length>32||f.height>30)throw Error('House dimensions exceed the supported staged builder.')
 const {x,y,z}=f.origin,w=f.width,l=f.length
 const floors=Math.max(1,Math.floor((f.height-2)/5))
 const parts=[],stages=[]
 const make=(part,material,coords)=>{
  if(!coords.length)return
  parts.push({name:part,material,count:coords.length})
  stages.push(...stageList(material,coords,part,plot,stageLimit))
 }
 const primary=design.materials?.[0]||'oak_planks'
 const walls=design.materials?.[1]||'cobblestone'
 const trim=design.materials?.[2]||primary
 // Bottom floor. Multi-storey interiors remain open until floor stages finish.
 for(let level=0;level<floors;level++){
  const h=y+level*5
  const floor=[]
  for(let dx=0;dx<w;dx++)for(let dz=0;dz<l;dz++)floor.push({x:x+dx,y:h,z:z+dz})
  make(level===0?'foundation':'upper-floor-'+level,primary,floor)
  const shell=[]
  const doorCenter=Math.floor(w/2),door=level===0
  for(let dy=1;dy<=4;dy++)for(let dx=0;dx<w;dx++)for(let dz=0;dz<l;dz++){
   if(dx!==0&&dx!==w-1&&dz!==0&&dz!==l-1)continue
   if(door&&dz===0&&dx===doorCenter&&dy<=2)continue
   // Window openings in each outer wall; glass can be placed later.
   if(dy===3&&(dz===0||dz===l-1)&&[Math.floor(w/4),Math.floor(w*3/4)].includes(dx))continue
   if(dy===3&&(dx===0||dx===w-1)&&[Math.floor(l/4),Math.floor(l*3/4)].includes(dz))continue
   shell.push({x:x+dx,y:h+dy,z:z+dz})
  }
  make('exterior-walls-'+level,walls,shell)
  // Functional ground-floor room separation with two-block-high doorways.
  if(level===0){
   const interior=[],splitX=Math.floor(w/2)
   for(let dz=1;dz<l-1;dz++)for(let dy=1;dy<=3;dy++){
    if([Math.floor(l/4),Math.floor(l*3/4)].includes(dz)&&dy<=2)continue
    interior.push({x:x+splitX,y:y+dy,z:z+dz})
   }
   make('room-partitions',trim,interior)
  }
 }
 const roofY=y+floors*5
 const roof=[]
 for(let dx=0;dx<w;dx++)for(let dz=0;dz<l;dz++)roof.push({x:x+dx,y:roofY,z:z+dz})
 make('roof',primary,roof)
 // A usable home also requires verified bed, crafting, storage and lighting.
 // This list remains explicit until interactive block placement is tested.
 const furniture=[
  {name:'bed',required:true,confirmed:false},
  {name:'crafting_table',required:true,confirmed:false},
  {name:'chest',required:true,confirmed:false},
  {name:'furnace',required:true,confirmed:false},
  {name:'lighting',required:true,confirmed:false}
 ]
 return {schema:1,kind:'staged-physical-home',designId:design.id,plotCenter:{...plot.center},
  dimension:plot.dimension,footprint:f,stages,parts,partCount:parts.length,stagesTotal:stages.length,
  placementsPlanned:parts.reduce((n,p)=>n+p.count,0),placementsVerified:0,furniture,
  status:'unstarted',completion:'unverified',noDestructiveEdits:true,
  note:'Every stage requires server-received terrain, supplies, permission, proximity, and per-block update confirmation. Home is not complete until roof, walls, entry, bed, storage and workstations are confirmed.'}
}
export function homeCompletion(plan,{bedConfirmed=false,stations={}}={}){
 if(!plan||!Array.isArray(plan.stages)||!Array.isArray(plan.furniture))return false
 if(plan.stages.some(s=>s.status!=='confirmed'||s.serverConfirmed!==s.positions.length))return false
 return bedConfirmed&&['crafting_table','chest','furnace','lighting'].every(n=>stations[n]===true)
}
export function inspectHomeCapacity({storage=null,roomCapacity=null,idleMs=0,plot=null,design=null,random=Math.random}={}){
 if(!plot||!design||idleMs<120000||typeof random!=='function')return {action:'none',reason:'No settled idle home is available.'}
 // A chest can only be called full if its actual container slots were read.
 const s=storage&&positive(storage.total)&&Number.isSafeInteger(storage.used)&&storage.used>=0&&storage.used<=storage.total?
  storage.used/storage.total:null
 const crowded=roomCapacity&&positive(roomCapacity.total)&&Number.isSafeInteger(roomCapacity.used)&&roomCapacity.used>=0&&roomCapacity.used<=roomCapacity.total?
  roomCapacity.used/roomCapacity.total:null
 if((s===null||s<.85)&&(crowded===null||crowded<.85))return {action:'observe',reason:'No confirmed pressure to expand. Continue existing tasks; idle creativity may generate a design preview only.'}
 const f=design.footprint,roof=f.origin.y+f.height
 const up=roof+6<=plot.bounds.max.y,down=f.origin.y-7>=plot.bounds.min.y
 if(!up&&!down)return {action:'ask-owner',reason:'Home expansion needs a larger owner-assigned plot.'}
 const direction=up&&down?(random()<.5?'up':'down'):up?'up':'down'
 const proposed={x:f.origin.x,y:direction==='up'?roof+1:f.origin.y-7,z:f.origin.z}
 if(!insidePlot(plot,proposed))return {action:'ask-owner',reason:'No validated expansion footprint inside land.'}
 return {action:'propose',direction,reason:s!==null&&s>=.85?'Chest usage verified above 85%.':'Room capacity verified above 85%.',
  origin:proposed,estimatedLevels:1,status:'preview-only',
  destructiveMining:direction==='down',permission:'new owner confirmation required',
  note:'Expansion does not start while idle. Validate terrain, structure, support and new material needs before placement or excavation.'}
}
export function assessHomeObstacle({world,targets,plot,allowMining=false}={}){
 if(!plot||!Array.isArray(targets)||targets.length>256||!targets.every(integer)||!allowed(plot,targets))return {action:'stop',reason:'The edit exceeds the authorized plot.'}
 let unknown=0,occupied=0,first=null
 for(const p of targets){const b=world?.block?.(p),extra=world?.block?.(p,1)
  if(!b||!extra){unknown++;continue}
  if(!['air','cave_air','void_air'].includes(b.name)){
   occupied++;first??={position:p,name:b.name}
  }
  if(!['air','cave_air','void_air'].includes(extra.name))return {action:'stop',reason:'Fluid or other overlay occupies the planned work cell.'}
 }
 if(unknown)return {action:'observe',reason:'Wait for missing server chunks; no speculative editing.',unknown}
 if(!occupied)return {action:'build',reason:'All target cells are empty and observed; check anchor/support and materials.'}
 return {action:allowMining?'request-clearance':'reroute',reason:'Construction targets overlap existing blocks; do not remove automatically.',occupied,first}
}
