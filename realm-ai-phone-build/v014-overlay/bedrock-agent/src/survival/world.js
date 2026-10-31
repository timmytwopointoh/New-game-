import {abilityEvidence} from './verification.js'
import registryFactory from 'prismarine-registry'
import blockFactory from 'prismarine-block'
import {Reader,decodeSection,blockIndex} from './chunks.js'
const dimensionNumber=d=>typeof d==='number'?d:({overworld:0,nether:1,end:2}[d]??0)
const dangerous=/^(?:flowing_)?(?:lava|water)$|fire|campfire|cactus|magma|powder_snow|sweet_berry|wither_rose|portal|web/
const airNames=new Set(['air','cave_air','void_air'])
export class WorldView{
 constructor(){this.reset()}
 reset(){this.abilityState=null;this.uniqueId=null;this.gameMode=null;this.registry=null;this.Block=null;this.sections=new Map();this.updates=new Map();this.position=null;this.entityId=null;this.dimension=0;this.chunks=0;this.decodeErrors=0;this.lastError='';this.enabled=true;this.inventory=new Map();this.inventoryKnown=false;this.attributes={};this.entities=new Map();this.players=new Map();this.selectedSlot=null;this.listeners=[];this.pending=new Set()}
 initialize(packet,version='1.26.60'){
  this.registry=registryFactory('bedrock_'+version);this.Block=blockFactory(this.registry)
  this.hashMode=packet.block_network_ids_are_hashes===true
  this.registry.handleStartGame({...packet,itemstates:packet.itemstates||this.registry.writeItemStates()})
  this.sections.clear();this.updates.clear();this.entities.clear();this.players.clear();this.selectedSlot=null;this.pending.clear();this.inventory.clear();this.inventoryKnown=false;this.attributes={}
  this.abilityState=null;this.uniqueId=packet.entity_id===undefined?null:String(packet.entity_id);this.gameMode=this.normalizeMode(packet.player_gamemode);this.position={...packet.player_position};this.entityId=String(packet.runtime_entity_id);this.dimension=dimensionNumber(packet.dimension)
 }
 runtime(id){return this.registry?.blocksByRuntimeId?.[id|0]||this.registry?.blocksByRuntimeId?.[id>>>0]}
 save(x,z,section){
  const k=`${x},${section.y},${z}`;this.sections.delete(k);this.sections.set(k,section)
  while(this.sections.size>192)this.sections.delete(this.sections.keys().next().value)
 }
 receiveChunk(packet,client){
  if(!this.enabled||!this.registry||dimensionNumber(packet.dimension)!==this.dimension)return
  const count=packet.sub_chunk_count>>>0
  if(packet.cache_enabled){this.lastError='Cached chunk data unavailable; waiting for uncached data';return}
  if(count>24){this.requestNearby(client);return}
  const r=new Reader(Buffer.from(packet.payload)),sections=[]
  for(let i=0;i<count;i++)sections.push(decodeSection(r,(this.dimension===0?-4:0)+i))
  for(const s of sections)this.save(packet.x,packet.z,s)
  this.chunks++
 }
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
  this.updates.delete(k);this.updates.set(k,packet.block_runtime_id)
  while(this.updates.size>8192)this.updates.delete(this.updates.keys().next().value)
 }
 block(p,layer=0){
  if(!this.enabled||!this.registry)return null
  const k=`${p.x},${p.y},${p.z},${layer}`,s=this.sections.get(`${Math.floor(p.x/16)},${Math.floor(p.y/16)},${Math.floor(p.z/16)}`)
  let id=this.updates.get(k)
  if(id===undefined){if(!s)return null;if(!s.layers[layer])return layer?{name:'air',shapes:[]}:null;id=s.layers[layer][blockIndex(p.x,p.y,p.z)]}
  const state=this.runtime(id);if(!state)return null
  try{return this.Block.fromStateId(state.stateId,0)}catch{return null}
 }
 runtimeIdAt(p,layer=0){
  const k=`${p.x},${p.y},${p.z},${layer}`
  if(this.updates.has(k))return this.updates.get(k)
  const s=this.sections.get(`${Math.floor(p.x/16)},${Math.floor(p.y/16)},${Math.floor(p.z/16)}`)
  return s?.layers[layer]?.[blockIndex(p.x,p.y,p.z)]
 }
 airAt(p){return [0,1].every(layer=>{const b=this.block(p,layer);return b&&airNames.has(b.name)})}
 normalizeMode(value){return value===0||value==='survival'? 'survival':value===1||value==='creative'?'creative':value===2||value==='adventure'?'adventure':value===6||value==='spectator'?'spectator':null}
 get survivalVerified(){return this.gameMode==='survival'&&!!this.abilityState?.known&&!this.abilityState.loading&&!this.abilityState.active.length}
 // Collision uses received block shapes in both layers. Unknown cells remain solid.
 clearBody(position){
  const feet=position.y-1.62,eps=.00001
  for(let x=Math.floor(position.x-.3+eps);x<=Math.floor(position.x+.3-eps);x++)
   for(let z=Math.floor(position.z-.3+eps);z<=Math.floor(position.z+.3-eps);z++)
    for(let y=Math.floor(feet+eps);y<=Math.floor(feet+1.8-eps);y++)for(const layer of [0,1]){
     const b=this.block({x,y,z},layer)
     if(!b||dangerous.test(b.name))return false
     if(!Array.isArray(b.shapes))return false
     for(const q of b.shapes)if(position.x+.3>x+q[0]+eps&&position.x-.3<x+q[3]-eps&&feet+1.8>y+q[1]+eps&&feet<y+q[4]-eps&&position.z+.3>z+q[2]+eps&&position.z-.3<z+q[5]-eps)return false
    }
  return true
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
  if(Math.abs(a.x-b.x)+Math.abs(a.z-b.z)!==1||b.y-a.y!==1||!this.walkable(a)||!this.walkable(b))return false
  return [a,b].every(p=>this.airAt({...p,y:a.y+2})&&this.airAt({...p,y:a.y+3}))
 }
 canDropBetween(a,b){
  return a.y-b.y===1&&Math.abs(a.x-b.x)+Math.abs(a.z-b.z)===1&&this.walkable(a)&&this.walkable(b)&&this.airAt({...b,y:a.y+1})
 }
 standPosition(){if(!this.position)return null;const p={x:Math.floor(this.position.x),y:Math.floor(this.position.y-1.62+.001),z:Math.floor(this.position.z)},feet=this.position.y-1.62
  const above={...p,y:p.y+1},h=this.supportHeight(above),at=this.supportHeight(p)
  if(h!==null&&Math.abs(h-feet)<.002&&(at===null||Math.abs(at-feet)>.002))return above
  return p
 }
 walkable(p){
  const height=this.supportHeight(p)
  if(height===null||!this.clearBody({x:p.x+.5,y:height+1.62,z:p.z+.5}))return false
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const n=this.block({x:p.x+dx,y:p.y,z:p.z+dz});if(n&&dangerous.test(n.name))return false
  }
  for(const e of this.entities.values())if(/zombie|skeleton|creeper|spider|warden|witch|pillager|enderman/.test(e.type)&&Math.hypot(e.position.x-p.x,e.position.z-p.z)<3)return false
  return true
 }
 visible(p){
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
 scan(name=null){
  const at=this.standPosition();if(!at)return {found:[],counts:[],message:'Position not received yet.'}
  const counts=new Map(),found=[]
  for(let dx=-8;dx<=8;dx++)for(let dz=-8;dz<=8;dz++)for(let dy=-3;dy<=4;dy++){
   const p={x:at.x+dx,y:at.y+dy,z:at.z+dz},b=this.block(p)
   if(!b||airNames.has(b.name)||(name&&b.name!==name)||!this.visible(p))continue
   counts.set(b.name,(counts.get(b.name)||0)+1);found.push({...p,name:b.name,distance:Math.hypot(dx,dy,dz)})
  }
  found.sort((a,b)=>a.distance-b.distance)
  return {found:found.slice(0,16),counts:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,8),message:this.lastError}
 }
 items(){const total=new Map();for(const item of this.inventory.values())if(item?.network_id&&item.count>0){const name=this.registry?.items?.[item.network_id]?.name;if(name)total.set(name,(total.get(name)||0)+item.count)}return Object.fromEntries(total)}
 attach(client){
  const on=(event,fn)=>{const safe=p=>{try{fn(p)}catch(e){this.decodeErrors++;this.lastError=String(e.message||e).slice(0,140)}};client.on(event,safe);this.listeners.push([client,event,safe])}
  on('start_game',p=>this.initialize(p,client.version||client.options?.version||'1.26.60'))
  on('update_abilities',p=>{if(this.uniqueId!==null&&String(p.entity_unique_id)===this.uniqueId)this.abilityState=abilityEvidence(p)})
  on('update_player_game_type',p=>{if(this.uniqueId!==null&&String(p.player_unique_id)===this.uniqueId)this.gameMode=this.normalizeMode(p.gamemode)})
  on('set_player_game_type',p=>{this.gameMode=this.normalizeMode(p.gamemode)})
  on('item_registry',p=>{if(this.registry)this.registry.handleStartGame({itemstates:p.itemstates,block_network_ids_are_hashes:this.hashMode})})
  on('level_chunk',p=>this.receiveChunk(p,client));on('subchunk',p=>this.receiveSections(p));on('update_block',p=>this.update(p))
  on('inventory_content',p=>{if(p.window_id==='inventory'||p.window_id===0){this.inventory.clear();p.input?.slice(0,256).forEach((v,i)=>this.inventory.set(i,v));this.inventoryKnown=true}})
  on('inventory_slot',p=>{if(p.window_id==='inventory'||p.window_id===0)this.inventory.set(p.slot,p.item)})
  on('update_attributes',p=>{if(String(p.runtime_entity_id)===this.entityId)for(const a of p.attributes||[])this.attributes[a.name]=a.current})
  on('player_hotbar',p=>{if((p.window_id==='inventory'||p.window_id===0)&&p.selected_slot>=0&&p.selected_slot<=8)this.selectedSlot=p.selected_slot})
  on('mob_equipment',p=>{if(String(p.runtime_entity_id)===this.entityId&&p.selected_slot>=0&&p.selected_slot<=8)this.selectedSlot=p.selected_slot})
  on('add_player',p=>{if(String(p.runtime_id)!==this.entityId){this.players.set(String(p.runtime_id),{name:p.username,position:p.position,uniqueId:String(p.unique_id)});while(this.players.size>64)this.players.delete(this.players.keys().next().value)}})
  on('move_player',p=>{const player=this.players.get(String(p.runtime_id));if(player)player.position=p.position})
  on('move_entity_delta',p=>{const e=this.players.get(String(p.runtime_entity_id))||this.entities.get(String(p.runtime_entity_id));if(e)for(const k of ['x','y','z'])if(Number.isFinite(p[k]))e.position[k]=p[k]})
  on('add_entity',p=>{this.entities.set(String(p.runtime_id),{type:p.entity_type,position:p.position,uniqueId:String(p.unique_id)});while(this.entities.size>256)this.entities.delete(this.entities.keys().next().value)})
  on('move_entity',p=>{const e=this.entities.get(String(p.runtime_entity_id))||this.players.get(String(p.runtime_entity_id));if(e)e.position=p.position})
  on('remove_entity',p=>{for(const map of [this.entities,this.players])for(const [id,e] of map)if(e.uniqueId===String(p.entity_id_self))map.delete(id)})
  on('change_dimension',p=>{this.dimension=dimensionNumber(p.dimension);this.position=p.position;this.sections.clear();this.updates.clear();this.pending.clear();this.entities.clear();this.players.clear()})
 }
 detach(){for(const [c,e,f] of this.listeners)c.off(e,f);this.listeners=[]}
 snapshot(){return {abilities:this.abilityState,gameMode:this.gameMode,survivalVerified:this.survivalVerified,enabled:this.enabled,position:this.standPosition(),sections:this.sections.size,decodeErrors:this.decodeErrors,lastError:this.lastError,inventoryKnown:this.inventoryKnown,inventory:this.items(),health:this.attributes['minecraft:health']??null,hunger:this.attributes['minecraft:player.hunger']??null,entities:this.entities.size,players:[...this.players.values()].map(p=>p.name),selectedSlot:this.selectedSlot}}
}
