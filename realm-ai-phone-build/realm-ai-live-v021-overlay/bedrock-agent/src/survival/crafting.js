import {slotInfo,emptyStack,knownStack} from './stack-operations.js'
const name=s=>String(s||'').replace(/^minecraft:/,'')
const TAGS={planks:n=>/_planks$/.test(n),logs:n=>/_(?:log|wood|stem|hyphae)$/.test(n),logs_that_burn:n=>/_(?:log|wood)$/.test(n),wooden_tool_materials:n=>/_planks$/.test(n),stone_tool_materials:n=>['cobblestone','cobbled_deepslate','blackstone'].includes(n),coals:n=>['coal','charcoal'].includes(n)}
function matches(ingredient,item,registry){
 if(ingredient.type==='invalid'||ingredient.count<=0||ingredient.descriptor_type==='empty')return false
 const n=registry.items[item.network_id]?.name
 if(ingredient.descriptor_type==='name')return n===name(ingredient.name)&&(ingredient.metadata<0||ingredient.metadata===32767||ingredient.metadata===item.metadata)
 if(ingredient.descriptor_type==='item_tag')return !!TAGS[name(ingredient.tag)]?.(n)
 return false // Never evaluate server molang/expressions as executable code.
}
export class Crafting{
 constructor(world,operations){this.world=world;this.operations=operations;this.recipes=[];this.creative=[];this.creativeListener=null;this.client=null;this.listener=null}
 attach(client){this.detach();this.client=client;this.recipes=[];this.listener=p=>{if(p.clear_recipes)this.recipes=[];for(const r of [...(p.shaped_recipes||[]),...(p.shapeless_recipes||[])].slice(0,20000))if(Number.isSafeInteger(r.network_id)&&r.network_id>0&&r.output?.length===1&&r.output[0].network_id&&r.input?.length<=9)this.recipes.push(r);this.recipes=this.recipes.slice(-20000)};client.on('crafting_data',this.listener);this.creative=[];this.creativeListener=p=>{this.creative=(p.items||[]).filter(e=>Number.isSafeInteger(e.entry_id)&&e.entry_id>0&&e.item?.network_id&&e.item?.metadata===0).slice(0,20000)};client.on('creative_content',this.creativeListener)}
 detach(){if(this.creativeListener)this.client?.off('creative_content',this.creativeListener);this.creativeListener=null;if(this.listener)this.client?.off('crafting_data',this.listener);this.listener=null;this.client=null}
 requirements(material){
  const w=this.world,inventory=[...w.inventory.values()],planks=inventory.map(i=>w.registry.items[i?.network_id]?.name).find(n=>/_planks$/.test(n||''))||inventory.map(i=>w.registry.items[i?.network_id]?.name).find(n=>/_(?:log|wood|stem|hyphae)$/.test(n||''))?.replace(/^stripped_/,'').replace(/_(?:log|wood|stem|hyphae)$/,'_planks')||'oak_planks'
  const choices=[]
  for(const r of this.recipes.filter(r=>w.registry.items[r.output[0].network_id]?.name===material)){
   const ingredients={};let valid=true
   for(const i of r.input){if(i.type==='invalid'||i.count<=0||i.descriptor_type==='empty')continue
    let n=i.descriptor_type==='name'?name(i.name):null
    if(i.descriptor_type==='item_tag'){const tag=name(i.tag);n=inventory.map(v=>w.registry.items[v?.network_id]?.name).find(n=>TAGS[tag]?.(n))||({planks,wooden_tool_materials:planks,logs:'oak_log',logs_that_burn:'oak_log',stone_tool_materials:'cobblestone',coals:'coal'})[tag]}
    if(!n||!w.registry.itemsByName[n]){valid=false;break}ingredients[n]=(ingredients[n]||0)+i.count
   }
   if(valid)choices.push({ingredients,station:(r.width||1)>2||(r.height||1)>2||r.input.filter(i=>i.count>0&&i.type!=='invalid'&&i.descriptor_type!=='empty').length>4?'crafting_table':'inventory',missing:Object.entries(ingredients).reduce((n,[id,c])=>n+Math.max(0,c-(w.items()[id]||0)),0)})
  }
  return choices.sort((a,b)=>a.missing-b.missing)[0]||null
 }
 plan(material){
  const w=this.world,inventory=[...w.inventory].filter(([slot,i])=>slot>=0&&slot<36&&knownStack(i)),candidates=this.recipes.filter(r=>w.registry.items[r.output[0].network_id]?.name===material)
  for(const r of candidates){
   if((r.width||1)>2||(r.height||1)>2||r.input.filter(i=>i.count>0&&i.type!=='invalid'&&i.descriptor_type!=='empty').length>4){if(!['workbench',1].includes(w.inventoryProtocol.openWindow?.type))continue}
   const remaining=new Map(inventory.map(([slot,i])=>[slot,i.count])),use=new Map();let valid=true
   for(const ingredient of r.input){
    if(ingredient.count<=0||ingredient.type==='invalid'||ingredient.descriptor_type==='empty')continue
    let need=ingredient.count
    for(const [slot,item] of inventory){if(!matches(ingredient,item,w.registry))continue;const count=Math.min(need,remaining.get(slot)||0);if(count){remaining.set(slot,remaining.get(slot)-count);use.set(slot,(use.get(slot)||0)+count);need-=count}if(!need)break}
    if(need){valid=false;break}
   }
   if(!valid)continue
   const output=r.output[0],max=w.registry.items[output.network_id]?.stackSize||64
   let destination=null
   for(let slot=0;slot<36;slot++){const current=w.inventory.get(slot);if(!current?.count||current.network_id===output.network_id&&current.metadata===output.metadata&&current.count+output.count<=max){destination=slot;break}}
   if(destination===null)continue
   // Avoid using an ingredient slot as the result destination in this bounded
   // single craft. It would need additional request-ID slot chaining.
   if(use.has(destination)){destination=Array.from({length:36},(_,i)=>i).find(slot=>!use.has(slot)&&!(w.inventory.get(slot)?.count));if(destination===undefined)continue}
   return {recipe:r,use,destination}
  }
  return null
 }
 creativeItem(material,count=64,now=Date.now()){
  if(!Number.isSafeInteger(count)||count<1||count>2304)return {accepted:false,queued:false,message:'Choose 1–2304 requested items.'}
  const w=this.world;if(w.gameMode!=='creative'||!w.creativeEditsVerified)return {accepted:false,queued:false,message:'The server has not confirmed this player in grounded Creative mode.'}
  const entry=this.creative.find(e=>w.registry.items[e.item.network_id]?.name===material)
  if(!entry)return {accepted:false,queued:false,message:'Material is not in the received Creative catalog.'}
  const max=w.registry.items[entry.item.network_id]?.stackSize||64
  let slot=null;for(let i=0;i<36;i++){const old=w.inventory.get(i);if(!old?.count||old.network_id===entry.item.network_id&&old.metadata===entry.item.metadata&&old.count<max){slot=i;break}}
  if(slot===null)return {accepted:false,queued:false,message:'Inventory is full; no item was discarded.'}
  const before=w.inventory.get(slot)||emptyStack(),amount=Math.min(count,max-(before.count||0)),after={...entry.item,count:(before.count||0)+amount,has_stack_id:false,stack_id:0}
  return this.operations.send([{type_id:'craft_creative',legacy_type_id:12,item_id:entry.entry_id,times_crafted:1},{type_id:'take',legacy_type_id:0,count:amount,source:{slot_type:{container_id:'creative_output',dynamic_container_id:null},slot:50,stack_id:this.operations.serial},destination:slotInfo(slot,before)}],[{window:0,slot,before:{...before},after}],'Taking '+amount+' '+material+' from the server-provided Creative catalog',now)
 }
 craft(material,now=Date.now()){
  if(!this.world.editModeVerified)return {accepted:false,queued:false,message:'Verified mode/abilities are required before crafting.'}
  if(this.operations.pending)return {accepted:false,queued:false,message:'Waiting for the current inventory request.'}
  const p=this.plan(material);if(!p)return {accepted:false,queued:false,message:`No received, usable recipe with confirmed ingredients and crafting station for ${material}.`}
  const {recipe:r,use,destination}=p,w=this.world,changes=[],ingredients=[]
  const actions=[{type_id:'craft_recipe_auto',legacy_type_id:11,recipe_network_id:r.network_id,times_crafted:1,ingredients}]
  for(const [slot,count] of use){const item=w.inventory.get(slot),n=w.registry.items[item.network_id]?.name;if(!n)return {accepted:false,queued:false,message:'Ingredient type changed.'};ingredients.push({type:'name',legacy_type:1,name:'minecraft:'+n,metadata:item.metadata||0,count});actions.push({type_id:'consume',legacy_type_id:5,count,source:slotInfo(slot,item)});changes.push({window:0,slot,before:{...item},after:item.count===count?emptyStack():{...item,count:item.count-count}})}
  const current=w.inventory.get(destination)||emptyStack(),output=r.output[0],after={...output,count:(current.count||0)+output.count,has_stack_id:false,stack_id:0}
  actions.push({type_id:'take',legacy_type_id:0,count:output.count,source:{slot_type:{container_id:'creative_output',dynamic_container_id:null},slot:50,stack_id:this.operations.serial},destination:slotInfo(destination,current)})
  changes.push({window:0,slot:destination,before:{...current},after})
  return this.operations.send(actions,changes,'Crafting '+material+' with a received server recipe',now)
 }
 snapshot(){return {receivedRecipes:this.recipes.length,receivedCreativeItems:this.creative.length}}
}
