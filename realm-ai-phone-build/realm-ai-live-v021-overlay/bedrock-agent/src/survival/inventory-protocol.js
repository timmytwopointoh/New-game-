// Bedrock 1.26.60 inventory evidence. Observes server packets only; never
// predicts inventory, manufactures items or treats a scheduled craft as done.
const inventory=id=>id===0||id==='inventory'
export class InventoryProtocol{
 constructor(world){this.world=world;this.reset()}
 reset(){this.revision=0;this.slots=new Map();this.containers=new Map();this.responses=new Map();this.expected=new Map();this.openWindow=null;this.windowEpoch=0}
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
 opened(p){this.openWindow={id:p.window_id,type:p.window_type,position:p.coordinates?{...p.coordinates}:null,epoch:++this.windowEpoch};this.containers.delete(String(p.window_id))}
 closed(p){if(this.openWindow?.id===p.window_id)this.openWindow=null;this.containers.delete(String(p.window_id))}
 stackResponse(p){
  for(const response of (Array.isArray(p.responses)?p.responses:[]).slice(0,64)){
   if(!Number.isSafeInteger(response.request_id)||!['ok','error'].includes(response.status))continue
   const changes=this.expected.get(response.request_id);this.expected.delete(response.request_id)
   const reconciled=response.status==='ok'&&changes?this.reconcile(response,changes):false
   this.responses.set(response.request_id,{status:response.status,revision:++this.revision,reconciled})
   while(this.responses.size>64)this.responses.delete(this.responses.keys().next().value)
  }
  // Unsolicited responses never create items. Only a fully matched, registered
  // request may reconcile server counts with already-known stack/recipe types.
 }
 expect(id,changes){if(!Number.isSafeInteger(id)||id>=0||!Array.isArray(changes)||changes.length>40)throw Error('Invalid stack request evidence');if(this.expected.size>=32)throw Error('Too many unconfirmed inventory requests');this.expected.set(id,changes.map(c=>({...c,before:{...c.before},after:{...c.after},windowEpoch:c.window===0?null:this.openWindow?.epoch})))}
 reconcile(response,changes){
  const updates=[]
  for(const change of changes){
   const own=change.window===0,window=this.containers.get(String(change.window))
   if(!own&&(!window?.known||this.openWindow?.id!==change.window||this.openWindow.epoch!==change.windowEpoch))return false
   const candidates=(response.containers||[]).filter(c=>own?['hotbar_and_inventory','hotbar','inventory',12,28,29].includes(c.slot_type?.container_id):['container','furnace_fuel','furnace_ingredient','furnace_output',7,24,25,26].includes(c.slot_type?.container_id)).flatMap(c=>(c.slots||[]).map(s=>({...s,container:c.slot_type?.container_id})))
   const receipt=candidates.find(s=>s.slot===change.slot&&(s.count===change.after.count||change.containerType==='furnace_fuel'&&s.count===0))
   if(!receipt||receipt.count>0&&(!Number.isSafeInteger(receipt.item_stack_id)||receipt.item_stack_id<=0))return false
   const current=own?this.world.inventory.get(change.slot):window.items[change.slot]
   if((current?.network_id||0)!==(change.before.network_id||0)&&(current?.network_id||0)!==(change.after.network_id||0))return false
   if((current?.count||0)!==(change.before.count||0)&&(current?.count||0)!==(change.after.count||0))return false
   updates.push({change,item:receipt.count?{...change.after,count:receipt.count,has_stack_id:true,stack_id:receipt.item_stack_id}:{...change.after,network_id:0,count:0},window})
  }
  // Each type came from an actual server inventory stack or server recipe;
  // all counts/stack IDs above came from this request's successful response.
  for(const {change,item,window} of updates){if(change.window===0){this.world.inventory.set(change.slot,item);this.slots.set(change.slot,++this.revision)}else{window.items[change.slot]=item;window.revision=++this.revision}}
  return true
 }
 baseline(slot){const item=this.world.inventory.get(slot);return {revision:this.slots.get(slot)||0,count:item?.count||0,id:item?.network_id||0}}
 consumed(slot,before){
  if((this.slots.get(slot)||0)<=before.revision)return false
  const item=this.world.inventory.get(slot)
  return before.count===1?(!item?.network_id||item.count===0):item?.network_id===before.id&&item.count===before.count-1
 }
 snapshot(){return {revision:this.revision,inventoryKnown:this.world.inventoryKnown,openWindow:this.openWindow?.type||null,knownContainers:[...this.containers.values()].filter(c=>c.known).length,stackResponses:this.responses.size}}
}
