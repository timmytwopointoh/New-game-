// Vanilla Overworld home/sleep loop. All observation comes from received
// Bedrock state; no invented bed, time skip, spawnpoint, items or task success.
import {insidePlot} from './companion-plot.js'
import {bedAcquisition,findBedFootprint} from './home-architecture.js'
import {constructionExposure} from './construction-guard.js'
const bed=n=>/^(?:[a-z]+_)?bed$/.test(String(n||'').replace(/^minecraft:/,''))
const tickPhase=t=>{
 if(!Number.isFinite(t))return 'unknown'
 const n=((Math.floor(t)%24000)+24000)%24000
 return n>=12500&&n<23000?'night':n>=11000&&n<12500?'dusk':'day'
}
const flat=(a,b)=>a&&b?Math.hypot(a.x-b.x,a.z-b.z):Infinity
const coords=p=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
export class HomeRoutine {
 constructor(controller){this.c=controller;this.plot=null;this.reset(false)}
 reset(keepPlot=true){
  if(!keepPlot)this.plot=null
  this.serverTime=null;this.serverTimeAt=0;this.phase='unknown';this.lastPhase='unknown';this.lastSleepNotice=0
  this.bedPosition=null;this.bedVerified=false;this.spawnConfirmed=false;this.sleepAttempted=false;this.asleepConfirmed=false
  this.pendingBed=null;this.pendingUse=null;this.lastAct=0;this.lastReturn=0;this.lastReport=0;this.resume=null
  this.state=this.plot?'home-assigned':'no-home';this.reason=this.plot?'Home assigned; bed not yet verified.':'No owner-assigned home.'
 }
 setPlot(plot){this.plot=plot;this.reset(true)}
 onServerTime(packet,now=Date.now()){
  if(!Number.isFinite(packet?.time))return
  this.serverTime=packet.time;this.serverTimeAt=now
  this.lastPhase=this.phase;this.phase=tickPhase(this.serverTime)
  if(this.phase==='day'&&this.lastPhase==='night'&&this.sleepAttempted&&this.asleepConfirmed){
   this.state='daytime';this.reason='Server clock returned to day after confirmed sleeping.'
  }
 }
 // Only call for verified server system messages, not ordinary player chat.
 onSystemText(packet,now=Date.now()){
  const type=String(packet?.type||'').toLowerCase()
  if(!['system','translation','whisper'].includes(type)||packet?.source_name)return
  const text=String(packet.message||'').toLowerCase().slice(0,200)
  if(/\b(?:players? sleeping|players? (?:are|is) trying to sleep|players? (?:are|is) in bed|\d+\s*\/\s*\d+ players sleeping)\b/.test(text))this.lastSleepNotice=now
  if(this.pendingUse&&/respawn point set|spawn point set/.test(text)&&now-this.pendingUse.started<12000){
   this.spawnConfirmed=true;this.reason='Server reported that the player respawn point was set at the interacted home bed.'
  }
  if(this.pendingUse&&/sleeping|you are now sleeping|you are in bed/.test(text)&&now-this.pendingUse.started<12000&&this.phase==='night'){
   this.asleepConfirmed=true;this.reason='Server sleep message observed; waiting for daytime.'
  }
 }
 observedBed(){
  const c=this.c,w=c.world
  if(!this.plot||w.dimension!==0||!w?.standPosition?.())return null
  const seen=w.scan(null,{range:8,maxFound:128,filter:bed}).found
  return seen.find(p=>insidePlot(this.plot,p,0))||null
 }
 inspect(){
  if(!this.plot)return {accepted:false,queued:false,message:'Owner has not designated home land.'}
  const w=this.c.world
  if(w.dimension!==0)return {accepted:false,queued:false,message:'Beds cannot be used in this dimension. Home routine runs only in the Overworld.'}
  const discovered=this.observedBed()
  if(discovered){this.bedPosition={x:discovered.x,y:discovered.y,z:discovered.z};this.bedVerified=true}
  const supplies=bedAcquisition(w.items?.()||{},{recipesReceived:(this.c.crafting?.recipes?.length||0)>0})
  return {accepted:true,queued:false,message:discovered?'A real bed was observed inside owner land. Spawn and sleeping still require verified interaction.':
   'No home bed observed. '+(supplies.missing.length?supplies.missing.map(x=>x.count+' '+x.material).join(', ')+' still needed.':'Bed can be crafted or placed after checking the server recipe and clear two-block footprint.'),
   bed:this.bedPosition,bedConfirmed:this.bedVerified,spawnConfirmed:this.spawnConfirmed,inventory: supplies,phase:this.phase}
 }
 // Does not fabricate sheep drops. Workshop.ensure uses only observed
 // inventory and server-supplied crafting recipes; if wool is unavailable,
 // the report names the missing prerequisite instead of inventing shearing.
 craftBed(now=Date.now()){
  if(!this.plot||this.c.world.dimension!==0)return {accepted:false,queued:false,message:'Set an Overworld home plot before making its bed.'}
  const c=this.c,w=c.world,plan=bedAcquisition(w.items?.()||{},{recipesReceived:(c.crafting.recipes?.length||0)>0})
  if(plan.phase==='bed-in-inventory')return {accepted:true,queued:false,message:'Bed is already in confirmed inventory: '+plan.item+'. Place it inside the plot.',item:plan.item}
  if(plan.missing.length)return {accepted:false,queued:false,message:'Need '+plan.missing.map(x=>x.count+' '+x.material).join(', ')+'. Vanilla options: shear sheep for matching wool or use four string per wool; gather logs for planks. The bot cannot yet shear sheep reliably, so owner help or a verified gathering executor may be required.',plan}
  if(!plan.canCraft)return {accepted:false,queued:false,message:'Waiting for the correct Bedrock server recipe before attempting to craft '+plan.item+'.',plan}
  const r=c.workshop.ensure(plan.item,1,now)
  return {...r,accepted:r.state!=='blocked'&&r.state!=='need',queued:r.state==='working',message:r.reason||('Crafting '+plan.item+' using actual received inventory and recipe.'),plan}
 }
 placeBed(now=Date.now()){
  const c=this.c,w=c.world,n=c.navigation
  if(!this.plot||w.dimension!==0||!c.connection.spawned||!w.inventoryKnown||!w.position||!w.editModeVerified)return {accepted:false,queued:false,message:'Need an observed, grounded Overworld player and assigned home land before bed placement.'}
  if(n.job||n.mining.job||n.building.job||n.pendingUse)return {accepted:false,queued:false,message:'Another action is in progress; Stop or finish it before placing a bed.'}
  if(this.observedBed())return {accepted:true,queued:false,message:'A bed is already visible inside the assigned plot. Use it to set spawn; do not place another automatically.'}
  const supply=bedAcquisition(w.items(),{recipesReceived:true})
  if(supply.phase!=='bed-in-inventory')return {accepted:false,queued:false,message:'Get a crafted bed into confirmed inventory first.',plan:supply}
  const site=findBedFootprint(w,this.plot)
  if(!site)return {accepted:false,queued:false,message:'No nearby server-observed two-block supported bed location inside the plot. Approach a clear floor area and scan again.'}
  const action=()=>{
   const available=[...w.inventory].find(([slot,item])=>slot>=0&&slot<9&&item?.count>0&&w.registry?.items?.[item.network_id]?.name===supply.item)
   if(!available)return {accepted:false,queued:false,message:'Move the verified bed item into your hotbar first; placement not sent.'}
   const [slot,item]=available
   if(slot!==w.selectedSlot)return {accepted:false,queued:false,message:'Select hotbar slot '+(slot+1)+' with '+supply.item+' before placement.'}
   const below={...site.foot,y:site.foot.y-1}
   const anchor=w.block(below)
   if(!anchor||!anchor.shapes?.length||!w.airAt(site.foot)||!w.airAt(site.head))return {accepted:false,queued:false,message:'Bed footprint or support changed. No placement attempted.'}
   const tx={legacy:{legacy_request_id:0,legacy_transactions:null},transaction_type:'item_use',actions:[],transaction_data:{
    action_type:'click_block',trigger_type:'player_input',block_position:below,face:1,hotbar_slot:slot,hand:'main_hand',
    held_item:item,player_pos:{...w.position,y:w.position.y-1.62},click_pos:{x:.5,y:1,z:.5},
    block_runtime_id:w.runtimeIdAt(below)>>>0,client_prediction:'success',client_cooldown_state:'off'}}
   if(!n.queueUse(tx,{x:below.x+.5,y:below.y+1,z:below.z+.5}))
    return {accepted:false,queued:false,message:'Another item-use action is pending; no bed placement sent.'}
   this.pendingBed={foot:site.foot,head:site.head,item:supply.item,slot,before:item.count,started:now,
    footVersion:w.blockVersion(site.foot),headVersion:w.blockVersion(site.head)}
   this.state='placing-bed';this.reason='Bed interaction queued; both head and foot must be observed before it is accepted.'
   return {accepted:true,queued:true,message:this.reason}
  }
  return c.companion.check('build',{shape:'bed',origin:site.foot,material:supply.item},[site.foot,site.head],action)
 }
 useBed(now=Date.now()){
  const c=this.c,w=c.world,n=c.navigation
  if(!this.plot||w.dimension!==0)return {accepted:false,queued:false,message:'Beds are only safe to use in the assigned Overworld home.'}
  const observed=this.observedBed()
  if(!observed)return {accepted:false,queued:false,message:'No observed bed in the plot. Acquire and place one first.'}
  const pos={x:observed.x,y:observed.y,z:observed.z}
  if(!w.position||Math.hypot(w.position.x-pos.x-.5,w.position.y-pos.y-.5,w.position.z-pos.z-.5)>3)
   return {accepted:false,queued:false,message:'Approach within three blocks of the home bed before using it.'}
  if(n.job||n.pendingUse)return {accepted:false,queued:false,message:'Finish the current action before interacting with the bed.'}
  if(this.pendingUse&&now-this.pendingUse.started<20000)return {accepted:false,queued:false,message:'Waiting for server bed acknowledgement.'}
  // Bed use is a block interaction; sleep/respawn success is NOT predicted
  // from this packet, and SetSpawnPosition is not treated as bed confirmation.
  try{c.connection.client.queue('player_action',{runtime_entity_id:BigInt(w.entityId),action:'start_sleeping',position:pos,result_position:pos,face:1})}
  catch{return {accepted:false,queued:false,message:'Bed interaction packet failed; no sleep or spawn point was confirmed.'}}
  this.pendingUse={started:now,at:pos,phase:this.phase}
  this.sleepAttempted=this.phase==='night';this.state='bed-use-requested'
  return {accepted:true,queued:true,message:'Bed interaction requested. Waiting for actual server sleep or respawn point confirmation; night is not assumed skipped.'}
 }
 tick(now=Date.now()){
  if(now-this.lastAct<1000)return;this.lastAct=now
  const c=this.c,w=c.world,n=c.navigation
  if(this.pendingBed){
   const p=this.pendingBed,a=w.block(p.foot),b=w.block(p.head)
   const changed=w.blockVersion(p.foot)>p.footVersion&&w.blockVersion(p.head)>p.headVersion
   if(changed&&bed(a?.name)&&bed(b?.name)){
    this.bedPosition={...p.foot};this.bedVerified=true;this.state='bed-placed'
    this.reason='Both bed blocks confirmed by server. Spawn point not yet confirmed.'
    this.pendingBed=null;c.report?.(this.reason)
   }else if(now-p.started>8000){this.pendingBed=null;this.state='bed-unknown';c.report?.('Bed placement not confirmed by the server. Inspect both cells and inventory; no duplicate bed was placed automatically.')}
  }
  if(!this.plot||w.dimension!==0||!c.connection.spawned||!w.movementVerified)return
  if(!this.serverTimeAt||now-this.serverTimeAt>180000)return
  if(this.phase==='day'){
   if(this.resume&&!n.job){
    const saved=this.resume;this.resume=null
    // Safe, idempotent player-follow only. Mining/building tasks require new consent.
    if(saved.kind==='follow')n.follow(saved.name)
   }
   return
  }
  if(this.phase!=='dusk'&&this.phase!=='night')return
  if(now-this.lastReturn<6000)return
  const at=w.standPosition(),home=this.plot.center
  if(!coords(at)||!coords(home))return
  const d=flat(at,home)
  if(d>4&&d<=48&&this.lastReturn===0){
   if(n.job?.kind==='follow')this.resume={kind:'follow',name:n.job.name}
   else this.resume=null
   if(n.job)n.stop('Nighttime safety: returning to assigned home.',false)
   const dest={x:home.x,y:at.y,z:home.z}
   if(w.walkable(dest)){
    const result=n.walk(dest,{allowMining:false,maxDrop:1})
    if(result.accepted){this.lastReturn=now;this.state='returning-home';this.reason='Returning home using an observed dry route before night.'}
   }else{this.lastReturn=now;this.state='home-route-blocked';this.reason='No safe confirmed route home; staying sheltered and requesting terrain.'}
   return
  }
  if(d<=4&&this.phase==='night'&&this.lastSleepNotice>0&&now-this.lastSleepNotice<30000&&now-this.lastReturn>=6000){
   const result=this.useBed(now);this.lastReturn=now
   if(result.accepted)c.report?.(result.message)
  }
 }
 snapshot(){return {state:this.state,phase:this.phase,reason:this.reason,homeAssigned:!!this.plot,bedObserved:!!this.bedPosition,
   bedPlacementConfirmed:this.bedVerified,spawnConfirmed:this.spawnConfirmed,sleepAttempted:this.sleepAttempted,
   sleepConfirmed:this.asleepConfirmed,serverTimeKnown:!!this.serverTimeAt,nightNoticeReceived:this.lastSleepNotice>0,
   returnHomePending:!!this.resume,bedPending:!!this.pendingBed}}
}
export {tickPhase}
