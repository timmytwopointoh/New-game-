import {InventoryProtocol} from './inventory-protocol.js'
import {vanillaBlockBehavior,vanillaPathRisk} from './vanilla-block-behavior.js'
import {abilityEvidence} from './verification.js'
import registryFactory from 'prismarine-registry'
import blockFactory from 'prismarine-block'
import {Reader,decodeSection,decodeBiomeStores,blockIndex} from './chunks.js'
const dimensionNumber=d=>typeof d==='number'?d:({overworld:0,nether:1,end:2}[d]??0)
const dangerous=/^(?:flowing_)?(?:lava|water)$|fire|campfire|cactus|magma|powder_snow|sweet_berry|wither_rose|portal|web/
const airNames=new Set(['air','cave_air','void_air'])
const isWater=name=>/^(?:flowing_)?water$/.test(name||'')
export class WorldView{
 constructor(){this.reset()}
 reset(){this.editApproval=null;this.unknownAddonBlocks=new Map();this.terrainRevision=0;this.visibilityCache=null;this.blockStates=new Map();this.serverAuthoritativeBreaking=null;this.serverAuthoritativeInventory=null;this.serverPosition=null;this.serverGrounded=null;this.inputLocks={};this.dragonState='unknown';this.ownedPlacements=new Map();this.blockRevision=0;this.blockRevisions=new Map();this.abilityState=null;this.uniqueId=null;this.gameMode=null;this.gameModeSource=null;this.registry=null;this.Block=null;this.sections=new Map();this.biomeStores=new Map();this.biomeNames=new Map();this.biomeDecodeErrors=0;this.updates=new Map();this.position=null;this.entityId=null;this.dimension=0;this.chunks=0;this.decodeErrors=0;this.lastError='';this.enabled=true;this.inventory=new Map();this.inventoryKnown=false;this.attributes={};this.healthRevision=0;this.lastHurtAt=null;this.deathReportedAt=null;this.effects=new Map();this.entities=new Map();this.players=new Map();this.drops=new Map();this.selectedSlot=null;this.listeners=[];this.pending=new Set();this.inventoryProtocol=new InventoryProtocol(this)}
 initialize(packet,version='1.26.60'){
  this.terrainRevision++;this.visibilityCache=null;this.blockStates.clear();this.registry=registryFactory('bedrock_'+version);this.Block=blockFactory(this.registry)
  this.hashMode=packet.block_network_ids_are_hashes===true
  this.registry.handleStartGame({...packet,itemstates:packet.itemstates||this.registry.writeItemStates()})
  this.ownedPlacements.clear();this.sections.clear();this.biomeStores.clear();this.biomeNames.clear();this.biomeDecodeErrors=0;this.updates.clear();this.entities.clear();this.players.clear();this.drops.clear();this.selectedSlot=null;this.pending.clear();this.inventory.clear();this.inventoryKnown=false;this.inventoryProtocol.reset();this.attributes={};this.healthRevision=0;this.lastHurtAt=null;this.deathReportedAt=null
  this.serverAuthoritativeInventory=typeof packet.server_authoritative_inventory==='boolean'?packet.server_authoritative_inventory:null
  this.serverAuthoritativeBreaking=typeof packet.server_authoritative_block_breaking==='boolean'?packet.server_authoritative_block_breaking:null;this.blockRevision=0;this.blockRevisions.clear();this.serverPosition={...packet.player_position};this.serverGrounded=null;this.inputLocks={};this.hardcore=packet.hardcore===true;this.abilityState=null;this.uniqueId=packet.entity_id===undefined?null:String(packet.entity_id)
  this.gameMode=this.normalizeMode(packet.player_gamemode);this.gameModeSource=this.gameMode?'player-specific start_game':null
  // Bedrock GameMode 5 is the player's explicit "use the world default" value.
  // It is safe to resolve through world_gamemode because the start_game field
  // says the player inherits it; do not use world_gamemode for other values.
  if(this.isDefaultMode(packet.player_gamemode)){this.gameMode=this.normalizeMode(packet.world_gamemode);this.gameModeSource=this.gameMode?'player fallback to reported world default':null}
  this.position={...packet.player_position};this.entityId=String(packet.runtime_entity_id);this.dimension=dimensionNumber(packet.dimension)
 }
 runtime(id){return this.registry?.blocksByRuntimeId?.[id|0]||this.registry?.blocksByRuntimeId?.[id>>>0]}
 save(x,z,section){
  this.terrainRevision++
  const k=`${x},${section.y},${z}`;this.sections.delete(k);this.sections.set(k,section)
  while(this.sections.size>192)this.sections.delete(this.sections.keys().next().value)
 }
 receiveChunk(packet,client){
  if(!this.enabled||!this.registry||dimensionNumber(packet.dimension)!==this.dimension)return
  const count=packet.sub_chunk_count>>>0
  if(packet.cache_enabled){this.lastError='Cached chunk data unavailable; waiting for uncached data';return}
  if(count>24){this.receiveBiomes(packet,new Reader(Buffer.from(packet.payload||[])));this.requestNearby(client);return}
  const r=new Reader(Buffer.from(packet.payload)),sections=[]
  for(let i=0;i<count;i++)sections.push(decodeSection(r,(this.dimension===0?-4:0)+i))
  for(const s of sections)this.save(packet.x,packet.z,s)
  this.receiveBiomes(packet,r)
  this.chunks++
 }
 receiveBiomes(packet,r){if(r.i>=r.b.length)return;try{const stores=decodeBiomeStores(r,this.dimension===0?24:this.dimension===1?8:16),minY=this.dimension===0?-4:0;for(let i=0;i<stores.length;i++)this.biomeStores.set(`${packet.x},${minY+i},${packet.z}`,stores[i]);while(this.biomeStores.size>192)this.biomeStores.delete(this.biomeStores.keys().next().value)}catch{this.biomeDecodeErrors++}}
 requestNearby(client){
  if(!this.position||!this.registry||!this.enabled)return
  const origin={x:Math.floor(this.position.x/16),y:Math.floor((this.position.y-1.62)/16),z:Math.floor(this.position.z/16)},requests=[]
  for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++){
   const k=`${origin.x+x},${origin.y+y},${origin.z+z}`
   if(this.sections.has(k)||this.pending.has(k))continue
   this.pending.add(k);requests.push({x,y,z})
  }
  if(requests.length){while(this.pending.size>192)this.pending.delete(this.pending.values().next().value);client.queue('subchunk_request',{dimension:this.dimension,origin,requests})}
 }
 receiveSections(packet){
  if(!this.enabled||packet.cache_enabled||dimensionNumber(packet.dimension)!==this.dimension)return
  for(const entry of (packet.entries||[]).slice(0,64)){
   const x=packet.origin.x+entry.dx,y=packet.origin.y+entry.dy,z=packet.origin.z+entry.dz
   this.pending.delete(`${x},${y},${z}`)
   if(entry.result==='success_all_air'){
    const air=Object.entries(this.registry.blocksByRuntimeId).find(([,b])=>b.name==='air')
    if(air)this.save(x,z,{y,layers:[new Int32Array(4096).fill(Number(air[0]))]})
   }else if(entry.result==='success'&&entry.payload){const s=decodeSection(Buffer.from(entry.payload),y);if(s.y!==y)throw Error('Subchunk Y mismatch');this.save(x,z,s)}
  }
 }
 update(packet){
  if(!this.enabled)return
  const p=packet.position,k=`${p.x},${p.y},${p.z},${packet.layer||0}`
  this.updates.delete(k);this.updates.set(k,packet.block_runtime_id);this.blockRevisions.delete(k);this.blockRevisions.set(k,++this.blockRevision);while(this.blockRevisions.size>8192)this.blockRevisions.delete(this.blockRevisions.keys().next().value)
  while(this.updates.size>8192)this.updates.delete(this.updates.keys().next().value)
 }
 block(p,layer=0){
  if(!this.enabled||!this.registry)return null
  const k=`${p.x},${p.y},${p.z},${layer}`,s=this.sections.get(`${Math.floor(p.x/16)},${Math.floor(p.y/16)},${Math.floor(p.z/16)}`)
  let id=this.updates.get(k)
  if(id===undefined){if(!s)return null;if(!s.layers[layer])return layer?{name:'air',shapes:[]}:null;id=s.layers[layer][blockIndex(p.x,p.y,p.z)]}
  const state=this.runtime(id);if(!state)return null
  // Remember only add-on block identifiers; never infer custom collisions
  // or whether a modded block is safe from an ordinary vanilla block name.
  const behavior=vanillaBlockBehavior(state.name)
  if(behavior.source==='custom'){
    if(!this.unknownAddonBlocks.has(state.name)&&this.unknownAddonBlocks.size<128)this.unknownAddonBlocks.set(state.name,true)
    return null
  }
  // Shapes and tool behavior depend on state, not world coordinates. Reuse them
  // across collision sweeps and A*; location/update lookup still happens above.
  let block=this.blockStates.get(state.stateId)
  if(block)return block
  try{block=this.Block.fromStateId(state.stateId,0);this.blockStates.set(state.stateId,block);if(this.blockStates.size>2048)this.blockStates.delete(this.blockStates.keys().next().value);return block}catch{return null}
 }
 blockVersion(p,layer=0){return this.blockRevisions.get(`${p.x},${p.y},${p.z},${layer}`)||0}
 runtimeIdAt(p,layer=0){
  const k=`${p.x},${p.y},${p.z},${layer}`
  if(this.updates.has(k))return this.updates.get(k)
  const s=this.sections.get(`${Math.floor(p.x/16)},${Math.floor(p.y/16)},${Math.floor(p.z/16)}`)
  return s?.layers[layer]?.[blockIndex(p.x,p.y,p.z)]
 }
 airAt(p){return [0,1].every(layer=>{const b=this.block(p,layer);return b&&airNames.has(b.name)})}
 isDefaultMode(value){return value===5||value==='5'||(typeof value==='string'&&value.toLowerCase()==='fallback')}
 normalizeMode(value){if(typeof value==='string')value=value.toLowerCase();return value===0||value==='survival'? 'survival':value===1||value==='creative'?'creative':value===2||value==='adventure'?'adventure':value===6||value==='spectator'?'spectator':null}
 get survivalVerified(){return this.gameMode==='survival'&&!!this.abilityState?.known&&!this.abilityState.loading&&!this.abilityState.active.length}
 // Grounded Creative actions are valid when the server identifies this player
 // as Creative and has sent effective abilities. Free flight, noclip and editor
 // privileges remain excluded from ordinary navigation and edits.
 get creativeMovementVerified(){const a=this.abilityState;if(this.gameMode!=='creative'||!a?.known||a.loading)return false;return !['flying','no_clip','world_builder','privileged_builder'].some(k=>a.effective[k]||a.active.includes(k))}
 get creativeEditsVerified(){const a=this.abilityState;if(this.gameMode!=='creative'||!a?.known||a.loading)return false;return !['flying','no_clip','world_builder','privileged_builder'].some(k=>a.effective[k]||a.active.includes(k))}
 get editModeVerified(){return this.survivalVerified||this.creativeEditsVerified}
 get movementVerified(){return this.survivalVerified||this.creativeMovementVerified}
 // Collision uses received block shapes in both layers. Unknown cells remain solid.
 bodyIssue(position,{allowWater=false,allowLava=false,allowPowder=false,allowPortal=false}={}){
  const feet=position.y-1.62,eps=.00001
  for(let x=Math.floor(position.x-.3+eps);x<=Math.floor(position.x+.3-eps);x++)
   for(let z=Math.floor(position.z-.3+eps);z<=Math.floor(position.z+.3-eps);z++)
    for(let y=Math.floor(feet+eps);y<=Math.floor(feet+1.8-eps);y++)for(const layer of [0,1]){
     const b=this.block({x,y,z},layer)
     if(!b)return {kind:'unknown',position:{x,y,z},layer,name:null}
     if(dangerous.test(b.name)&&!(allowWater&&/^(?:flowing_)?water$/.test(b.name))&&!(allowLava&&/^(?:flowing_)?lava$/.test(b.name))&&!(allowPowder&&b.name==='powder_snow')&&!(allowPortal&&/^(?:portal|nether_portal|end_portal)$/.test(b.name)))return {kind:'hazard',position:{x,y,z},layer,name:b.name}
     if(!Array.isArray(b.shapes))return {kind:'unknown-shape',position:{x,y,z},layer,name:b.name}
     for(const q of b.shapes)if(position.x+.3>x+q[0]+eps&&position.x-.3<x+q[3]-eps&&feet+1.8>y+q[1]+eps&&feet<y+q[4]-eps&&position.z+.3>z+q[2]+eps&&position.z-.3<z+q[5]-eps)return {kind:'solid',position:{x,y,z},layer,name:b.name}
    }
  return null
 }
 clearBody(position,options){return !this.bodyIssue(position,options)}
 standingIssue(position,{maxStepDown=.6}={}){
  const collision=this.bodyIssue(position);if(collision)return collision
  const feet=position.y-1.62,seen=new Set();let contact=false
  for(const dx of [-.299,.299])for(const dz of [-.299,.299]){
   const x=Math.floor(position.x+dx),z=Math.floor(position.z+dz),id=`${x},${z}`;if(seen.has(id))continue;seen.add(id)
   const y=Math.floor(feet-.00001)
   for(const layer of [0,1]){const b=this.block({x,y,z},layer);if(!b)return {kind:'unknown-support',position:{x,y,z},layer,name:null};if(dangerous.test(b.name))return {kind:'hazard',position:{x,y,z},layer,name:b.name}}
   for(const standY of [Math.floor(feet+.001)+1,Math.floor(feet+.001),Math.floor(feet+.001)-1]){const h=this.supportHeight({x,y:standY,z});if(h!==null&&h<=feet+.002&&feet-h<=maxStepDown+.002)contact=true}
  }
  return contact?null:{kind:'unsupported',position:{x:Math.floor(position.x),y:Math.floor(feet),z:Math.floor(position.z)},layer:0,name:null}
 }
 supportHeight(p){
  const ground=this.block({...p,y:p.y-1}),fluid=this.block({...p,y:p.y-1},1),body=this.block(p),overlay=this.block(p,1)
  if(!ground||!fluid||!body||!overlay||[ground,fluid,body,overlay].some(b=>dangerous.test(b.name))||fluid.shapes?.length||overlay.shapes?.length)return null
  const surfaces=(ground.shapes||[]).filter(q=>q[0]===0&&q[2]===0&&q[3]===1&&q[5]===1)
  if(!surfaces.length)return null
  const base=p.y-1+Math.max(...surfaces.map(q=>q[4]))
  if(!body.shapes?.length)return base
  // Partial layers/slabs may be stepped onto. Full blocks still require a jump route.
  if(body.shapes.some(q=>q[0]!==0||q[2]!==0||q[3]!==1||q[5]!==1||q[1]!==0||q[4]>=1))return null
  return p.y+Math.max(...body.shapes.map(q=>q[4]))
 }
 terrainKnown(position=this.position){
  if(!position)return false
  const feet=position.y-1.62
  for(let x=Math.floor(position.x-.3+.00001);x<=Math.floor(position.x+.3-.00001);x++)for(let z=Math.floor(position.z-.3+.00001);z<=Math.floor(position.z+.3-.00001);z++)for(let y=Math.floor(feet-.02);y<=Math.floor(feet+1.8-.00001);y++)for(const layer of [0,1])if(!this.block({x,y,z},layer))return false
  return true
 }
 grounded(position=this.position){
  if(!position)return false
  const feet=position.y-1.62
  let contact=false
  for(const dx of [-.299,.299])for(const dz of [-.299,.299]){
   let supported=false
   for(const y of [Math.floor(feet+.001)+1,Math.floor(feet+.001),Math.floor(feet+.001)-1]){
    const h=this.supportHeight({x:Math.floor(position.x+dx),y,z:Math.floor(position.z+dz)})
    if(h!==null&&Math.abs(feet-h)<.002)supported=true
   }
   if(supported)contact=true
  }
  return contact&&this.clearBody(position)
 }
 canJumpBetween(a,b){
  if(this.inputLocks?.jump)return false
  if(Math.abs(a.x-b.x)+Math.abs(a.z-b.z)!==1||b.y-a.y!==1||!this.walkable(a)||!this.walkable(b))return false
  const from=this.supportHeight(a),to=this.supportHeight(b);if(from===null||to===null||to-from<=0||to-from>1.25)return false
  for(let h=from;h<to;h+=.05)if(!this.clearBody({x:a.x+.5,y:h+1.62,z:a.z+.5}))return false
  return this.clearBody({x:a.x+.5,y:to+1.62,z:a.z+.5})
 }
 canDropBetween(a,b,{maxDrop=1}={}){
  const limit=Math.min(5,Math.max(1,maxDrop)),from=this.supportHeight(a),to=this.supportHeight(b)
  if(a.y-b.y<1||a.y-b.y>limit||Math.abs(a.x-b.x)+Math.abs(a.z-b.z)!==1||!this.walkable(a)||!this.walkable(b)||from===null||to===null||from-to>limit+.001||from<=to)return false
  const health=this.attributes['minecraft:health'],damage=Math.max(0,Math.ceil(from-to)-3)
  if(this.gameMode==='survival'&&damage>0&&(health===undefined||health-damage<=6))return false
  // Inspect the entire landing column: missing terrain is never assumed clear.
  for(let y=to;y<=from+.0001;y+=.1)if(!this.clearBody({x:b.x+.5,y:y+1.62,z:b.z+.5}))return false
  return this.clearBody({x:b.x+.5,y:from+1.62,z:b.z+.5})
 }
 standPosition(){if(!this.position)return null;const p={x:Math.floor(this.position.x),y:Math.floor(this.position.y-1.62+.001),z:Math.floor(this.position.z)},feet=this.position.y-1.62
  const above={...p,y:p.y+1},h=this.supportHeight(above),at=this.supportHeight(p)
  if(h!==null&&Math.abs(h-feet)<.002&&(at===null||Math.abs(at-feet)>.002))return above
  return p
 }
 // Ordinary water is not lava. Wading is allowed only across observed
 // single-block-deep water with solid support and air around the player's head.
 shallowWater(p){
  if(!p||![p.x,p.y,p.z].every(Number.isSafeInteger))return false
  const foot=[this.block(p),this.block(p,1)],head=[this.block({...p,y:p.y+1}),this.block({...p,y:p.y+1},1)]
  if(foot.some(b=>!b)||head.some(b=>!b)||!foot.some(b=>isWater(b.name)))return false
  if(!head.every(b=>airNames.has(b.name)))return false
  const floor=this.block({...p,y:p.y-1}),floorOverlay=this.block({...p,y:p.y-1},1)
  if(!floor||!floorOverlay||dangerous.test(floor.name)||(!airNames.has(floorOverlay.name)&&!isWater(floorOverlay.name)))return false
  if(!floor.shapes?.some(q=>q[0]===0&&q[2]===0&&q[3]===1&&q[5]===1&&q[4]>=1))return false
  return this.clearBody({x:p.x+.5,y:p.y+1.62,z:p.z+.5},{allowWater:true})
 }
 terrainPenalty(p){return vanillaPathRisk(this,p)}
 walkable(p,{avoidHostiles=true,allowWater=false}={}){
  // Do not step onto add-on, harmful, triggering or unobserved cells.
  if(!Number.isFinite(this.terrainPenalty(p)))return false
  const height=this.supportHeight(p),shallow=allowWater&&this.shallowWater(p)
  if(!shallow&&(height===null||!this.clearBody({x:p.x+.5,y:height+1.62,z:p.z+.5})))return false
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const n=this.block({x:p.x+dx,y:p.y,z:p.z+dz});if(n&&dangerous.test(n.name)&&!(allowWater&&isWater(n.name)))return false
  }
  if(avoidHostiles)for(const e of this.entities.values())if(/zombie|skeleton|creeper|spider|warden|witch|pillager|enderman/.test(e.type)&&Math.hypot(e.position.x-p.x,e.position.z-p.z)<3)return false
  return true
 }
 visible(p){
  const at=this.position;if(!at)return false
  let cache=this.visibilityCache
  if(!cache||cache.x!==at.x||cache.y!==at.y||cache.z!==at.z||cache.revision!==this.blockRevision||cache.terrain!==this.terrainRevision||cache.enabled!==this.enabled||cache.dimension!==this.dimension){cache=this.visibilityCache={...at,revision:this.blockRevision,terrain:this.terrainRevision,enabled:this.enabled,dimension:this.dimension,values:new Map()}}
  const id=`${p.x},${p.y},${p.z}`
  if(cache.values.has(id))return cache.values.get(id)
  const result=this.rayVisible(p);cache.values.set(id,result)
  if(cache.values.size>4096)cache.values.delete(cache.values.keys().next().value)
  return result
 }
 rayVisible(p){
  if(!this.position)return false
  const target={x:p.x+.5,y:p.y+.5,z:p.z+.5},distance=Math.hypot(target.x-this.position.x,target.y-this.position.y,target.z-this.position.z)
  const steps=Math.ceil(distance*5)
  for(let i=1;i<steps;i++){
   const t=i/steps,q={x:Math.floor(this.position.x+(target.x-this.position.x)*t),y:Math.floor(this.position.y+(target.y-this.position.y)*t),z:Math.floor(this.position.z+(target.z-this.position.z)*t)}
   if(q.x===p.x&&q.y===p.y&&q.z===p.z)return true
   const b=this.block(q);if(!b||(!airNames.has(b.name)&&b.shapes?.length))return false
  }
  return true
 }
 scan(name=null,{yaw=null,fov=40,range=8,filter=null,maxFound=16}={}){
  const at=this.standPosition();if(!at)return {found:[],counts:[],message:'Position not received yet.'}
  const counts=new Map(),found=[]
  for(let dx=-range;dx<=range;dx++)for(let dz=-range;dz<=range;dz++)for(let dy=-3;dy<=4;dy++){
   if(yaw!==null&&(dx||dz)){const bearing=Math.atan2(-dx,dz)*180/Math.PI;const difference=((bearing-yaw+540)%360)-180;if(Math.abs(difference)>fov/2)continue}
   const p={x:at.x+dx,y:at.y+dy,z:at.z+dz},b=this.block(p)
   if(!b||airNames.has(b.name)||(name&&b.name!==name)||(filter&&!filter(b.name))||!this.visible(p))continue
   counts.set(b.name,(counts.get(b.name)||0)+1);found.push({...p,name:b.name,distance:Math.hypot(dx,dy,dz)})
  }
  found.sort((a,b)=>a.distance-b.distance)
  return {found:found.slice(0,Math.min(128,Math.max(1,maxFound|0))),counts:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,8),message:this.lastError}
 }
 items(){const total=new Map();for(const item of this.inventory.values())if(item?.network_id&&item.count>0){const name=this.registry?.items?.[item.network_id]?.name;if(name)total.set(name,(total.get(name)||0)+item.count)}return Object.fromEntries(total)}
 attach(client){
  const on=(event,fn)=>{const safe=p=>{try{fn(p)}catch(e){this.decodeErrors++;this.lastError=String(e.message||e).slice(0,140);this.onPacketError?.(e)}};client.on(event,safe);this.listeners.push([client,event,safe])}
  on('start_game',p=>this.initialize(p,client.version||client.options?.version||'1.26.60'))
  on('update_abilities',p=>{if(this.uniqueId!==null&&String(p.entity_unique_id)===this.uniqueId)this.abilityState=abilityEvidence(p)})
  on('update_player_game_type',p=>{if(this.uniqueId!==null&&String(p.player_unique_id)===this.uniqueId){this.gameMode=this.normalizeMode(p.gamemode);this.gameModeSource='per-player server update'}})
  on('set_player_game_type',p=>{this.gameMode=this.normalizeMode(p.gamemode);this.gameModeSource='server set-player update'})
  on('update_client_input_locks',p=>{this.inputLocks={...p.locks}})
  on('item_registry',p=>{if(this.registry)this.registry.handleStartGame({itemstates:p.itemstates,block_network_ids_are_hashes:this.hashMode})})
  on('biome_definition_list',p=>{for(const b of (p.biome_definitions||[]).slice(0,1024)){const name=p.string_list?.[b.name_index];if(Number.isSafeInteger(b.biome_id)&&typeof name==='string'&&name.length<96)this.biomeNames.set(b.biome_id,name)}})
  on('level_chunk',p=>this.receiveChunk(p,client));on('subchunk',p=>this.receiveSections(p));on('update_block',p=>this.update(p));on('update_block_synced',p=>this.update(p));on('update_subchunk_blocks',p=>{for(const [layer,entries] of [[0,p.blocks],[1,p.extra]])for(const entry of (entries||[]).slice(0,4096))this.update({position:entry.position,block_runtime_id:entry.runtime_id,layer})})
  on('inventory_content',p=>this.inventoryProtocol.content(p))
  on('inventory_slot',p=>this.inventoryProtocol.slot(p))
  on('container_open',p=>this.inventoryProtocol.opened(p));on('container_close',p=>this.inventoryProtocol.closed(p));on('item_stack_response',p=>this.inventoryProtocol.stackResponse(p))
  on('mob_effect',p=>{if(String(p.runtime_entity_id)===this.entityId){if(p.event_id==='remove')this.effects.delete(p.effect_id);else if(['add','update'].includes(p.event_id))this.effects.set(p.effect_id,{amplifier:p.amplifier,expires:p.duration<0?Infinity:Date.now()+p.duration*50})}})
  on('set_health',p=>{if(Number.isFinite(p.health)){if(p.health<(this.attributes['minecraft:health']??p.health))this.lastHurtAt=Date.now();this.attributes['minecraft:health']=p.health;this.healthRevision++}})
  on('update_attributes',p=>{if(String(p.runtime_entity_id)===this.entityId)for(const a of p.attributes||[]){if(a.name==='minecraft:health'&&Number.isFinite(a.current)){if(a.current<(this.attributes[a.name]??a.current))this.lastHurtAt=Date.now();this.healthRevision++}this.attributes[a.name]=a.current}})
  on('entity_event',p=>{if((p.event_id==='ender_dragon_death'||p.event_id===37)&&this.dimension===2&&/(?:^|:)ender_dragon$/.test(this.entities.get(String(p.runtime_entity_id))?.type||''))this.dragonState='defeated';if(String(p.runtime_entity_id)!==this.entityId)return;if(p.event_id==='hurt_animation'||p.event_id===2)this.lastHurtAt=Date.now();if(p.event_id==='death_animation'||p.event_id===3)this.deathReportedAt=Date.now()})
  on('death_info',()=>{this.deathReportedAt=Date.now()})
  on('player_hotbar',p=>{if((p.window_id==='inventory'||p.window_id===0)&&p.selected_slot>=0&&p.selected_slot<=8)this.selectedSlot=p.selected_slot})
  on('mob_equipment',p=>{if(String(p.runtime_entity_id)===this.entityId&&p.selected_slot>=0&&p.selected_slot<=8)this.selectedSlot=p.selected_slot})
  on('add_player',p=>{if(String(p.runtime_id)!==this.entityId){this.players.set(String(p.runtime_id),{name:p.username,position:p.position,uniqueId:String(p.unique_id)});while(this.players.size>64)this.players.delete(this.players.keys().next().value)}})
  on('move_player',p=>{const player=this.players.get(String(p.runtime_id));if(player)player.position=p.position})
  on('move_entity_delta',p=>{const drop=this.drops.get(String(p.runtime_entity_id));if(drop)for(const k of ['x','y','z'])if(Number.isFinite(p[k]))drop.position[k]=p[k];const e=this.players.get(String(p.runtime_entity_id))||this.entities.get(String(p.runtime_entity_id));if(e)for(const k of ['x','y','z'])if(Number.isFinite(p[k]))e.position[k]=p[k]})
  const addDrop=p=>{
    const id=String(p.runtime_entity_id??p.runtime_id??'');const pos=p.position;const item=p.item||p.item_stack||p.itemStack
    if(!/^\d+$/.test(id)||!pos||![pos.x,pos.y,pos.z].every(Number.isFinite))return
    const name=this.registry?.items?.[item?.network_id]?.name
    if(!name)return
    this.drops.set(id,{position:{...pos},name,count:item?.count||1})
    while(this.drops.size>128)this.drops.delete(this.drops.keys().next().value)
  }
  on('add_item_entity',addDrop);on('add_item_actor',addDrop)
  on('add_entity',p=>{if(/(?:^|:)ender_dragon$/.test(p.entity_type))this.dragonState='alive';this.entities.set(String(p.runtime_id),{type:p.entity_type,position:p.position,uniqueId:String(p.unique_id)});while(this.entities.size>256)this.entities.delete(this.entities.keys().next().value)})
  on('move_entity',p=>{const d=this.drops.get(String(p.runtime_entity_id));if(d&&p.position)d.position=p.position;const e=this.entities.get(String(p.runtime_entity_id))||this.players.get(String(p.runtime_entity_id));if(e)e.position=p.position})
  on('remove_entity',p=>{for(const [id,e] of this.drops)if(id===String(p.entity_id_self)||e.uniqueId===String(p.entity_id_self))this.drops.delete(id);for(const map of [this.entities,this.players])for(const [id,e] of map)if(e.uniqueId===String(p.entity_id_self))map.delete(id)})
  on('change_dimension',p=>{this.dimension=dimensionNumber(p.dimension);this.position=p.position;this.serverPosition={...p.position};this.blockRevisions.clear();this.blockRevision=0;this.sections.clear();this.biomeStores.clear();this.updates.clear();this.pending.clear();this.entities.clear();this.players.clear()})
 }
 detach(){for(const [c,e,f] of this.listeners)c.off(e,f);this.listeners=[]}
 biomeAt(position=this.serverPosition){if(!position)return null;const x=Math.floor(position.x),y=Math.floor(position.y-1.62),z=Math.floor(position.z),store=this.biomeStores.get(`${Math.floor(x/16)},${Math.floor(y/16)},${Math.floor(z/16)}`);if(!store)return null;const id=store[blockIndex(x,y,z)],name=this.biomeNames.get(id)||this.registry?.biomes?.[id]?.name;return {id,name:name||null,source:'server-biome-palette'}}
 snapshot(){return {unverifiedAddonBlockTypes:[...this.unknownAddonBlocks.keys()].slice(0,16),unverifiedAddonBlockCount:this.unknownAddonBlocks.size,biome:this.biomeAt(),biomeDecodeErrors:this.biomeDecodeErrors,inventoryAuthority:this.serverAuthoritativeInventory===null?'unknown':this.serverAuthoritativeInventory?'server-authoritative':'legacy',blockBreakingMode:this.serverAuthoritativeBreaking===null?'unknown':this.serverAuthoritativeBreaking?'server-authoritative':'legacy-player-actions',abilities:this.abilityState,editModeVerified:this.editModeVerified,creativeEditsVerified:this.creativeEditsVerified,gameMode:this.gameMode,gameModeSource:this.gameModeSource,survivalVerified:this.survivalVerified,enabled:this.enabled,position:this.standPosition(),sections:this.sections.size,decodeErrors:this.decodeErrors,lastError:this.lastError,inventoryKnown:this.inventoryKnown,inventoryEvidence:this.inventoryProtocol.snapshot(),inventory:this.items(),health:this.attributes['minecraft:health']??null,hunger:this.attributes['minecraft:player.hunger']??null,entities:this.entities.size,groundDrops:this.drops.size,players:[...this.players.values()].map(p=>p.name),selectedSlot:this.selectedSlot}}
}
