// Bounded A* over observed, supported, level walking cells. No digging or teleporting.
const key=p=>`${p.x},${p.y},${p.z}`
const metric=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)+Math.abs(a.y-b.y)
export function findPath(world,start,goal,{maxNodes=4096,maxDistance=48,allowSteps=false}={}){
 if(![start?.x,start?.y,start?.z,goal?.x,goal?.y,goal?.z].every(Number.isSafeInteger))return {ok:false,reason:'Use whole block coordinates.'}
 if(!allowSteps&&start.y!==goal.y)return {ok:false,reason:'Walking currently stays on one level; jumping and climbing are not implemented.'}
 if(metric(start,goal)>maxDistance)return {ok:false,reason:`Destination exceeds the ${maxDistance}-block walking limit.`}
 if(!world.walkable(start)||!world.walkable(goal))return {ok:false,reason:'Start or destination is unsafe or not observed. Look around near loaded terrain first.'}
 const open=[{p:start,g:0,f:metric(start,goal)}],cost=new Map([[key(start),0]]),parent=new Map(),visited=new Set()
 while(open.length&&visited.size<maxNodes){
  let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i
  const current=open.splice(best,1)[0],ck=key(current.p)
  if(visited.has(ck))continue
  visited.add(ck)
  if(ck===key(goal)){
   const path=[current.p];let at=ck
   while(parent.has(at)){const p=parent.get(at);path.push(p);at=key(p)}
   return {ok:true,path:path.reverse(),expanded:visited.size}
  }
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   for(const dy of (allowSteps?[0,1,-1]:[0])){
    const p={x:current.p.x+dx,y:current.p.y+dy,z:current.p.z+dz},pk=key(p),g=current.g+(dy?1.6:1)
    if(visited.has(pk)||metric(start,p)>maxDistance||!world.walkable(p)||g>=(cost.get(pk)??Infinity))continue
    if(dy===1&&!world.canJumpBetween?.(current.p,p))continue
    if(dy===-1&&!world.canDropBetween?.(current.p,p))continue
    cost.set(pk,g);parent.set(pk,current.p);open.push({p,g,f:g+metric(p,goal)})
   }
  }
 }
 return {ok:false,reason:visited.size>=maxNodes?'Route search reached its limit. Choose a closer target.':'No safe route through observed level ground.'}
}
