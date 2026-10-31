import {CommandPlans} from './command-plans.js'
import {SurvivalVerification} from './verification.js'
import {WorldView} from './world.js'
import {Navigation} from './navigation.js'
import {resolveMaterial,searchCatalog,recipeInfo,supplyPlan,catalogCounts,materialInfo} from './catalog.js'
const answer=(message,extra={})=>({accepted:true,queued:false,message,...extra})
export class SurvivalController{
 constructor(connection,{plansDirectory=null,scope=null}={}){this.connection=connection;this.world=new WorldView();this.navigation=new Navigation(this.world,m=>this.report(m));this.lastPlan=null;this.commandPlans=new CommandPlans(this,{directory:plansDirectory,scope});this.verification=new SurvivalVerification(this.world,this.navigation,m=>this.report(m));this.verification.desiredMode=connection.config?.requestedGameMode==='creative'?'creative':'survival';this.navigation.checkVerification=()=>this.verification.check()}
 report(message){const c=this.connection;c.events.push({id:++c.nextEventId,source:'Survival',message});if(c.events.length>64)c.events.shift();c.emit('survival-update',{message})}
 attach(client){this.world.detach();this.world.reset();this.world.attach(client);this.navigation.attach(client);this.verification.attach(client)}
 close(){this.commandPlans.interrupt('Disconnected; no automatic resume.');this.verification.detach();this.navigation.detach();this.world.detach()}
 snapshot(){return {plans:this.commandPlans.snapshot(),verification:this.verification.snapshot(),view:this.world.snapshot(),navigation:this.navigation.snapshot(),catalog:catalogCounts,plan:this.lastPlan}}
 handle(raw){
  if(typeof raw!=='string'||raw.length>190)return null
  const s=raw.trim().toLowerCase().replace(/[.!?]+$/,'').replace(/^(?:please |can you |could you )/,'');let m
  if(s==='ensure survival'){const state=this.verification.requestMode('survival');return answer(state.reason,{verification:state})}
  if(/^(?:rejoin|rejoin realm|reconnect|reconnect realm|join again)$/.test(s))return this.connection.reconnect()
  if(/^(?:view on|look around|look|scan|survey nearby|what can you see|what is nearby)$/.test(s)){
   this.world.enabled=true
   if(!this.connection.spawned)return answer('Join the Realm first, then look around.')
   try{this.world.requestNearby(this.connection.client)}catch(e){this.world.lastError=e.message}
   const report=this.world.scan(),p=this.world.standPosition()
   return answer(`View at ${p?`${p.x},${p.y},${p.z}`:'unknown position'}: ${report.counts.length?report.counts.map(([n,c])=>`${n} ×${c}`).join(', '):'waiting for nearby terrain data'}. ${this.world.sections.size} terrain sections; ${this.world.decodeErrors} decode errors.${this.world.lastError?' '+this.world.lastError:''}`,{survival:this.snapshot()})
  }
  if(s==='view off'){this.world.enabled=false;this.world.sections.clear();this.world.updates.clear();this.world.pending.clear();this.navigation.stop('View switched off.');return answer('View off; walking stopped.')}
  if(/^(?:stop|stop everything|stop following|stop following me|stop mining|stop walking|stay|wait here|cancel job|cancel plan)$/.test(s)){this.commandPlans.interrupt();this.navigation.stop();this.lastPlan=null;return answer('Stopped following, walking, mining and building. Saved plans kept.')}
  if(/^(?:inventory|what do you have|check inventory)$/.test(s)){
   const items=Object.entries(this.world.items());return answer(this.world.inventoryKnown?(items.length?'Inventory: '+items.slice(0,16).map(([n,c])=>`${n} ×${c}`).join(', '):'Inventory is empty.'):'Waiting for the server inventory snapshot.')
  }
  if(/^(?:status|position|where are you|health|survival status)$/.test(s)){const x=this.world.snapshot(),source=x.gameModeSource?.includes('fallback')?' (inherited from server-reported player default)':'';return answer(`Mode ${x.gameMode||'unknown'}${source}; Survival verified: ${x.survivalVerified}. Realm ${this.connection.spawned?'joined':'disconnected/not spawned'}. Position ${x.position?Object.values(x.position).join(','):'unknown'}. Health ${x.health??'unknown'}, hunger ${x.hunger??'unknown'}. Navigation ${this.navigation.state}. View sections ${x.sections}.`,{survival:this.snapshot()})}
  if(/^(?:help|commands|what can you do|help survival|help movement|show jobs)$/.test(s))return answer('No add-on needed: “look around”, “inventory”, “find oak log”, “route to X Y Z”, “walk to X Y Z”, “stop”, “rejoin realm”, “materials stone”, “recipe stone pickaxe”, “plan get 8 torches”. Follow mode can jump one-block steps with headroom. “movement status”, “follow me”, “clear path to X Y Z”, “select slot 1”, “dig X Y Z”. Clear-path mining is limited to easy natural-looking blocks; containers/build-looking blocks are protected. Crafting remains a preview. Building uses explicitly positioned block/wall/floor/shelter jobs with actual hotbar supplies.')
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
  if(m||buildShelter||place){const simple=buildShelter||place,material=resolveMaterial(simple?simple[1]:m[4]);if(!material)return {accepted:false,queued:false,message:'Choose a known building block.'};return this.navigation.build({shape:buildShelter?'shelter':place?'block':m[1],width:simple?1:Number(m[2]),height:simple?1:Number(m[3]),material,origin:{x:Number(simple?simple[2]:m[5]),y:Number(simple?simple[3]:m[6]),z:Number(simple?simple[4]:m[7])}})}
  m=s.match(/^(?:dig|mine block at) (-?\d+)[, ]+(-?\d+)[, ]+(-?\d+)$/)
  if(m)return this.navigation.mine({x:Number(m[1]),y:Number(m[2]),z:Number(m[3])})
  m=s.match(/^clear path to (-?\d+)[, ]+(-?\d+)[, ]+(-?\d+)$/)
  if(m)return this.navigation.walk({x:Number(m[1]),y:Number(m[2]),z:Number(m[3])},{allowMining:true})
  if(s==='movement status'||s==='why are you stuck'){const n=this.navigation.snapshot();return answer(`${n.mode}: ${n.state}. ${n.reason} Server feedback: ${n.progress.feedback}.`,{navigation:n})}
  m=s.match(/^(?:route|walk|go|move|head) to (-?\d+)[, ]+(-?\d+)[, ]+(-?\d+)$/)
  if(m){const goal={x:Number(m[1]),y:Number(m[2]),z:Number(m[3])};if(s.startsWith('route')){const p=this.navigation.routeTo(goal);return answer(p.ok?`Route found: ${p.path.length-1} level-ground steps. Say “walk to ${goal.x} ${goal.y} ${goal.z}” to move.`:p.reason,{route:p.ok?p.path:[]})}return this.navigation.walk(goal)}
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
   return answer(`Building preview: ${shelter?'5×5 shelter, 3-block walls, floor, roof and 2-block doorway':`${m[1]} ${width}×${height}`}; ${count} ${name}. Check the footprint and gather supplies. ${plan.steps.slice(0,10).map(x=>`${x.action} ${x.count} ${x.item}`).join(' → ')}. Placement and crafting are not executable yet.`,{supplyPlan:plan})
  }
  m=s.match(/^(?:plan (?:get|make|craft|gather|collect)|get|gather|collect|craft|make) (\d+) (.+)$/)
  if(m){const n=resolveMaterial(m[2]);if(!n)return answer('Unknown material; use “materials <name>” to look it up.');const plan=supplyPlan(n,Number(m[1]),this.world.items(),this.world.inventoryKnown);if(!plan.ok)return answer(plan.message);this.lastPlan=plan;return answer(`Plan ${plan.count} ${plan.name}${plan.inventoryKnown?'':' (inventory unknown; quantities assume empty inventory)'}: ${plan.steps.slice(0,12).map(x=>`${x.action} ${x.count} ${x.item}`).join(' → ')||'already supplied'}. ${plan.message}`,{supplyPlan:plan})}
  if(/^(?:plan status|show plan)$/.test(s))return answer(this.lastPlan?JSON.stringify(this.lastPlan):'No survival supply plan yet.')
  if(/^(?:start plan|run plan|execute plan|approve plan)$/.test(s))return answer('Survival supply plans are previews. Crafting and block placement transactions are not implemented; no job was sent.')
  if(/^(?:follow|come|build|mine|harvest|smelt|fight|explore|return|mark|plan)\b/.test(s))return answer('That survival action is not implemented yet. Try “look around”, “walk to X Y Z”, or “plan get 8 torches”. No behavior-pack command or teleport was sent.')
  return answer('Try “help survival” for the no-add-on commands. Use a material name and quantity to prepare a supply plan.')
 }
}
