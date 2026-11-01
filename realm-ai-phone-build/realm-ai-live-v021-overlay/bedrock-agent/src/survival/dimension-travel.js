import {Building} from './building.js'
import {placementActions} from './building.js'
import {Pillaring} from './pillaring.js'
const activePortal=n=>/^(?:portal|nether_portal|end_portal)$/.test(n||'')
export function materialDimension(name){
 if(/^(?:end_stone|end_stone_bricks|purpur_|chorus_|elytra|dragon_|shulker_)/.test(name)||['end_rod','end_portal_frame'].includes(name))return 2
 if(/^(?:nether_|netherrack|ancient_debris|blackstone|basalt|gilded_blackstone|crimson_|warped_|quartz_ore|netherite_|soul_sand|soul_soil|glowstone|magma|blaze_)/.test(name))return 1
 return 0
}
export function portalFrame(origin,axis='x'){
 const positions=[]
 for(let y=0;y<5;y++)for(let i=0;i<4;i++)if(y===0||y===4||i===0||i===3)positions.push({x:origin.x+(axis==='x'?i:0),y:origin.y+y,z:origin.z+(axis==='z'?i:0)})
 return {positions,inside:{x:origin.x+(axis==='x'?1:0),y:origin.y+1,z:origin.z+(axis==='z'?1:0)},bottom:{x:origin.x+(axis==='x'?1:0),y:origin.y,z:origin.z+(axis==='z'?1:0)}}
}
export class DimensionTravel{
 constructor(c){this.c=c;this.reset()}
 reset(){this.target=null;this.state='idle';this.reason='';this.portal=null;this.frame=null;this.frameIndex=0;this.walk=null;this.needed=null;this.started=0;this.eyeSearch=null;this.eyePending=null;this.endWaitAt=null;this.entryVy=undefined;this.ignitedAt=null;this.enteredAt=null;this.equipUntil=0}
 cancel(reason='Dimension travel interrupted.'){this.state='interrupted';this.reason=reason;this.target=null;this.c.navigation.portalControl=null;this.c.navigation.pendingFlags.push('stop_sneaking')}
 start(target,now=Date.now()){if(![0,1,2].includes(target))return false;this.reset();this.target=target;this.started=now;this.state='search';this.reason='Checking known active portals before preparing a new one.';return true}
 need(material,quantity,reason){this.needed={material,quantity};this.reason=reason;this.state='preparing';return this.needed}
 candidates(){const w=this.c.world;return w.scan(null,{range:8,maxFound:64,filter:n=>activePortal(n)})?.found||[]}
 findInactive(){const w=this.c.world,near=w.scan('obsidian',{range:8,maxFound:64})?.found||[];for(const p of near)for(const axis of ['x','z'])for(let shift=0;shift<4;shift++){
 const origin={x:p.x-(axis==='x'?shift:0),y:p.y,z:p.z-(axis==='z'?shift:0)},frame=portalFrame(origin,axis)
 frame.positions=frame.positions.filter(q=>!(q.y===origin.y||q.y===origin.y+4)||axis==='x'&&q.x!==origin.x&&q.x!==origin.x+3||axis==='z'&&q.z!==origin.z&&q.z!==origin.z+3)
 if(frame.positions.every(q=>w.block(q)?.name==='obsidian')&&[0,1].every(dx=>[0,1,2].every(dy=>w.airAt({x:frame.inside.x+(axis==='x'?dx:0),y:frame.inside.y+dy,z:frame.inside.z+(axis==='z'?dx:0)}))))return frame
 }return null}
 tick(now=Date.now()){
  const c=this.c,w=c.world,n=c.navigation;this.lastTickAt=now;this.needed=null
  if(this.target===null||['blocked','interrupted','completed'].includes(this.state))return
  if(w.dimension===this.target){this.state='completed';this.reason='Server confirmed the requested dimension.';n.portalControl=null;return}
  if(now-this.started>180000){this.state='blocked';this.reason='Portal preparation/travel timed out without a confirmed dimension change.';return}
  if(n.pillar||this.state==='scaffold-edge')return
  if(this.state==='walking'){
   if(n.lastPoseAt>this.walk.poseAt&&Math.hypot(w.serverPosition.x-this.walk.goal.x-.5,w.serverPosition.z-this.walk.goal.z-.5)<.5){n.stop('',false);this.state=this.walk.resume;this.walk=null}else if(now-this.walk.started>20000){this.state='blocked';this.reason='Portal approach was not server-confirmed.'}return
  }
  if(this.state==='placing'){
   if(n.building.job)return
   if(n.building.state!=='confirmed'){this.state='blocked';this.reason=n.building.reason||'Portal-frame block was not confirmed.';return}
   this.frameIndex++;this.state='frame'
  }
  if(n.job)return
  if(this.state==='entering')return
  const portals=this.candidates().filter(p=>this.target===2?p.name==='end_portal':p.name!=='end_portal')
  if(portals.length){this.portal={...portals.sort((a,b)=>a.distance-b.distance)[0]};for(let i=0;i<4&&activePortal(w.block({...this.portal,y:this.portal.y-1})?.name);i++)this.portal.y--;this.state='approach'}
  if(this.state==='entering')return
  if(this.state==='approach'&&this.portal){
   const p=this.portal
   if(Math.hypot(p.x+.5-w.position.x,p.z+.5-w.position.z)>3){if(this.approach(p,now,'approach'))return;this.state='blocked';this.reason='No observed safe route to the portal.';return}
   this.state='entering';this.enteredAt=now;n.portalControl=time=>this.control(time);this.reason='Entering the observed active portal with normal movement; waiting for server dimension change.';return
  }
  if(this.target===2){
   const frames=w.scan('end_portal_frame',{range:8,maxFound:16})?.found||[]
   if(!frames.length){this.locateStronghold(now);return}
   if(this.eyePending){const p=this.eyePending,b=w.block(p.position);if(b?.getProperties?.().end_portal_eye_bit&&(w.gameMode==='creative'||w.inventoryProtocol.consumed(p.slot,p.before))){this.eyePending=null}else{if(now-p.started>5000){this.state='blocked';this.reason='End-frame eye placement was not server-confirmed.'}return}}
   const empty=frames.find(p=>w.block(p)?.getProperties?.().end_portal_eye_bit===0)
   if(!empty){this.endWaitAt??=now;if(now-this.endWaitAt>5000){this.state='blocked';this.reason='Observed eyes are filled, but no active End portal was confirmed; verify all 12 frame positions and orientations.'}return}
   if(!w.items().ender_eye)return this.need('ender_eye',1,'A visible End-frame socket needs a real Eye of Ender.')
   const supply=c.workshop.hotbar('ender_eye',now);if(supply.state!=='ready'){this.reason=supply.reason;return}
   const slot=[...w.inventory].find(([s,i])=>s<9&&w.registry.items[i.network_id]?.name==='ender_eye')?.[0]
   if(w.selectedSlot!==slot){c.handle(`select slot ${slot+1}`);this.equipUntil=now+150;return}if(now<(this.equipUntil||0))return
   const hit={x:empty.x+.5,y:empty.y+.8125,z:empty.z+.5}
   if(Math.hypot(hit.x-w.position.x,hit.y-w.position.y,hit.z-w.position.z)>4){if(this.approach(empty,now,'search'))return;this.state='blocked';this.reason='No safe reachable End-frame socket.';return}
   const held=w.inventory.get(slot),tx={legacy:{legacy_request_id:0,legacy_transactions:null},transaction_type:'item_use',actions:placementActions(slot,held,w.gameMode==='creative'),transaction_data:{action_type:'click_block',trigger_type:'player_input',block_position:{x:empty.x,y:empty.y,z:empty.z},face:1,hotbar_slot:slot,hand:'main_hand',held_item:held,player_pos:{...w.position,y:w.position.y-1.62},click_pos:{x:.5,y:.8125,z:.5},block_runtime_id:w.runtimeIdAt(empty)>>>0,client_prediction:'success',client_cooldown_state:'off'}}
   if(n.queueUse(tx,hit))this.eyePending={position:{...empty},slot,before:w.inventoryProtocol.baseline(slot),started:now}
   return
  }
  if(this.target===0){this.state='blocked';this.reason='No observed return portal; explore and verify one before travelling.';return}
  this.frame||=this.findInactive()
  if(!this.frame){
   if((w.items().obsidian||0)<14)return this.need('obsidian',14,'Need 14 real obsidian blocks for a supported full portal frame, or an observed existing portal.')
   if((w.items().dirt||0)<3)return this.need('dirt',64,'Need real dirt for construction scaffolding.')
   const start=w.standPosition(),origin={x:start.x-1,y:start.y,z:start.z+2},frame=portalFrame(origin)
   if(!frame.positions.every(p=>w.airAt(p))){this.state='blocked';this.reason='No clear observed portal-frame footprint at the current site.';return}
   this.frame=frame;this.frameIndex=0;this.state='frame'
  }
  if(this.state!=='frame'&&this.frame.positions.some(p=>w.block(p)?.name!=='obsidian'))this.state='frame'
  if(this.state==='frame'){
   const p=this.frame.positions[this.frameIndex]
   if(!p){if(this.scaffoldBase&&Math.hypot(w.position.x-this.scaffoldBase.x,w.position.z-this.scaffoldBase.z)>.01){this.edge(this.scaffoldBase,'ignite');return}this.state='ignite'}
   else if(w.block(p)?.name==='obsidian'){this.frameIndex++;return}
   else{
    const supply=c.workshop.hotbar('obsidian',now);if(supply.state!=='ready'){if(supply.state==='need')return this.need('obsidian',14,supply.reason);this.reason=supply.reason;return}
    if(w.position.y<=p.y+.02){const rise=Math.ceil(p.y+.1-w.position.y);if(rise>4){this.state='blocked';this.reason='Portal frame needs a closer observed scaffold.';return}n.pillar=new Pillaring(n,rise);return}
    const check=new Building(w);if(check.begin({shape:'block',origin:p,material:'obsidian'}).accepted&&!check.anchor(p)){const base={...w.position};for(const [dx,dz] of [[.52,0],[-.52,0],[0,.52],[0,-.52]]){const eye={x:base.x+dx,y:base.y,z:base.z+dz};if(w.grounded(eye)&&w.clearBody(eye)&&check.anchor(p,eye)){this.scaffoldBase||=base;this.edge(eye,'frame');return}}}
    const result=n.build({shape:'block',origin:p,material:'obsidian'});if(!result.accepted){this.state='blocked';this.reason=result.message;return}this.state='placing';return
   }
  }
  if(this.state==='preparing'||this.state==='search')this.state='ignite'
  if(this.state==='ignite'){
   if(!w.items().flint_and_steel)return this.need('flint_and_steel',1,'Need a real flint-and-steel item to ignite the observed frame.')
   const supply=c.workshop.hotbar('flint_and_steel',now);if(supply.state!=='ready'){this.reason=supply.reason;return}
   const slot=[...w.inventory].find(([s,i])=>s<9&&w.registry.items[i.network_id]?.name==='flint_and_steel')?.[0]
   if(w.selectedSlot!==slot){c.handle(`select slot ${slot+1}`);this.equipUntil=now+150;return}if(now<(this.equipUntil||0))return
   const b=this.frame.bottom,hit={x:b.x+.5,y:b.y+1,z:b.z+.5}
   if(Math.hypot(hit.x-w.position.x,hit.y-w.position.y,hit.z-w.position.z)>4){if(this.approach(this.frame.inside,now,'ignite'))return;this.state='blocked';this.reason='Cannot safely approach the frame for ignition.';return}
   if(this.ignitedAt){if(now-this.ignitedAt>5000){this.state='blocked';this.reason='The server did not confirm a portal after ignition.'}return}
   const held=w.inventory.get(slot),tx={legacy:{legacy_request_id:0,legacy_transactions:null},transaction_type:'item_use',actions:[],transaction_data:{action_type:'click_block',trigger_type:'player_input',block_position:b,face:1,hotbar_slot:slot,hand:'main_hand',held_item:held,player_pos:{...w.position,y:w.position.y-1.62},click_pos:{x:.5,y:1,z:.5},block_runtime_id:w.runtimeIdAt(b)>>>0,client_prediction:'success',client_cooldown_state:'off'}}
   if(n.queueUse(tx,hit))this.ignitedAt=now
  }
 }
 locateStronghold(now){
  const c=this.c,w=c.world,n=c.navigation
  if(this.eyeSearch){
   const s=this.eyeSearch,signals=[...w.entities].filter(([id,e])=>/(?:eye_of_ender|ender_eye)/.test(e.type||'')&&!s.oldIds.has(id))
   const signal=signals[0]?.[1];if(signal?.position)s.last={...signal.position}
   if(now-s.started<2500)return
   if(!s.last){if(now-s.started>6000){this.state='blocked';this.reason='No server-observed Eye of Ender signal after use; no stronghold coordinate was invented.'}return}
   const target={x:Math.floor(s.last.x),y:w.standPosition().y,z:Math.floor(s.last.z)}
   if(Math.hypot(s.last.x-w.position.x,s.last.z-w.position.z)<2&&s.last.y<w.position.y-3){this.needed={searchDepth:Math.max(-54,Math.min(w.standPosition().y-1,Math.floor(s.last.y)-1)),material:'end_portal_frame',quantity:1};this.reason='Observed Eye signal points down; prepare an observed staircase search, never a straight-down shaft.';this.eyeSearch=null;return}
   if(this.approach(target,now,'search')){this.eyeSearch=null;return}
   this.state='blocked';this.reason='The observed Eye signal has no safe loaded approach yet.';return
  }
  if(!w.items().ender_eye)return this.need('ender_eye',1,'Need a real Eye of Ender to locate a stronghold; none has been observed nearby.')
  const supply=c.workshop.hotbar('ender_eye',now);if(supply.state!=='ready'){this.reason=supply.reason;return}
  const slot=[...w.inventory].find(([s,i])=>s<9&&w.registry.items[i.network_id]?.name==='ender_eye')?.[0]
  if(w.selectedSlot!==slot){c.handle(`select slot ${slot+1}`);this.equipUntil=now+150;return}if(now<(this.equipUntil||0))return
  const held=w.inventory.get(slot),p=w.standPosition(),tx={legacy:{legacy_request_id:0,legacy_transactions:null},transaction_type:'item_use',actions:placementActions(slot,held,w.gameMode==='creative'),transaction_data:{action_type:'click_air',trigger_type:'player_input',block_position:p,face:0,hotbar_slot:slot,hand:'main_hand',held_item:held,player_pos:{...w.position,y:w.position.y-1.62},click_pos:{x:0,y:0,z:0},block_runtime_id:0,client_prediction:'success',client_cooldown_state:'off'}}
  if(n.queueUse(tx)){this.eyeSearch={started:now,oldIds:new Set(w.entities.keys()),last:null};this.reason='Used an Eye of Ender; waiting for its actual server-observed flight direction.'}
 }
 edge(target,resume){
  this.state='scaffold-edge';const n=this.c.navigation,w=this.c.world,began=this.lastTickAt||Date.now();let first=true
  n.portalControl=time=>{if(time-began>5000){n.portalControl=null;this.state='blocked';this.reason='Scaffold edge movement was not confirmed.';n.pendingFlags.push('stop_sneaking');return null}const p=w.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.005){n.pendingFlags.push('stop_sneaking');n.portalControl=null;this.state=resume;return null}const speed=Math.min(.035,d),next={x:p.x+dx/d*speed,y:p.y,z:p.z+dz/d*speed};if(!w.clearBody(next)||!w.grounded(next)){n.portalControl=null;this.state='blocked';this.reason='Scaffold edge lost known support.';n.pendingFlags.push('stop_sneaking');return null}w.position=next;n.lookAt({...target,y:p.y});const flags=['sneaking','sneak_down',...(first?['start_sneaking']:[])];first=false;return {active:true,delta:{x:next.x-p.x,y:0,z:next.z-p.z},move:{x:0,z:1},flags}}
 }
 approach(position,now,resume){
  const c=this.c,w=c.world,n=c.navigation,candidates=[]
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=-3;dy<=1;dy++){const p={x:position.x+dx,y:position.y+dy,z:position.z+dz};if(!w.walkable(p))continue;const r=n.routeTo(p,w.standPosition(),{maxDrop:3});if(r.ok)candidates.push({p,steps:r.path.length})}
  candidates.sort((a,b)=>Math.hypot(a.p.x-position.x,a.p.z-position.z)-Math.hypot(b.p.x-position.x,b.p.z-position.z)||a.steps-b.steps)
  for(const {p} of candidates){const r=n.walk(p,{maxDrop:3});if(r.accepted){this.walk={goal:p,poseAt:n.lastPoseAt,started:now,resume};this.state='walking';return true}}
  return false
 }
 control(now){
  const w=this.c.world,n=this.c.navigation,p=w.position,t=this.portal
  if(this.state!=='entering'||!t||w.dimension===this.target){n.portalControl=null;return null}
  if(now-this.enteredAt>12000){this.state='blocked';this.reason='Portal entry did not produce a server dimension change.';n.portalControl=null;return null}
  if(!activePortal(w.block(t)?.name)){this.state='blocked';this.reason='Observed portal changed before entry.';n.portalControl=null;return null}
  const dx=t.x+.5-p.x,dz=t.z+.5-p.z,d=Math.hypot(dx,dz),speed=Math.min(.08,d),needsJump=t.y>p.y-1.62+.1
  let jump=false;if(needsJump&&d<=1.25&&this.entryVy===undefined&&w.grounded()){this.entryVy=.42;jump=true}
  const vertical=this.entryVy===undefined?0:this.entryVy,next={x:p.x+(d?dx/d*speed:0),y:p.y+vertical,z:p.z+(d?dz/d*speed:0)}
  if(this.entryVy!==undefined)this.entryVy=(this.entryVy-.08)*.98
  if(this.entryVy<0&&p.y>=t.y+1.62&&next.y<t.y+1.62&&w.block({x:Math.floor(next.x),y:t.y-1,z:Math.floor(next.z)})?.shapes?.some(q=>q[0]===0&&q[2]===0&&q[3]===1&&q[4]===1&&q[5]===1)){next.y=t.y+1.62;this.entryVy=0}
  if(!w.clearBody(next,{allowPortal:true})){this.state='blocked';this.reason='Portal entry clearance changed or is unknown.';n.portalControl=null;return null}
  w.position=next;n.lookAt({x:t.x+.5,y:p.y,z:t.z+.5});return {active:true,delta:{x:next.x-p.x,y:0,z:next.z-p.z},move:{x:0,z:d>0?1:0},flags:jump?['start_jumping','jump_down','jumping']:this.entryVy!==undefined?['jumping']:[]}
 }
 snapshot(){return {target:this.target,state:this.state,reason:this.reason,needed:this.needed,confirmedFrameBlocks:this.frameIndex}}
}
