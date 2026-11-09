// Minecraft-first, offline task understanding. No browser, paid API, or remote model.
// Knowledge is read from minecraft-data already bundled with Realm AI Live.
// Knowledge is NOT permission or a replacement for Bedrock server confirmations.
import minecraftData from 'minecraft-data'
import {blockReference,blockAllTools,mobReference,referenceStats} from './knowledge/bedrock-reference.js'
import {resolveMaterial, materialInfo, recipeInfo, supplyPlan, catalogCounts} from './survival/catalog.js'

const data=minecraftData('bedrock_1.26.60')
const entities=new Map((data.entitiesArray||[]).map(e=>[e.name,e]))
const biomes=new Map((data.biomesArray||[]).map(e=>[e.name,e]))
const synonyms={
 'wood':'oak_log','logs':'oak_log','log':'oak_log','tree':'oak_log','trees':'oak_log',
 'plank':'oak_planks','planks':'oak_planks','cobble':'cobblestone',
 'iron ore':'iron_ore','diamonds':'diamond','coal ore':'coal_ore',
 'food':'bread','work bench':'crafting_table','workbench':'crafting_table',
 'pickaxe':'wooden_pickaxe','sword':'wooden_sword','axe':'wooden_axe',
 'shelter materials':'cobblestone'
}
const normalize=s=>String(s||'').trim().toLowerCase().replace(/[.!]+$/,'').replace(/^minecraft:/,'').replace(/\s+/g,' ')
const friendly=s=>String(s||'').replace(/_/g,' ')
const short=s=>String(s).slice(0,410)
function material(raw){const s=normalize(raw).replace(/^(?:a|an|the|some|any|my)\s+/,'');return resolveMaterial(synonyms[s]||s)}
function entity(raw){const s=normalize(raw).replace(/^(?:a|an|the)\s+/,'').replace(/ /g,'_');return entities.get(s)||null}
function biome(raw){const s=normalize(raw).replace(/^(?:a|an|the)\s+/,'').replace(/ /g,'_');return biomes.get(s)||null}
const result=(message,extras={})=>({accepted:true,queued:false,offline:true,message, ...extras})
const threatKinds=new Set(['zombie','husk','drowned','skeleton','stray','bogged','spider','cave_spider','creeper','witch','pillager','vindicator','evoker','ravager','blaze','ghast','wither','warden','endermite','silverfish','phantom','guardian','elder_guardian','slime','magma_cube','piglin_brute','zoglin','hoglin','shulker'])
const learnVerbs={gather:'collect resources',harvest:'obtain a resource',fetch:'obtain a resource',retrieve:'obtain a resource',obtain:'collect resources',acquire:'obtain a resource',chop:'break wood logs with a suitable tool',fell:'chop a tree',shelter:'protective player-built structure',smelt:'process items in a furnace',craft:'make an item from ingredients',loot:'collect dropped items',mine:'break a block',scout:'scan visible terrain',navigate:'walk along a confirmed route',fight:'attack or evade hostile entities',equip:'put an item in an inventory/equipment slot'}
function itemFacts(name){
 const item=materialInfo(name)
 const rs=recipeInfo(name).slice(0,2)
 const info=[`${item.displayName||friendly(name)} (${name}) is in the bundled Bedrock catalog.`,item.block?'It is a block.':item.item?'It is an item.':'']
 if(item.diggable===true){info.push('It can be broken; tool/reach and server conditions still matter.');const facts=blockReference(name);if(facts&&!facts.error)info.push('Hardness '+facts.hardness+'; hand '+(facts.seconds===null?'unbreakable/unknown':facts.seconds+'s')+'. Ask for mining time or a full mining table for any tool.');}
 if(rs.length)info.push('Recipe reference: '+rs.map(r=>`${r.output} from ${Object.entries(r.ingredients).map(([k,v])=>`${v} ${friendly(k)}`).join(' + ')} at ${friendly(r.station)}${r.verified?'':' (verify in game)'}`).join('; ')+'.')
 else info.push('No reliable recipe in this bundled data; it may require obtaining from the world.')
 return info.filter(Boolean).join(' ')
}
function locatedResource(name,world){
 if(!world?.standPosition?.()||!world?.scan)return 'Your current observed terrain is unavailable; I cannot locate it or invent coordinates.'
 try{
  const scan=world.scan(name)
  const spot=scan?.found?.[0]
  return spot?`The scan found a visible ${friendly(name)} at ${spot.x}, ${spot.y}, ${spot.z}. This is only a location, not a confirmed break or pickup.`:`No visible ${friendly(name)} is in the received nearby terrain. Move or look around to search another area.`
 }catch{return 'The local terrain scan could not confirm any target.'}
}
const requirements={
 gather:'Detect target -> navigate to reachable position -> mine/harvest -> observe server change -> collect drop -> confirm inventory change',
 craft:'Confirm ingredients -> access correct station -> send crafting transaction -> confirm output inventory',
 build:'Confirm materials -> inspect entire footprint -> place one block -> confirm block update/inventory -> repeat',
 combat:'Observe hostile -> verify line of sight and distance -> evade or attack -> observe outcome',
 use:'Identify interactive target -> verify reach -> send use interaction -> await server confirmation'
}
export const offlineKnowledgeStats=Object.freeze({...referenceStats,version:'bedrock_1.26.60',blocks:catalogCounts.blocks,items:catalogCounts.items,entities:entities.size,biomes:biomes.size,recipes:Object.keys(data.recipes||{}).length,networkRequired:false})

/** Return a grounded, read-only answer or bounded plan. Never fabricate actions. */
export function offlineMinecraftResponse(raw,{world=null}={}){
 if(typeof raw!=='string'||raw.length>190||/[\x00-\x1f\x7f]/.test(raw))return null
 let s=normalize(raw).replace(/^(?:(?:please|hey bot|bot)[, ]+|(?:can|could|would|will) you\s+|i (?:want|need) you to\s+|go ahead and\s+)+/,'')
 s=s.replace(/^(?:research and (?:do|perform|execute)|do research on|teach me (?:how to|about))\s+/,'')
 if(/^(?:minecraft knowledge|offline knowledge|what do you know about minecraft|knowledge status)$/.test(s))return result(`Offline Bedrock ${offlineKnowledgeStats.version} knowledge: ${offlineKnowledgeStats.blocks} blocks, ${offlineKnowledgeStats.items} items, ${offlineKnowledgeStats.entities} entities, ${offlineKnowledgeStats.biomes} biomes, ${offlineKnowledgeStats.recipes} recipe records. No Google key or network required. Knowledge is not proof the bot can perform every game mechanic.`,{knowledge:offlineKnowledgeStats})
 let mining=s.match(/^(?:mining time|break time|how long (?:does it take|will it take) to (?:mine|break|destroy)|how long to (?:mine|break|destroy))\s+([a-z0-9_ ]+?)(?:\s+with\s+([a-z0-9_ ]+))?(?:\?)?$/)
 if(mining){const name=material(mining[1]);if(!name)return null;const facts=blockReference(name,{tool:/^(?:hand|bare hand|bare hands|your hand|my hand|fist|nothing)$/.test((mining[2]||'hand').trim())?'hand':mining[2],world});if(!facts||facts.error)return result(facts?.error||'No known mining time for that item.');return result(`${facts.displayName}: ${facts.tool} ${facts.seconds===null?'cannot be mined normally':facts.seconds+' seconds ('+facts.ticks+' ticks)'}; hardness ${facts.hardness}; ${facts.expectedDrop}. Water, enchantments, airborne and status effects can change the time.`,{knowledge:facts})}
 let table=s.match(/^mining table\s+([a-z0-9_ ]+?)(?:\?)?$/)
 if(table){const name=material(table[1]);if(!name)return null;const tools=blockAllTools(name,{world});if(!tools.length)return result('No mining table in this Bedrock version.');return result(`${name}: `+tools.slice(0,14).map(t=>`${t.tool} ${t.seconds===null?'∞':t.seconds+'s'}`).join(', ')+'. Remaining tools and statuses are available through the local knowledge endpoint.',{knowledge:{kind:'mining-table',name,tools}})}
 let mob=s.match(/^(?:mob (?:stats|info)|how much health does|hp of|attack of|mob behavior)\s+([a-z0-9_ ]+?)(?:\?)?$/)
 if(mob){const info=mobReference(mob[1]);if(!info)return null;return result(`${info.name}: HP ${info.health??'unknown'}; attack damage ${info.normalDamage??'not independently verified'}. ${info.behavior} ${info.response}`,{knowledge:{kind:'mob',...info}})}
 // Explain an achievable shelter plan without claiming that any world action happened.
  let m=s.match(/^(?:what (?:is|are)|what do you know about|tell me about|explain|about|define)\s+(.+?)(?:\?)?$/)
 if(m){const subject=m[1].replace(/\?$/,'');const n=material(subject),e=entity(subject),b=biome(subject),v=learnVerbs[subject];
  if(n)return result(itemFacts(n),{knowledge:{kind:'material',name:n}})
  if(e){const info=mobReference(e.name);return result(`${info?.name||e.displayName||friendly(e.name)}: HP ${info?.health??'unknown'}; attack damage ${info?.normalDamage??'not independently verified'}. ${info?.behavior||'Behavior needs observation.'} ${info?.response||''}`,{knowledge:{kind:'entity',...info}})}
  if(b)return result(`${friendly(b.name)} is a Bedrock biome. Its presence in the data does not mean this Realm has been surveyed there.`,{knowledge:{kind:'biome',name:b.name}})
  if(v)return result(`In Minecraft, ${subject} means ${v}. That describes a goal, not a standalone executable packet.`)
  return null
 }

 m=s.match(/^(?:how (?:do i|can (?:i|you)|to)|(?:explain|show me) how to|(?:can|could) you (?:explain|show me) how to)\s+(?:build|construct|make)\s+(?:a\s+)?(?:small\s+)?(house|shelter|base)(?:\s+(?:near|next to|beside)\s+me)?(?:\?)?$/)
 if(m)return result('To build a safe '+m[1]+': first survey a dry, level footprint away from water and hostile mobs; count the floor, wall, roof and doorway blocks; gather the required materials and tools; verify the inventory; place a floor, walls, a two-block-high doorway, a roof and lighting; confirm each placement from server block updates; then inspect the finished shelter for gaps and hazards. '+(s.includes('near me')||s.includes('next to me')||s.includes('beside me')?'A nearby location requires a confirmed player position and safe terrain scan; I cannot assume your location. ':'')+'This is a planning answer only: no terrain was surveyed, materials collected or blocks placed.',{knowledge:{kind:'building-plan',structure:m[1],executed:false}})

 m=s.match(/^(?:how (?:do i|can (?:i|you)|to)|show me how to)\s+(?:make|craft|obtain|get|find|build)\s+(.+?)(?:\?)?$/)
 if(m){const n=material(m[1].replace(/\?$/,''));if(n)return result(itemFacts(n)+' Crafting is currently reference/planning only; actual crafting transactions are not yet implemented.')}
 m=s.match(/^(?:where (?:can i|do you|to)|how to)\s+(?:find|locate|mine)\s+(.+?)(?:\?)?$/)
 if(m){const n=material(m[1].replace(/\?$/,''));if(n)return result(`Looking for ${friendly(n)}. ${locatedResource(n,world)} This scan only uses visible, received terrain.`,{knowledge:{kind:'search',name:n}})}
 m=s.match(/^(?:(?:go\s+)?(?:get|gather|collect|fetch|harvest|obtain|acquire|retrieve|chop|mine)(?:\s+me)?|bring me)\s+(?:(-?\d+)\s+)?(.+)$/)
 if(m){const count=m[1]?Number(m[1]):1,n=material(m[2]);if(!n)return null
  if(!Number.isSafeInteger(count)||count<1||count>256)return result('Resource requests are limited to 1–256 for a bounded supply plan.')
  const stock=world?.items?.()||{},known=!!world?.inventoryKnown,have=stock[n]||0
  if(known&&have>=count)return result(`Inventory already reports ${have} ${friendly(n)}; requested amount is ${count}. No mining required.`)
  const plan=supplyPlan(n,count,stock,known)
  const steps=plan.ok?plan.steps.slice(0,8).map(x=>`${x.action} ${x.count} ${friendly(x.item)}`).join(' -> '):'Plan unavailable'
  return result(`Offline ${friendly(n)} goal (${count}): ${steps||'no supplies missing'}. ${locatedResource(n,world)} ${requirements.gather}. I can identify materials and attempt bounded manual mining/pickup, but a fully automatic harvest-to-inventory sequence is not verified. Nothing has been mined or collected.`,{supplyPlan:plan,knowledge:{kind:'resource-task',name:n}})
 }
 m=s.match(/^(?:(?:make|craft|smelt)(?:\s+me)?\s+)(?:(-?\d+)\s+)?(.+)$/)
 if(m){const count=Number(m[1]||1);if(!Number.isSafeInteger(count)||count<1||count>256)return result('Crafting requests are limited to 1–256 items; no crafting was attempted.');const n=material(m[2]);if(!n)return null;const p=supplyPlan(n,count,world?.items?.()||{},!!world?.inventoryKnown);return result(`Offline crafting goal: ${count} ${friendly(n)}. ${itemFacts(n)} ${p.ok?p.steps.slice(0,8).map(x=>`${x.action} ${x.count} ${friendly(x.item)}`).join(' -> '):p.message}. ${requirements.craft}. Crafting execution is not implemented; no item was created.`,{supplyPlan:p})}
 if(/^(?:build|construct|create|make)\s+(?:me\s+)?(?:a\s+)?(?:small\s+)?(?:shelter|house|wall|floor|base)(?:\s+.*)?$/.test(s))return result(`Offline building goal: ${requirements.build}. For a live attempt, specify a known-air origin and an actual hotbar material. The bot cannot invent a footprint or claim placement success. A live placement still needs server confirmation; no blocks were placed.`)
 if(/^(?:defend|protect|fight|attack|kill)(?:\b|$)/.test(s))return result(`Hostile defense is already attempted by the on-device survival loop when observed hostile mobs are in range. ${requirements.combat}. Actual hits and kills are not yet reliably verified; it never attacks players intentionally.`)
 if(/^(?:use|open|eat|equip|wear|trade|interact|enchant|brew|sleep|ride|tame)(?:\b|$)/.test(s))return result(`I recognize this Minecraft interaction goal, but ${requirements.use}. This interaction type does not have a verified general executor yet. I have not interacted with anything.`)
 return null
}
