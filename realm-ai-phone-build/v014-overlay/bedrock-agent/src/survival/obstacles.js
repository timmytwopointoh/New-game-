// Intent-sensitive recovery. Geometry/provenance are evidence, not proof of placement history.
const built=/(?:planks|bricks|tiles|stairs|slab|glass|concrete|terracotta|wool|fence|wall|door|sign|lantern|torch|carpet|polished|chiseled|cut_|smooth_)/
const protectedNames=/(?:chest|barrel|shulker|furnace|hopper|dispenser|dropper|spawner|bedrock|portal|command_block|structure_block|bed$|beehive|bee_nest|vault|trial_spawner)/
const naturalLooking=new Set(['dirt','grass_block','coarse_dirt','rooted_dirt','podzol','mud','clay','stone','deepslate','granite','diorite','andesite','netherrack'])
export function placementEvidence(world,pos,block=world.block(pos)){
 if(!block)return {classification:'unknown',reason:'Block data is missing.'}
 if(protectedNames.test(block.name))return {classification:'protected',reason:'Container, interactive, or protected block.'}
 if(built.test(block.name))return {classification:'likely-built',reason:'Material commonly used in player builds.'}
 // Obvious artificial surroundings are enough to protect even an ordinary dirt/stone block.
 for(const [x,y,z] of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0]]){
  const n=world.block({x:pos.x+x,y:pos.y+y,z:pos.z+z})
  if(n&&(built.test(n.name)||protectedNames.test(n.name)))return {classification:'likely-built',reason:'Adjacent to construction or an interactive block.'}
 }
 return {classification:naturalLooking.has(block.name)?'natural-looking':'unknown',reason:'Minecraft does not identify who placed this block.'}
}
export function miningAssessment(world,pos,{explicit=false,allowBuilt=false,maxMs=5000}={}){
 if(!world.survivalVerified)return {ok:false,reason:'Server Survival mode is not verified.'}
 const block=world.block(pos),evidence=placementEvidence(world,pos,block)
 if(!block||!world.position)return {ok:false,reason:'Block or position is unknown.',evidence}
 if(evidence.classification==='protected')return {ok:false,reason:evidence.reason,evidence}
 if(!allowBuilt&&evidence.classification==='likely-built')return {ok:false,reason:'Looks like part of a player build; going around.',evidence}
 if(!explicit&&evidence.classification!=='natural-looking')return {ok:false,reason:'Placement is uncertain; not clearing it automatically.',evidence}
 if(!block.diggable||!Number.isFinite(block.hardness)||block.hardness<0)return {ok:false,reason:'Block cannot be mined normally.',evidence}
 if(Math.hypot(pos.x+.5-world.position.x,pos.y+.5-world.position.y,pos.z+.5-world.position.z)>4||!world.visible(pos))return {ok:false,reason:'Block is out of reach or not visible.',evidence}
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const next=world.block({x:pos.x+dx,y:pos.y,z:pos.z+dz})
  if(!next||/water|lava/.test(next.name))return {ok:false,reason:'Unobserved terrain or fluid beside the mining target.',evidence}
 }
 const feet=world.standPosition()
 if(!feet||!world.walkable(feet)||!world.grounded())return {ok:false,reason:'Must stand on safe ground before mining.',evidence}
 if(pos.y<feet.y||pos.y>feet.y+1)return {ok:false,reason:'Will not mine underfoot or overhead while recovering movement.',evidence}
 const above=world.block({...pos,y:pos.y+1})
 if(!above||/sand|gravel|concrete_powder|anvil|water|lava/.test(above.name))return {ok:false,reason:'Unknown or falling/fluid block above the target.',evidence}
 if(!world.inventoryKnown||world.selectedSlot===null)return {ok:false,reason:'Held tool is unknown. Use “select slot 1” after inventory loads.',evidence}
 if(!world.inventory.has(world.selectedSlot))return {ok:false,reason:'Selected inventory slot has not been received.',evidence}
 const held=world.inventory.get(world.selectedSlot),tool=held.network_id?world.registry?.items?.[held.network_id]:null
 if(held.network_id&&!tool)return {ok:false,reason:'Held item is not recognized.',evidence}
 const toolId=tool?.id||null
 if(!block.canHarvest(toolId))return {ok:false,reason:'Held tool is unsuitable for harvesting this block.',evidence}
 const estimated=block.digTime(toolId,false,false,false)
 if(!Number.isFinite(estimated)||estimated>maxMs)return {ok:false,reason:`Too difficult with the current tool (limit ${maxMs/1000}s).`,evidence}
 return {ok:true,block,held,tool:tool?.name||'hand',durationMs:Math.max(250,Math.ceil(estimated/50)*50+250),evidence}
}
export function recoveryDecision({mode,canJump=false,hasDetour=false,mine=null,allowMining=false,attempts=0}){
 if(attempts>=3)return {action:'pause',reason:'Recovery attempt limit reached.'}
 if(mode==='follow'&&canJump)return {action:'jump',reason:'Following: one-block obstacle, known landing and headroom.'}
 if(hasDetour)return {action:'detour',reason:mode==='follow'?'Jump is unavailable; taking another route.':'Solo travel: taking another route first.'}
 if(mode!=='follow'&&allowMining&&mine?.ok)return {action:'mine',reason:'No route around; target is within the current clearing job and tool budget.'}
 return {action:'pause',reason:mode==='follow'?'No clear jump or route; never mining while following.':mine?.reason||'No safe detour or authorized mining option.'}
}
export class ProgressTracker{
 constructor(){this.reset()}
 reset(){this.intent=0;this.samples=[];this.feedback='unconfirmed'}
 commanded(distance){if(Number.isFinite(distance)&&distance>0)this.intent+=distance}
 observe(position,now){
  if(!position||![position.x,position.y,position.z,now].every(Number.isFinite))return
  this.samples.push({p:{...position},at:now,intent:this.intent})
  this.samples=this.samples.filter(s=>now-s.at<=2000).slice(-32)
  const a=this.samples[0],b=this.samples.at(-1);this.feedback='unconfirmed'
  if(this.samples.length>=3&&b.at-a.at>=800&&b.intent-a.intent>=.6){
   const xs=this.samples.map(s=>s.p.x),zs=this.samples.map(s=>s.p.z)
   this.feedback=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))<.15?'stalled':'progressing'
  }
 }
 stalled(now){const b=this.samples.at(-1);return this.feedback==='stalled'&&!!b&&now-b.at<=1000}
 snapshot(now=Date.now()){const last=this.samples.at(-1);return {feedback:last&&now-last.at<=2000?this.feedback:'unconfirmed',samples:this.samples.length,lastServerPosition:last?{...last.p}:null}}
}
