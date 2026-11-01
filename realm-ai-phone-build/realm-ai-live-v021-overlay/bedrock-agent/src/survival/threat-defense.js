// Defensive evasion only: no damage packets, teleports, player targets or
// global Realm commands. Uses actual observed mobs and received terrain.
const TYPE=/(?:^|:)(?:zombie(?:_villager)?|husk|drowned|skeleton|stray|bogged|wither_skeleton|creeper|spider|cave_spider|witch|pillager|vindicator|ravager|warden|phantom|silverfish|endermite|blaze|ghast|hoglin|zoglin|piglin_brute|breeze)(?:$|_)/i
export function nearbyHostiles(world,range=7){
 const pos=world?.position;if(!pos)return []
 return [...(world.entities?.values?.()||[])].filter(e=>TYPE.test(String(e.type||''))&&e.position&&[e.position.x,e.position.y,e.position.z].every(Number.isFinite)).map(e=>({type:String(e.type),position:e.position,distance:Math.hypot(e.position.x-pos.x,e.position.z-pos.z,e.position.y-pos.y)})).filter(e=>e.distance<=range).sort((a,b)=>a.distance-b.distance)
}
export function safestEscape(nav,hostiles,{maxRadius=8}={}){
 const world=nav.world,start=world.standPosition?.()
 if(!start||!hostiles.length)return null
 const threat=hostiles[0],distance=p=>Math.hypot(p.x+.5-threat.position.x,p.z+.5-threat.position.z)
 const initial=distance(start)
 let best=null
 for(const radius of [4,6,maxRadius])for(let dx=-radius;dx<=radius;dx+=2)for(let dz=-radius;dz<=radius;dz+=2){
  if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue
  for(const dy of [0,1,-1]){
   const goal={x:start.x+dx,y:start.y+dy,z:start.z+dz}
   if(!world.walkable(goal)||distance(goal)<initial+2)continue
   const plan=nav.routeTo(goal,start,{allowSteps:true,allowDirt:false,avoidHostiles:false,maxNodes:384})
   if(!plan.ok||plan.path.length>18)continue
   // The first movement must not be toward the threat. A mob must never be
   // considered a bridge, path support, or an unknown terrain substitute.
   if(plan.path.length>1&&distance(plan.path[1])<initial-.25)continue
   const score=distance(goal)*3-plan.path.length
   if(!best||score>best.score)best={plan,goal,score,threat}
  }
 }
 return best
}
