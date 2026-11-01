import {findPath} from './pathfinder.js'
import {Building} from './building.js'
const key=p=>`${p.x},${p.y},${p.z}`
// Bounded, straight, one-block-wide bridges. The virtual view is planning only;
// the navigation controller must confirm every support before walking onto it.
export function dirtBridge(world,start,goal,{excluded=()=>false,maxDrop=5}={}){
 if(!world.editModeVerified||world.abilityState?.effective.build===false||!world.inventoryKnown)return null
 const builder=new Building(world),stock=builder.inventory('dirt').reduce((n,[,i])=>n+i.count,0),dirt=world.registry?.blocksByName.dirt
 if(!stock||!dirt||!world.walkable(start))return null
 const bases=[]
 for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
  const p={x:start.x+dx,y:start.y,z:start.z+dz}
  if(Math.abs(dx)+Math.abs(dz)<=2&&world.walkable(p)&&!excluded(p))bases.push(p)
 }
 bases.sort((a,b)=>Math.hypot(a.x-goal.x,a.z-goal.z)-Math.hypot(b.x-goal.x,b.z-goal.z))
 for(const base of bases){
  const prefix=findPath(world,start,base,{allowSteps:true,maxNodes:128,maxDistance:8,maxDrop})
  if(!prefix.ok||prefix.path.some(excluded))continue
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const added=new Map(),steps=[],stairs=[],view=Object.create(world)
   view.block=(p,layer=0)=>!layer&&added.has(key(p))?world.Block.fromStateId(dirt.defaultState,0):world.block(p,layer)
   for(let i=1;i<=7;i++){
    const cell={x:base.x+dx*i,y:base.y,z:base.z+dz*i},support={...cell,y:cell.y-1}
    if(excluded(cell))break
    if(world.walkable(cell)){
     if(!added.size)break
     const suffix=findPath(world,cell,goal,{allowSteps:true,maxNodes:768,maxDrop})
     if(suffix.ok&&!suffix.path.some(excluded))return {ok:true,path:[...prefix.path,...steps,...suffix.path],stairs,dirtRequired:added.size,bridge:true,expanded:prefix.expanded+suffix.expanded}
     break
    }
    if(i>6||!world.airAt(support)||!world.airAt(cell)||!world.airAt({...cell,y:cell.y+1})||world.gameMode!=='creative'&&added.size>=stock)break
    if(!new Building(view).begin({shape:'block',origin:support,material:'dirt'}).accepted)break
    added.set(key(support),support)
    if(!view.walkable(cell))break
    steps.push(cell);stairs.push({cell,targets:[support],kind:'bridge'})
   }
  }
 }
 return null
}
