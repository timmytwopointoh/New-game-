const empty=()=>({network_id:0,count:0,metadata:0,has_stack_id:false,stack_id:0,block_runtime_id:0,extra:{has_nbt:false,can_place_on:[],can_destroy:[]}})
const clone=x=>({...x})
const known=item=>item?.network_id&&item.count>0&&item.has_stack_id&&Number.isSafeInteger(item.stack_id)&&item.stack_id>0
export const slotInfo=(slot,item,window=0,type=null)=>({slot_type:{container_id:type||(window===0?'hotbar_and_inventory':'container'),dynamic_container_id:null},slot,stack_id:item?.count?item.stack_id:0})
export class StackOperations{
 constructor(world,report=()=>{}){this.world=world;this.report=report;this.serial=-1;this.pending=null;this.state='idle';this.reason=''}
 cancel(reason='Inventory work interrupted.'){if(this.pending)this.world.inventoryProtocol.expected.delete(this.pending.id);this.pending=null;this.state='interrupted';this.reason=reason}
 send(actions,changes,description,now=Date.now()){
  if(this.pending)return {accepted:false,queued:false,message:'An inventory request is still pending.'}
  if(!this.world.inventoryKnown||!this.client)return {accepted:false,queued:false,message:'Waiting for server inventory and connection.'}
  const id=this.serial--;if(this.serial< -2000000000)this.serial=-1
  this.world.inventoryProtocol.expect(id,changes)
  try{this.client.queue('item_stack_request',{requests:[{request_id:id,actions,custom_names:[],cause:'chat_public'}]})}catch(e){this.world.inventoryProtocol.expected.delete(id);return {accepted:false,queued:false,message:'Stack request serialization failed: '+String(e.message).slice(0,100)}}
  this.pending={id,changes,started:now,revision:this.world.inventoryProtocol.revision};this.state='waiting-for-server';this.reason=description+'; waiting for server inventory confirmation.'
  return {accepted:true,queued:true,message:this.reason}
 }
 item(window,slot){return window===0?this.world.inventory.get(slot):this.world.inventoryProtocol.containers.get(String(window))?.items[slot]}
 transfer(from,to,count,now=Date.now()){
  const a=this.item(from.window,from.slot),b=this.item(to.window,to.slot)||empty()
  if(!known(a)||!Number.isSafeInteger(count)||count<1||count>a.count||count>64)return {accepted:false,queued:false,message:'Source item/count/stack ID is not confirmed.'}
  if(b.count&&(!known(b)||b.network_id!==a.network_id||b.metadata!==a.metadata))return {accepted:false,queued:false,message:'Destination is occupied by another item.'}
  const max=this.world.registry?.items?.[a.network_id]?.stackSize||64;if((b.count||0)+count>max)return {accepted:false,queued:false,message:'Destination stack capacity exceeded.'}
  if(from.window!==0&&this.world.inventoryProtocol.openWindow?.id!==from.window||to.window!==0&&this.world.inventoryProtocol.openWindow?.id!==to.window)return {accepted:false,queued:false,message:'The requested container is not open.'}
  const afterA=a.count===count?empty():{...a,count:a.count-count},afterB={...a,count:(b.count||0)+count}
  return this.send([{type_id:'place',legacy_type_id:1,count,source:slotInfo(from.slot,a,from.window,from.containerType),destination:slotInfo(to.slot,b,to.window,to.containerType)}],[{...from,before:clone(a),after:afterA},{...to,before:clone(b),after:afterB}],'Moving '+count+' known item(s)',now)
 }
 swap(from,to,now=Date.now()){
  const a=this.item(from.window,from.slot)||empty(),b=this.item(to.window,to.slot)||empty()
  if(a.count&&!known(a)||b.count&&!known(b))return {accepted:false,queued:false,message:'Both stack identities must be server-known before swapping.'}
  if(from.window!==0&&this.world.inventoryProtocol.openWindow?.id!==from.window||to.window!==0&&this.world.inventoryProtocol.openWindow?.id!==to.window)return {accepted:false,queued:false,message:'Container is not open.'}
  return this.send([{type_id:'swap',legacy_type_id:2,source:slotInfo(from.slot,a,from.window,from.containerType),destination:slotInfo(to.slot,b,to.window,to.containerType)}],[{...from,before:{...a},after:{...b}},{...to,before:{...b},after:{...a}}],'Swapping two confirmed inventory slots',now)
 }
 tick(now=Date.now()){
  const p=this.pending;if(!p)return
  const response=this.world.inventoryProtocol.responses.get(p.id)
  if(response?.status==='error'){this.pending=null;this.state='denied';this.reason='The server denied the inventory/crafting request.';this.report(this.reason);return}
  const matches=p.changes.every(c=>{const item=this.item(c.window,c.slot);return (item?.network_id||0)===(c.after.network_id||0)&&(item?.count||0)===(c.after.count||0)})
  const newer=p.changes.every(c=>c.window===0?(this.world.inventoryProtocol.slots.get(c.slot)||0)>p.revision:(this.world.inventoryProtocol.containers.get(String(c.window))?.revision||0)>p.revision)
  if(response?.reconciled||matches&&newer){this.pending=null;this.state='confirmed';this.reason='Server confirms inventory changes for the request.';this.report(this.reason);return}
  if(now-p.started>8000){this.world.inventoryProtocol.expected.delete(p.id);this.pending=null;this.state='unverified';this.reason='Inventory/crafting was not confirmed within eight seconds; no supplies were invented.';this.report(this.reason)}
 }
 snapshot(){return {state:this.state,reason:this.reason,pending:!!this.pending}}
}
export {empty as emptyStack,known as knownStack}
