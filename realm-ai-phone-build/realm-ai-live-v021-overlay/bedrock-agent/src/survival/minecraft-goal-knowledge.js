// Offline, version-aware Minecraft GOAL knowledge. A goal is NEVER an instruction
// to invent supplies, teleport, damage a build or pretend server action succeeded.
// Templates are conservative vanilla Bedrock concepts; live worlds may use packs.
import {resolveMaterial,supplyPlan} from './catalog.js'

const step=(action,detail,ability,items=[])=>({action,detail,ability,items,confirmed:false})
const goal=(id,title,pattern,steps,notes=[],hazards=[])=>({id,title,pattern,steps,notes,hazards})
// "can execute" here means an existing primitive can ATTEMPT a safe bounded job.
// Multi-step plans, farming, portal travel and combat remain owner-directed.
export const GOALS=Object.freeze([
 goal('starter-shelter','Build a safe starter shelter',/\b(?:shelter|starter house|first house|survive (?:the )?first night|safe base)\b/,
  [step('observe','Find a safe, lit, supported site inside approved land.','observe'),
   step('gather','Collect wood and stone; verify inventory before crafting.','gather',['oak_log','cobblestone']),
   step('craft','Craft a workbench, tools and lights using received recipes.','craft',['crafting_table','torch']),
   step('build','Place supported walls, roof, entrance and lighting without replacing anyone else\'s blocks.','positioned-build'),
   step('bed','Acquire wool and planks, craft and place a real bed, then verify spawn.','interaction',['white_bed'])],
  ['A saved home location is not a verified respawn point; a usable bed is separate.'],['hostiles','player-builds']),
 goal('wheat-farm','Grow and maintain a wheat farm',/\b(?:wheat farm|farm wheat|grow wheat|crop farm|food farm|grow crops)\b/,
  [step('site','Choose level dirt/grass with room for water and lighting; never alter protected plots.','observe'),
   step('hoe','Acquire a hoe and seeds, then till dirt/grass into farmland.','interaction',['wooden_hoe','wheat_seeds']),
   step('water','Provide water within four horizontal blocks of farmland and prevent trampling.','fluid-placement',['water_bucket']),
   step('plant','Plant seeds; wait for actual growth updates, not a time guess.','plant'),
   step('harvest','Harvest mature wheat, collect the drops and replant verified seed stock.','harvest')],
  ['Wheat requires mature growth; crop progress is not measured by assumed elapsed time.'],['water','terrain-edit']),
 goal('livestock','Breed and protect livestock',/\b(?:breed (?:animals|cows|sheep|pigs|chickens)|animal farm|livestock|raise cows|raise sheep)\b/,
  [step('enclosure','Build a safe fenced enclosure with access gates and lighting.','positioned-build',['fence']),
   step('locate','Find animals and verify matching breeding food.','observe'),
   step('lure','Safely guide animals without trapping or harming other players\' animals.','entity-interaction'),
   step('breed','Feed two adults appropriate food and confirm the new animal from server events.','entity-interaction')],
  ['Cows and sheep use wheat; pigs use carrots/potatoes/beetroots; chickens use seeds.'],['entities','owner-property']),
 goal('iron-equipment','Upgrade to iron tools and armor',/\b(?:iron tools?|iron gear|iron equipment|iron armor|iron armour|make iron|find iron|iron ingots?)\b/,
  [step('pickaxe','Prepare a stone-tier or better pickaxe and enough torches.','craft',['stone_pickaxe']),
   step('mine','Locate iron ore or deepslate iron ore and break only server-observed reachable ore.','gather',['raw_iron']),
   step('smelt','Use a fueled furnace to process raw iron into ingots, checking actual output.','smelt',['furnace','coal']),
   step('craft','Make requested iron equipment using real recipes and confirmed ingots.','craft',['iron_ingot'])],
  ['Wooden and bare-hand mining do not produce normal iron ore drops.'],['lava','caves']),
 goal('diamond-mining','Find and collect diamonds safely',/\b(?:diamond(?:s| ore| mining)?|mine diamonds|find diamonds)\b/,
  [step('prepare','Bring an iron-tier or better pickaxe, food, blocks, torches and a return route.','craft',['iron_pickaxe']),
   step('locate','Explore observed underground terrain and avoid lava and unsupported drops.','explore'),
   step('mine','Mine confirmed diamond ore only with a suitable tool; observe the block break.','gather',['diamond_ore']),
   step('collect','Check actual inventory gain and return safely.','gather',['diamond'])],
  ['Diamond ore needs an iron-tier or better pickaxe for normal drops; Fortune affects drops and Silk Touch changes the result.'],['lava','deep-caves']),
 goal('nether-prep','Prepare a safe Nether expedition',/\b(?:nether|portal to (?:the )?nether|go to hell|blaze rods?|nether fortress)\b/,
  [step('equipment','Prepare strong armor, food, tools, building blocks and fire-resistant travel choices.','craft'),
   step('portal','Obtain obsidian and flint and steel; portal construction requires an approved real build.','positioned-build',['obsidian','flint_and_steel']),
   step('defense','Bring one gold armor item for ordinary piglin neutrality; avoid aggressive actions.','craft',['golden_boots']),
   step('entry','Confirm dimension transition and a safe return route before exploring.','dimension-travel'),
   step('objective','Find the specific Nether target only through observed safe terrain.','explore')],
  ['Nether beds explode if used; never try to set the home spawn there.'],['lava','fire','hostile-mobs','dimension']),
 goal('enchanting','Prepare an enchanting setup',/\b(?:enchant(?:ing|ments?)?|enchantment table|enchant my)\b/,
  [step('materials','Collect diamonds, obsidian, a book and lapis lazuli as applicable.','gather',['diamond','obsidian','book','lapis_lazuli']),
   step('craft','Craft and place an enchanting table after checking the server recipe.','craft',['enchanting_table']),
   step('shelves','Place up to 15 effective bookshelves with proper air gaps, if higher levels are desired.','positioned-build',['bookshelf']),
   step('experience','Verify available experience levels and server-offered enchantments before spending them.','enchant')],
  ['Enchantments are server-provided choices; do not predict an exact enchantment.'],['resource-cost']),
 goal('brewing','Prepare a brewing station',/\b(?:brew(?:ing)?|potions?|brewing stand|nether wart)\b/,
  [step('stand','Obtain blaze rods and a brewing stand from actual Nether progress.','craft',['blaze_rod','brewing_stand']),
   step('ingredients','Obtain blaze powder, nether wart and water-filled bottles.','gather',['blaze_powder','nether_wart','glass_bottle']),
   step('recipe','Verify ingredient sequence and desired potion against the actual Bedrock recipe set.','observe'),
   step('brew','Fuel and operate a brewing stand, then verify bottle contents.','brew')],
  ['Potions and modded recipes can differ; knowledge does not mean a brewing GUI executor exists.'],['nether','resource-cost']),
 goal('storage','Organize a safe item-storage system',/\b(?:organize (?:inventory|items|storage)|storage room|sort (?:my |your )?items|build (?:a )?chest room|make (?:a )?chest)\b/,
  [step('inventory','Observe real item counts and reserve emergency food/tools/building blocks.','observe'),
   step('storage','Craft and place chests in a protected, approved location.','positioned-build',['chest']),
   step('transfer','Move items only after a container transaction is acknowledged; never discard unverified items.','container-transfer'),
   step('verify','Compare server inventory and container contents before declaring success.','observe')],
  ['Container deposits are not a general reliable autonomous skill yet.'],['item-loss','player-property']),
 goal('smelting','Smelt or cook resources',/\b(?:smelt|furnace|cook (?:food|meat|ore)|make charcoal)\b/,
  [step('materials','Identify the exact input and valid fuel from inventory.','observe'),
   step('furnace','Craft or locate a usable furnace/smoker/blast furnace.','craft',['furnace']),
   step('fuel','Verify fuel, input, cooking recipe and station type.','observe'),
   step('collect','Operate the workstation, wait for result and confirm inventory gain.','smelt')],
  ['The furnace must have real fuel and a valid recipe; do not invent smelted output.'],['fuel']),
 goal('redstone','Plan and test a redstone mechanism',/\b(?:redstone|automatic door|piston door|secret door|redstone machine|automatic machine)\b/,
  [step('design','Define inputs, outputs, block coordinates and expected behavior.','observe'),
   step('parts','Gather dust, repeaters, comparators, switches, observers or pistons according to the design.','gather'),
   step('build','Place the circuit only in approved empty cells.','positioned-build'),
   step('test','Read actual block states and activations; adjust one failing component at a time.','redstone')],
  ['Bedrock redstone timing can differ from Java; do not copy Java-only assumptions.'],['player-builds']),
 goal('end-expedition','Prepare for the End and stronghold',/\b(?:stronghold|end portal|ender dragon|go to (?:the )?end|eyes? of ender)\b/,
  [step('gear','Prepare strong gear, food, blocks, a water plan and a return strategy.','craft'),
   step('eyes','Obtain ender pearls and blaze powder to craft eyes of ender.','craft',['ender_pearl','blaze_powder']),
   step('search','Track actual thrown-eye bearings and navigate only safe observed ground.','explore'),
   step('portal','Locate the stronghold portal room and check frame needs; activating it requires a verified interaction.','interaction'),
   step('fight','Prepare for dragon phases and fall damage; boss combat is not implemented as autonomous strategy.','combat')],
  ['A compass does not point to the stronghold; do not assume portal coordinates.'],['void','combat','dimension']),
 goal('village','Protect or trade with villagers',/\b(?:village|villagers?|trading hall|trade with|protect villagers?)\b/,
  [step('locate','Locate a village and observe residents, beds, job blocks and hostiles.','explore'),
   step('protect','Secure safe access and light nearby areas without touching unrelated builds.','positioned-build'),
   step('trade','Inspect actual villager offers and inventory before requesting a trade.','entity-interaction'),
   step('confirm','Verify server inventory and offer changes.','observe')],
  ['Never steal or alter other players\' villagers or workstations without approval.'],['owner-property','hostiles']),
 goal('fishing','Fish safely from dry land',/\b(?:fish(?:ing)?|catch fish)\b/,
  [step('rod','Craft or equip a fishing rod with real string and sticks.','craft',['fishing_rod']),
   step('bank','Find safe accessible water while keeping both feet on dry supported ground.','observe'),
   step('cast','Cast a line and wait for an actual bobber/bite event.','entity-interaction'),
   step('reel','Reel in and verify the collected fish against inventory.','observe')],
  ['Do not enter water to fish.'],['water']),
 goal('exploration','Explore safely and remember a route',/\b(?:explore|map (?:the |this )?area|go adventuring|find a biome|discover a biome|survey (?:the )?world)\b/,
  [step('observe','Survey chunks, verify health and record named locations and current dimension.','observe'),
   step('route','Travel only through observed, grounded dry segments and avoid hazards.','walk'),
   step('remember','Save landmark evidence and changed positions, never guesses.','observe'),
   step('return','Use the remembered route or named owner locator to return, replanning when terrain changes.','walk')],
  ['Unloaded chunks and map markers cannot prove a traversable path.'],['water','caves','cliffs'])
])
const normalize=s=>String(s||'').trim().toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ')
const prompt=s=>s.replace(/^(?:please |can you |could you |would you )+/,'')
const explain=s=>{
 const q=prompt(normalize(s))
 const m=q.match(/^(?:plan(?: (?:to|for|how to))?|how to|how (?:do|can|would) (?:i|we|you)|what (?:do|would|should) (?:i|we|you) need (?:to|for)|what (?:is|'s) (?:needed|required|the best way) (?:to|for)|teach (?:me|yourself) (?:how to|about)|figure out (?:how to|a way to)|help (?:me|us) (?:with|to)|i want (?:you )?to|prepare (?:for|to)) (.+)$/)
 return {query:m?m[1]:q,explicit:!!m}
}
const isBroadAction=q=>/^(?:build|make|set up|start|grow|breed|farm|prepare|survive|protect|explore|fish|enchant|brew|find|smelt)\b/.test(q)
const actionSupport={
 'observe':'supported (observed data only)','gather':'partial; requires actual nearby target, tool, break and pickup',
 'walk':'partial; known terrain and movement are required',
 'craft':'conditional; use server recipes, workstation and inventory',
 'positioned-build':'conditional; exact approved coordinates, hotbar materials and block updates',
 'interaction':'not generally automated','fluid-placement':'not generally automated',
 'plant':'not generally automated','harvest':'not generally automated',
 'entity-interaction':'not generally automated','smelt':'partial; server workstation interactions must be verified',
 'container-transfer':'not generally automated','dimension-travel':'not generally automated',
 'enchant':'not generally automated','brew':'not generally automated',
 'redstone':'not generally automated','combat':'defensive basics only; no multi-phase boss execution',
 'explore':'partial; dry observed chunks only'
}
export function understandMinecraftGoal(raw,{inventory={},inventoryKnown=false,dimension=null,health=null}={}){
 if(typeof raw!=='string'||raw.length>190)return null
 const {query,explicit}=explain(raw)
 if(!explicit&&!isBroadAction(query))return null
 // Precise craftable item targets outrank thematic phrases. "Make a diamond
 // pickaxe" is an item recipe, not the broad diamond-mining expedition.
 const directItem=query.match(/^(?:craft|make|get|obtain) (?:me |us |a |an |some |the )?(.+)$/)
 const directName=directItem&&resolveMaterial(directItem[1])
 if(directName){
  const plan=supplyPlan(directName,1,inventoryKnown?inventory:{},inventoryKnown)
  return {kind:'minecraft-item-plan',title:'Prepare '+directName.replace(/_/g,' '),item:directName,
   planningOnly:true,acceptedActions:0,inventoryKnown,
   steps:plan.ok?plan.steps.slice(0,32).map((s,i)=>({...s,index:i+1,confirmed:false,abilityStatus:actionSupport[s.action==='obtain'?'gather':s.action==='craft'?'craft':'positioned-build']})):[],
   knownMissing:inventoryKnown&&plan.ok?Object.keys(plan.missing):[],recipeKnown:plan.ok,
   notes:['Recipe data is a reference. Check server recipe, inventory, and station before acting.'],
   risks:[],message:plan.ok?'Item dependency plan only; actual crafting/gathering not started.':plan.message}
 }
 const match=GOALS.find(g=>g.pattern.test(query))
 if(match){
  const owned=inventoryKnown?{...inventory}:{}
  const steps=match.steps.map((s,i)=>({...s,index:i+1,abilityStatus:actionSupport[s.ability]||'not implemented',
   inInventory:inventoryKnown?s.items.filter(x=>(owned[x]||0)>0):[]}))
  const requested=[...new Set(steps.flatMap(x=>x.items))]
  const knownMissing=inventoryKnown?requested.filter(x=>(owned[x]||0)<1):[]
  const risks=[...match.hazards]
  if(dimension!==0&&['wheat-farm','starter-shelter'].includes(match.id))risks.push('Overworld dimension must be verified')
  if(typeof health==='number'&&health<=6)risks.push('low health: do not initiate hazardous work')
  return {kind:'minecraft-goal-plan',goal:match.id,title:match.title,
   planningOnly:true,acceptedActions:0,inventoryKnown,knownMissing,steps,
   notes:match.notes,risks,worldEvidence:'Required for every executable step',
   message:'I understand the goal, but this is a knowledge plan, not an active job. Every action requires its own permitted, server-confirmed executor.'}
 }
 // Generic item goals get dependency knowledge from the bundled versioned
 // recipe catalog. No guessing that an ingredient is obtainable locally.
 const itemQuery=query.match(/^(?:(?:craft|make|get|obtain|prepare|gather|collect|build) (?:me |us |a |an |some |the )?|(?:ingredients|materials) (?:for|to make) (?:a |an )?)(.+)$/)
 if(!explicit&&!itemQuery)return null
 const candidate=(itemQuery?itemQuery[1]:query).replace(/^(?:a |an |some |the )/,'').trim()
 const item=resolveMaterial(candidate)
 if(!item)return explicit?{kind:'minecraft-goal-unknown',planningOnly:true,message:
  'I do not recognize a safe Minecraft goal or known item in that request. Give a precise goal, item, or recipe; no action was started.'}:null
 const plan=supplyPlan(item,1,inventoryKnown?inventory:{},inventoryKnown)
 return {kind:'minecraft-item-plan',title:'Prepare '+item.replace(/_/g,' '),item,
  planningOnly:true,acceptedActions:0,inventoryKnown,
  steps:plan.ok?plan.steps.slice(0,32).map((s,i)=>({...s,index:i+1,confirmed:false,abilityStatus:actionSupport[s.action==='obtain'?'gather':s.action==='craft'?'craft':'positioned-build']})):[],
  knownMissing:inventoryKnown&&plan.ok?Object.keys(plan.missing):[],
  recipeKnown:plan.ok,notes:['Recipe data is a reference. Check actual server recipe, inventory and workstation before every action.'],
  risks:[],message:plan.ok?'Item dependency plan only; actual crafting/gathering not started.':plan.message}
}
