import {RealmEditGrant} from './realm-edit-grant.js'
import {CompanionCommands} from './companion-commands.js'
import {CommandPlans} from './command-plans.js'
import {CommandVocabulary} from './command-vocabulary.js'
import {LearningMemory} from './learning-memory.js'
import {bundledEnglishWordCount} from '../lexicon/lookup.js'
import path from 'node:path'
import {SurvivalVerification} from './verification.js'
import {AcquisitionJobs} from './acquisition-jobs.js'
import {MiningJobs} from './mining-jobs.js'
import {Workshop} from './workshop.js'
import {StackOperations} from './stack-operations.js'
import {Crafting} from './crafting.js'
import {Situation} from './situation.js'
import {WorldView} from './world.js'
import {ResourceJobs} from './resource-jobs.js'
import {isForestryReturnCommand} from './forestry-return.js'
import {LandmarkMemory} from './landmark-memory.js'
import {ExplorationJobs} from './exploration-jobs.js'
import {Navigation} from './navigation.js'
import {RespawnRecovery} from './respawn.js'
import {resolveMaterial,searchCatalog,recipeInfo,supplyPlan,catalogCounts,materialInfo} from './catalog.js'
const answer=(message,extra={})=>({accepted:true,queued:false,message,...extra})
export class SurvivalController{
 constructor(connection,{plansDirectory=null,scope=null}={}){this.connection=connection;this.world=new WorldView();this.navigation=new Navigation(this.world,m=>this.report(m));this.lastPlan=null;this.learning=new LearningMemory({directory:plansDirectory?path.join(path.dirname(plansDirectory),'task-learning'):null,scope});this.commandPlans=new CommandPlans(this,{directory:plansDirectory,scope});this.commandVocabulary=new CommandVocabulary({directory:plansDirectory?path.join(path.dirname(plansDirectory),'command-vocabulary'):null,scope});this.verification=new SurvivalVerification(this.world,this.navigation,m=>this.report(m));this.verification.desiredMode=connection.config?.requestedGameMode==='creative'?'creative':'survival';this.respawn=new RespawnRecovery(this.world,this.navigation,m=>{this.commandPlans.interrupt(m);this.operations?.cancel(m);this.resources?.cancel(m);this.exploration?.cancel(m);this.miningJobs?.cancel(m);this.acquisition?.cancel(m)},m=>this.report(m));this.navigation.checkRespawn=now=>{const blocked=this.respawn.tick(now);this.situation?.tick(now);return blocked};this.navigation.isRespawning=()=>!['alive','respawned'].includes(this.respawn.state);this.navigation.checkVerification=()=>this.verification.check();this.landmarks=new LandmarkMemory({directory:plansDirectory?path.join(path.dirname(plansDirectory),'landmark-memory'):null,scope});this.operations=new StackOperations(this.world,m=>this.report(m));this.crafting=new Crafting(this.world,this.operations);this.workshop=new Workshop(this,{directory:plansDirectory?path.join(path.dirname(plansDirectory),'workshop'):null,scope});this.situation=new Situation(this);this.resources=new ResourceJobs(this);this.exploration=new ExplorationJobs(this,this.landmarks);this.miningJobs=new MiningJobs(this);this.acquisition=new AcquisitionJobs(this);this.navigation.onNeedDirt=(name,minimum)=>this.miningJobs.startSupport(name,minimum);this.navigation.onSchedulingPause=reason=>{this.exploration.cancel(reason);this.resources.cancel(reason);this.miningJobs.cancel(reason);this.acquisition.cancel(reason);this.operations.cancel(reason);this.commandPlans.interrupt(reason)};this.navigation.onResourceTick=now=>{this.operations.tick(now);this.workshop.tick(now);this.situation.tick(now);if(now-(this.lastMapObservation||0)>10000){this.lastMapObservation=now;this.landmarks.observe(this.world,{yaw:null,now})}this.exploration.tick(now);this.resources.tick(now);this.miningJobs.tick(now);this.acquisition.tick(now)};this.navigation.onSurveySector=(yaw,now)=>this.landmarks.observe(this.world,{yaw,fov:34,now});this.navigation.onThreat=message=>{this.operations.cancel(message);this.miningJobs?.cancel(message);this.acquisition?.cancel(message);this.exploration.cancel('Hostile interrupted exploration.');this.resources.cancel('Hostile interrupted resource task.');this.commandPlans.interrupt(message);this.report(message)};this.navigation.reportRuntimeError=e=>this.connection.trace?.error(e);this.world.onPacketError=e=>this.connection.trace?.error(e);this.ownerEditGrant=new RealmEditGrant(plansDirectory?path.dirname(plansDirectory):null);this.companion=new CompanionCommands(this,scope);this.authorizeRealmClearing(scope)}
 authorizeRealmClearing(scope){this.world.allowBuiltMining=this.ownerEditGrant.allows(scope)}
 report(message){const c=this.connection;c.events.push({id:++c.nextEventId,source:'Survival',message});if(c.events.length>64)c.events.shift();c.emit('survival-update',{message})}
 attach(client){this.companion.reset();this.workshop.placing=null;this.workshop.opening=null;this.workshop.depositing=null;this.workshop.fuelSentAt=null;this.workshop.smeltStarted=null;this.acquisition.cancel('New session.');this.miningJobs.cancel('New session; excavation not resumed.');this.operations.cancel('New session.');this.operations.client=client;this.crafting.attach(client);this.exploration.cancel('New Realm session; exploration not automatically resumed.');this.resources.cancel('New Realm session; resource work not automatically resumed.');this.world.detach();this.world.reset();this.world.attach(client);this.navigation.attach(client);this.verification.attach(client);this.respawn.attach(client)}
 close(){this.companion.reset();this.acquisition.cancel('Disconnected.');this.miningJobs.cancel('Disconnected.');this.operations.cancel('Disconnected.');this.operations.client=null;this.crafting.detach();this.exploration.cancel('Connection closed.');this.resources.cancel('Connection closed.');this.commandPlans.interrupt('Disconnected; no automatic resume.');this.respawn.detach();this.verification.detach();this.navigation.detach();this.world.detach()}
 snapshot(){return {companion:this.companion.snapshot(),acquisition:this.acquisition.snapshot(),excavation:this.miningJobs.snapshot(),workshop:this.workshop.snapshot(),inventoryOperations:this.operations.snapshot(),crafting:this.crafting.snapshot(),situation:this.situation.snapshot(),language:{engine:'offline glossary, constrained direct actions, optional key-free HTTPS dictionary lookup',bundledWords:bundledEnglishWordCount,neuralModel:false},learning:this.learning.snapshot(),plans:this.commandPlans.snapshot(),vocabulary:this.commandVocabulary.list(),verification:this.verification.snapshot(),respawn:this.respawn.snapshot(),view:this.world.snapshot(),navigation:this.navigation.snapshot(),catalog:catalogCounts,plan:this.lastPlan,resourceTask:this.resources.snapshot(),exploration:this.exploration.snapshot(),landmarks:this.landmarks.snapshot()}}
 handle(raw){
  if(typeof raw!=='string'||raw.length>190)return null
  const s=raw.trim().toLowerCase().replace(/[.!?]+$/,'').replace(/^(?:please |can you |could you )/,'');let m
  const companion=this.companion.handle(s);if(companion)return companion
  if((this.miningJobs.active||this.acquisition.active||this.operations.pending)&&/^(?:gather|quarry|strip|craft|walk|follow|dig|place|build|roam|explore|find and mine|find and break|get wood|harvest|chop)\b/.test(s))return {accepted:false,queued:false,message:'A resource, excavation or inventory task is active. Stop it before starting a different action.'}
  if(s==='respawn')return this.respawn.request()
  if(isForestryReturnCommand(s))return this.resources.requestReturnHome()
  const acquisition=this.acquisition.start(s);if(acquisition)return acquisition
  const mining=this.miningJobs.start(s);if(mining)return mining
  const craft=s.match(/^craft (.+)$/);if(craft){const material=resolveMaterial(craft[1]);if(!material)return {accepted:false,queued:false,message:'Choose a known crafting material.'};return this.crafting.craft(material)}
  const resource=this.resources.start(s);if(resource)return resource
  const exploring=this.exploration.start(s);if(exploring)return exploring
  if(s==='ensure survival'){const state=this.verification.requestMode('survival');return answer(state.reason,{verification:state})}
  if(/^(?:rejoin|rejoin realm|reconnect|reconnect realm|join again)$/.test(s))return this.connection.reconnect()
  if(/^(?:view on|look around|look|scan|survey nearby|what can you see|what is nearby)$/.test(s)){
   this.world.enabled=true
   if(!this.connection.spawned)return answer('Join the Realm first, then look around.')
   try{this.world.requestNearby(this.connection.client)}catch(e){this.world.lastError=e.message}
   const started=this.navigation.beginSurvey()
   return {...started,survival:this.snapshot()}
  }
  if(/^(?:collect nearby|collect drops|pick up drops|pickup drops)$/.test(s))return this.navigation.collectNearby()
  if(s==='view off'){this.miningJobs.cancel('View switched off.');this.acquisition.cancel('View switched off.');this.operations.cancel('View switched off.');this.exploration.cancel('View switched off.');this.resources.cancel();this.world.enabled=false;this.world.sections.clear();this.world.updates.clear();this.world.pending.clear();this.navigation.stop('View switched off.');return answer('View off; walking stopped.')}
  if(/^(?:stop|stop everything|stop following|stop following me|stop mining|stop walking|stay|wait here|cancel job|cancel plan)$/.test(s)){this.companion.reset();this.exploration.cancel();this.resources.cancel();this.commandPlans.interrupt();this.operations.cancel('Stopped.');this.miningJobs.cancel('Stopped.');this.acquisition.cancel('Stopped.');this.workshop.depositing=null;this.navigation.stop();this.lastPlan=null;return answer('Stopped following, walking, mining and building. Saved plans kept.')}
  if(/^(?:inventory|what do you have|check inventory)$/.test(s)){
   const items=Object.entries(this.world.items());return answer(this.world.inventoryKnown?(items.length?'Inventory: '+items.slice(0,16).map(([n,c])=>`${n} ×${c}`).join(', '):'Inventory is empty.'):'Waiting for the server inventory snapshot.')
  }
  if(/^(?:surroundings|biome|what biome|situation)$/.test(s)){this.situation.lastAt=0;this.situation.tick(Date.now());const v=this.situation.snapshot();return answer(`Health: ${v.healthState} (${v.health??'unknown'}). Biome: ${v.biome?.name||'unknown; no biome palette received'}. Medium: ${v.medium.kind}. Nearby mobs: ${v.nearbyMobs.map(m=>m.type+' '+m.distance+'m').join(', ')||'none observed'}. Position ${v.position?Object.values(v.position).join(','):'unknown'}.`,{situation:v})}
  if(/^(?:status|position|where are you|health|survival status)$/.test(s)){const x=this.world.snapshot(),source=x.gameModeSource?.includes('fallback')?' (inherited from server-reported player default)':'';return answer(`Mode ${x.gameMode||'unknown'}${source}; Survival verified: ${x.survivalVerified}. Realm ${this.connection.spawned?'joined':'disconnected/not spawned'}. Position ${x.position?Object.values(x.position).join(','):'unknown'}. Health ${x.health??'unknown'}, hunger ${x.hunger??'unknown'}. Navigation ${this.navigation.state}. View sections ${x.sections}.`,{survival:this.snapshot()})}
  if(/^(?:help|commands|what can you do|help survival|help movement|show jobs)$/.test(s))return answer('No add-on needed: “roam” or “explore north” (30-block safe observed trip with remembered tree locations), “look around”, “inventory”, “find oak log”, “route to X Y Z”, “walk to X Y Z”, “stop”, “rejoin realm”, “materials stone”, “recipe stone pickaxe”, “plan get 8 torches”. Walking/following can jump one-block steps with headroom and use short server-confirmed dirt staircases when required. Put dirt in the hotbar. “collect drops”, “movement status”, “follow me”, “clear path to X Y Z”, “select slot 1”, “dig X Y Z”. Clear-path mining is limited to easy natural-looking blocks; containers/build-looking blocks are protected. Recipe/supply commands are previews; Craft uses a received recipe and actual server-confirmed ingredients/output. Building uses explicitly positioned block/wall/floor/shelter jobs with actual hotbar supplies.')
  m=s.match(/^follow(?: (.+))?$/)
  if(m){
   let name=m[1]
   if(!name||name==='me'){
    const owners=this.connection.config?.ownerPlayerNames||[]
    const visible=owners.filter(n=>[...this.world.players.values()].some(p=>p.name.toLowerCase()===n.toLowerCase()))
    name=visible.length===1?visible[0]:owners.length===1?owners[0]:null
   }
   if(!name)return answer('Say “follow <player name>” so I know which player to follow.')
   return this.navigation.follow(name)
  }
  m=s.match(/^select (?:hotbar )?slot ([1-9])$/)
  if(m){
   if(!this.connection.spawned||!this.world.inventoryKnown)return answer('Join and receive inventory first.')
   const slot=Number(m[1])-1
   if(!this.world.inventory.has(slot))return answer('That inventory slot has not been received.')
   try{this.connection.client.queue('player_hotbar',{selected_slot:slot,window_id:'inventory',select_slot:true});this.connection.client.queue('mob_equipment',{runtime_entity_id:BigInt(this.world.entityId),item:this.world.inventory.get(slot),slot,selected_slot:slot,window_id:'inventory'});this.world.selectedSlot=slot;return answer(`Selected hotbar slot ${slot+1}. The server still validates equipment and durability.`)}catch(e){return answer('Could not select slot: '+e.message)}
  }
  m=s.match(/^build (wall|floor) (\d+) by (\d+) (?:with|of) (.+) at (-?\d+) (-?\d+) (-?\d+)$/)
  const buildShelter=s.match(/^build shelter (?:with|of) (.+) at (-?\d+) (-?\d+) (-?\d+)$/)
  const place=s.match(/^place (.+) at (-?\d+) (-?\d+) (-?\d+)$/)
  if(m||buildShelter||place){const simple=buildShelter||place,material=resolveMaterial(simple?simple[1]:m[4]);if(!material)return {accepted:false,queued:false,message:'Choose a known building block.'};const descriptor={shape:buildShelter?'shelter':place?'block':m[1],width:simple?1:Number(m[2]),height:simple?1:Number(m[3]),material,origin:{x:Number(simple?simple[2]:m[5]),y:Number(simple?simple[3]:m[6]),z:Number(simple?simple[4]:m[7])}};return this.companion.build(descriptor,()=>this.navigation.build(descriptor))}
  m=s.match(/^(?:dig|mine block at) (-?\d+)[, ]+(-?\d+)[, ]+(-?\d+)$/)
  if(m){const pos={x:Number(m[1]),y:Number(m[2]),z:Number(m[3])};return this.companion.mine(pos,()=>this.navigation.mine(pos))}
  m=s.match(/^clear path to (-?\d+)[, ]+(-?\d+)[, ]+(-?\d+)$/)
  if(m)return this.navigation.walk({x:Number(m[1]),y:Number(m[2]),z:Number(m[3])},{allowMining:true})
  if(s==='movement status'||s==='why are you stuck'){const n=this.navigation.snapshot(),f=n.physics,a=this.world.abilityState;return answer(`${n.mode}: ${n.state}. ${n.reason} Ground contact: ${f.grounded}; terrain known: ${f.terrainKnown}; server grounded: ${f.serverGrounded??'unreported'}; active flight: ${a?.known?!!a.effective.flying:'unverified'}; loading: ${f.loading}; flight recovery: ${this.verification.flightRecovery.state}. ${this.navigation.movementBlock()||'Ready to walk.'} Server feedback: ${n.progress.feedback}.`,{navigation:n,verification:this.verification.snapshot()})}
  m=s.match(/^(?:route|walk|go|move|head) to (-?\d+)[, ]+(-?\d+)[, ]+(-?\d+)$/)
  if(m){const goal={x:Number(m[1]),y:Number(m[2]),z:Number(m[3])};if(s.startsWith('route')){const p=this.navigation.routeTo(goal);return answer(p.ok?`Route found: ${p.path.length-1} walking/jumping steps. Say “walk to ${goal.x} ${goal.y} ${goal.z}” to move.`:p.reason,{route:p.ok?p.path:[]})}return this.navigation.walk(goal)}
  m=s.match(/^(?:find|locate|look for) (.+)$/)
  if(m){const n=resolveMaterial(m[1]);if(!n)return answer('Unknown material. Try “materials '+m[1]+'”.');const scan=this.world.scan(n),p=scan.found[0];return answer(p?`Visible ${n} at ${p.x},${p.y},${p.z}. This locates it; no blocks were mined.`:`No ${n} visible in observed nearby terrain. Look around or move closer.`)}
  m=s.match(/^(?:materials|blocks|items|catalog)(?: (.*))?$/)
  if(m)return answer(`Catalog: ${catalogCounts.blocks} blocks, ${catalogCounts.items} items. Matches: ${searchCatalog(m[1]).join(', ')||'none'}. Ask “recipe <name>” or “about <name>”.`)
  m=s.match(/^(?:recipe|how (?:do i|to) (?:craft|make)|about) (.+)$/)
  if(m){const n=resolveMaterial(m[1]);if(!n)return answer('Unknown material. Try “materials '+m[1]+'”.');const r=recipeInfo(n);return answer(`${materialInfo(n).displayName} (${n}). `+(r.length?r.map(x=>`${x.output} output from ${Object.entries(x.ingredients).map(([n,c])=>`${c} ${n}`).join(' + ')}; ${x.station}${x.verified?'':' (version-data reference; verify ingredients in game)'}`).join(' | '):'No crafting recipe in the bundled version data.'))}
  m=s.match(/^plan build (?:a )?(wall|floor|platform) (\d+)\s*(?:by|x)\s*(\d+) (?:with|of|using) (.+)$/)
  const shelter=s.match(/^plan build (?:a )?(?:small )?shelter(?: (?:with|of|using) (.+))?$/)
  if(m||shelter){
   const name=resolveMaterial(shelter?(shelter[1]||'cobblestone'):m[4]),width=shelter?5:Number(m[2]),height=shelter?3:Number(m[3]),count=shelter?96:width*height
   if(!name||width<1||width>12||height<1||height>12)return answer('Choose a known material and dimensions from 1 to 12.')
   const plan=supplyPlan(name,count,this.world.items(),this.world.inventoryKnown);if(!plan.ok)return answer(plan.message)
   plan.blueprint=shelter?{shape:'shelter',width:5,length:5,wallHeight:3,doorwayBlocks:2,includes:['floor','walls','roof'],windows:false}: {shape:m[1],width,height}
   this.lastPlan=plan
   return answer(`Building preview: ${shelter?'5×5 shelter, 3-block walls, floor, roof and 2-block doorway':`${m[1]} ${width}×${height}`}; ${count} ${name}. Check the footprint and gather supplies. ${plan.steps.slice(0,10).map(x=>`${x.action} ${x.count} ${x.item}`).join(' → ')}. This preview is not executable; use Place, Build or Craft for actual server-confirmed actions.`,{supplyPlan:plan})
  }
  m=s.match(/^(?:plan (?:get|make|craft|gather|collect)|get|gather|collect|craft|make) (\d+) (.+)$/)
  if(m){const n=resolveMaterial(m[2]);if(!n)return answer('Unknown material; use “materials <name>” to look it up.');const plan=supplyPlan(n,Number(m[1]),this.world.items(),this.world.inventoryKnown);if(!plan.ok)return answer(plan.message);this.lastPlan=plan;return answer(`Plan ${plan.count} ${plan.name}${plan.inventoryKnown?'':' (inventory unknown; quantities assume empty inventory)'}: ${plan.steps.slice(0,12).map(x=>`${x.action} ${x.count} ${x.item}`).join(' → ')||'already supplied'}. ${plan.message}`,{supplyPlan:plan})}
  if(/^(?:plan status|show plan)$/.test(s))return answer(this.lastPlan?JSON.stringify(this.lastPlan):'No survival supply plan yet.')
  if(/^(?:start plan|run plan|execute plan|approve plan)$/.test(s))return answer('Survival supply plans are previews. Crafting and block placement transactions are not implemented; no job was sent.')
  if(/^(?:follow|come|build|mine|harvest|smelt|fight|explore|return|mark|plan)\b/.test(s))return answer('That survival action is not implemented yet. Try “look around”, “walk to X Y Z”, or “plan get 8 torches”. No behavior-pack command or teleport was sent.')
  return answer('Try “help survival” for the no-add-on commands. Use a material name and quantity to prepare a supply plan.')
 }
}
