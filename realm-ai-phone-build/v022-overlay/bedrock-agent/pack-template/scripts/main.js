import { world, system } from '@minecraft/server'
import settings from './config.js'
import {parseCommand,ALLOWED_MINE,HELP_CATEGORIES} from './commands.js'
import {floorPos,distance,nearOwner,planWall,planFloor,planPillar,planBridge,planMining,materialId,isReplaceable,isGround} from './logic.js'

// World edits are deliberately disabled unless owner enables them in generated pack config.
// The Bedrock protocol client provides the visible bot player; this script runs on the server.
const agent={follow:false,task:null,sequence:0,lastMessage:'Not started',lastError:'',mark:null}
const ownerNames=(settings.ownerNames||[]).filter(x=>x && !x.startsWith('SET_'))
const botName=settings.botPlayerName
const authorizedName=name=>ownerNames.includes(name)||name===botName
const getPlayer=name=>world.getPlayers().find(p=>p.name===name)
const getBot=()=>getPlayer(botName)
const getOwner=()=>ownerNames.map(getPlayer).find(Boolean)
function tell(player,msg) {
 const message='[VEILFORGE] '+String(msg).slice(0,200)
 try {player?.sendMessage(message)}catch(_){}
 const bot=getBot()
 if(bot && bot.name!==player?.name){try{bot.sendMessage(message)}catch(_){}}
 agent.lastMessage=String(msg)
}
function fail(player,msg){agent.lastError=String(msg);tell(player,msg)}
function blockAt(d,pos) {try{return d.getBlock(pos)}catch(_){return undefined}}
function clearTask(){agent.sequence++;agent.task=null}
function safeTeleport(bot,coord,player){
 try {
   if(typeof bot.tryTeleport === 'function' && bot.tryTeleport(coord,{checkForBlocks:true})) return true
   fail(player,'Destination is blocked or chunk unloaded.');return false
 }catch(err){fail(player,'Teleport rejected: '+err.message);return false}
}
function status(player){
 const bot=getBot()
 if(!bot)return tell(player,`Bot ${botName} is not connected. Status: offline.`)
 const p=floorPos(bot.location)
 tell(player,`Bot online at ${p.x},${p.y},${p.z}. Following=${agent.follow}. Task=${agent.task?.label||'none'}. World edits=${settings.allowWorldEdits?'ON':'OFF'}.`)
}
function scheduleWork(player,label,steps,handler){
 if(agent.task) return fail(player,'Already working. Use !vf stop first.')
 const job={id:++agent.sequence,index:0,label,done:0,steps}
 agent.task=job
 tell(player,`Starting ${label} (${steps.length} steps max).`)
 const tick=()=>{
   if(agent.task!==job||job.id!==agent.sequence)return
   if(job.index>=job.steps.length){agent.task=null;return tell(player,`Finished ${label}: ${job.done}/${steps.length} successful.`)}
   try {if(handler(job.steps[job.index])) job.done++}
   catch(err){agent.task=null;return fail(player,`Stopped ${label}: ${String(err.message).slice(0,90)}. Completed ${job.done} steps.`)}
   job.index++
   system.runTimeout(tick,4)
 }
 system.runTimeout(tick,2)
}
function startMine(player,bot,cmd){
 if(!settings.allowWorldEdits)return fail(player,'Mining is disabled. Enable allowWorldEdits in config.json, rebuild pack, and back up world.')
 if(!ALLOWED_MINE.includes(cmd.block))return fail(player,'Block not permitted.')
 if(!nearOwner(bot,player,Math.max(4,settings.maxRadius)))return fail(player,'Stay near the bot in the same dimension.')
 const radius=Math.min(6,Math.max(2,settings.maxRadius))
 let target=[]
 for(const pos of planMining(bot.location,radius)){
   const b=blockAt(bot.dimension,pos)
   if(b?.typeId===materialId(cmd.block))target.push(pos)
   if(target.length>=Math.min(cmd.count,settings.maxBlocksPerTask))break
 }
 if(!target.length)return fail(player,`No nearby ${cmd.block} in currently loaded blocks.`)
 scheduleWork(player,`mining ${cmd.block}`,target,pos=>{
   const b=blockAt(bot.dimension,pos)
   if(!b||b.typeId!==materialId(cmd.block))return false
   if(distance(bot.location,{x:pos.x+.5,y:pos.y,z:pos.z+.5})>radius+1)return false
   const drop=b.getItemStack(1)
   if(!drop)throw Error('This block has no safe item representation.')
   // Simulated mining via Script API; not tool/durability or survival-physics accurate.
   b.setType('minecraft:air')
   try {bot.dimension.spawnItem(drop,{x:pos.x+.5,y:pos.y+.5,z:pos.z+.5})}
   catch(err){try{b.setType(materialId(cmd.block))}catch(_){};throw err}
   return true
 })
}
function inventorySlots(bot,typeId){
 const inv=bot.getComponent('minecraft:inventory')?.container
 if(!inv)throw Error('Bot inventory is not ready.')
 const rows=[];let total=0
 for(let i=0;i<inv.size;i++){
   const stack=inv.getItem(i)
   if(stack?.typeId===typeId){rows.push({slot:i,count:stack.amount});total+=stack.amount}
 }
 return {inv,rows,total}
}
function takeOne(bot,typeId){
 const inv=bot.getComponent('minecraft:inventory')?.container
 if(!inv)throw Error('No inventory.')
 for(let i=0;i<inv.size;i++){
   const stack=inv.getItem(i)
   if(stack?.typeId===typeId){
     if(stack.amount===1)inv.setItem(i,undefined)
     else{stack.amount-=1;inv.setItem(i,stack)}
     return
   }
 }
 throw Error('Ran out of '+typeId)
}
function startStructure(player,bot,cmd){
 if(!settings.allowWorldEdits)return fail(player,'Building is disabled. Enable allowWorldEdits, regenerate the pack and back up the Realm first.')
 if(!nearOwner(bot,player,settings.maxRadius))return fail(player,'Stay near the bot in the same dimension.')
 const shape=cmd.action
 const steps=shape==='wall'?planWall(bot.location,cmd.width,cmd.height)
  :shape==='floor'?planFloor(bot.location,cmd.width,cmd.height)
  :shape==='pillar'?planPillar(bot.location,cmd.length)
  :planBridge(bot.location,cmd.length)
 if(steps.length>settings.maxBlocksPerTask)return fail(player,'That structure exceeds the configured per-task block budget.')
 const material=materialId(cmd.block)
 let inventory
 try{inventory=inventorySlots(bot,material)}catch(err){return fail(player,err.message)}
 if(inventory.total<steps.length)return fail(player,`Need ${steps.length} ${cmd.block} in bot inventory; have ${inventory.total}.`)
 if(shape==='bridge'){
   const first=steps[0]
   const start=blockAt(bot.dimension,{x:first.x-1,y:first.y,z:first.z})
   if(!isGround(start))return fail(player,'Bridge needs a solid starting block connected to its first step.')
 }
 for(const pos of steps){
   const b=blockAt(bot.dimension,pos)
   if(!isReplaceable(b))return fail(player,'Structure footprint obstructed or unloaded; no blocks placed.')
   if(distance(bot.location,{x:pos.x+.5,y:pos.y,z:pos.z+.5})>settings.maxRadius)return fail(player,'Structure extends outside maximum build radius.')
   const baseBlock=(shape==='wall'&&pos.y===steps[0].y)||(shape==='floor')||(shape==='pillar'&&pos.y===steps[0].y)
   if(baseBlock){const support=blockAt(bot.dimension,{x:pos.x,y:pos.y-1,z:pos.z});if(!isGround(support))return fail(player,'Structure requires solid supporting blocks under its base.')}
 }
 scheduleWork(player,`building ${shape} with ${cmd.block}`,steps,pos=>{
   const b=blockAt(bot.dimension,pos)
   if(!isReplaceable(b))return false
   if(distance(bot.location,{x:pos.x+.5,y:pos.y,z:pos.z+.5})>settings.maxRadius)return false
   b.setType(material)
   try{takeOne(bot,material)}catch(err){try{b.setType('minecraft:air')}catch(_){};throw err}
   return true
 })
}
function reportInventory(player,bot){
 try{
   const inv=bot.getComponent('minecraft:inventory')?.container
   if(!inv)return fail(player,'Inventory not available to the server script.')
   const items=new Map()
   for(let i=0;i<inv.size;i++){
     const item=inv.getItem(i);if(item)items.set(item.typeId,(items.get(item.typeId)||0)+item.amount)
   }
   const values=[...items].sort((a,b)=>b[1]-a[1])
   tell(player,values.length?'Inventory: '+values.slice(0,6).map(([id,n])=>`${id.replace('minecraft:','')} x${n}`).join(', ')+(values.length>6?` and ${values.length-6} more types`:''):'Inventory is empty.')
 }catch(e){fail(player,'Could not read inventory: '+String(e.message).slice(0,80))}
}
function reportScan(player,bot,cmd){
 const radius=Math.min(4,settings.maxRadius)
 const positions=planMining(bot.location,radius).slice(0,450)
 const hits=new Map()
 let nearest=null
 for(const pos of positions){
   const block=blockAt(bot.dimension,pos)
   if(!block)continue
   const type=block.typeId.replace(/^minecraft:/,'')
   if(cmd.action==='find'||cmd.action==='count'){
     if(type!==cmd.block)continue
     if(!nearest)nearest=pos
   }else if(type==='air'||type==='cave_air'||type==='bedrock')continue
   hits.set(type,(hits.get(type)||0)+1)
 }
 if(cmd.action==='find')return nearest?tell(player,`Nearest scanned ${cmd.block}: ${nearest.x}, ${nearest.y}, ${nearest.z} (only nearby loaded blocks).`):tell(player,`No ${cmd.block} found in the immediate loaded area.`)
 if(cmd.action==='count')return tell(player,`Found ${hits.get(cmd.block)||0} ${cmd.block} blocks in the immediate loaded scan (not an entire ore vein).`)
 const found=[...hits].sort((a,b)=>b[1]-a[1]).slice(0,6)
 tell(player,'Nearby scan: '+(found.length?found.map(([type,n])=>`${type} ${n}`).join(', '):'no scanned blocks')+'.')
}
function reportPlayers(player){
 const names=world.getPlayers().map(x=>x.name)
 tell(player,`Online (${names.length}): ${names.slice(0,8).join(', ')||'none'}`)
}
function handle(player,message){
 const cmd=parseCommand(message)
 if(cmd.action==='invalid')return fail(player,cmd.message)
 if(cmd.action==='help'){
   if(cmd.category)return tell(player,`Examples: ${HELP_CATEGORIES[cmd.category].join(' | ')}`)
   return tell(player,'Jobs: follow/come/go, stay/stop, status/task/inventory/position, survey/find/count, mark/return, mine, wall/floor/pillar/bridge. Try help building.')
 }
 if(cmd.action==='status')return status(player)
 if(cmd.action==='task')return tell(player,agent.task?`Job ${agent.task.label}: ${agent.task.index}/${agent.task.steps.length} steps checked, ${agent.task.done} successful.`:'No active block job. Follow mode='+agent.follow+'.')
 if(cmd.action==='stop'||cmd.action==='stay'){clearTask();agent.follow=false;return tell(player,'Stopped follow and cancelled pending work. Already changed blocks are not undone.')}
 if(cmd.action==='forget'){agent.mark=null;return tell(player,'Saved position cleared.')}
 const bot=getBot()
 if(!bot)return fail(player,`Bot player ${botName} has not joined yet.`)
 const owner=player.name===botName?getOwner():player
 if(!owner||!ownerNames.includes(owner.name))return fail(player,'An approved owner must be online to control this bot.')
 if(cmd.action==='inventory')return reportInventory(player,bot)
 if(cmd.action==='position'){const p=floorPos(bot.location);return tell(player,`Bot at ${p.x}, ${p.y}, ${p.z} in ${bot.dimension.id}.`)}
 if(cmd.action==='players')return reportPlayers(player)
 if(['find','count','survey'].includes(cmd.action))return reportScan(player,bot,cmd)
 if(cmd.action==='mark'){
  agent.mark={...floorPos(bot.location),dimension:bot.dimension.id}
  return tell(player,`Saved bot position ${agent.mark.x}, ${agent.mark.y}, ${agent.mark.z}.`)
 }
 if(cmd.action==='return'){
  if(!agent.mark)return fail(player,'No marked location yet. Try mark this spot.')
  if(agent.mark.dimension!==bot.dimension.id)return fail(player,'Mark is in another dimension.')
  if(distance(bot.location,agent.mark)>12)return fail(player,'Mark is more than 12 blocks away. Long distance route planning is not ready.')
  if(!nearOwner(bot,owner,48))return fail(player,'The owner must be near the bot.')
  return safeTeleport(bot,{x:agent.mark.x+.5,y:agent.mark.y,z:agent.mark.z+.5},player)&&tell(player,'Returned to saved spot.')
 }
 if(cmd.action==='follow'){agent.follow=true;return tell(player,`Following ${owner.name} (safe short teleports, not pathfinding).`)}
 if(cmd.action==='come'){
   if(bot.dimension.id!==owner.dimension.id)return fail(player,'Bot and owner must be in the same dimension.')
   const p=owner.location
   return safeTeleport(bot,{x:Math.floor(p.x)+1.5,y:Math.floor(p.y),z:Math.floor(p.z)+1.5},player)&&tell(player,'Moved close to owner.')
 }
 if(cmd.action==='go'){
   if(!nearOwner(bot,owner,48))return fail(player,'Owner and bot must be close together.')
   if(distance(bot.location,cmd)>12)return fail(player,'Movement commands are limited to 12 blocks at a time.')
   return safeTeleport(bot,{x:cmd.x+.5,y:cmd.y,z:cmd.z+.5},player)&&tell(player,'Moved to nearby coordinates.')
 }
 if(agent.task)return fail(player,'Already doing a block task. Use !vf stop to cancel first.')
 if(cmd.action==='mine')return startMine(player,bot,cmd)
 if(['wall','floor','pillar','bridge'].includes(cmd.action))return startStructure(player,bot,cmd)
}

// Chat event APIs are preview-marked in some Bedrock releases; support whichever exists.
const chatSignal=world.afterEvents?.chatSend || world.beforeEvents?.chatSend
if(chatSignal?.subscribe){
 chatSignal.subscribe(event=>{
   const msg=String(event.message||'')
   if(!/^!vf(?:\s|$)/i.test(msg))return
   const sender=event.sender
   if(!sender||!authorizedName(sender.name))return
   // Gameplay APIs cannot modify state inside before-event restricted execution.
   system.run(()=>{try{handle(sender,msg)}catch(err){fail(sender,`Command failed: ${String(err.message).slice(0,100)}`)}})
 })
}else{
 console.warn('[VEILFORGE] Chat hook unavailable in this Bedrock server version. See README: Beta APIs may be required.')
}
system.runInterval(()=>{
 if(!agent.follow || agent.task)return
 const bot=getBot(),owner=getOwner()
 if(!bot||!owner||bot.dimension.id!==owner.dimension.id)return
 const d=distance(bot.location,owner.location)
 if(d<=4||d>48)return
 const p=owner.location
 try{bot.tryTeleport({x:Math.floor(p.x)+1.5,y:Math.floor(p.y),z:Math.floor(p.z)+1.5},{checkForBlocks:true})}catch(_){ }
},settings.followIntervalTicks||10)
console.warn('[VEILFORGE] World bridge loaded; world edits '+(settings.allowWorldEdits?'ON':'OFF')+'.')
