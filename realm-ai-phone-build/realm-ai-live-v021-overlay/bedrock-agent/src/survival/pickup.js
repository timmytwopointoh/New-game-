// Ground item pickup: physical approach and normal client-to-server take packet.
// A pickup is confirmed ONLY by a server inventory increase for the expected item.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)
export function nearestDrop(world,{range=9,name=null}={}){
 const pos=world?.position;if(!pos)return null
 return [...(world.drops?.entries?.()||[])].map(([id,e])=>({...e,id,distance:distance(pos,e.position)}))
  .filter(e=>e.position&&e.distance<=range&&(!name||e.name===name))
  .sort((a,b)=>a.distance-b.distance)[0]||null
}
export function pickupPacket(world,drop){
 if(!world?.position||!drop||!/^[0-9]+$/.test(String(drop.id))||!world.entityId||distance(world.position,drop.position)>1.65)return null
 return {item_runtime_id:BigInt(drop.id),actor_runtime_id:BigInt(world.entityId)}
}
export class Pickup {
 constructor(world){this.world=world;this.reset()}
 reset(){this.state='idle';this.reason='';this.target=null;this.before=null;this.sentAt=0;this.sent=false}
 begin(drop){if(!drop?.name||!this.world.inventoryKnown)return {accepted:false,message:'Drop type or inventory is unknown; cannot claim item pickup.'}
  this.target={...drop};this.before=this.world.items()[drop.name]||0;this.state='approaching';this.reason='Approaching an observed dropped item.';this.sent=false;return {accepted:true,queued:true,message:'Approaching observed '+drop.name+'; pickup is not confirmed until inventory increases.'}}
 tick(now,client){if(!this.target)return
  const t=this.target,w=this.world,after=w.items()[t.name]||0
  if(this.sent&&after>this.before){this.state='confirmed';this.reason='Server inventory confirms '+t.name+' increased by '+(after-this.before)+'.';this.target=null;return}
  if(this.sent){if(now-this.sentAt>3500){this.state='unverified';this.reason='No inventory confirmation for '+t.name+' after pickup attempt.';this.target=null}return}
  const packet=pickupPacket(w,t)
  if(packet&&w.grounded?.()&&w.movementVerified){client.queue('take_item_entity',packet);this.sent=true;this.sentAt=now;this.state='waiting-for-server-inventory';this.reason='Sent nearby item pickup; waiting for server inventory.'}
 }
 stop(){if(this.target){this.state='interrupted';this.reason='Pickup cancelled before confirmation.';this.target=null}}
 snapshot(){return {state:this.state,reason:this.reason,material:this.target?.name||null}}
}
