// Private on-device Minecraft task knowledge. It is deliberately not an app menu.
// Recipes are knowledge; mining, pickup, crafting and storage still require
// separate server-confirmed transactions. Never invent supplies or completion.
import minecraftData from 'minecraft-data'
import {resolveMaterial,recipeInfo} from './catalog.js'

const database=minecraftData('bedrock_1.26.60')
const recognizedBlocks=new Set((database.blocksArray||[]).map(b=>b.name))
const trunkPattern=/(?:_log|_wood|_stem|_hyphae)$/
export const treeTrunks=Object.freeze([...recognizedBlocks].filter(n=>trunkPattern.test(n)&&!/(?:stripped_)/.test(n)))
const trunkSet=new Set(treeTrunks)
const BLOCK_ACTIONS=['observe','approach','break','verify-block-update','locate-drop','approach-drop','verify-inventory']
const buildItem=(name)=>({name,recipe:recipeInfo(name).slice(0,3),requiresCraftingExecutor:true})
const norm=s=>String(s||'').toLowerCase().trim().replace(/[.!?]+$/,'').replace(/^(?:please |bot |can you |could you |go and )+/,'').replace(/\s+/g,' ')

export function parseResourceGoal(raw){
 const s=norm(raw)
 if(/^(?:(?:go |start |keep )?(?:cut(?:ting)? down|chop(?:ping)? down|harvest|mine) (?:all |every |nearby |the )?(?:trees|tree trunks|logs)|(?:cut down|harvest|chop) (?:all |every )?tree(?:s)? (?:you see|you find|you come across)?)$/.test(s))return {kind:'tree-harvest',target:'tree_trunks',maxBlocks:null,maxDistance:8,needsPickup:true}
 if(/^(?:go )?(?:get|gather|collect|chop(?: down)?) (?:some )?(?:wood|logs|tree logs)$/.test(s))return {kind:'tree-harvest',target:'tree_trunks',maxBlocks:null,maxDistance:8,needsPickup:true}
 const trees=s.match(/^gather (\d+) trees$/)
 if(trees){const count=Number(trees[1]);return count>=1&&count<=16?{kind:'mine-material',target:'tree_trunks',sourceFamily:'logs',requiredTrees:count,maxBlocks:512,maxDistance:8,needsPickup:true,continuousSearch:true}:{error:'Choose 1–16 trees.'}}
 // Players naturally say both "mine 200 oak logs" AND "mine oak logs 200".
 // Reorder the quantity only after an exact grammar match; never guess a
 // goal from arbitrary chat, and retain the same inventory/break verification.
 const trailing=s.match(/^(?:go )?(?:gather|collect|mine|get|harvest|chop) (.+?) (\d{1,4})$/)
 if(trailing){
  const quantity=Number(trailing[2]),raw=trailing[1].replace(/ blocks?$/,'')
  const target=resolveMaterial(raw)
  if(!target||quantity<1||quantity>2304)
   return {error:'Choose a known material and a quantity from 1–2304.'}
  return {kind:'mine-material',target,maxBlocks:Math.min(4096,quantity*4+16),
   quantity,maxDistance:8,needsPickup:true,continuousSearch:true,
   sourceFamily:/^(?:wood|logs|log)$/.test(raw)?'logs':null}
 }
 const gather=s.match(/^(?:gather|collect|mine|get) (\d{1,4}) (.+)$/)
 if(gather){const quantity=Number(gather[1]),raw=gather[2].replace(/ blocks?$/,''),target=resolveMaterial(raw);if(!target||quantity<1||quantity>2304)return {error:'Choose a known material and a quantity from 1–2304.'};return {kind:'mine-material',target,maxBlocks:Math.min(4096,quantity*4+16),quantity,maxDistance:8,needsPickup:true,continuousSearch:true,sourceFamily:/^(?:wood|logs|log)$/.test(raw)?'logs':null}}
 const m=s.match(/^(?:go )?(?:find and mine|find and break|locate and mine|search for and mine) (?:some |a |the )?(.+)$/)
 if(!m)return null
 const requested=m[1].trim(),target=resolveMaterial(requested)
 if(!target||!recognizedBlocks.has(target))return {error:`No known Bedrock block matches “${requested}”.`}
 return {kind:'mine-material',target,maxBlocks:8,maxDistance:8,needsPickup:true}
}

export function mineableKnowledge(block,toolId=null){
 if(!block||block.diggable===false||!Number.isFinite(block.hardness)||block.hardness<0)return {breakable:false,harvestable:false,estimatedMs:null,reason:'Unbreakable normally or unknown hardness.'}
 let harvestable=false,estimatedMs=null
 try{harvestable=!!block.canHarvest?.(toolId)}catch{}
 try{estimatedMs=block.digTime?.(toolId,false,false,false,[],{})??null}catch{}
 if(!Number.isFinite(estimatedMs)||estimatedMs<0)estimatedMs=null
 return {breakable:true,harvestable,estimatedMs,reason:harvestable?'Breaking is possible; drop and inventory still need server evidence.':'Block may break, but this tool is not expected to harvest its normal drop.'}
}

export function selectKnownResource(world,goal,excluded=new Set()){
 if(!world?.position||!world?.scan||!goal)return null
 const names=goal.kind==='tree-harvest'||goal.sourceFamily==='logs'?treeTrunks:[...new Set([...(goal.target==='dirt'?['dirt','grass_block']:recognizedBlocks.has(goal.target)?[goal.target]:[]),...(world.registry?.blocksArray||[]).filter(b=>(b.drops||[]).some(id=>world.registry.items[id]?.name===goal.target)).map(b=>b.name)])]
 const candidates=[]
 for(const name of names){
  for(const p of world.scan(name,{range:Math.min(8,goal.maxDistance||8)})?.found||[]){
   const k=`${p.x},${p.y},${p.z}`
   if(excluded.has(k))continue
   // The floor under the bot is evidence of a deposit, never the first dig.
   const feet=world.standPosition?.()
   if(feet&&p.x===feet.x&&p.z===feet.z&&p.y<feet.y)continue
   if(!Number.isFinite(p.distance)||p.distance>Math.min(goal.maxDistance||8,8))continue
   candidates.push(p)
  }
 }
 candidates.sort((a,b)=>a.distance-b.distance)
 return candidates[0]||null
}

export function internalResourcePlan(raw,{inventory={},knownInventory=false}={}){
 const goal=parseResourceGoal(raw)
 if(!goal||goal.error)return goal
 const stages=[...BLOCK_ACTIONS]
 const equipment=goal.kind==='tree-harvest'?['crafting_table','wooden_axe','chest'].map(buildItem):[]
 const alreadyEquipped=!!Object.keys(inventory).some(x=>/^(?:wooden|stone|iron|golden|diamond|netherite)_axe$/.test(x))
 return {goal,stages,equipment,knownInventory,alreadyEquipped,
  firstTree:'Gather a log; the server must confirm the break and actual item pickup.',
  toolUpgrade:alreadyEquipped?'Use the observed axe if it is in a hotbar slot.':'After confirmed logs: craft planks, sticks, a crafting table, and a wooden axe, when crafting transactions exist.',
  secondTree:'After two distinct observed tree trunks: select a safe near-tree chest location, craft and place a chest, then verify it exists before storing.',
  storagePolicy:'Do not drop valuable items or empty inventory until a chest/container transaction is server-confirmed. Keep dirt and other materials for later jobs.',
  executableNow:['scan','walk','mine','attempt-pickup'],blockedSkills:['craft','place-container','deposit-in-container','discard-item'],
  limits:{radius:8,maxBlocks:goal.maxBlocks,continuous:goal.kind==='tree-harvest'},
  noFakeCompletion:true}
}

export function treeTrunkAtPosition(pos){return pos&&[pos.x,pos.z].every(Number.isFinite)?`${pos.x},${pos.z}`:null}
export function isTreeLog(name){return trunkSet.has(name)}
