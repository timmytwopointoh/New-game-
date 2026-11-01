import {resolveMaterial} from './catalog.js'
import {DimensionTravel,materialDimension} from './dimension-travel.js'
const logs=n=>/_(?:log|wood|stem|hyphae)$/.test(n)
const smelt={iron_ingot:'raw_iron',gold_ingot:'raw_gold',copper_ingot:'raw_copper',stone:'cobblestone',glass:'sand'}
export function acquisitionPlan(world,material,quantity){
 const definition=world.registry?.blocksByName?.[material],dimension=materialDimension(material),stock=world.items?.()||{},sources=(world.registry?.blocksArray||[]).filter(b=>(b.drops||[]).some(id=>world.registry.items[id]?.name===material)).map(b=>b.name)
 const impossible=definition&&(definition.diggable===false||definition.hardness<0)&&!['obsidian'].includes(material)
 return {material,quantity,alreadyOwned:stock[material]||0,dimension,sources,unobtainableNormally:!!impossible,
 stages:[...(dimension!==world.dimension?['verify gear and reachable portal','prepare missing portal materials or eyes','server-confirmed dimension travel']:[]),...(dimension===2?['inspect dragon and End hazards before pursuing loot']:[]),'verify recipe or source block','prepare correct tools and 64 real dirt when needed','approach or roam through observed terrain','mine/craft/smelt with server confirmation','collect and count actual inventory'],
 prerequisites:smelt[material]?[smelt[material],'furnace','fuel']:dimension===1?['observed active portal or 14 obsidian + flint_and_steel + dirt scaffold']:dimension===2?['observed stronghold/portal','real eyes for empty sockets','dragon encounter evidence and exit plan']:[],noInventedSupplies:true}
}
export class AcquisitionJobs{
 constructor(c){this.c=c;this.active=null;this.last={state:'idle'};this.travel=new DimensionTravel(c)}
 start(raw){
  const m=String(raw).match(/^gather (\d+) (.+)$/i);if(!m)return null
  const c=this.c,w=c.world,n=c.navigation,quantity=Number(m[1]),rawName=m[2].toLowerCase(),material=resolveMaterial(rawName)
  if(!material||quantity<1||quantity>2304)return {accepted:false,queued:false,message:'Choose a known material and an amount from 1–2304.'}
  if(this.active||c.resources.active||c.exploration.active||c.miningJobs.active||n.job||c.operations.pending)return {accepted:false,queued:false,message:'Stop the current task before acquiring another material.'}
  const denied=n.movementBlock();if(denied)return {accepted:false,queued:false,message:denied}
  const plan=acquisitionPlan(w,material,quantity);if(plan.unobtainableNormally&&plan.alreadyOwned<quantity&&w.gameMode!=='creative')return {accepted:false,queued:false,message:'That block cannot normally be collected by breaking it; no cheats or replacement items were used.',plan}
  this.active={material,quantity,rawName,plan,state:'planning',reason:'Checking real stock and prerequisites before acquisition.',lastAt:0,child:null};c.report(this.active.reason)
  return {accepted:true,queued:true,message:`Preparing ${quantity} ${material}: inventory, tools, recipes and dimension access are checked first. Unseen sources trigger observed roaming.`,acquisition:plan}
 }
 cancel(reason='Acquisition interrupted; no automatic resume.'){if(this.active)this.last={...this.snapshot(),state:'interrupted',reason};this.active=null;this.travel.cancel(reason)}
 block(reason){const a=this.active;if(!a)return;a.state='blocked';a.reason=reason;this.travel.cancel(reason);this.c.operations.cancel(reason);this.c.resources.cancel(reason);this.c.miningJobs.cancel(reason);this.c.navigation.stop(reason,false);this.c.report(reason)}
 count(){const a=this.active,stock=this.c.world.items();return /^(?:wood|logs)$/.test(a.rawName)?Object.entries(stock).reduce((n,[name,count])=>n+(logs(name)?count:0),0):stock[a.material]||0}
 equip(material,now){const w=this.c.world,r=this.c.workshop.hotbar(material,now);if(r.state!=='ready')return r;const slot=[...w.inventory].find(([s,i])=>s<9&&w.registry.items[i.network_id]?.name===material)?.[0];if(slot===undefined)return {state:'blocked',reason:'Tool is not in a server-known slot.'};if(w.selectedSlot!==slot){this.c.handle(`select slot ${slot+1}`);this.active.equipUntil=now+150;return {state:'working',reason:'Equipping '+material+'.'}}return now<(this.active.equipUntil||0)?{state:'working',reason:'Waiting for tool equipment.'}:{state:'ready'}}
 process(result,now,depth=0){
  const a=this.active,c=this.c,w=c.world
  if(depth>10){this.block('Acquisition prerequisite cycle/depth limit.');return}
  a.reason=result.reason||'Preparing supplies.'
  if(result.state==='blocked'){this.block(result.reason);return}
  if(result.state==='approach'){
   if(!this.travel.approach(result.position,now,'search')){this.block('The required workshop has no safe observed approach.');return}
   a.child={type:'workshop-walk'};return
  }
  if(result.state!=='need')return
  const material=result.material,quantity=result.quantity||1
  if(material==='cobblestone'&&!Object.keys(w.items()).some(n=>/_pickaxe$/.test(n))){return this.process(c.workshop.ensure('wooden_pickaxe',1,now),now,depth+1)}
  let required=['raw_iron','raw_copper'].includes(material)?'stone_pickaxe':material==='raw_gold'?'iron_pickaxe':material==='diamond'||material==='redstone'?'iron_pickaxe':material==='obsidian'?'diamond_pickaxe':null
  const names=(w.registry.blocksArray||[]).filter(b=>b.name===material||(b.drops||[]).some(id=>w.registry.items[id]?.name===material)),definition=w.registry.blocksByName[material]||names[0],block=definition?w.Block.fromStateId(definition.defaultState,0):null
  if(block&&!block.canHarvest?.(null)&&![...w.inventory.values()].some(i=>i.count>0&&block.canHarvest?.(i.network_id)))required=['wooden_pickaxe','stone_pickaxe','iron_pickaxe','diamond_pickaxe','netherite_pickaxe'].find(name=>block.canHarvest?.(w.registry.itemsByName[name]?.id))||required
  if(required&&!(w.items()[required]>0)&&!['diamond_pickaxe','netherite_pickaxe'].some(n=>w.items()[n]>0))return this.process(c.workshop.ensure(required,1,now),now,depth+1)
  const pick=c.miningJobs.chooseTool('pickaxe');if((required||material==='cobblestone')&&pick){const r=this.equip(pick,now);if(r.state!=='ready')return this.process(r,now,depth+1)}
  const sourceNames=(w.registry.blocksArray||[]).filter(b=>b.name===material||(b.drops||[]).some(id=>w.registry.items[id]?.name===material)).map(b=>b.name)
  if(!sourceNames.length&&!logs(material)&&material!=='wood'){this.block(`${material} needs a received recipe, mob/loot/trade source or another verified acquisition method; no source or item was invented.`);return}
  const visible=sourceNames.some(name=>w.scan(name,{range:8,maxFound:1})?.found.length)
  if(!visible&&['raw_iron','raw_copper','raw_gold','diamond','redstone','lapis_lazuli'].includes(material)&&w.dimension===0){
   const depth=material==='diamond'||material==='redstone'?-54:-20
   const started=c.miningJobs.start(`strip mine 8 rows at ${Math.min(w.standPosition().y,depth)}`)
   if(started?.accepted){c.miningJobs.active.stopWhen={material,quantity};a.child={type:'excavation'};a.reason='Preparing an observed staircase and strip search for '+material+'.';return}
  }
  const anyWood=logs(material)&&a.material!=='oak_planks'&&a.material!=='oak_log',command=`gather ${quantity} ${anyWood?'wood':material}`
  const r=c.resources.start(command);if(!r?.accepted){this.block(r?.message||'Could not start prerequisite acquisition.');return}a.child={type:'resources'};a.reason='Acquiring prerequisite '+material+'; no predicted inventory credit.'
 }
 tick(now=Date.now()){
  const a=this.active;if(!a||a.state==='blocked'||now-a.lastAt<200)return;a.lastAt=now;const c=this.c,w=c.world,n=c.navigation
  if(this.travel.target!==null&&(w.abilityState?.loading||n.loading?.state==='waiting-for-terrain')){a.reason='Waiting for server dimension terrain and loading abilities.';return}
  if(n.isRespawning?.()||w.attributes['minecraft:health']===0||w.attributes['minecraft:health']>0&&w.attributes['minecraft:health']<=6||!w.editModeVerified){this.block('Acquisition stopped on death, low health or unverified abilities.');return}
  if(c.operations.pending||c.resources.active)return
  if(a.child){
   if(a.child.type==='resources'){if(c.resources.last?.state!=='completed'){this.block(c.resources.last?.reason||'Resource collection unconfirmed.');return}}
   else if(a.child.type==='excavation'){if(c.miningJobs.active){if(c.miningJobs.active.state==='blocked')this.block(c.miningJobs.active.reason);return}if(c.miningJobs.last?.state!=='completed'){this.block(c.miningJobs.last?.reason||'Strip search interrupted.');return}}
   else if(a.child.type==='workshop-walk'){const walk=this.travel.walk;if(walk&&n.lastPoseAt>walk.poseAt&&Math.hypot(w.serverPosition.x-walk.goal.x-.5,w.serverPosition.z-walk.goal.z-.5)<.5){n.stop('',false);this.travel.walk=null}else if(walk&&now-walk.started>20000){this.block('Workshop approach was unconfirmed.');return}else return}
   a.child=null;this.travel.started=now
  }
  if(this.count()>=a.quantity){this.last={...this.snapshot(),state:'completed',reason:`Server inventory confirms ${this.count()} ${a.rawName}.`};this.active=null;c.workshop.close();c.report(this.last.reason);return}
  if(w.gameMode==='creative'&&c.crafting.creative.some(e=>w.registry.items[e.item.network_id]?.name===a.material)){const r=c.workshop.ensure(a.material,a.quantity,now);if(r.state!=='ready')this.process(r,now);return}
  if(a.plan.dimension!==w.dimension){
   const definition=w.registry.blocksByName[a.material],block=definition?w.Block.fromStateId(definition.defaultState,0):null
   if(block&&!block.canHarvest(null)&&![...w.inventory.values()].some(i=>i.count>0&&block.canHarvest(i.network_id))){const required=['wooden_pickaxe','stone_pickaxe','iron_pickaxe','diamond_pickaxe','netherite_pickaxe'].find(name=>block.canHarvest(w.registry.itemsByName[name]?.id));if(required){const r=c.workshop.ensure(required,1,now);if(r.state!=='ready'){this.process(r,now);return}}}
   if((w.items().dirt||0)<64){this.process({state:'need',material:'dirt',quantity:64,reason:'Preparing 64 dirt before dimension travel.'},now);return}
   if(this.travel.target===null||this.travel.state==='idle')this.travel.start(a.plan.dimension,now)
   this.travel.tick(now);a.reason=this.travel.reason
   if(this.travel.state==='blocked'){this.block(this.travel.reason);return}
   if(this.travel.needed?.searchDepth!==undefined){const r=c.miningJobs.start(`strip mine 1 rows at ${this.travel.needed.searchDepth}`);if(r?.accepted){c.miningJobs.active.stopWhenObserved='end_portal_frame';a.child={type:'excavation'}}else this.block(r?.message||'Stronghold descent could not start.');return}
   if(this.travel.needed){const need=this.travel.needed,result=c.workshop.ensure(need.material,need.quantity,now);if(result.state!=='ready')this.process(result,now)}
   return
  }
  if(a.plan.dimension===2&&(/^(?:elytra|shulker_|chorus_|purpur_)/.test(a.material))&&w.dragonState!=='defeated'){this.block(`End dragon state is ${w.dragonState}. Dragon encounter/exit preparation must be verified before pursuing End-city loot; absence of a visible dragon is not proof of defeat.`);return}
  const rawFamily=/^(?:wood|logs)$/.test(a.rawName)
  const result=rawFamily?{state:'need',material:'wood',quantity:a.quantity,reason:'Searching for real tree logs.'}:c.workshop.ensure(a.material,a.quantity,now)
  if(result.state==='ready')return
  this.process(result,now)
 }
 snapshot(){return this.active?{state:this.active.state,reason:this.active.reason,material:this.active.material,target:this.active.quantity,plan:this.active.plan,portal:this.travel.snapshot()}:this.last}
}
