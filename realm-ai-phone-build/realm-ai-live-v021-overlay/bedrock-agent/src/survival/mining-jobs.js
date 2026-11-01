import {stripLayout,quarryLayout,miningRequest,right} from './mining-layouts.js'
import {cardinalFromYaw} from './exploration-jobs.js'
import {miningAssessment} from './obstacles.js'
import {expectedResourceDrops} from './resource-jobs.js'
import {resolveMaterial} from './catalog.js'
const dist=(p,g)=>p?Math.hypot(p.x-g.x-.5,p.y-1.62-g.y,p.z-g.z-.5):Infinity
const ore=n=>/(?:_ore$|ancient_debris$)/.test(n||'')
export class MiningJobs{
 constructor(c){this.c=c;this.active=null;this.last={state:'idle'}}
 start(raw){
  const request=miningRequest(raw);if(!request)return null
  const c=this.c,w=c.world,n=c.navigation
  if(this.active||n.job||c.resources.active||c.exploration.active||c.operations.pending)return {accepted:false,queued:false,message:'Stop the active task before beginning excavation.'}
  const denied=n.movementBlock();if(denied)return {accepted:false,queued:false,message:denied}
  if(!w.inventoryKnown||!w.editModeVerified)return {accepted:false,queued:false,message:'Verified mode, terrain and real inventory are required.'}
  if(request.kind==='quarry'){request.material=resolveMaterial(request.material);if(!request.material||!w.registry.blocksByName[request.material])return {accepted:false,queued:false,message:'Choose a known block material for the quarry.'}}
  const start=w.standPosition(),heading=cardinalFromYaw(n.yaw||0)
  if(request.kind==='strip'&&(request.depth< -54||request.depth>start.y||request.rows<1||request.rows>16))return {accepted:false,queued:false,message:'Choose 1–16 rows and a lower depth between -54 and your current feet level.'}
  this.active={request,start:{...start},heading,state:'provision',index:0,layout:null,breaks:0,pickups:0,started:Date.now(),lastAt:0,target:null,waiting:null,reason:'Planning tools, building dirt, a known route and storage before digging.',home:null,depositing:false,oreVisited:new Set(),oreCount:0,child:null}
  this.c.report(this.active.reason);return {accepted:true,queued:true,message:request.kind==='strip'?`Preparing ${request.rows} rows of 30-block, two-high tunnels at Y ${request.depth}, with four-block connectors. A staircase descent avoids mining underfoot. Tools and 64 dirt are checked first.`:'Preparing a 15×15 excavation two blocks deep, safe access, a shovel and storage at 640 dirt.'}
 }
 startSupport(name,minimum=1){if(this.active||this.c.resources.active||this.c.exploration.active)return false;this.c.navigation.stop('Preparing shovel and building dirt before resuming follow.',false);this.active={request:{kind:'support',name,minimum},state:'provision',index:0,breaks:0,pickups:0,lastAt:0,reason:'Preparing real dirt supplies.',started:Date.now()};return true}
 cancel(reason='Excavation interrupted; no automatic resume.'){if(!this.active)return;this.last={...this.snapshot(),state:'interrupted',reason};this.active=null}
 block(reason){if(!this.active)return;this.active.reason=reason;this.active.state='blocked';this.c.navigation.stop(reason,false);this.c.resources.cancel(reason);this.c.operations.cancel(reason);this.c.report(reason)}
 snapshot(){const a=this.active;return a?{kind:a.request.kind,state:a.state,reason:a.reason,completedCells:a.index,totalCells:a.layout?.points.length||0,confirmedBreaks:a.breaks,confirmedPickups:a.pickups,home:a.home,plan:a.request}:this.last}
 equip(material,now){const c=this.c,w=c.world,r=c.workshop.hotbar(material,now);if(r.state!=='ready')return r;const slot=[...w.inventory].find(([s,i])=>s<9&&i.count>0&&w.registry.items[i.network_id]?.name===material)?.[0];if(slot===undefined)return {state:'blocked',reason:'Requested tool is not in a confirmed hotbar slot.'};if(w.selectedSlot!==slot){const selected=c.handle(`select slot ${slot+1}`);if(!selected?.accepted)return {state:'blocked',reason:selected?.message||'Tool selection failed.'};this.active.equipUntil=now+150;return {state:'working',reason:'Equipping the actual '+material+'.'}}return now<(this.active.equipUntil||0)?{state:'working',reason:'Waiting for equipment input.'}:{state:'ready'}}
 needs(result,now){
  const a=this.active,c=this.c,w=c.world,n=c.navigation
  if(result.state==='ready')return true
  a.reason=result.reason
  if(result.state==='blocked'){this.block(result.reason);return false}
  if(result.state==='approach'){
   if(n.job)return false
   const p=result.position,candidates=[]
   for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=-1;dy<=1;dy++){const g={x:p.x+dx,y:p.y+dy,z:p.z+dz};if(w.walkable(g)){const r=n.routeTo(g);if(r.ok)candidates.push({g,length:r.path.length})}}
   candidates.sort((a,b)=>a.length-b.length);const g=candidates[0]?.g
   let destination=g
   if(!destination){const start=w.standPosition(),distance=Math.hypot(p.x-start.x,p.z-start.z);for(const length of [12,8,4]){if(!distance)break;const x=Math.floor(start.x+(p.x-start.x)/distance*Math.min(length,distance)),z=Math.floor(start.z+(p.z-start.z)/distance*Math.min(length,distance));for(const dy of [0,1,-1,2,-2]){const q={x,y:start.y+dy,z};if(w.walkable(q)&&n.routeTo(q).ok){destination=q;break}}if(destination)break}}
   if(destination){const g=destination,r=n.walk(g);if(r.accepted){a.walk={goal:g,poseAt:n.lastPoseAt,started:now,resume:a.state};a.state='approaching-workshop';return false}}
   w.requestNearby(n.client);return false
  }
  if(result.state==='need'){
   let material=result.material
   if(/_(?:log|wood|stem|hyphae)$/.test(material))material='wood'
   if(material==='cobblestone'&&!Object.keys(w.items()).some(n=>/_pickaxe$/.test(n))){const tool=c.workshop.ensure('wooden_pickaxe',1,now);return this.needs(tool,now)}
   if(['raw_iron','raw_copper'].includes(material)&&!Object.keys(w.items()).some(n=>/^(?:stone|iron|diamond|netherite)_pickaxe$/.test(n))){if(!this.needs(c.workshop.ensure('stone_pickaxe',1,now),now))return false}
   if(material==='raw_gold'&&!Object.keys(w.items()).some(n=>/^(?:iron|diamond|netherite)_pickaxe$/.test(n))){if(!this.needs(c.workshop.ensure('iron_pickaxe',1,now),now))return false}
   if(['cobblestone','raw_iron','raw_gold','raw_copper'].includes(material)){const pick=this.chooseTool('pickaxe');if(pick&&!this.needs(this.equip(pick,now),now))return false}
   if(material==='dirt'){const shovel=this.chooseTool('shovel');if(shovel&&!this.needs(this.equip(shovel,now),now))return false}
   if(!c.resources.active){const r=c.resources.start(`gather ${Math.min(2304,Math.max(1,result.quantity))} ${material}`);if(!r?.accepted)this.block(r?.message||'Could not start prerequisite gathering.');else{a.child={material,started:now};a.reason='Gathering prerequisite '+material+' before excavation.'}}
  }
  return false
 }
 chooseTool(type){const names=Object.keys(this.c.world.items()).filter(n=>new RegExp(`_(?:${type})$`).test(n));const order=['netherite','diamond','iron','stone','golden','wooden'];return names.sort((a,b)=>order.findIndex(x=>a.startsWith(x))-order.findIndex(x=>b.startsWith(x)))[0]||null}
 provision(now){
  const a=this.active,c=this.c,w=c.world
  if(a.request.kind==='support'){if((w.items().dirt||0)<(a.request.minimum||1)){if(!this.chooseTool('shovel')&&!this.needs(c.workshop.ensure('wooden_shovel',1,now),now))return;const shovel=this.chooseTool('shovel');if(shovel&&!this.needs(this.equip(shovel,now),now))return;if(!this.needs({state:'need',material:'dirt',quantity:64,reason:'Gathering 64 real dirt before climbing.'},now))return}if(!this.needs(c.workshop.hotbar('dirt',now),now))return;const name=a.request.name;this.last={state:'completed',reason:'Dirt supplies confirmed; resuming the requested follow.'};this.active=null;c.navigation.follow(name);return}
  if(w.gameMode!=='creative'){
   if(a.request.kind==='strip'&&!this.chooseTool('pickaxe')){const r=c.workshop.ensure('stone_pickaxe',1,now);if(!this.needs(r,now))return}
   if(a.request.kind!=='quarry'&&(w.items().dirt||0)<64){if(!this.needs({state:'need',material:'dirt',quantity:64,reason:'Gathering a real 64-dirt escape reserve.'},now))return}
  }
  if((w.items().dirt||0)>0&&!this.needs(c.workshop.hotbar('dirt',now),now))return
  if(!a.layout){try{a.layout=a.request.kind==='strip'?stripLayout(w.standPosition(),a.heading,a.request):quarryLayout(w.standPosition(),a.heading)}catch(e){this.block(e.message);return}}
  a.state='excavating';a.reason='Prerequisites verified. Starting observed excavation; every break and movement needs server evidence.';c.report(a.reason)
 }
 tick(now=Date.now()){
  const a=this.active;if(!a||now-a.lastAt<150||a.state==='blocked')return;a.lastAt=now
  const c=this.c,w=c.world,n=c.navigation
  if(n.isRespawning?.()||w.attributes['minecraft:health']===0||w.attributes['minecraft:health']>0&&w.attributes['minecraft:health']<=6||!w.editModeVerified){this.block('Excavation stopped on death, low health or unverified mode.');return}
  if(c.operations.pending)return
  if(c.resources.active)return
  if(a.child){if(c.resources.last?.state!=='completed'){this.block('Prerequisite gathering did not finish: '+(c.resources.last?.reason||'unconfirmed'));return}a.child=null}
  if(a.state==='approaching-workshop'){
   if(n.state==='stopped'||now-a.walk.started>25000){this.block('Workshop approach was not confirmed.');return}
   if(n.lastPoseAt>a.walk.poseAt&&dist(w.serverPosition,a.walk.goal)<.7){n.stop('',false);a.state=a.walk.resume;a.walk=null}return
  }
  if(a.state==='provision'){this.provision(now);return}
  if(a.state==='walking'){
   if(n.state==='stopped'||now-a.walk.started>20000){this.block('Mining step movement was not confirmed.');return}
   if(n.lastPoseAt>a.walk.poseAt&&dist(w.serverPosition,a.walk.goal)<.5){n.stop('',false);a.state='excavating';a.index++;a.oreCount=0;a.walk=null}return
  }
  if(a.state==='breaking'){
   if(n.mining.job)return
   if(n.mining.result!=='confirmed'){this.block(n.mining.reason||'The server did not confirm the excavation break.');return}
   a.breaks++;a.pickupAt=now;a.state='collecting';return
  }
  if(a.state==='collecting'){
   const names=expectedResourceDrops(w,a.target),gained=names.some(name=>(w.items()[name]||0)>(a.inventoryBefore[name]||0))
   if(gained||w.gameMode==='creative'){if(gained)a.pickups++;a.state='excavating';return}
   const noDrop=(w.registry.blocksByName[a.target.name]?.drops||[]).length===0,fragile=/grass|fern|flower|leaves|vine|sapling|dead_bush|mushroom/.test(a.target.name);if(now-a.pickupAt>1800&&(noDrop||fragile)&&![...w.drops.values()].some(d=>names.includes(d.name))){a.state='excavating';a.reason='Server break confirmed; no collectible drop was observed for this plant/empty-drop block.';return}
   if(n.pickup.target)return
   if(now-a.pickupAt>10000){this.block('A broken block/drop was not confirmed in inventory. Work stopped to keep resources from being left behind.');return}
   if(now-a.pickupAt>=500&&[...w.drops.values()].some(d=>names.includes(d.name))){if(n.job)n.stop('',false);n.collectNearby({names})}return
  }
  if(a.state==='preparing-home'){
   if(a.request.kind==='quarry'){
    const sites=c.workshop.records.filter(p=>p.name==='tree_site'&&p.dimension===w.dimension)
    if(sites.length<2){if(!c.resources.active){const r=c.resources.start('gather 2 trees');if(!r?.accepted)this.block(r?.message||'Could not find the second tree for storage.');else a.child={material:'tree sites'}}return}
    a.home={x:sites[1].x,y:sites[1].y,z:sites[1].z};const ground=[];for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=-4;dy<=1;dy++){const p={x:a.home.x+dx,y:a.home.y+dy,z:a.home.z+dz};if(w.walkable(p))ground.push(p)}ground.sort((p,q)=>Math.hypot(p.x-sites[1].x,p.z-sites[1].z)-Math.hypot(q.x-sites[1].x,q.z-sites[1].z));if(ground[0])a.home=ground[0]
    const table=c.workshop.known('crafting_table').find(p=>Math.hypot(p.x-a.home.x,p.z-a.home.z)<5)
    if(!table){if(!this.needs(c.workshop.ensure('crafting_table',1,now),now))return;this.needs(c.workshop.place('crafting_table',a.home,now),now);return}
   }
   a.state='storage';a.storeMaterials=Object.keys(w.items()).filter(name=>!/_pickaxe$|_axe$|_shovel$|sword$|_helmet$|_chestplate$|_leggings$|_boots$/.test(name)&&!['crafting_table','chest'].includes(name));return
  }
  if(a.state==='storage'){
   const material=a.request.kind==='quarry'?a.request.material:a.storeMaterials?.[0]
   if(!material){this.finish();return}
   if((w.items()[material]||0)===0){if(c.workshop.depositing?.material===material)c.workshop.depositing=null;if(a.request.kind==='quarry'){this.finish('Server confirms the requested resource has been deposited at the second-tree storage site.');return}a.storeMaterials.shift();return}
   const r=c.workshop.deposit(material,{minimum:a.request.kind==='quarry'?640:1,double:a.request.kind==='strip',home:a.home,now})
   if(r.state==='ready'){if(a.request.kind==='strip'){a.storeMaterials.shift();return}this.finish();return}
   this.needs(r,now);return
  }
  if(a.state!=='excavating'||n.job)return
  if(a.stopWhenObserved&&w.scan(a.stopWhenObserved,{range:8,maxFound:1})?.found.length){this.finish('Observed the requested structure; stopping excavation for the next verified action.');return}
  if(a.stopWhen&&(w.items()[a.stopWhen.material]||0)>=a.stopWhen.quantity){this.finish('Requested resource amount confirmed in server inventory.');return}
  if(a.request.kind==='quarry'&&(w.items()[a.request.material]||0)>=640){a.state='preparing-home';a.reason='640 real requested items reached; preparing tree-two storage.';return}
  if(a.index>=a.layout.points.length){
   if(a.request.kind==='strip'){a.state='preparing-home';a.storeMaterials=Object.keys(w.items()).filter(name=>!/_pickaxe$|_axe$|_shovel$|sword$|_helmet$|_chestplate$|_leggings$|_boots$/.test(name)&&!['crafting_table','chest'].includes(name));a.home=w.standPosition();a.reason='Mining pass finished. Preparing a server-confirmed double chest for collected materials.';return}
   if(w.gameMode==='creative'){this.finish('Creative excavation area completed. Creative breaks do not generate Survival drops; no 640-item deposit was invented.');return}
   const previous=a.layout,last=previous.points.at(-1).cell,lateral=previous.lateral,heading={x:-previous.heading.x,z:-previous.heading.z};a.layout=quarryLayout({x:last.x+lateral.x,y:last.y,z:last.z+lateral.z},heading,{descend:false,lateral});a.index=0;a.reason='Continuing into the adjacent 15×15 area until 640 requested items are confirmed.';return
  }
  const point=a.layout.points[a.index]
  let targets=point.clear.filter(p=>!w.airAt(p)),opportunistic=false
  if(!targets.length&&a.request.kind==='strip'&&(a.oreCount||0)<16){const visible=w.scan(null,{range:4,maxFound:16,filter:ore})?.found||[],candidate=visible.find(p=>p.distance<=4&&!a.oreVisited.has(`${p.x},${p.y},${p.z}`)&&p.y>=w.standPosition().y);if(candidate){targets=[candidate];opportunistic=true}}
  if(targets.some(p=>!w.block(p)||!w.block(p,1))){a.unknownAt??=now;w.requestNearby(n.client);a.reason='Requesting missing terrain before digging.';if(now-a.unknownAt>5000)this.block('Excavation terrain could not be verified after five seconds.');return}a.unknownAt=null
  if(targets.length){
   const p=targets.find(p=>w.visible(p))||targets[0],b=w.block(p)
   if(w.gameMode!=='creative'){
    const choices=[...w.inventory.values()].filter(i=>i?.count&&b.canHarvest?.(i.network_id)).map(i=>({name:w.registry.items[i.network_id]?.name,time:b.digTime(i.network_id,false,false,false,[],{})})).filter(x=>x.name&&Number.isFinite(x.time)).sort((a,b)=>a.time-b.time)
    const tool=choices[0]?.name
    if(tool&&!this.needs(this.equip(tool,now),now))return
    if(!tool&&!b.canHarvest?.(null)){const tiers=['wooden_pickaxe','stone_pickaxe','iron_pickaxe','diamond_pickaxe','netherite_pickaxe'],required=tiers.find(name=>b.canHarvest?.(w.registry.itemsByName[name]?.id));if(required){this.needs(c.workshop.ensure(required,1,now),now);return}}
   }
   const assessment=miningAssessment(w,p,{explicit:true,allowAbove:true,allowLowerForward:true})
   if(!assessment.ok||w.gameMode==='survival'&&!assessment.canHarvest){if(opportunistic){a.oreVisited.add(`${p.x},${p.y},${p.z}`);a.oreCount++;a.reason='Skipping an ore that cannot currently be reached/collected safely.';return}this.block(assessment.reason||'The real held tool cannot collect this block.');return}
   a.target={...p,name:b.name};a.inventoryBefore={...w.items()};const r=n.mine(p,{allowAbove:true,allowLowerForward:true});if(!r.accepted){this.block(r.message);return}if(opportunistic){a.oreVisited.add(`${p.x},${p.y},${p.z}`);a.oreCount++}a.state='breaking';a.reason='Mining '+b.name+' in front of the bot; awaiting server break and pickup.';return
  }
  if(dist(w.serverPosition,point.cell)<.3){a.index++;return}
  if(!w.walkable(point.cell)){this.block('The next mining cell has no safe known support; no blind digging or straight-down fall was attempted.');return}
  const r=n.walk(point.cell);if(!r.accepted){this.block(r.message);return}a.walk={goal:point.cell,poseAt:n.lastPoseAt,started:now};a.state='walking'
 }
 finish(reason='Mining and requested server-confirmed storage completed.') {this.last={...this.snapshot(),state:'completed',reason};this.active=null;this.c.workshop.close();this.c.report(reason)}
}
