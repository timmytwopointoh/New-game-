// Inventory-backed placement only. No setblock, teleport, creative, crafting or local world prediction.
import {placementEvidence} from './obstacles.js'
const key=p=>`${p.x},${p.y},${p.z}`
const air=b=>b&&['air','cave_air','void_air'].includes(b.name)
const directions=[{x:0,y:-1,z:0,face:1},{x:0,y:1,z:0,face:0},{x:0,y:0,z:1,face:2},{x:0,y:0,z:-1,face:3},{x:1,y:0,z:0,face:4},{x:-1,y:0,z:0,face:5}]
const full=b=>b?.shapes?.some(q=>q.every((v,i)=>v===(i<3?0:1)))
const functional=/water|lava|sand$|gravel|powder|anvil|concrete_powder|chest|barrel|furnace|crafting_table|hopper|dispenser|dropper|bedrock|portal|command|structure|spawner|tnt|piston|observer|redstone|bed$|shulker|beehive|bee_nest|farmland|path$|ice|glass|leaves|copper_chest/
export function blueprint({shape,origin,width=1,height=1,material}){
 if(!['block','wall','floor','shelter'].includes(shape)||![origin?.x,origin?.y,origin?.z].every(Number.isSafeInteger)||Math.abs(origin.x)>30000000||Math.abs(origin.z)>30000000||origin.y< -64||origin.y>315)throw Error('Choose a supported build shape and whole block coordinates.')
 if(!Number.isSafeInteger(width)||width<1||width>6||!Number.isSafeInteger(height)||height<1||height>(shape==='wall'?3:6))throw Error('Executable walls: width 1–6, height 1–3. Floors: dimensions 1–6.')
 const positions=[];const add=(x,y,z)=>positions.push({x:origin.x+x,y:origin.y+y,z:origin.z+z})
 if(shape==='block')add(0,0,0)
 if(shape==='wall')for(let y=0;y<height;y++)for(let x=0;x<width;x++)add(x,y,0)
 if(shape==='floor')for(let z=0;z<height;z++)for(let x=0;x<width;x++)add(x,0,z)
 if(shape==='shelter'){
  for(let z=0;z<5;z++)for(let x=0;x<5;x++)add(x,0,z)
  for(let y=1;y<=3;y++)for(let z=0;z<5;z++)for(let x=0;x<5;x++)if((x===0||x===4||z===0||z===4)&&!(z===0&&x===2&&y<=2))add(x,y,z)
  for(let z=0;z<5;z++)for(let x=0;x<5;x++)add(x,4,z)
 }
 return {shape,origin:{...origin},material,positions}
}
export function overlapsBody(cell,eye){if(!eye)return false;const feet=eye.y-1.62;return eye.x+.3>cell.x&&eye.x-.3<cell.x+1&&eye.z+.3>cell.z&&eye.z-.3<cell.z+1&&feet+1.8>cell.y+.0001&&feet<cell.y+1-.0001}
export class Building{
 constructor(world,report=()=>{}){this.world=world;this.report=report;this.reset()}
 reset(){this.job=null;this.state='idle';this.reason='';this.placed=0;this.total=0}
 inventory(material){const w=this.world;return [...w.inventory].filter(([slot,item])=>slot>=0&&slot<9&&item?.count>0&&w.registry?.items?.[item.network_id]?.name===material)}
 check(){const w=this.world;if(!w.survivalVerified)return 'Server Survival mode and abilities must be verified.';if(w.abilityState?.effective.build===false)return 'The server has disabled this player’s building permission.';if(!w.enabled||!w.inventoryKnown||!w.position)return 'Join, enable view and receive inventory before building.';const h=w.attributes['minecraft:health'];if(h!==undefined&&h<=6)return 'Health is too low to build.';return null}
 begin(descriptor,now=Date.now()){
  if(this.job)return {accepted:false,queued:false,message:'A building job is already active.'}
  const denied=this.check();if(denied)return {accepted:false,queued:false,message:denied}
  let design;try{design=blueprint(descriptor)}catch(e){return {accepted:false,queued:false,message:e.message}}
  const w=this.world,definition=w.registry.blocksByName[design.material]
  if(!definition||functional.test(design.material)||!full(w.Block.fromStateId(definition.defaultState,0)))return {accepted:false,queued:false,message:'Choose a simple full solid block, such as dirt, cobblestone, stone or planks. Interactive, falling, partial and hazardous blocks are not supported.'}
  const stock=this.inventory(design.material).reduce((n,[,item])=>n+item.count,0)
  if(stock<design.positions.length)return {accepted:false,queued:false,message:`Need ${design.positions.length} ${design.material} in known hotbar stacks; have ${stock}. Put the required blocks in the hotbar first. No placement sent.`}
  if(Math.hypot(design.origin.x-w.position.x,design.origin.y-(w.position.y-1.62),design.origin.z-w.position.z)>12)return {accepted:false,queued:false,message:'Choose a build origin within 12 blocks.'}
  for(const p of design.positions){
   if(!w.airAt(p))return {accepted:false,queued:false,message:`Build target ${key(p)} is occupied or unknown. Existing blocks and snow are never replaced; choose a clear footprint.`}
   for(const d of directions){const q={x:p.x+d.x,y:p.y+d.y,z:p.z+d.z},b=w.block(q),fluid=w.block(q,1)
    if(!b||!fluid)return {accepted:false,queued:false,message:`Terrain beside ${key(p)} is unknown; look around before building.`}
    if(!air(fluid)||/water|lava|fire|powder_snow/.test(b.name))return {accepted:false,queued:false,message:'Fluid or hazardous terrain beside the footprint; placement refused.'}
    if(!air(b)&&placementEvidence(w,q,b).classification!=='natural-looking')return {accepted:false,queued:false,message:'Footprint is beside an existing build or protected block; choose a clear location.'}
   }
  }
  this.job={...design,remaining:design.positions.map(p=>({...p})),confirmed:new Set(),pending:null,started:now,lastProgress:now,approachAttempts:0};this.state='building';this.reason='Build prepared; each block requires server and inventory confirmation.';this.placed=0;this.total=design.positions.length
  return {accepted:true,queued:true,message:`Building ${design.shape}: ${this.total} ${design.material}, origin ${key(design.origin)}; +X width, +Z length. Existing blocks are preserved. Waiting for server-confirmed placements.`}
 }
 cancel(reason='Building stopped. Confirmed blocks remain in the Realm.') {if(this.job){this.state='interrupted';this.reason=`${reason} ${this.placed}/${this.total} placements confirmed.`;this.job=null;this.report(this.reason)}}
 anchor(target,eye=this.world.position){
  const w=this.world,j=this.job
  for(const d of directions){const p={x:target.x+d.x,y:target.y+d.y,z:target.z+d.z},b=w.block(p)
   if(!full(b)||!air(w.block(p,1)))continue
   if(!j.confirmed.has(key(p))&&placementEvidence(w,p,b).classification!=='natural-looking')continue
   const click={x:d.face===4?0:d.face===5?1:.5,y:d.face===0?0:d.face===1?1:.5,z:d.face===2?0:d.face===3?1:.5},hit={x:p.x+click.x,y:p.y+click.y,z:p.z+click.z}
   const outside=[eye.y<hit.y,eye.y>hit.y,eye.z<hit.z,eye.z>hit.z,eye.x<hit.x,eye.x>hit.x][d.face]
   if(!outside||Math.hypot(hit.x-eye.x,hit.y-eye.y,hit.z-eye.z)>4)continue
   // Only a visible face may be clicked; never interact through another block.
   const distance=Math.hypot(hit.x-eye.x,hit.y-eye.y,hit.z-eye.z),steps=Math.ceil(distance*10);let clear=true
   for(let i=1;i<steps;i++){const t=i/steps,q={x:Math.floor(eye.x+(hit.x-eye.x)*t),y:Math.floor(eye.y+(hit.y-eye.y)*t),z:Math.floor(eye.z+(hit.z-eye.z)*t)};if(key(q)===key(target))continue;const b=w.block(q);if(!b||b.shapes?.length){clear=false;break}}
   if(clear)return {position:p,face:d.face,click,hit}
  }
  return null
 }
 tick(now=Date.now(),routeTo=null){
  const j=this.job,w=this.world;if(!j)return {}
  const denied=this.check();if(denied){this.cancel(denied);return {}}
  if(now-j.started>180000){this.cancel('Build time limit reached.');return {}}
  if(j.pending){
   const p=j.pending,block=w.block(p.target),version=w.blockVersion(p.target),stack=w.inventory.get(p.slot)
   if(version>p.version&&block&&!air(block)&&block.name!==j.material){this.cancel('Server changed the target to another block; placement not confirmed.');return {}}
   if(version>p.version&&block?.name===j.material){
    p.blockConfirmed=true
    if(stack?.network_id===p.heldId&&stack.count===p.count-1||(p.count===1&&(!stack?.network_id||stack.count===0))){
     j.confirmed.add(key(p.target));j.remaining=j.remaining.filter(q=>key(q)!==key(p.target));j.pending=null;j.lastProgress=now;j.approachAttempts=0;this.placed++;this.report(`Server confirms ${this.placed}/${this.total} placed ${j.material}; inventory decreased by one.`)
     if(!j.remaining.length){this.state='confirmed';this.reason=`Server confirms all ${this.total} ${j.material} placements and inventory consumption.`;this.job=null;this.report(this.reason)}
     return {}
    }
   }
   if(now-p.sentAt>5000){this.cancel(p.blockConfirmed?'Block placed, but inventory consumption was not confirmed; halted further placement.':'Server did not confirm placement. Check building permission, reach and Realm spawn protection.');return {}}
   return {}
  }
  if(!w.grounded())return {}
  const slots=this.inventory(j.material);if(slots.reduce((sum,[,item])=>sum+item.count,0)<j.remaining.length){this.cancel('Supplies changed; not enough matching hotbar blocks remain for the unfinished footprint.');return {}}if(!slots.length){this.cancel('No remaining matching hotbar stack; no inventory was invented.');return {}}
  const stage=Math.min(...j.remaining.map(p=>p.y)),elevated=['wall','shelter'].includes(j.shape)&&w.position.y-1.62<stage-.08
  const targets=j.remaining.filter(p=>p.y===stage).sort((a,b)=>Math.hypot(a.x-w.position.x,a.y-(w.position.y-1.62),a.z-w.position.z)-Math.hypot(b.x-w.position.x,b.y-(w.position.y-1.62),b.z-w.position.z))
  for(const target of elevated?[]:targets){
   if(!w.airAt(target)){this.cancel('Footprint changed or became unknown; remaining placement cancelled.');return {}}
   if(overlapsBody(target,w.position)||overlapsBody(target,w.serverPosition))continue
   const anchor=this.anchor(target);if(!anchor)continue
   if(w.serverPosition&&Math.hypot(w.position.x-w.serverPosition.x,w.position.y-w.serverPosition.y,w.position.z-w.serverPosition.z)>.35){this.state='waiting-for-position';if(now-j.lastProgress>5000)this.cancel('Approach movement is not confirmed by server position; no placement sent.');return {}}
   const [slot,held]=slots.find(([slot])=>slot===w.selectedSlot)||slots[0]
   if(w.selectedSlot!==slot){return {selectSlot:slot}}
   if(j.equipWaitUntil&&now<j.equipWaitUntil)return {}
   j.pending={target:{...target},slot,count:held.count,heldId:held.network_id,version:w.blockVersion(target),sentAt:now,blockConfirmed:false};this.state='waiting-for-placement'
   return {aim:anchor.hit,placement:{legacy:{legacy_request_id:0,legacy_transactions:null},transaction_type:'item_use',actions:[],transaction_data:{action_type:'click_block',trigger_type:'player_input',block_position:anchor.position,face:anchor.face,hotbar_slot:slot,hand:'main_hand',held_item:held,player_pos:{...w.position,y:w.position.y-1.62},click_pos:anchor.click,block_runtime_id:w.runtimeIdAt(anchor.position)>>>0,client_prediction:'failure',client_cooldown_state:'off'}}}
  }
  if(routeTo&&j.approachAttempts<3){
   const target=targets.find(p=>directions.some(d=>full(w.block({x:p.x+d.x,y:p.y+d.y,z:p.z+d.z}))))
   if(target){
    const candidates=[]
    for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)for(let dy=0;dy<=5;dy++){
     const p={x:target.x+dx,y:j.origin.y+dy,z:target.z+dz},h=w.supportHeight(p),eye={x:p.x+.5,y:(h??p.y)+1.62,z:p.z+.5}
     if(!w.walkable(p)||overlapsBody(target,eye)||(['wall','shelter'].includes(j.shape)&&eye.y-1.62<stage-.08)||Math.hypot(eye.x-w.position.x,eye.y-w.position.y,eye.z-w.position.z)<.4||Math.hypot(eye.x-target.x-.5,eye.y-target.y-.5,eye.z-target.z-.5)>3.6)continue
     if(!this.anchor(target,eye))continue
     candidates.push(p)
    }
    candidates.sort((a,b)=>Math.hypot(a.x-w.position.x,a.z-w.position.z)-Math.hypot(b.x-w.position.x,b.z-w.position.z))
    for(const goal of candidates.slice(0,8)){const route=routeTo(goal);if(route.ok&&route.path.length>1){j.approachAttempts++;j.lastProgress=now;this.state='approaching';return {route}}}
   }
  }
  this.cancel('No safe observed placement face or approach route. Move closer to the footprint, then reactivate the plan.');return {}
 }
 snapshot(){return {state:this.state,reason:this.reason,placed:this.placed,total:this.total,target:this.job?.pending?.target||null}}
}
