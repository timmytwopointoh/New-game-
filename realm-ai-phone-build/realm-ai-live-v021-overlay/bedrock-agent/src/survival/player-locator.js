// Player Locator Bar *data*, not pixels: clientbound Bedrock player_list
// and player_location plus near-entity movement packets. Never infers a
// named target from marker color, which can change every Realm session.
const finite=p=>!!p&&[p.x,p.y,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<30000010)
const stableId=v=>{
 if(v===undefined||v===null)return null
 const s=String(v)
 return /^-?\d+$/.test(s)?s:null
}
const shortName=n=>typeof n==='string'&&n.length>0&&n.length<=64?n:null
export class PlayerLocator {
 constructor(){this.reset()}
 reset(){this.entries=new Map();this.known=new Map();this.hidden=new Set();this.latestPacketAt=0}
 observeList(packet,now=Date.now()){
  const records=packet?.records??packet?.players??packet?.entries
  const items=Array.isArray(records)?records:Array.isArray(records?.records)?records.records:Array.isArray(records?.players)?records.players:[]
  for(const x of items.slice(0,256)){
   // 1.26.40 Bedrock records carry a per-record type, not packet-wide action.
   const action=x?.type??x?.action??packet?.type??packet?.action
   const isRemove=action==='remove'||action===0||action==='0'
   const isAdd=action==='add'||action===1||action==='1'||action===undefined
   const id=stableId(x?.entity_unique_id??x?.unique_id??x?.entity_id)
   if(isRemove){
    const uuid=String(x?.uuid??'')
    for(const [key,p] of this.entries)if(p.uuid===uuid&&uuid||id&&key===id){this.entries.delete(key);this.known.delete(key);this.hidden.delete(key)}
    continue
   }
   if(!isAdd||!id||!shortName(x?.username))continue
   if(this.entries.size>=256&&!this.entries.has(id))continue
   this.entries.set(id,{name:x.username,uuid:x.uuid===undefined?null:String(x.uuid),seenAt:now})
  }
 }
 registerNear({name,uniqueId,position},now=Date.now()){
  const id=stableId(uniqueId)
  if(!id||!shortName(name))return
  if(!this.entries.has(id)&&this.entries.size<256)this.entries.set(id,{name,uuid:null,seenAt:now})
  if(finite(position))this.updatePosition(id,position,now,'nearby-entity')
 }
 updatePosition(id,position,now=Date.now(),source='locator-bar'){
  id=stableId(id)
  if(!id||!finite(position))return false
  if(this.entries.has(id)){
   this.known.set(id,{position:{x:position.x,y:position.y,z:position.z},at:now,source})
   this.hidden.delete(id);this.latestPacketAt=now;return true
  }
  return false
 }
 observeLocation(packet,now=Date.now()){
  const id=stableId(packet?.entity_unique_id??packet?.target_actor_id??packet?.actor_unique_id)
  if(!id)return false
  const action=packet?.type??packet?.location?.type??packet?.location?.packet_type
  if(action==='type_hide'||action==='hide'||action===1||action==='1'){
   this.hidden.add(id);this.known.delete(id);return true
  }
  if(!['coordinates','0',0,undefined].includes(action))return false
  const position=packet?.position??packet?.location?.position
  return this.updatePosition(id,position,now,'locator-bar')
 }
 locate(name,nearby=new Map(),now=Date.now()){
  if(!shortName(name))return null
  const normalized=name.toLowerCase()
  // Only the actual named player is returned; colors cannot identify players.
  for(const p of nearby.values()){
   if(p?.name?.toLowerCase()!==normalized||!finite(p.position))continue
   const id=stableId(p.uniqueId)
   if(id&&this.hidden.has(id))continue
   return {name:p.name,position:{...p.position},source:'nearby-entity',ageMs:0,estimated:false}
  }
  for(const [id,p] of this.entries){
   if(p.name.toLowerCase()!==normalized||this.hidden.has(id))continue
   const q=this.known.get(id)
   if(!q||now-q.at>90000||now<q.at)continue
   return {name:p.name,position:{...q.position},source:q.source,ageMs:now-q.at,estimated:q.source==='locator-bar'&&now-q.at>10000}
  }
  return null
 }
 snapshot(){return {trackedPlayers:this.entries.size,locationUpdatesReceived:this.latestPacketAt>0,knownLocations:this.known.size,hiddenPlayers:this.hidden.size}}
}
// The locator-bar's server-provided named player position supplies a bearing.
// Waypoints are a search direction, NOT proof the player is there and NOT
// permission to traverse unknown terrain. Try alternate bearings around
// obstacles; Navigation.routeTo must validate the ENTIRE path before movement.
export function routeSearchCandidates(world,start,target,{maxSegment=14,range=20,limit=24}={}){
 if(!finite(start)||!finite(target)||typeof world?.walkable!=='function')return []
 const dx=target.x-start.x,dz=target.z-start.z,d=Math.hypot(dx,dz)
 if(d<2.5)return []
 const length=Math.min(d,Math.max(2,Math.min(maxSegment,range)))
 const ux=dx/d,uz=dz/d,px=-uz,pz=ux
 const out=[],seen=new Set()
 // First try toward the named player's server bearing, then sweep to
 // either side around trees, cliffs, structures, holes and visible fluids.
 for(const factor of [1,.75,.5,.25]){
  for(const lateral of [0,-2,2,-4,4]){
   const forward=length*factor
   const x=Math.floor(start.x+ux*forward+px*lateral)
   const z=Math.floor(start.z+uz*forward+pz*lateral)
   if(Math.hypot(x-start.x,z-start.z)<2)continue
   // Only a grounded block in observed terrain can be considered.
   for(const yDelta of [0,1,-1,2,-2,3,-3]){
    const goal={x,y:Math.floor(start.y+yDelta),z},id=x+':'+goal.y+':'+z
    if(seen.has(id))continue
    seen.add(id)
    if(!world.walkable(goal))continue
    const remaining=Math.hypot(target.x-(x+.5),target.z-(z+.5))
    const progress=d-remaining
    if(progress<1.5)continue // don't wander sideways with no gain
    out.push({goal,reached:false,remaining,progress,
     bearingSource:'named-player-locator',lateralOffset:lateral})
    break
   }
  }
 }
 // Keep larger safe forward progress first, but test side routes when
 // a forward destination is blocked (the pathfinder may reject it).
 return out.slice(0,Math.min(32,Math.max(1,limit)))
}
export function routeSearchWaypoint(world,start,target,options={}){
 if(finite(start)&&finite(target)&&Math.hypot(start.x-target.x,start.z-target.z)<2.5)
  return {goal:null,reached:true}
 return routeSearchCandidates(world,start,target,options)[0]||null
}
