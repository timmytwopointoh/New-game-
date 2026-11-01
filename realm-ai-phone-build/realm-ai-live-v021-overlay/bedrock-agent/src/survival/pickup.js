// Bedrock collects drops when the server observes the player close enough.
// take_item_entity is a SERVER notification, never a client pickup request.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)
const valid=p=>p&&[p.x,p.y,p.z].every(Number.isFinite)
export function nearestDrop(world,{range=9,name=null,names=null}={}){
 const pos=world?.serverPosition||world?.position;if(!valid(pos))return null
 return [...(world.drops?.entries?.()||[])].filter(([,e])=>valid(e?.position))
  .map(([id,e])=>({...e,id,distance:distance(pos,e.position)}))
  .filter(e=>e.distance<=range&&(!name||e.name===name)&&(!names||names.includes(e.name)))
  .sort((a,b)=>a.distance-b.distance)[0]||null
}
export function withinPickupReach(world,drop){
 const p=world?.serverPosition
 return valid(p)&&valid(drop?.position)&&distance({...p,y:p.y-1.62},drop.position)<=1.8
}
export class Pickup{
 constructor(world){this.world=world;this.reset()}
 reset(){this.state='idle';this.reason='';this.target=null;this.before=0;this.waitingSince=null;this.started=0}
 begin(drop,now=Date.now()){
  if(!drop?.name||!valid(drop.position)||!this.world.inventoryKnown)return {accepted:false,message:'Drop type or inventory is unknown; cannot claim item pickup.'}
  this.target={...drop};this.before=this.world.items()[drop.name]||0;this.state='approaching';this.reason='Approaching an observed dropped item.';this.waitingSince=null;this.started=now
  return {accepted:true,queued:true,message:'Walking toward observed '+drop.name+'; the server handles proximity pickup. Inventory confirmation is required.'}
 }
 tick(now){
  if(!this.target)return
  const t=this.target,w=this.world,live=w.drops?.get(String(t.id));if(valid(live?.position))t.position={...live.position}
  if((w.items()[t.name]||0)>this.before){this.state='confirmed';this.reason='Server inventory confirms '+t.name+' increased.';this.target=null;return}
  if(this.waitingSince!==null){if(now-this.waitingSince>3500){this.state='unverified';this.reason='No inventory confirmation for '+t.name+' after approaching the observed drop.';this.target=null}return}
  if(withinPickupReach(w,t)&&w.grounded?.()&&w.movementVerified){this.waitingSince=now;this.state='waiting-for-server-inventory';this.reason='Server position is near the drop; waiting for automatic pickup and inventory confirmation.'}
  else if(now-this.started>20000){this.state='unverified';this.reason='Approach to the dropped item was not server-confirmed within 20 seconds.';this.target=null}
 }
 stop(){if(this.target){this.state='interrupted';this.reason='Pickup cancelled before confirmation.';this.target=null}}
 snapshot(){return {state:this.state,reason:this.reason,material:this.target?.name||null}}
}
