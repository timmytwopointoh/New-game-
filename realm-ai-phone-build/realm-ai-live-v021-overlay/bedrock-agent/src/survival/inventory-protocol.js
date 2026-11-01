// Bedrock 1.26.60 inventory evidence. Observes server packets only; never
// predicts inventory, manufactures items or treats a scheduled craft as done.
const inventory=id=>id===0||id==='inventory'
export class InventoryProtocol{
 constructor(world){this.world=world;this.reset()}
 reset(){this.revision=0;this.slots=new Map();this.containers=new Map();this.responses=new Map();this.openWindow=null}
 content(p){
  if(!Array.isArray(p.input))return
  if(inventory(p.window_id)){
   const previous=[...this.world.inventory.keys()];this.world.inventory.clear()
   p.input.slice(0,256).forEach((v,i)=>this.world.inventory.set(i,v));this.world.inventoryKnown=true
   const version=++this.revision
   for(const slot of new Set([...previous,...this.world.inventory.keys()]))this.slots.set(slot,version)
  }else{
   this.containers.set(String(p.window_id),{known:true,revision:++this.revision,items:p.input.slice(0,256)})
   while(this.containers.size>8)this.containers.delete(this.containers.keys().next().value)
  }
 }
 slot(p){
  if(!Number.isSafeInteger(p.slot)||p.slot<0||p.slot>255)return
  if(inventory(p.window_id)){this.world.inventory.set(p.slot,p.item);this.slots.set(p.slot,++this.revision)}
  else{const c=this.containers.get(String(p.window_id));if(c){c.items[p.slot]=p.item;c.revision=++this.revision}}
 }
 opened(p){this.openWindow={id:p.window_id,type:p.window_type};this.containers.delete(String(p.window_id))}
 closed(p){if(this.openWindow?.id===p.window_id)this.openWindow=null;this.containers.delete(String(p.window_id))}
 stackResponse(p){
  for(const response of (Array.isArray(p.responses)?p.responses:[]).slice(0,64)){
   if(!Number.isSafeInteger(response.request_id)||!['ok','error'].includes(response.status))continue
   this.responses.set(response.request_id,{status:response.status,revision:++this.revision})
   while(this.responses.size>64)this.responses.delete(this.responses.keys().next().value)
  }
  // Responses do not identify all item types; wait for authoritative inventory
  // snapshots before crediting new planks, tools, chests, or container transfers.
 }
 baseline(slot){const item=this.world.inventory.get(slot);return {revision:this.slots.get(slot)||0,count:item?.count||0,id:item?.network_id||0}}
 consumed(slot,before){
  if((this.slots.get(slot)||0)<=before.revision)return false
  const item=this.world.inventory.get(slot)
  return before.count===1?(!item?.network_id||item.count===0):item?.network_id===before.id&&item.count===before.count-1
 }
 snapshot(){return {revision:this.revision,inventoryKnown:this.world.inventoryKnown,openWindow:this.openWindow?.type||null,knownContainers:[...this.containers.values()].filter(c=>c.known).length,stackResponses:this.responses.size}}
}
