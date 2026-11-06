// Conservative obstruction decisions within a previously owner-confirmed plot.
// Bedrock does not expose who placed a block. Only simple natural-looking
// blocks away from external structures may be automatically excavated.
import {constructionExposure} from './construction-guard.js'
import {insidePlot} from './companion-plot.js'

const air=new Set(['air','cave_air','void_air'])
const natural=new Set(['dirt','grass_block','coarse_dirt','rooted_dirt','podzol','mycelium','stone','cobblestone','deepslate','tuff','granite','diorite','andesite','clay','mud','moss_block','dirt_path','snow','snow_layer','netherrack'])
const vegetation=new Set(['short_grass','tall_grass','fern','large_fern','dead_bush','dandelion','poppy','oxeye_daisy','blue_orchid','allium','azure_bluet','lily_of_the_valley','cornflower','leaf_litter'])
// Leaf litter is low ground cover in a confirmed owner plot, not an arbitrary
// canopy leaf, a sign, or a built block. It still requires diggable server
// data, verified air overlay, known overhead and construction-distance checks.
const forbidden=/(?:water|lava|fire|magma|cactus|powder_snow|tnt|portal|bedrock|spawner|end_gateway|campfire|berry_bush|cobweb)/
const falling=/(?:sand|gravel|anvil|concrete_powder)/
const index=p=>p.x+','+p.y+','+p.z
const integer=p=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
const stripped=n=>String(n||'').replace(/^minecraft:/,'')
const treePart=n=>/(?:^|_)(?:log|wood|stem|hyphae)$/.test(n)

export function classifyHomeObstruction(world,plot,pos,{ownedProjectBlocks=new Set()}={}){
 if(!integer(pos)||!plot||!insidePlot(plot,pos,world?.dimension))
  return {action:'stop',reason:'Outside the approved construction plot.'}
 const b=world?.block?.(pos),overlay=world?.block?.(pos,1)
 if(!b||!overlay)return {action:'observe',reason:'Block or fluid layer not received yet.'}
 const n=stripped(b.name)
 if(air.has(n))return {action:'clear',reason:'Construction cell is already empty.'}
 if(!air.has(stripped(overlay.name)))return {action:'ask',reason:'Occupied fluid or overlay: inspect before altering it.',position:pos,name:n}
 if(n.includes(':')||forbidden.test(n)||falling.test(n))
  return {action:'ask',reason:'Custom, hazardous or unstable block must be reviewed.',position:pos,name:n}
 if(!natural.has(n)&&!vegetation.has(n)&&!treePart(n))
  return {action:'ask',reason:'Block is not clearly a removable natural obstacle.',position:pos,name:n}
 if(treePart(n)){
  let canopy=false,unknown=false
  for(let dy=0;dy<=7;dy++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
   if(Math.abs(dx)+Math.abs(dz)>3)continue
   const p={x:pos.x+dx,y:pos.y+dy,z:pos.z+dz},v=world.block(p)
   if(!v){unknown=true;continue}
   if(/(?:^|_)leaves(?:_2)?$/.test(stripped(v.name)))canopy=true
  }
  if(!canopy)return {action:unknown?'observe':'ask',reason:'Log without an observed natural canopy may be part of a build.',position:pos,name:n}
 }
 const ext=constructionExposure(world,[pos],{ignoreVerifiedProjectBlocks:ownedProjectBlocks})
 // The owner gave this 50x50 plot for work. Tiny naturally removable
 // ground cover can be cleared when it is MORE than three blocks from
 // observed construction, even if a sign/torch is elsewhere in the broader
 // 15-block buffer. Solid mining, trees, actual builds and unknown blocks
 // always keep the full 15-block protection and all other safety checks.
 if(ext.state==='protected'&&!(n==='leaf_litter'&&ext.near?.distance>3))
  return {action:'ask',reason:'An existing structure is within the protected 15-block buffer.',near:ext.near,position:pos,name:n}
 if(ext.state==='unverified')return {action:'observe',reason:ext.reason,position:pos,name:n}
 const above=world.block({...pos,y:pos.y+1})
 if(!above)return {action:'observe',reason:'Overhead block not yet received.'}
 if(falling.test(stripped(above.name))||forbidden.test(stripped(above.name)))
  return {action:'ask',reason:'Falling block or hazard overhead.',position:pos,name:n}
 if(!b.diggable||!Number.isFinite(b.hardness)||b.hardness<0)
  return {action:'stop',reason:'Server block data does not permit ordinary mining.',position:pos,name:n}
 return {action:'auto-mine',reason:'Ordinary, observed natural obstruction is away from external structures.',position:pos,name:n}
}

export function nextHomeObstruction(world,plot,positions,options={}){
 if(!Array.isArray(positions)||positions.length<1||positions.length>256)
  return {action:'stop',reason:'Invalid bounded construction stage.'}
 for(const pos of positions){
  const decision=classifyHomeObstruction(world,plot,pos,options)
  if(decision.action!=='clear')return decision
 }
 return {action:'build',reason:'All positions clear and server-observed.'}
}

export function homeProjectOwnedCoordinates(world,stages,upTo){
 const allowed=new Set()
 for(const stage of (stages||[]).slice(0,upTo)){
  if(stage.status!=='confirmed'||stage.serverConfirmed!==stage.positions.length)continue
  for(const p of stage.positions){
   const v=world?.ownedPlacements?.get(world.dimension+':'+index(p))
   if(v?.name===stage.material&&world.block(p)?.name===stage.material)allowed.add(index(p))
  }
 }
 return allowed
}
