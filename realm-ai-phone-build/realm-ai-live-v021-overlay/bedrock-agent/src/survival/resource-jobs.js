import {parseResourceGoal,internalResourcePlan,selectKnownResource,treeTrunkAtPosition} from './internal-skills.js'
import {miningAssessment} from './obstacles.js'
import {bestAxeSlot,axeDurability,chestCheckpoint,storageForTree,trunkIdentity,provisioningPlan} from './forestry-cycle.js'
import {makeForestryReturnPlan,returnRouteHints} from './forestry-return.js'

export function expectedResourceDrops(world,target){
 const names=(world.registry?.blocksByName?.[target?.name]?.drops||[]).map(id=>world.registry?.items?.[id]?.name).filter(Boolean)
 return [...new Set([...(target?.name?[target.name]:[]),...names])]
}

const id=p=>`${p.x},${p.y},${p.z}`
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)

// Single task owned by the local bot. No new UI, no remote AI, and no chat
// messages from anyone other than the already-authorized owner can start it.
// World actions are delegated to the existing verified movement/mining/pickup
// pipeline; a predicted position never counts as a successful block break.
export class ResourceJobs {
 constructor(controller){this.controller=controller;this.active=null;this.last=null}
 get world(){return this.controller.world}
 get navigation(){return this.controller.navigation}
 report(text){this.controller.report?.(text)}
 snapshot(){return this.active?{kind:this.active.goal.kind,state:this.active.state,confirmedBreaks:this.active.breaks,confirmedPickups:this.active.pickups,trees:0,registeredTrunks:this.active.trunks.length,checkpointAt:this.active.checkpoints.map(x=>({...x})),axes:this.active.axeCount,lastMessage:this.active.reason,waitingCapabilities:this.active.waitingCapabilities,returnPlan:this.active.returnPlan||null}:this.last||{state:'idle'}}
 cancel(reason='Resource task stopped; resources already collected remain in inventory.'){
  if(!this.active)return
  this.last={state:'interrupted',reason,confirmedBreaks:this.active.breaks,confirmedPickups:this.active.pickups,trees:0,registeredTrunks:this.active.trunks.length,checkpoints:this.active.checkpoints,returnPlan:this.active.returnPlan||null}
  this.active=null
 }
 finish(reason,state='blocked'){
  if(!this.active)return
  this.last={state,reason,confirmedBreaks:this.active.breaks,confirmedPickups:this.active.pickups,trees:0,registeredTrunks:this.active.trunks.length,checkpoints:this.active.checkpoints,returnPlan:this.active.returnPlan||null}
  this.active=null
  this.report(reason)
 }
 start(raw){
  const plan=internalResourcePlan(raw,{inventory:this.world.items?.()||{},knownInventory:!!this.world.inventoryKnown})
  if(!plan)return null
  if(plan.error)return {accepted:false,queued:false,message:plan.error}
  if(this.active||this.controller.exploration?.active||this.navigation.job||this.navigation.survey)return {accepted:false,queued:false,message:'Stop the current job before beginning another resource task.'}
  if(!this.world.inventoryKnown||!this.world.enabled)return {accepted:false,queued:false,message:'Waiting for inventory and visible terrain; task not started.'}
  const blocked=this.navigation.movementBlock()
  if(blocked)return {accepted:false,queued:false,message:blocked}
  this.controller.workshop?.close()
  this.active={goal:plan.goal,plan,state:'search',started:Date.now(),lastAt:0,breaks:0,pickups:0,trees:new Set(),trunks:[],checkpoints:[],axeCount:0,waitingCapabilities:[],visited:new Set(),target:null,reason:'Searching observed terrain.',pickupStarted:0,inventoryBefore:{...this.world.items()},movementObservedAt:0,triedTrees:new Set(),rememberedTarget:null,scoutAttempts:0,nextScoutAt:0,scoutHeading:0,scoutGoal:null,scoutPoseAt:0,requestedAxeSlot:null,axeRequestAt:0,lastReportAt:0,hadAxes:false,warnedOutOfAxes:false}
  this.tick(Date.now())
  return {accepted:true,queued:!!this.active,message:this.active?'Resource task started internally: '+this.active.reason:'Resource scan finished. '+(this.last?.reason||'No target found.'),resourceTask:this.snapshot()}
 }
 requestReturnHome(){
  const a=this.active
  if(!a||a.goal.kind!=='tree-harvest')return {accepted:false,queued:false,message:'No active tree-harvesting run to return from. Emergency Stop is always available.'}
  // Stop new harvesting NOW, including the currently held mining input; a
  // return-home request must never complete an in-flight break by prediction.
  this.navigation.stop('Stopping tree harvesting for the return-home job.',false)
  a.returnPlan=makeForestryReturnPlan(a.checkpoints,{dimension:this.world.dimension??null})
  a.returnRoute=returnRouteHints(a.trunks,a.returnPlan.home?.position||a.trunks[1])
  a.returnIndex=0;a.returnLeg=null;a.returnStartedAt=Date.now();a.returnLastReportAt=0
  a.waitingCapabilities=['server-confirmed chest placement','container open + contents','authoritative item stack transfers','confirmed empty-chest pickup','safe home-chest line placement']
  if(!a.returnPlan.home){
   this.finish('Tree harvesting stopped. Tree two has not been reached, so the first-chest home base does not exist yet. No chest or wood was moved.','awaiting-home')
   return {accepted:true,queued:false,message:this.last.reason,returnPlan:this.last.returnPlan}
  }
  a.state='returning-home';a.reason='Harvesting stopped. Heading toward the first tree-two chest checkpoint. Chest collection/storage is pending verified Bedrock container transactions.'
  this.tick(Date.now()+300)
  return {accepted:true,queued:!!this.active,message:a.reason,resourceTask:this.snapshot()}
 }
 tickHomeward(now){
  const a=this.active,w=this.world,n=this.navigation
  if(!a||!a.returnPlan?.home)return
  const home=a.returnPlan.home.position,pose=w.serverPosition
  if(pose&&distance(pose,{x:home.x+.5,y:home.y+1.62,z:home.z+.5})<4){
   this.finish('Returned near the tree-two home checkpoint. Wood retrieval, empty-chest pickup and chest-line deposits require server-confirmed container support; no chest or wood was fabricated or moved.','awaiting-storage')
   return
  }
  if(a.state==='return-walking'){
   const leg=a.returnLeg
   if(n.job&&['blocked','failed','stopped'].includes(n.state)){
    n.stop('',false);a.state='return-paused';a.reason='Home route stopped: '+(n.reason||'server route failure')+'; no chest actions attempted.';return
   }
   if(leg&&pose&&(n.lastPoseAt||0)>a.returnLegPoseAt&&distance(pose,{x:leg.x+.5,y:leg.y+1.62,z:leg.z+.5})<.75){
    n.stop('',false);a.state='returning-home';a.returnIndex++;a.reason='Server confirmed one leg back toward home.';return
   }
   if(now-a.returnLegStartedAt>21000){n.stop('',false);a.state='return-paused';a.reason='Homeward walking timed out without server position confirmation.'}
   return
  }
  if(a.state==='return-paused')return
  if(n.job)return
  const route=a.returnRoute||[]
  // Advance past logs we are already near; no guessed or unobserved teleport.
  while(a.returnIndex<route.length-1&&pose&&distance(pose,{x:route[a.returnIndex].x+.5,y:route[a.returnIndex].y+1.62,z:route[a.returnIndex].z+.5})<6)a.returnIndex++
  const mark=route[Math.min(a.returnIndex,route.length-1)]||home
  const approach=this.chooseMemoryApproach(mark)
  if(approach){const result=n.walk(approach,{allowMining:false});if(result?.accepted){a.state='return-walking';a.returnLeg=approach;a.returnLegPoseAt=n.lastPoseAt||0;a.returnLegStartedAt=now;a.reason='Walking toward remembered tree checkpoint; waiting for server-confirmed position.';return}}
  try{w.requestNearby?.(n.client)}catch{}
  if(now-a.returnLastReportAt>12000){a.returnLastReportAt=now;this.report('Returning with wood is paused: path to tree-two chest is not yet visible and safe. No mining or chest edits will be attempted. Use Stop to cancel.')}
  a.reason='Waiting for safe observed terrain to route home.'
 }
 failIfUnsafe(now){
  if(!this.active)return true
  // Forestry is intentionally continuous until Stop, danger or a disconnect.
  // A single explicit 'find and mine' request keeps its finite safety limit.
  if(this.active.goal.kind!=='tree-harvest'&&!this.active.goal.continuousSearch&&now-this.active.started>180000){this.finish('Resource task reached its three-minute safety limit.','timed-out');return true}
  if(this.world.attributes['minecraft:health']===0||this.world.attributes['minecraft:health']>0&&this.world.attributes['minecraft:health']<=6||this.navigation.isRespawning?.()){
   this.finish('Resource task stopped on death or low health.');return true
  }
  if(this.navigation.defense?.state!=='idle'&&this.navigation.defense?.state!==undefined){this.finish('Resource work stopped because hostile-mob defense took priority.');return true}
  if(!this.world.enabled||!this.world.inventoryKnown||!this.world.movementVerified){this.finish('Resource work stopped because terrain, inventory or movement verification was lost.');return true}
  return false
 }

 chooseTools(now){
  const a=this.active,w=this.world,n=this.navigation
  if(a?.goal.kind!=='tree-harvest')return false
  const axes=[0,1,2,3,4,5].filter(slot=>axeDurability(w.inventory?.get(slot),w.registry)?.remaining!==0 && axeDurability(w.inventory?.get(slot),w.registry))
  a.axeCount=axes.length
  if(a.axeCount===0&&a.hadAxes&&!a.warnedOutOfAxes){
   a.warnedOutOfAxes=true
   const stock=provisioningPlan(w.items?.()||{},0,{hasTable:!!(w.items?.()||{}).crafting_table})
   this.report('All six monitored axe slots are empty or exhausted. A replacement batch needs '+stock.neededPlanks+' planks and '+stock.neededSticks+' sticks before crafting; will continue by hand where permitted, without fabricating tools.')
  }
  if(a.axeCount>0){a.hadAxes=true;a.warnedOutOfAxes=false}
  const slot=bestAxeSlot(w)
  if(slot===null){a.requestedAxeSlot=null;return false} // bare hand remains a valid fallback for logs
  if(slot===w.selectedSlot){a.requestedAxeSlot=null;return false}
  if(a.requestedAxeSlot===slot&&now-a.axeRequestAt<3000){a.reason='Waiting for server to confirm equipped axe in slot '+(slot+1);return true}
  if(a.requestedAxeSlot===slot&&now-a.axeRequestAt>=3000){
   a.reason='Server did not confirm axe selection; continuing with current held item if safe.'
   a.requestedAxeSlot=null;return false
  }
  if(!n.client||w.entityId===null)return false
  try{
   n.client.queue('player_hotbar',{selected_slot:slot,window_id:'inventory',select_slot:true})
   n.client.queue('mob_equipment',{runtime_entity_id:BigInt(w.entityId),item:w.inventory.get(slot),slot,selected_slot:slot,window_id:'inventory'})
   a.requestedAxeSlot=slot;a.axeRequestAt=now;a.reason='Equipping observed axe in hotbar slot '+(slot+1)+'; waiting for server acknowledgment.'
   return true
  }catch(e){a.reason='Axe selection failed: '+String(e.message||e).slice(0,120);return false}
 }
 noteTree(target,now){
  const a=this.active;if(!a||a.goal.kind!=='tree-harvest')return
  const anchor=trunkIdentity(target,a.trunks)
  if(a.trunks.includes(anchor))return
  a.trunks.push(anchor)
  const count=a.trunks.length
  const stock=this.world.items?.()||{}
  a.axeCount=[0,1,2,3,4,5].filter(slot=>axeDurability(this.world.inventory?.get(slot),this.world.registry)).length
  const missing=provisioningPlan(stock,a.axeCount,{needChest:count>=2,hasTable:!!stock.crafting_table})
  if(count===1&&a.axeCount===0){
   a.waitingCapabilities=['crafting-table placement','plank and stick crafting','six-axe crafting','hotbar slot transfers']
   this.report('First observed tree trunk registered; the entire tree is not yet confirmed felled. Six-axe setup requested; '+(missing.hasSupplies?'supplies may be sufficient':'still gathering wood')+'. Crafting transactions are not yet available, so no tools were invented.')
  }
  if(chestCheckpoint(count)){
   // Scheduling a chest doesn't mean a chest was made, placed, or filled.
   const c={tree:count,position:{...anchor},state:'awaiting-real-crafting-and-container-transactions',confirmed:false}
   a.checkpoints.push(c)
   this.report(`Observed trunk ${count}: unconfirmed chest checkpoint scheduled at ${anchor.x},${anchor.y},${anchor.z}. Placement and storage must be confirmed by the Realm before being counted.`)
  }
  if(count>2){
   const at=storageForTree(count)
   if(at&&count!==at&&now-a.lastReportAt>12000){
    a.lastReportAt=now
    this.report(`Observed trunk ${count}: saved wood is intended for tree-${at} storage. Chest deposits are pending actual container transaction support; inventory has not been discarded.`)
   }
  }
 }
 startScouting(now){
  const a=this.active,w=this.world,n=this.navigation,feet=w.standPosition?.()
  if(!feet)return
  if(now<a.nextScoutAt)return
  // Do not treat unobserved cells as empty or teleport into unloaded chunks.
  // Try short, observable forward segments, then other cardinal directions.
  const directions=[{x:0,z:1},{x:1,z:0},{x:0,z:-1},{x:-1,z:0}]
  const head=directions[(a.scoutHeading)%4];a.scoutVisited||=new Set()
  for(const d of [5,3,2,1])for(const dy of [0,1,-1]){
   const goal={x:feet.x+head.x*d,y:feet.y+dy,z:feet.z+head.z*d}
   if(!w.walkable(goal)||a.scoutVisited.has(id(goal)))continue
   const plan=n.routeTo(goal,feet,{allowDirt:false,maxNodes:900})
   if(!plan?.ok||plan.path.length<2)continue
   const result=n.walk(goal,{allowMining:false})
   if(result.accepted){a.scoutVisited.add(id(goal));if(a.scoutVisited.size>512)a.scoutVisited.delete(a.scoutVisited.values().next().value);a.scoutGoal=goal;a.scoutPoseAt=n.lastPoseAt||0;a.state='scouting';a.scoutStarted=now;a.reason='Roaming through another observed section to find the requested material; continuing until Stop.';return}
  }
  try{w.requestNearby?.(n.client)}catch{}
  a.scoutHeading++;a.scoutAttempts++;a.nextScoutAt=now+2000
  a.reason='No safe forward segment known; waiting for server terrain and trying another direction.'
  if(a.scoutAttempts%10===0)this.report('Still looking for the requested material; safe path is not confirmed. Stop remains available.')
 }
 chooseMemoryApproach(target){
  const w=this.world,n=this.navigation,start=w.standPosition?.();if(!start)return null
  const candidates=[]
  for(const r of [3,5,7])for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r]])for(const dy of [0,1,-1,2,-2]){
   const cell={x:target.x+dx,y:start.y+dy,z:target.z+dz}
   if(!w.walkable(cell))continue
   const route=n.routeTo(cell,start,{allowDirt:false,maxNodes:2048})
   if(route?.ok)candidates.push({cell,steps:route.path.length})
  }
  candidates.sort((a,b)=>a.steps-b.steps)
  return candidates[0]?.cell||null
 }
 chooseApproach(target){
  const w=this.world,n=this.navigation,start=w.standPosition?.();if(!start||!w.visible(target))return null
  const cells=[]
  for(const dist of [2,3])for(const [dx,dz] of [[dist,0],[-dist,0],[0,dist],[0,-dist],[dist,1],[-dist,-1],[1,dist],[-1,-dist]])for(const dy of [0,1,-1]){
   const p={x:target.x+dx,y:start.y+dy,z:target.z+dz}
   if(w.walkable(p))cells.push(p)
  }
  cells.sort((a,b)=>distance(a,start)-distance(b,start))
  // Try distinct nearby approaches, stopping as soon as one route works.
  // Do not synchronously run dozens of complete A* searches per mining tick.
  for(const p of cells.slice(0,12))if(n.routeTo(p,start,{allowDirt:false,maxNodes:512})?.ok)return p
  return null
 }
 tick(now=Date.now()){
  const a=this.active;if(!a||now-a.lastAt<250)return
  a.lastAt=now
  if(this.failIfUnsafe(now))return
  if(['returning-home','return-walking','return-paused'].includes(a.state)){this.tickHomeward(now);return}
  const w=this.world,n=this.navigation
  if(a.state==='search'){
   if(a.goal.requiredTrees&&a.trunks.length>=a.goal.requiredTrees){this.finish(`Confirmed log collection at ${a.trunks.length} distinct tree sites.`,'completed');return}
   if(a.goal.quantity){const amount=a.goal.sourceFamily==='logs'?Object.entries(w.items()).reduce((n,[name,count])=>n+(/_(?:log|wood|stem|hyphae)$/.test(name)?count:0),0):(w.items()[a.goal.target]||0);if(amount>=a.goal.quantity){this.finish(`Server inventory confirms ${amount} ${a.goal.sourceFamily==='logs'?'logs':a.goal.target}.`,'completed');return}}
   if(a.goal.kind!=='tree-harvest'&&a.breaks>=a.goal.maxBlocks){this.finish('Finished bounded resource pass: '+a.breaks+' server-confirmed breaks; '+a.pickups+' inventory-confirmed pickups.',a.goal.quantity?'partial':'completed');return}
   if(n.job||n.mining.job)return
   if(this.chooseTools(now))return
   const target=selectKnownResource(w,a.goal,a.visited)
   if(!target){
    // Consult *remembered observations*, not fabricated live blocks. Revisit a
    // safe known waypoint near a previously observed tree and scan it again.
    if(a.goal.kind==='tree-harvest'){
     const remembered=this.controller.landmarks?.treeCandidates(w.dimension,w.serverPosition||w.position,{exclude:a.triedTrees})||[]
     const tree=remembered[0]
     if(tree){
      const tId=`${tree.dimension}:${tree.kind}:${tree.x},${tree.z}`
      a.triedTrees.add(tId)
      if(distance(w.position,{x:tree.x+.5,y:tree.y+1.62,z:tree.z+.5})>8){
       const approach=this.chooseMemoryApproach(tree)
       if(approach){const result=n.walk(approach);if(result.accepted){a.state='approaching-memory';a.rememberedTarget=tree;a.movementObservedAt=n.lastPoseAt||0;a.movementGoal=approach;a.movementStartedAt=now;a.reason=`Returning toward remembered tree at ${tree.x},${tree.y},${tree.z}; will verify it still exists.`;return}}
      }else{
       const current=w.block({x:tree.x,y:tree.y,z:tree.z})
       if(current&&current.name!==tree.name)this.controller.landmarks?.forgetTree(tree,w.dimension)
      }
      a.reason=`Remembered tree at ${tree.x},${tree.y},${tree.z}, but no safe observed route or visible log currently. Checking another location.`
      return
     }
    }
    if(a.goal.kind==='tree-harvest'||a.goal.continuousSearch){this.startScouting(now);return}
    this.finish(`No more visible ${a.goal.target}. ${a.breaks} blocks server-confirmed broken; inventory pickup confirmed ${a.pickups} time(s).`,a.breaks?'partial':'blocked');return
   }
   a.target=target
   a.inventoryBefore={...w.items()}
   const pos={x:target.x,y:target.y,z:target.z},assessment=miningAssessment(w,pos,{explicit:true,allowAbove:true})
   if(assessment.ok&&(!a.goal.quantity||assessment.canHarvest)){const result=n.mine(pos,{allowAbove:true});if(result.accepted){a.state='mining';a.reason='Mining a visible '+target.name+'; waiting for server block update.';return}}
   // If out of reach, navigate physically to a known safe cell, not through a block.
   const far=w.position&&distance(w.position,{x:target.x+.5,y:target.y+.5,z:target.z+.5})>4
   if(far){const approach=this.chooseApproach(target);if(approach){const p=n.walk(approach);if(p.accepted){a.state='approaching';a.movementGoal=approach;a.movementStartedAt=now;a.movementObservedAt=n.lastPoseAt||0;a.reason='Walking to visible '+target.name+'; movement not yet server-confirmed.';return}}}
   a.visited.add(id(target));a.reason='Skipping unsafe or unreachable '+target.name+'.';return
  }
  if(a.state==='scouting'){
   if(n.state==='stopped'||['blocked','failed'].includes(n.state)){n.stop('',false);a.state='search';a.nextScoutAt=now+1500;return}
   const p=w.serverPosition,g=a.scoutGoal
   if(p&&g&&n.lastPoseAt>a.scoutPoseAt&&distance(p,{x:g.x+.5,y:g.y+1.62,z:g.z+.5})<.75){
    n.stop('',false);this.controller.landmarks?.observe?.(w,{yaw:null,now});a.state='search';a.scoutAttempts=0;a.reason='Scouting segment server-confirmed; checking visible trees.';return
   }
   if(now-a.scoutStarted>18000){n.stop('',false);a.state='search';a.nextScoutAt=now+2000;a.reason='Scouting segment timed out; selecting another safe direction.'}
   return
  }
  if(a.state==='approaching-memory'){
   if(now-a.movementStartedAt>21000){n.stop('',false);this.finish('Remembered-tree approach timed out without server confirmation.');return}
   if(n.state==='stopped'||['blocked','failed'].includes(n.state)){this.finish('Route to remembered tree stopped: '+(n.reason||'movement interrupted'));return}
   const p=w.serverPosition,g=a.movementGoal
   if(p&&g&&n.lastPoseAt>a.movementObservedAt&&distance(p,{x:g.x+.5,y:g.y+1.62,z:g.z+.5})<.75){
    n.stop('',false)
    this.controller.landmarks?.observe(w,{yaw:n.yaw,fov:120,now})
    a.state='search';a.reason='Returned near remembered tree; checking the actual server-observed logs before mining.'
    return
   }
   return
  }
  if(a.state==='approaching'){
   if(['blocked','stopped','failed'].includes(n.state)){this.finish(n.reason||'Resource approach interrupted.');return}
   if(now-a.movementStartedAt>21000){n.stop('',false);this.finish('Resource approach timed out without server confirmation.');return}
   if(n.job&&n.state!=='arrived-predicted'){if(['blocked','stopped','failed'].includes(n.state))this.finish(n.reason||'Route failed.');return}
   const p=w.serverPosition,goal=a.movementGoal
   if(!p||!goal||n.lastPoseAt<=a.movementObservedAt)return
   if(distance(p,{x:goal.x+.5,y:goal.y+1.62,z:goal.z+.5})>.75)return
   n.stop('',false);a.state='search';a.reason='Server confirmed approach; checking reach again.';return
  }
  if(a.state==='mining'){
   if(n.mining.job)return
   if(n.mining.result!=='confirmed'){
    this.finish('Mining was not server-confirmed: '+(n.mining.reason||'unknown result'));return
   }
   const target=a.target;a.visited.add(id(target));a.breaks++
   if(a.goal.sourceFamily==='logs'){const site=trunkIdentity(target,a.trunks);if(!a.trunks.includes(site))a.trunks.push(site);this.controller.workshop?.rememberTree(target)}
   if(a.goal.kind==='tree-harvest'){this.controller.workshop?.rememberTree(target);a.trees.add(treeTrunkAtPosition(target));this.noteTree(target,now)}
   a.pickupStarted=now;a.state='pickup-wait'
   a.reason='Server confirmed '+target.name+' broken. Waiting for an observed item drop; inventory not yet confirmed.'
   return
  }
  if(a.state==='pickup-wait'){
   // Let the server report a drop before searching for one. No client-created items.
   if(now-a.pickupStarted<600)return
   if(n.job)return
   const before=a.inventoryBefore,after=w.items()
   const expected=expectedResourceDrops(w,a.target);const growth=expected.some(name=>(after[name]||0)>(before[name]||0))
   if(growth){a.pickups++;a.state='search';a.reason='Inventory increased after a confirmed break; looking for the next target.';return}
   const drop=[...(w.drops?.values?.()||[])].filter(d=>expected.includes(d.name)&&distance(d.position,w.position)<8).sort((x,y)=>distance(x.position,w.position)-distance(y.position,w.position))[0]
   if(drop){const result=n.collectNearby({names:expected});if(result?.accepted){a.state='pickup-active';a.reason='Collecting server-observed drop and waiting for inventory confirmation.';return}}
   if(now-a.pickupStarted>2500){a.state='search';a.reason='Break confirmed; no item received. Never counted as collected.'}
  }
  if(a.state==='pickup-active'){
   if(n.pickup.target||n.job)return
   if(n.pickup.state==='confirmed')a.pickups++
   else a.reason='Pickup was not confirmed; no supplies credited.'
   a.state='search'
  }
 }
}
