import minecraftData from 'minecraft-data'
const data=minecraftData('bedrock_1.26.60')
const aliases={wood:'oak_log','oak logs':'oak_log',cobble:'cobblestone',planks:'oak_planks','wooden planks':'oak_planks',sticks:'stick',workbench:'crafting_table','crafting bench':'crafting_table','iron':'iron_ingot',torches:'torch'}
const simpleRecipes={
 oak_planks:{output:4,ingredients:{oak_log:1},station:'inventory'},
 stick:{output:4,ingredients:{oak_planks:2},station:'inventory'},
 crafting_table:{output:1,ingredients:{oak_planks:4},station:'inventory'},
 wooden_pickaxe:{output:1,ingredients:{oak_planks:3,stick:2},station:'crafting_table'},
 stone_pickaxe:{output:1,ingredients:{cobblestone:3,stick:2},station:'crafting_table'},
 furnace:{output:1,ingredients:{cobblestone:8},station:'crafting_table'},
 chest:{output:1,ingredients:{oak_planks:8},station:'crafting_table'},
 torch:{output:4,ingredients:{coal:1,stick:1},station:'inventory'},
 stone_axe:{output:1,ingredients:{cobblestone:3,stick:2},station:'crafting_table'},
 stone_sword:{output:1,ingredients:{cobblestone:2,stick:1},station:'crafting_table'}
}
export function resolveMaterial(raw){
 const s=String(raw).toLowerCase().trim().replace(/^minecraft:/,'').replace(/\s+/g,' ')
 let name=aliases[s]||s.replace(/ /g,'_')
 const exists=n=>data.itemsByName[n]||data.blocksByName[n]
 if(!exists(name)&&name.endsWith('s')&&exists(name.slice(0,-1)))name=name.slice(0,-1)
 return exists(name)?name:null
}
export function searchCatalog(raw='',limit=12){const q=String(raw).toLowerCase().replace(/ /g,'_');return [...new Set([...data.blocksArray,...data.itemsArray].map(x=>x.name))].filter(n=>n.includes(q)).slice(0,limit)}
export function recipeInfo(name){
 if(simpleRecipes[name])return [{name,output:simpleRecipes[name].output,ingredients:simpleRecipes[name].ingredients,station:simpleRecipes[name].station,verified:true}]
 return Object.values(data.recipes).filter(r=>r.output?.some(o=>o.name===name)).slice(0,3).map(r=>({name:r.name,output:r.output.find(o=>o.name===name).count,ingredients:Object.fromEntries((r.ingredients||[]).map(i=>[i.name,i.count||1])),station:r.type,verified:false}))
}
export function materialInfo(name){const block=data.blocksByName[name],item=data.itemsByName[name];return {name,displayName:block?.displayName||item?.displayName,block:!!block,item:!!item,stackSize:item?.stackSize||block?.stackSize,diggable:block?.diggable??null,recipes:recipeInfo(name)}}
const baseSupplies=new Set(['coal','charcoal','diamond','emerald','iron_ingot','gold_ingot','copper_ingot','netherite_ingot','redstone','lapis_lazuli','quartz','raw_iron','raw_gold','raw_copper','bone','bamboo','wheat','string','leather','sand','gravel','dirt','cobblestone','stone'])
function chooseRecipe(name,stock,active=new Set()){
 if(baseSupplies.has(name)||/_(?:ore|log|stem)$/.test(name))return null
 if(simpleRecipes[name])return simpleRecipes[name]
 const candidates=[]
 for(const r of Object.values(data.recipes)){
  if(r.type!=='crafting_table'||r.output?.length!==1||r.output[0].name!==name||(r.output[0].metadata||0)!==0||!Array.isArray(r.ingredients))continue
  const ingredients={};let valid=true
  for(const item of r.ingredients){
   // Ambiguous tag and legacy metadata recipes remain references, never guessed dependencies.
   const id=resolveMaterial(item.name)
   if(!id||active.has(id)||(item.metadata||0)!==0||!Number.isSafeInteger(item.count)||item.count<1){valid=false;break}
   ingredients[id]=(ingredients[id]||0)+item.count
  }
  if(!valid||!Object.keys(ingredients).length||!Number.isSafeInteger(r.output[0].count)||r.output[0].count<1)continue
  const rows=r.input||[],small=Array.isArray(rows)&&rows.length<=2&&rows.every(row=>Array.isArray(row)&&row.length<=2)
  candidates.push({output:r.output[0].count,ingredients,station:small?'inventory':'crafting_table',score:Object.entries(ingredients).reduce((n,[id,c])=>n+Math.max(0,c-(stock[id]||0)),0)})
 }
 return candidates.sort((a,b)=>a.score-b.score)[0]
}
export function supplyPlan(name,count,inventory={},inventoryKnown=false){
 if(!Number.isSafeInteger(count)||count<1||count>256)return {ok:false,message:'Choose 1–256 items for a supply plan.'}
 const stock={...inventory},steps=[],missing={},stations=new Set(),active=new Set()
 function need(item,amount,depth=0){
  if(depth>12||steps.length>32)throw Error('Plan is too complex; choose a smaller job.')
  const owned=Math.min(stock[item]||0,amount);stock[item]=(stock[item]||0)-owned;amount-=owned;if(!amount)return
  const recipe=chooseRecipe(item,stock,new Set([...active,item]))
  if(!recipe){missing[item]=(missing[item]||0)+amount;steps.push({action:'obtain',item,count:amount,executable:false});return}
  if(active.has(item))throw Error('Recipe cycle detected')
  active.add(item);const times=Math.ceil(amount/recipe.output)
  for(const [input,n] of Object.entries(recipe.ingredients))need(input,n*times,depth+1)
  if(recipe.station==='crafting_table'&&!stations.has('crafting_table')){
   if((stock.crafting_table||0)>0)stations.add('crafting_table')
   else{need('crafting_table',1,depth+1);stations.add('crafting_table');steps.push({action:'place_station',item:'crafting_table',count:1,executable:false})}
  }
  stock[item]=(stock[item]||0)+times*recipe.output-amount
  steps.push({action:'craft',item,count:times*recipe.output,times,station:recipe.station,executable:false});active.delete(item)
 }
 try{need(name,count)}catch(e){return {ok:false,message:e.message}}
 return {ok:true,name,count,inventoryKnown,missing,steps,executable:false,message:steps.length?'Supply plan only. Survival harvesting/crafting transactions are not implemented yet.':'Requested supplies are already in the observed inventory.'}
}
export const catalogCounts={blocks:data.blocksArray.length,items:data.itemsArray.length,recipes:Object.keys(data.recipes).length}
