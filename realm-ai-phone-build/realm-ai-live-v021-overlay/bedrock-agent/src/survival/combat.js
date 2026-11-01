// Survival emergency melee only. Never targets a player, passive mob or pet.
// Server reaction is unverified until a subsequent authoritative packet arrives.
const MELEE=/(?:^|:)(?:zombie|zombie_villager|husk|drowned|spider|cave_spider|silverfish|endermite|vindicator|pillager|wither_skeleton|stray|skeleton)(?:$|_)/i
export function meleeTarget(world,{range=2.75}={}){
 const p=world?.position,h=world?.attributes?.['minecraft:health'];if(!p||world.gameMode!=='survival'||!world.survivalVerified||!world.grounded?.()||h===0||h!==undefined&&h<9)return null
 const candidates=[]
 for(const [id,e] of world.entities||[]){
  if(!MELEE.test(String(e.type||''))||!e.position||[e.position.x,e.position.y,e.position.z].some(v=>!Number.isFinite(v)))continue
  if(world.players?.has?.(id)||id===world.entityId)continue
  const distance=Math.hypot(e.position.x-p.x,e.position.y-p.y,e.position.z-p.z)
  if(distance>range||distance<0.01)continue
  const cell={x:Math.floor(e.position.x),y:Math.floor(e.position.y+.7),z:Math.floor(e.position.z)}
  if(!world.visible?.(cell))continue
  candidates.push({id,type:e.type,position:e.position,distance})
 }
 return candidates.sort((a,b)=>a.distance-b.distance)[0]||null
}
export function meleePacket(world,target){
 if(!target||!world?.inventoryKnown||!Number.isSafeInteger(world.selectedSlot)||world.selectedSlot<0||world.selectedSlot>8||!world.inventory.has(world.selectedSlot))return null
 if(!/^\d+$/.test(String(target.id)))return null
 return {transaction:{
  legacy:{legacy_request_id:0,legacy_transactions:null},transaction_type:'item_use_on_entity',actions:[],transaction_data:{
   entity_runtime_id:BigInt(target.id),action_type:'attack',hotbar_slot:world.selectedSlot,hand:'main_hand',held_item:world.inventory.get(world.selectedSlot),player_pos:{...world.position},click_pos:{x:0,y:.9,z:0}
  }
 }}
}
