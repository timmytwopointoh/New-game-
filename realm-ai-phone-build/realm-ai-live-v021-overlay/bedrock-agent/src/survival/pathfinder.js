// Bounded A* over observed, supported, level walking cells. No digging or teleporting.
const key=p=>`${p.x},${p.y},${p.z}`
const metric=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)+Math.abs(a.y-b.y)
export function findPath(world,start,goal,{maxNodes=4096,maxDistance=48,allowSteps=false,maxDrop=1,waterBudget=0,waterPenalty=3}={}){
 if(![start?.x,start?.y,start?.z,goal?.x,goal?.y,goal?.z].every(Number.isSafeInteger))return {ok:false,reason:'Use whole block coordinates.'}
 if(!allowSteps&&start.y!==goal.y)return {ok:false,reason:'This preview requires a level route. Enable step-aware navigation for jumps.'}
 if(metric(start,goal)>maxDistance)return {ok:false,reason:`Destination exceeds the ${maxDistance}-block walking limit.`}
 if(!world.walkable(start)||!world.walkable(goal))return {ok:false,reason:'Start or destination is unsafe or not observed. Look around near loaded terrain first.'}
 const sid=(p,wet)=>`${key(p)}|${wet}`
 const open=[{p:start,wet:world.shallowWater?.(start)?1:0,g:0,f:metric(start,goal)}],cost=new Map([[sid(start,world.shallowWater?.(start)?1:0),0]]),parent=new Map(),visited=new Set()
 while(open.length&&visited.size<maxNodes){
  let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i
  const current=open.splice(best,1)[0],ck=sid(current.p,current.wet)
  if(visited.has(ck))continue
  visited.add(ck)
  if(key(current.p)===key(goal)){
   const path=[current.p];let at=ck
   while(parent.has(at)){const p=parent.get(at);path.push(p.p);at=p.parent}
   return {ok:true,path:path.reverse(),expanded:visited.size,waterCrossing:path.some(p=>world.shallowWater?.(p))}
  }
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   for(const dy of (allowSteps?[0,1,...Array.from({length:Math.min(5,Math.max(1,Math.floor(maxDrop)))},(_,i)=>-i-1)]:[0])){
    const p={x:current.p.x+dx,y:current.p.y+dy,z:current.p.z+dz},water=!!world.shallowWater?.(p),wet=water?current.wet+1:0,pk=sid(p,wet),g=current.g+(dy?1.6+Math.max(0,-dy-1)*.4:1)+(water?waterPenalty:0)
    if(wet>waterBudget||visited.has(pk)||metric(start,p)>maxDistance||!world.walkable(p)||g>=(cost.get(pk)??Infinity))continue
    if(dy===1&&!world.canJumpBetween?.(current.p,p))continue
    if(dy<0&&!world.canDropBetween?.(current.p,p,{maxDrop}))continue
    cost.set(pk,g);parent.set(pk,{p:current.p,parent:ck});open.push({p,wet,g,f:g+metric(p,goal)})
   }
  }
 }
 return {ok:false,reason:visited.size>=maxNodes?'Route search reached its limit. Choose a closer target.':'No observed route through reachable steps or the permitted shallow-water crossing distance.'}
}
