// Immediate, owner-invited home intuition: make an original small first shelter
// based on real observations, with a fresh random choice each time.
// This only PLANS. All edits still flow through guarded, server-confirmed
// HomeProject stages; unknown chunks, unsafe terrain and missing materials wait.
import {insidePlot,planUniqueHome,validatePlotBlueprint} from './companion-plot.js'

const air=new Set(['air','cave_air','void_air'])
const hazardous=/(?:water|lava|fire|powder_snow|cactus|magma|portal|campfire|cobweb)/
const woods=['oak','spruce','birch','jungle','acacia','dark_oak','mangrove','cherry','pale_oak','crimson','warped']
const known=(p)=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
const clamp=(x)=>Math.min(.999999999,Math.max(0,Number.isFinite(x)?x:0.5))
const choice=(items,pick)=>items[Math.min(items.length-1,Math.floor(clamp(pick())*items.length))]
const normalized=x=>String(x||'').replace(/^minecraft:/,'')
export const NEW_HOME_SPOT=/^(?:(?:this|here) is (?:your|the) (?:new )?(?:home|house|base)(?: spot| location| site| place)?(?: right here)?|(?:make|set|call|use) (?:this|here) (?:your|the) (?:new )?(?:home|house|base)(?: spot| location| site)?|(?:you can|please) (?:live|build your home|make your home) here|welcome to your new home(?: spot)?|this (?:spot|place) is (?:your|for your) (?:new )?home)$/i

export function daylightDeadline(serverTime,{receivedAt=0,now=Date.now()}={}){
 if(!Number.isFinite(serverTime)||!Number.isFinite(receivedAt)||receivedAt<=0||now<receivedAt||now-receivedAt>180000)
  return {phase:'unknown',ticksUntilNight:null,minutesUntilNight:null,urgent:true,source:'no fresh server clock'}
 const t=((Math.floor(serverTime)%24000)+24000)%24000
 const phase=t>=12500&&t<23000?'night':t>=11000&&t<12500?'dusk':'day'
 const ticks=phase==='night'?0:t<12500?12500-t:36500-t
 return {phase,ticksUntilNight:ticks,minutesUntilNight:Math.round(ticks/1200*10)/10,
  urgent:phase!=='day'||ticks<=5000,source:'last confirmed Realm clock'}
}

function sampleSite(world,plot,origin,width){
 let observed=0,open=0,supported=0,hazards=0,occupied=0
 for(let dx=0;dx<width;dx++)for(let dz=0;dz<width;dz++){
  const p={x:origin.x+dx,y:origin.y,z:origin.z+dz}
  if(!insidePlot(plot,p))return null
  const b=world.block?.(p),overlay=world.block?.(p,1),under=world.block?.({...p,y:p.y-1})
  if(!b||!overlay||!under)continue
  observed++
  const n=normalized(b.name),layer=normalized(overlay.name),ground=normalized(under.name)
  if(hazardous.test(n)||hazardous.test(layer)||hazardous.test(ground))hazards++
  if(air.has(n)&&air.has(layer))open++;else occupied++
  if(!air.has(ground)&&under.shapes?.length)supported++
 }
 const total=width*width
 return {origin,width,observed,open,supported,hazards,occupied,total,
  fullyObserved:observed===total,freeCells:open,groundedCells:supported}
}

function chooseSite(world,plot,width,pick){
 const offsets=[[-width-2,1],[2,1],[1,-width-2],[1,2],
  [-Math.floor(width/2),-Math.floor(width/2)],
  [-width-2,-width-2],[3,3],[-width-2,3],[3,-width-2]]
 const scored=[]
 for(const [dx,dz] of offsets){
  const origin={x:plot.center.x+dx,y:plot.center.y,z:plot.center.z+dz}
  const site=sampleSite(world,plot,origin,width)
  if(!site)continue
  const score=site.open*4+site.supported*2-site.occupied*8-site.hazards*100-(site.total-site.observed)*5+
   clamp(pick())*2
  scored.push({...site,score})
 }
 scored.sort((a,b)=>b.score-a.score)
 return scored[0]||null
}

export function observeHomeMaterials(world){
 const stock=typeof world.items==='function'?world.items():{}
 const seen=[]
 try{
  const result=world.scan?.(null,{range:8,fov:360,maxFound:256,filter:name=>
   typeof name==='string'&&(/(?:^|_)log$|(?:^|_)stem$|^dirt$|^grass_block$|^podzol$|^coarse_dirt$/.test(normalized(name)))})
  if(Array.isArray(result?.found))seen.push(...result.found)
 }catch{}
 const dirt=seen.filter(p=>['dirt','grass_block','podzol','coarse_dirt'].includes(normalized(p.name))).length
 const trees=woods.map(wood=>({wood,observed:seen.filter(p=>[wood+'_log',wood+'_stem'].includes(normalized(p.name))).length,
  planks:wood+'_planks',inInventory:Number(stock[wood+'_planks']||0)}))
 return {stock,dirt,trees,observedBlocks:seen.length}
}

export function decideFirstHome(world,plot,{serverTime=null,serverTimeAt=0,now=Date.now(),pick=Math.random}={}){
 if(!plot||!known(plot.center)||!world||plot.dimension!==world.dimension)throw Error('Home choice requires verified owner land and matching Realm dimension.')
 const deadline=daylightDeadline(serverTime,{receivedAt:serverTimeAt,now})
 const resources=observeHomeMaterials(world)
 // Daylight, visible space and a fresh random preference influence the idea.
 // No scripted wood-only or dirt-only result: both options can win.
 const width=deadline.urgent?9:choice([9,11],pick)
 const site=chooseSite(world,plot,width,pick)
 if(!site)throw Error('No candidate starter footprint is inside the approved 50-block land.')
 const candidates=[{material:'dirt',kind:'earthwork',
   weight:1+(resources.stock.dirt||0)/16+resources.dirt/8}]
 for(const t of resources.trees){
  if(t.observed||t.inInventory)candidates.push({material:t.planks,kind:'timber',
   weight:1+t.inInventory/16+t.observed/8})
 }
 // No observed timber: wood remains a possible original idea, but dirt is
 // preferred until actual tree/stock evidence arrives.
 if(candidates.length===1&&!resources.dirt&&!resources.stock.dirt)
  candidates.push({material:'oak_planks',kind:'timber',weight:1})
 const sum=candidates.reduce((n,c)=>n+Math.max(0,c.weight),0),roll=clamp(pick())*sum
 let cumulative=0,selected=candidates[candidates.length-1]
 for(const candidate of candidates){cumulative+=Math.max(0,candidate.weight);if(roll<cumulative){selected=candidate;break}}
 const plan=planUniqueHome(plot,{pick})
 const origin={...site.origin}
 const rooms=['entrance','bedroom','chest-storage','crafting-workshop']
 const half=Math.floor(width/2),roomW=Math.floor((width-3)/2),roomL=roomW
 const cells=[{x:1,z:1},{x:half+1,z:1},{x:1,z:half+1},{x:half+1,z:half+1}]
 plan.rooms=rooms.map((name,i)=>({name,level:0,
  origin:{x:origin.x+cells[i].x,y:origin.y+1,z:origin.z+cells[i].z},width:roomW,length:roomL}))
 plan.footprint={origin,width,length:width,height:7}
 plan.style=selected.kind==='earthwork'?choice(['burrow-cottage','earthwork-hideaway','hilltop-den'],pick):
  choice(['woodland-cabin','timber-workshop','forest-hideout'],pick)
 plan.materials=[selected.material,selected.material,selected.material]
 plan.estimatedBlocks={foundation:width*width,wallShell:(width*4-4)*4,
  roof:width*width,furniture:'bed and stations require server-confirmed inventory and recipes',knownExact:false}
 plan.note='Original short-first-night starter idea. Land grant authorizes safe empty-cell stages only; destructive changes still require specific approval.'
 if(!validatePlotBlueprint(plot,plan))throw Error('The improvised starter home exceeded its approved plot.')
 const readiness=site.hazards?'hazard-observed':!site.fullyObserved?'awaiting-terrain':
  site.occupied?'occupied-cells':'observed-clear-cells'
 return {design:plan,choice:{kind:selected.kind,foundation:selected.material,width,style:plan.style},
  site:{...site,readiness},materials:{observedDirt:resources.dirt,observedTrees:resources.trees.filter(t=>t.observed).map(t=>t.wood),
   inventoryFoundation:Number(resources.stock[selected.material]||0)},
  daylight:deadline,priority:deadline.urgent?'starter-shelter-first':'shelter-before-furnishings'}
}
