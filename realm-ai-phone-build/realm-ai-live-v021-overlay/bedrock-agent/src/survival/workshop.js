import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {emptyStack} from './stack-operations.js'
const key=p=>`${p.dimension}:${p.x},${p.y},${p.z}`
const waiting=reason=>({state:'working',reason})
export class Workshop{
 constructor(controller,{directory=null,scope=null}={}){this.c=controller;this.directory=directory;this.records=[];this.placing=null;this.opening=null;this.error='';this.setScope(scope)}
 setScope(scope){this.error='';this.scope=scope?String(scope):null;this.records=[];this.file=this.directory&&this.scope?path.join(this.directory,crypto.createHash('sha256').update(this.scope).digest('hex')+'.json'):null;if(this.file&&fs.existsSync(this.file)){try{const data=JSON.parse(fs.readFileSync(this.file));if(!Array.isArray(data)||data.length>1024)throw Error();this.records=data.filter(p=>['chest','crafting_table','furnace','obsidian','dirt','tree_site'].includes(p.name)&&[p.x,p.y,p.z,p.dimension].every(Number.isSafeInteger)&&p.dimension>=0&&p.dimension<=2)}catch{this.error='Workshop memory unreadable; saved file preserved.'}}}
 rememberTree(target){const p={x:target.x,y:target.y,z:target.z,dimension:this.c.world.dimension,name:'tree_site'};if(!this.records.some(r=>r.name==='tree_site'&&r.dimension===p.dimension&&Math.hypot(r.x-p.x,r.z-p.z)<2.5)){this.records.push(p);this.persist()}}
 persist(){if(!this.file||this.error)return;fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.records.slice(-1024)),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file)}
 tick(now){
  const w=this.c.world
  for(const p of this.records)if(p.dimension===w.dimension&&w.block(p)?.name===p.name)w.ownedPlacements.set(key(p),p)
  if(this.placing&&!this.c.navigation.building.job){if(this.c.navigation.building.state==='confirmed'){const p={...this.placing,dimension:w.dimension};if(!this.records.some(r=>key(r)===key(p)))this.records.push(p);this.persist()}this.placing=null}
  if(now-(this.lastPersist||0)>10000){this.lastPersist=now;let changed=false;for(const p of w.ownedPlacements.values())if(['chest','crafting_table','furnace','obsidian','dirt'].includes(p.name)&&!this.records.some(r=>key(r)===key(p))){this.records.push(p);changed=true}if(changed)this.persist()}
 }
 known(name){const w=this.c.world;return this.records.filter(p=>p.name===name&&p.dimension===w.dimension&&w.block(p)?.name===name)}
 hotbar(material,now){
  const w=this.c.world,ops=this.c.operations
  if(ops.pending)return waiting(ops.reason)
  if([...w.inventory].some(([s,i])=>s<9&&i.count>0&&w.registry.items[i.network_id]?.name===material))return {state:'ready'}
  const found=[...w.inventory].find(([s,i])=>s>=9&&s<36&&i.count>0&&w.registry.items[i.network_id]?.name===material),slot=Array.from({length:9},(_,i)=>i).find(s=>!w.inventory.get(s)?.count)
  if(!found)return {state:'need',material,quantity:1,reason:'No matching inventory item.'}
  if(slot===undefined){const selected=Number.isSafeInteger(w.selectedSlot)?w.selectedSlot:8,r=ops.swap({window:0,slot:found[0]},{window:0,slot:selected},now);return r.accepted?waiting(r.message):{state:'blocked',reason:r.message}}
  const r=ops.transfer({window:0,slot:found[0]},{window:0,slot},found[1].count,now);return r.accepted?waiting(r.message):{state:'blocked',reason:r.message}
 }
 ensure(material,quantity=1,now=Date.now(),depth=0,seen=new Set()){
  const c=this.c,w=c.world,stock=w.items();if((stock[material]||0)>=quantity)return {state:'ready'}
  if(depth>8||seen.has(material))return {state:'blocked',reason:'Recipe dependency cycle or depth limit.'}
  if(c.operations.pending)return waiting(c.operations.reason)
  if(['denied','unverified'].includes(c.operations.state))return {state:'blocked',reason:c.operations.reason}
  if(w.gameMode==='creative'&&c.crafting.creative.some(e=>w.registry.items[e.item.network_id]?.name===material)){const r=c.crafting.creativeItem(material,quantity-(stock[material]||0),now);return r.accepted?waiting(r.message):{state:'blocked',reason:r.message}}
  if(['iron_ingot','gold_ingot','copper_ingot','charcoal','stone','glass'].includes(material))return this.smelt(material,now,depth,seen)
  const plan=c.crafting.requirements(material)
  if(!plan)return c.crafting.recipes.length?{state:'need',material,quantity:quantity-(stock[material]||0),reason:'This material must be found and collected.'}:waiting('Waiting for received server crafting recipes.')
  const next=new Set([...seen,material])
  for(const [ingredient,count] of Object.entries(plan.ingredients))if((w.items()[ingredient]||0)<count){const r=this.ensure(ingredient,count,now,depth+1,next);if(r.state!=='ready')return r}
  if(plan.station==='crafting_table'){
   if(!['workbench',1].includes(w.inventoryProtocol.openWindow?.type)){
    const table=this.known('crafting_table').find(p=>Math.hypot(p.x+.5-w.position.x,p.y+1.62-w.position.y,p.z+.5-w.position.z)<10)
    if(!table){const supplies=this.ensure('crafting_table',1,now,depth+1,next);if(supplies.state!=='ready')return supplies;return this.place('crafting_table',null,now)}
    return this.open(table,now)
   }
  }
  const result=c.crafting.craft(material,now);return result.accepted?waiting(result.message):{state:'blocked',reason:result.message}
 }
 smelt(material,now,depth,seen){
  const c=this.c,w=c.world,inputs={iron_ingot:'raw_iron',gold_ingot:'raw_gold',copper_ingot:'raw_copper',stone:'cobblestone',glass:'sand',charcoal:null},stock=w.items(),log=Object.keys(stock).find(n=>/_(?:log|wood)$/.test(n)),input=inputs[material]||log||'oak_log'
  const open=w.inventoryProtocol.openWindow,openItems=open?w.inventoryProtocol.containers.get(String(open.id))?.items:null,haveOutput=openItems?.[2]?.count&&w.registry.items[openItems[2].network_id]?.name===material,haveInput=openItems?.[0]?.count&&w.registry.items[openItems[0].network_id]?.name===input
  if(!stock[input]&&!haveOutput&&!haveInput)return {state:'need',material:input,quantity:1,reason:'Smelting needs a real '+input+'.'}
  const furnace=this.known('furnace').find(p=>Math.hypot(p.x+.5-w.position.x,p.y+1.62-w.position.y,p.z+.5-w.position.z)<10)
  if(!furnace){const supply=this.ensure('furnace',1,now,depth+1,new Set([...seen,material]));if(supply.state!=='ready')return supply;return this.place('furnace',null,now)}
  let fuel=Object.keys(stock).find(n=>['coal','charcoal'].includes(n))||Object.keys(stock).find(n=>/_planks$/.test(n))
  if(!fuel&&!haveOutput&&!openItems?.[1]?.count&&!this.fuelSentAt){const plank=(log||'oak_log').replace(/^stripped_/,'').replace(/_(?:log|wood)$/,'_planks');const supply=this.ensure(plank,1,now,depth+1,new Set([...seen,material]));if(supply.state!=='ready')return supply;fuel=plank}
  const opened=this.open(furnace,now);if(opened.state!=='ready')return opened
  const items=w.inventoryProtocol.containers.get(String(opened.window))?.items;if(!items)return waiting('Waiting for furnace inventory.')
  const output=items[2],outputName=w.registry.items[output?.network_id]?.name
  if(output?.count){if(outputName!==material)return {state:'blocked',reason:'Owned furnace contains a different output; no item overwritten.'};let dest=[...w.inventory].find(([s,i])=>s<36&&i.network_id===output.network_id&&i.count<(w.registry.items[i.network_id]?.stackSize||64))?.[0];if(dest===undefined)dest=Array.from({length:36},(_,i)=>i).find(s=>!w.inventory.get(s)?.count);if(dest===undefined)return {state:'blocked',reason:'No inventory room for smelted output.'};const r=c.operations.transfer({window:opened.window,slot:2,containerType:'furnace_output'},{window:0,slot:dest},Math.min(output.count,64-(w.inventory.get(dest)?.count||0)),now);return r.accepted?waiting(r.message):{state:'blocked',reason:r.message}}
  if(items[0]?.count&&w.registry.items[items[0].network_id]?.name!==input)return {state:'blocked',reason:'Owned furnace has another ingredient; refusing to overwrite it.'}
  const slotFor=n=>[...w.inventory].find(([s,i])=>s<36&&i.count&&w.registry.items[i.network_id]?.name===n)?.[0]
  if(!items[0]?.count){const slot=slotFor(input);const r=c.operations.transfer({window:0,slot},{window:opened.window,slot:0,containerType:'furnace_ingredient'},1,now);this.smeltStarted=now;this.fuelSentAt=null;return r.accepted?waiting(r.message):{state:'blocked',reason:r.message}}
  this.smeltStarted??=now
  if(!items[1]?.count&&!this.fuelSentAt){const slot=slotFor(fuel);const r=c.operations.transfer({window:0,slot},{window:opened.window,slot:1,containerType:'furnace_fuel'},1,now);if(r.accepted)this.fuelSentAt=now;return r.accepted?waiting(r.message):{state:'blocked',reason:r.message}}
  if(now-(this.smeltStarted||now)>45000)return {state:'blocked',reason:'No server-confirmed furnace output after 45 seconds.'}
  return waiting('Smelting; waiting for the server furnace output slot.')
 }
 place(material,near=null,now=Date.now()){
  const c=this.c,w=c.world,n=c.navigation;if(this.placing||n.job)return waiting('Waiting for the current construction or movement.')
  const supply=this.hotbar(material,now);if(supply.state!=='ready')return supply
  const base=near||w.standPosition();if(!base)return waiting('Waiting for position.');if(Math.hypot(base.x+.5-w.position.x,base.z+.5-w.position.z)>5)return {state:'approach',position:base,reason:'Walk toward the storage/workshop site before placing.'}
  const targets=[];for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){const p={x:base.x+dx,y:base.y,z:base.z+dz};if(Math.hypot(p.x+.5-w.position.x,p.z+.5-w.position.z)>3.7||!w.airAt(p))continue;targets.push(p)}
  targets.sort((a,b)=>Math.hypot(a.x-base.x,a.z-base.z)-Math.hypot(b.x-base.x,b.z-base.z))
  for(const p of targets){if(w.position.x+.3>p.x&&w.position.x-.3<p.x+1&&w.position.z+.3>p.z&&w.position.z-.3<p.z+1)continue
   const result=n.build({shape:'block',origin:p,material,internalStructure:true});if(result.accepted){this.placing={...p,name:material};return waiting('Placing '+material+'; waiting for server block and inventory confirmation.')}
  }
  return {state:'blocked',reason:'No safe observed nearby station/chest placement cell.'}
 }
 open(position,now=Date.now()){
  const w=this.c.world,n=this.c.navigation,p=w.position,b=w.block(position)
  if(!b||!w.ownedPlacements.has(key({...position,dimension:w.dimension})))return {state:'blocked',reason:'Container/station ownership is not confirmed.'}
  const window=w.inventoryProtocol.openWindow
  if(window&&window.position&&window.position.x===position.x&&window.position.y===position.y&&window.position.z===position.z&&this.opening&&key(this.opening.position)===key({...position,dimension:w.dimension})){if(['workbench',1].includes(window.type)||w.inventoryProtocol.containers.get(String(window.id))?.known)return {state:'ready',window:window.id};if(now-this.opening.started>8000)return {state:'blocked',reason:'Container contents were not received.'};return waiting('Waiting for server container contents.')}
  if(this.opening&&key(this.opening.position)!==key({...position,dimension:w.dimension})){this.close();return waiting('Closing the previous station before opening another.')}
  if(this.opening){if(now-this.opening.started>8000){this.opening=null;return {state:'blocked',reason:'The server did not open the station/container.'}}return waiting('Waiting for the station/container to open.')}
  if(Math.hypot(position.x+.5-p.x,position.y+.5-p.y,position.z+.5-p.z)>4||!w.visible(position))return {state:'approach',position,reason:'Walk closer to the owned station/container.'}
  const dx=p.x-position.x-.5,dy=p.y-position.y-.5,dz=p.z-position.z-.5,face=Math.abs(dy)>=Math.max(Math.abs(dx),Math.abs(dz))?(dy>0?1:0):Math.abs(dx)>Math.abs(dz)?(dx>0?5:4):(dz>0?3:2),click={x:face===4?0:face===5?1:.5,y:face===0?0:face===1?1:.5,z:face===2?0:face===3?1:.5},slot=w.selectedSlot
  if(slot===null||!w.inventory.has(slot))return {state:'blocked',reason:'Held slot must be received before interacting.'}
  const held=w.inventory.get(slot)?.network_id?w.inventory.get(slot):emptyStack(),tx={legacy:{legacy_request_id:0,legacy_transactions:null},transaction_type:'item_use',actions:[],transaction_data:{action_type:'click_block',trigger_type:'player_input',block_position:{x:position.x,y:position.y,z:position.z},face,hotbar_slot:slot,hand:'main_hand',held_item:held,player_pos:{...p,y:p.y-1.62},click_pos:click,block_runtime_id:w.runtimeIdAt(position)>>>0,client_prediction:'success',client_cooldown_state:'off'}}
  if(!n.queueUse(tx,{x:position.x+click.x,y:position.y+click.y,z:position.z+click.z}))return waiting('Other use-item controls are pending.')
  this.opening={position:{...position,dimension:w.dimension},started:now};return waiting('Interacting with the owned '+b.name+'; waiting for server container-open.')
 }
 close(){const w=this.c.world,open=w.inventoryProtocol.openWindow;if(open){this.c.connection.client?.queue('container_close',{window_id:open.id,window_type:open.type,server:false});w.inventoryProtocol.closed({window_id:open.id})}this.opening=null}
 deposit(material,{minimum=640,double=false,home=null,now=Date.now()}={}){
  const w=this.c.world,c=this.c
  if(c.operations.pending)return waiting(c.operations.reason)
  if(['denied','unverified'].includes(c.operations.state))return {state:'blocked',reason:c.operations.reason}
  if(!this.depositing&&(w.items()[material]||0)<minimum)return {state:'ready',stored:false,reason:`Below the ${minimum}-item deposit threshold.`}
  this.depositing||={material}
  if(this.depositing.material!==material)return {state:'blocked',reason:'Another deposit is still active.'}
  let chests=this.known('chest')
  if(!chests.length){const supplies=this.ensure('chest',double?2:1,now);if(supplies.state!=='ready')return supplies;return this.place('chest',home,now)}
  const chest=chests.sort((a,b)=>Math.hypot(a.x-(home?.x||w.position.x),a.z-(home?.z||w.position.z))-Math.hypot(b.x-(home?.x||w.position.x),b.z-(home?.z||w.position.z)))[0]
  if(double&&!chests.some(p=>p!==chest&&p.y===chest.y&&Math.abs(p.x-chest.x)+Math.abs(p.z-chest.z)===1)){const supplies=this.ensure('chest',1,now);if(supplies.state!=='ready')return supplies;return this.place('chest',chest,now)}
  const opened=this.open(chest,now);if(opened.state!=='ready')return opened
  const container=w.inventoryProtocol.containers.get(String(opened.window));if(double&&container?.items.length!==54)return {state:'blocked',reason:'Two chest blocks exist, but the server did not confirm a 54-slot double chest.'}
  const source=[...w.inventory].find(([,i])=>w.registry.items[i.network_id]?.name===material&&i.count>0)
  if(!source){this.depositing=null;return {state:'ready',stored:true}}
  const max=w.registry.items[source[1].network_id]?.stackSize||64,slot=container.items.findIndex(i=>!i?.count||i.network_id===source[1].network_id&&i.count<max)
  if(slot<0)return {state:'blocked',reason:'Owned chest is full; no items were discarded.'}
  const count=Math.min(source[1].count,max-(container.items[slot]?.count||0)),r=c.operations.transfer({window:0,slot:source[0]},{window:opened.window,slot},count,now)
  return r.accepted?waiting(r.message):{state:'blocked',reason:r.message}
 }
 snapshot(){return {knownStructures:this.records.length,placing:this.placing?.name||null,opening:!!this.opening,error:this.error}}
}
