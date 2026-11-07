// Bedrock game-data reference. Predictions only: never bypass server confirmation.
import minecraftData from 'minecraft-data'
import registryFactory from 'prismarine-registry'
import blockFactory from 'prismarine-block'
export const KNOWLEDGE_VERSION='bedrock_1.26.60'
const data=minecraftData(KNOWLEDGE_VERSION),norm=x=>String(x||'').toLowerCase().trim().replace(/^minecraft:/,'').replace(/\s+/g,'_')
const tiers=['wooden','stone','copper','iron','diamond','netherite','golden']
export const toolNames=Object.freeze(['hand',...tiers.flatMap(t=>['pickaxe','axe','shovel','hoe','sword'].map(k=>t+'_'+k)),'shears'])
let fallback=null
const levels=(n,max)=>Number.isSafeInteger(Number(n))&&Number(n)>=0&&Number(n)<=max?Number(n):null
function factory(world){if(world?.registry&&world?.Block)return {registry:world.registry,Block:world.Block};if(!fallback){const registry=registryFactory(KNOWLEDGE_VERSION);fallback={registry,Block:blockFactory(registry)}}return fallback}
export function blockBehavior(raw){
 const name=norm(raw),tags=[],lines=[],mark=(tag,line)=>{tags.push(tag);lines.push(line)}
 if(/^(?:water|flowing_water)$/.test(name))mark('fluid','Water can be crossed or swum in, but drowning and mining penalties depend on submersion.')
 if(/^(?:lava|flowing_lava)$/.test(name))mark('hazard','Lava burns and must not be treated like water.')
 if(/magma|cactus|fire|campfire|powder_snow|wither_rose|sweet_berry/.test(name))mark('hazard','Contact can hurt the player.')
 if(/^(?:sand|red_sand|gravel|suspicious_sand|suspicious_gravel)$/.test(name)||name.endsWith('concrete_powder'))mark('gravity','May fall without support.')
 if(/(?:_ore|ancient_debris)$/.test(name))mark('ore','Mining tier matters for obtaining drops.')
 if(/(?:_log|_wood|_stem|_hyphae)$/.test(name))mark('wood','Wood material often supports planks, sticks and crafting.')
 if(/chest|barrel|shulker_box|hopper|furnace|spawner|vault/.test(name))mark('protected-container','Preserve inventories and functional world objects.')
 if(/tnt|command_block|structure_block|bedrock|barrier|portal/.test(name))mark('protected','Do not alter as an ordinary obstacle.')
 if(/redstone|piston|observer|repeater|comparator/.test(name))mark('mechanism','Observe circuit state before interacting.')
 if(/door|trapdoor|fence_gate/.test(name))mark('opening','Opening state affects navigation.')
 if(/slab|stairs|carpet|fence|wall/.test(name))mark('partial-collision','Collision differs from a full cube.')
 if(/sapling|_crop|wheat|potato|carrot|beetroot/.test(name))mark('growable','Growth and harvesting rules may apply.')
 return {tags,description:lines.join(' ')||'Bedrock block. Behavior depends on its exact state, surroundings and game rules.',confidence:'name-derived guidance, not a live world observation'}
}
export function blockCatalog(){
 return (data.blocksArray||[]).map(b=>({id:b.name,name:b.displayName||b.name,hardness:Number.isFinite(b.hardness)?b.hardness:null,diggable:b.diggable===true,material:b.material||null,collision:b.boundingBox||null,...blockBehavior(b.name)}))
}
const hp={
 zombie:20,husk:20,drowned:20,skeleton:20,stray:20,bogged:16,creeper:20,spider:16,cave_spider:12,enderman:40,witch:26,blaze:20,ghast:10,piglin:16,piglin_brute:50,hoglin:40,zoglin:40,warden:500,wither:300,ender_dragon:200,iron_golem:100,snow_golem:4,ravager:100,pillager:24,vindicator:24,evoker:24,vex:14,guardian:30,elder_guardian:80,phantom:20,breeze:30,silverfish:8,endermite:8,chicken:4,cow:10,sheep:8,pig:10,villager:20,bee:10,cat:10,wolf:8,frog:10,axolotl:14,allay:20,camel:32,sniffer:14,armadillo:12,horse:30,shulker:30
}
const danger={
 zombie:'Hostile melee undead; approach carefully.',husk:'Hostile desert undead; may apply Hunger.',drowned:'Aquatic zombie; some throw tridents.',skeleton:'Ranged skeleton; seek cover.',stray:'Skeleton variant; arrows may cause Slowness.',bogged:'Skeleton variant; poisoned arrows.',creeper:'Explodes near players; keep distance.',spider:'May climb and lunge.',cave_spider:'Small hostile spider; poison risk.',enderman:'Usually neutral until provoked or stared at.',witch:'Throws harmful potions.',blaze:'Ranged fireball attacker.',ghast:'Flying explosive-fireball attacker.',piglin:'Neutral or hostile depending on conditions and equipment.',piglin_brute:'Hostile melee attacker.',hoglin:'Hostile charging animal.',zoglin:'Aggressive undead hoglin.',warden:'Extremely dangerous; senses vibrations and can attack at range.',wither:'Boss; dangerous projectiles and explosions.',ender_dragon:'Flying boss with multi-part attacks.',ravager:'Powerful melee charger.',pillager:'Hostile crossbow user.',vindicator:'Hostile axe-wielding raider.',evoker:'Summons vexes and magical attacks.',vex:'Small flying attacker.',guardian:'Underwater ranged beam attacker.',elder_guardian:'Underwater boss-like guardian.',phantom:'Flying swooping hostile.',breeze:'Hostile wind-based ranged attacks.',silverfish:'Small hostile swarm mob.',endermite:'Small hostile mob.'}
export function mobReference(raw){
 const id=norm(raw),e=data.entitiesByName?.[id]||(data.entitiesArray||[]).find(x=>x.name===id);if(!e)return null
 const known=Object.hasOwn(hp,id),behavior=danger[id]||'Behavior and hostility depend on entity type, conditions and live observations.'
 return {id,name:norm(e.displayName||'')===id?e.displayName:id.replaceAll('_',' '),category:e.category||e.type||'entity',health:known?hp[id]:Number.isFinite(e.health)?e.health:null,normalDamage:null,attackType:danger[id]?'varies by attack':'unknown or noncombat',behavior,response:danger[id]?'Observe range, armor, health and terrain before engaging or evading.':'Observe the entity before deciding to approach.',healthConfidence:known?'curated baseline; variants may differ':'registry value or unknown',damageConfidence:'unverified: no invented exact damage',source:'pinned Bedrock entity registry and conservative behavior hints'}
}
export const entityCatalog=()=> (data.entitiesArray||[]).map(e=>mobReference(e.name)).filter(Boolean)
export function blockReference(raw,{tool='hand',efficiency=0,haste=0,conduitPower=0,miningFatigue=0,underwater=false,aquaAffinity=false,airborne=false,creative=false,world=null}={}){
 const id=norm(raw),b=data.blocksByName?.[id];if(!b)return null
 const toolName=/^(?:bare_hand|bare_hands|fist)$/.test(norm(tool))?'hand':norm(tool)
 if(!toolNames.includes(toolName))return {id,error:'Unknown tool; use hand, shears or a named tool and tier.'}
 const status={efficiency:levels(efficiency,5),haste:levels(haste,10),conduitPower:levels(conduitPower,10),miningFatigue:levels(miningFatigue,10)}
 if(Object.values(status).some(x=>x===null))return {id,error:'Invalid status-effect level.'}
 const {registry,Block}=factory(world),info=registry.blocksByName?.[id]
 if(!info||!Number.isSafeInteger(info.minStateId))return {id,error:'Block state unavailable for this game version.'}
 const block=Block.fromStateId(info.minStateId,0)
 if(block.name!==id)return {id,error:'Registry state mismatch.'}
 const item=toolName==='hand'?null:registry.itemsByName?.[toolName]?.id
 if(toolName!=='hand'&&!Number.isSafeInteger(item))return {id,error:'Tool is not present in the pinned Bedrock registry.'}
 const effects={}
 for(const [effect,level] of [['Haste',Math.max(status.haste,status.conduitPower)],['MiningFatigue',status.miningFatigue]]){
  const r=registry.effectsByName?.[effect];if(level&&!r)return {id,error:'Missing game effect '+effect}
  if(level)effects[r.id]={amplifier:level-1}
 }
 const ench=[...(status.efficiency?[{name:'efficiency',lvl:status.efficiency}]:[]),...(aquaAffinity?[{name:'aqua_affinity',lvl:1}]:[])]
 const ms=block.diggable===false||!Number.isFinite(block.hardness)?Infinity:block.digTime(item,!!creative,!!underwater,!!airborne,ench,effects)
 const harvest=!!block.canHarvest(item)
 return {id,displayName:b.displayName||block.displayName||id,description:blockBehavior(id).description,hardness:Number.isFinite(block.hardness)?block.hardness:null,diggable:!!block.diggable,tool:toolName,canHarvest:harvest,expectedDrop:harvest?'possible, depends on loot rules':'not expected with selected tool',seconds:Number.isFinite(ms)?ms/1000:null,ticks:Number.isFinite(ms)?Math.round(ms/50):null,instant:ms===0,unbreakable:!Number.isFinite(ms),conditions:{...status,underwater:!!underwater,aquaAffinity:!!aquaAffinity,airborne:!!airborne,creative:!!creative},accuracy:'20-tick-rate Prismarine estimate; verify with the real Bedrock server and game rules'}
}
export const blockAllTools=(raw,conditions={})=>toolNames.map(tool=>blockReference(raw,{...conditions,tool})).filter(Boolean)
export const referenceStats=Object.freeze({version:KNOWLEDGE_VERSION,blocks:(data.blocksArray||[]).length,entities:(data.entitiesArray||[]).length,tools:toolNames.length,statusVariants:'calculated on demand',offline:true})
