import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {miningAssessment} from './obstacles.js'
import {resolveMaterial,searchCatalog,materialInfo} from './catalog.js'
export const commandCatalog=JSON.parse(fs.readFileSync(new URL('./command-catalog.json',import.meta.url),'utf8'))
const copy=x=>JSON.parse(JSON.stringify(x))
export function validateDescriptor(input){
 if(!input||typeof input!=='object')throw Error('Choose a supported command.')
 const def=commandCatalog.find(d=>d.id===input.id);if(!def)throw Error('Unsupported command.')
 const values={}
 for(const field of def.fields){
  let value=input.values?.[field.id]
  if(field.type==='integer'||field.type==='slot'){
   if(typeof value==='string'&&/^-?\d+$/.test(value))value=Number(value)
   if(!Number.isSafeInteger(value)||value<field.min||value>field.max)throw Error(`${field.label}: choose ${field.min}–${field.max}.`)
  }else{
   if(typeof value!=='string'||!value.trim()||value.length>64||/[\r\n\x00-\x1f{}]/.test(value))throw Error('Enter '+field.label+'.')
   value=value.trim()
   if(field.type==='material'||field.type==='block'){
    if(def.id!=='materials'){value=resolveMaterial(value);if(!value)throw Error('Choose a known material.')}
    if(field.type==='block'&&!materialInfo(value)?.block)throw Error('Choose a block material.')
   }
  }
  values[field.id]=value
 }
 return {id:def.id,values}
}
export function renderDescriptor(input){const d=validateDescriptor(input),def=commandCatalog.find(x=>x.id===d.id);return def.template.replace(/\{(\w+)\}/g,(_,key)=>String(d.values[key]))}
export function parseDescriptor(raw){
 if(typeof raw!=='string'||raw.length>190||/[\r\n\x00-\x1f]/.test(raw))throw Error('Use a supported command in one line.')
 let s=raw.trim().replace(/[.!?]+$/,'').replace(/^(?:please |can you |could you )/i,'')
 if(/^mine(?: block at)? -?\d+[, ]+-?\d+[, ]+-?\d+$/i.test(s))s=s.replace(/^mine(?: block at)?/i,'dig')
 s=s.replace(/^place (?:a )?block at /i,'place dirt at ').replace(/^build (wall|floor) (\d+) by (\d+) at /i,'build $1 $2 by $3 with dirt at ').replace(/^build (?:a )?shelter at /i,'build shelter with dirt at ')
 if(/^strip min(?:e|ing)$/i.test(s))s='strip mine 8 rows at -20'
 if(/^mine dirt$/i.test(s))s='quarry dirt'
 if(/^(?:mine|get) [a-z_ ]+$/i.test(s)&&!/^mine dirt$/i.test(s))s=s.replace(/^(?:mine|get) /i,'gather 64 ')
 if(/^biome$/i.test(s))s='surroundings'
 if(/^mine$/i.test(s))throw Error('Choose Commands → Dig one block, or enter “dig X Y Z”. A target and known held item are required.')
 const aliases={status:'survival status',position:'survival status',look:'look around','view on':'look around',help:'help survival',commands:'help survival',rejoin:'rejoin realm','show plan':'plan status'};s=aliases[s.toLowerCase()]||s
 for(const def of commandCatalog){
  const names=[];let pattern=def.template.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{(\w+)\}/g,(_,k)=>{names.push(k);const f=def.fields.find(x=>x.id===k);return f.type==='integer'||f.type==='slot'?'(-?\\d+)':'(.+?)'})
  const match=s.match(new RegExp('^'+pattern+'$','i'));if(!match)continue
  const values=Object.fromEntries(names.map((name,i)=>[name,match[i+1]]));if(def.id==='follow'&&values.player.toLowerCase()==='me')values.player='me'
  return validateDescriptor({id:def.id,values})
 }
 throw Error('Unsupported command. Use Commands to prepare a supported plan; “move forward 3 blocks” is not supported.')
}
const NUMBER_WORDS={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12}
export function parseCommandRequest(raw){
 if(typeof raw!=='string'||raw.length>190)throw Error('Use one short command (190 characters maximum).')
 const s=raw.trim().replace(/^command\s*/i,'').replace(/[.!?]+$/,'').trim()
 if(!s)throw Error('Open Commands to see every supported command, or type “command <action>” to prepare an action.')
 const phrasing=s.toLowerCase().replace(/-/g,' ').replace(/\s+/g,' ')
 const height=phrasing.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+blocks?\s+(?:high|tall)\b/)
 const stacks=phrasing.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+stacks?\b/)
 if(height&&/\bslabs?\b/.test(phrasing)){
  const n=Number(height[1])||NUMBER_WORDS[height[1]]
  return {clarification:`I read “${n} blocks high” as a height, not ${n} stacks. Do you mean a structure ${n} blocks tall made from slabs? This builder only places full solid blocks; slab placement is not supported. Use a full block material, or choose a wall preview (previews do not place anything).`}
 }
 if(stacks&&/\bslabs?\b/.test(phrasing)){const n=Number(stacks[1])||NUMBER_WORDS[stacks[1]];return {clarification:`I read “${n} stacks of slabs” as an item quantity, not a structure height. To plan a structure, specify its shape and dimensions. Slab placement is not supported; full solid blocks can be used for executable builds.`}}
 if(/\bblocks?\s+of\s+slabs?\b/.test(phrasing)&&!height&&!stacks)return {clarification:'“Blocks of slabs” could mean slab items or a structure made from slabs. Which do you mean? I have not saved or started anything.'}
 try{return {descriptor:parseDescriptor(s)}}catch(e){
  const measure=s.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:-|\s)?blocks?\s+(?:high|tall)\b/i)
  if(measure){const n=Number(measure[1])||NUMBER_WORDS[measure[1].toLowerCase()];return {clarification:`I interpreted that number as a height of ${n} blocks, not stacks. To prepare a build, use Commands → Build wall and fill in width, height, material, and origin. Executable walls are limited to 3 blocks high; wall previews can be up to 12 blocks high and do not place blocks.`}}
  throw e
 }
}
export class CommandPlans{
 constructor(controller,{directory=null,scope=null,batchDelayMs=2000}={}){this.controller=controller;this.directory=directory;this.scope=null;this.file=null;this.cards=[];this.selected=null;this.running=null;this.sequence=0;this.batchDelayMs=batchDelayMs;this.batch=null;this.batchTimer=null;this.batchPoll=null;this.setScope(scope)}
 setScope(scope){
  this.interrupt('Realm changed; no automatic resume.');this.scope=scope||null;this.cards=[];this.selected=null;this.readOnly=false;this.loadError=''
  this.file=this.directory&&scope?path.join(this.directory,crypto.createHash('sha256').update(scope).digest('hex')+'.json'):null
  if(this.file&&fs.existsSync(this.file)){try{const data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!Array.isArray(data.cards)||data.cards.length>5)throw Error();this.cards=data.cards.map((c,i)=>({id:i+1,descriptor:validateDescriptor(c.descriptor),state:'waiting',result:'',activationLocked:false}));this.sequence=this.cards.length;const selected=Number.isSafeInteger(data.selected)?data.selected:null;this.selected=this.cards.some(c=>c.id===selected)?selected:null}catch{this.loadError='Saved plans could not be read; original file preserved.';this.readOnly=true}}
 }
 persist(){if(this.readOnly)throw Error(this.loadError);if(!this.file)return;fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});fs.writeFileSync(this.file+'.tmp',JSON.stringify({cards:this.cards.map(c=>({descriptor:c.descriptor})),selected:this.selected}),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file)}
 snapshot(){this.reconcile();return {retryable:this.running===null&&!this.batch&&this.cards.some(c=>['blocked','failed'].includes(c.state)&&['walk','clear'].includes(c.descriptor.id)),scopeKnown:!!this.scope,cards:this.cards.map(c=>({...copy(c),command:renderDescriptor(c.descriptor),label:commandCatalog.find(d=>d.id===c.descriptor.id)?.label,note:commandCatalog.find(d=>d.id===c.descriptor.id)?.note})),selected:this.selected,running:this.running,batch:this.batch?{remaining:this.batch.ids.length-this.batch.index,total:this.batch.ids.length}:null,pending:this.cards.filter(c=>c.state==='waiting').length,error:this.loadError||'',capacity:5}}
 prepare(descriptor){
  if(this.directory&&!this.scope)throw Error('Join and identify the Realm before saving a Realm-scoped plan.')
  if(this.cards.length>=5)throw Error('Five plans are saved. Delete a card before preparing another.')
  const d=validateDescriptor(descriptor);this.validateChoices(d);const previous=this.selected,card={id:++this.sequence,descriptor:d,state:'waiting',result:'',activationLocked:false};this.cards.push(card);this.selected=card.id
  try{this.persist()}catch(e){this.cards.pop();this.selected=previous;this.sequence--;throw e}
  return {accepted:true,queued:false,message:'Saved and selected plan #'+card.id+': '+renderDescriptor(d)+'. Activate runs the waiting queue, selected first. Nothing executed yet.'+(this.controller.learning?.guidance(d)?' '+this.controller.learning.guidance(d):''),plans:this.snapshot()}
 }
 validateChoices(d){
  const w=this.controller.world
  if(d.id==='follow'&&d.values.player!=='me'&&![...w.players.values()].some(p=>p.name.toLowerCase()===d.values.player.toLowerCase())&&!this.controller.connection.config?.ownerPlayerNames?.some(p=>p.toLowerCase()===d.values.player.toLowerCase()))throw Error('Choose an observed player or configured owner.')
  if(d.id==='hotbar'&&!w.inventory.has(d.values.slot-1))throw Error('That hotbar slot has not been received from the server.')
 }
 select(id){this.reconcile();if(this.running||this.batch)throw Error('Stop the running plan batch before changing selection.');if(!this.cards.some(c=>c.id===id))throw Error('Choose a saved card.');const previous=this.selected,card=this.cards.find(c=>c.id===id),old={locked:card.activationLocked,state:card.state};this.selected=id;if(card.activationLocked){card.activationLocked=false;card.state='waiting';card.result='Reused; waiting for Activate.'}try{this.persist()}catch(e){this.selected=previous;card.activationLocked=old.locked;card.state=old.state;throw e}return this.snapshot()}
 delete(id){if(this.batch)throw Error('Stop the running plan batch before deleting a card.');if(this.running===id)throw Error('Stop this plan before deleting it.');const before=this.cards,selected=this.selected;this.cards=this.cards.filter(c=>c.id!==id);if(this.selected===id)this.selected=null;try{this.persist()}catch(e){this.cards=before;this.selected=selected;throw e}return this.snapshot()}
 activate(id){
  this.reconcile();if(this.running!==null||this.batch)throw Error('A plan batch is already running.');if(id!==this.selected)throw Error('Activate only the selected plan.')
  const card=this.cards.find(c=>c.id===id);if(!card)throw Error('Select a plan first.')
  if(card.activationLocked)throw Error('Plan already activated. Select the card again to reuse it.')
  const d=validateDescriptor(card.descriptor);this.validateChoices(d);this.batch={ids:[id],index:0};const result=this.launchBatchItem()
  return {...(result||{accepted:true,queued:true,message:`Started selected command #${id}.`}),plans:this.snapshot()}
 }
 activateQueue(){
  this.reconcile();if(this.running!==null||this.batch)throw Error('A plan batch is already running.')
  const waiting=this.cards.filter(c=>c.state==='waiting'&&!c.activationLocked)
  if(!waiting.length)throw Error('There are no waiting commands. Prepare or reuse a saved command first.')
  // Revalidate the whole queue before its first side effect. Then execute one
  // command at a time and revalidate each card again immediately before use.
  for(const c of waiting){const d=validateDescriptor(c.descriptor);this.validateChoices(d)}
  const ordered=this.selected&&waiting.some(c=>c.id===this.selected)?[waiting.find(c=>c.id===this.selected),...waiting.filter(c=>c.id!==this.selected)]:waiting
  this.batch={ids:ordered.map(c=>c.id),index:0};const first=this.launchBatchItem()
  if(first?.accepted===false)return {...first,plans:this.snapshot()}
  return {accepted:true,queued:true,message:`Started queued commands: ${ordered.length} item${ordered.length===1?'':'s'}. The next starts two seconds after server-confirmed completion; Stop cancels the remaining queue.`,plans:this.snapshot()}
 }
 // Execute exactly these newly created cards, not older waiting saved cards.
 activateSubset(ids){
  this.reconcile();if(this.running!==null||this.batch)throw Error('Another job is already running.')
  if(!Array.isArray(ids)||ids.length<1||ids.length>5||new Set(ids).size!==ids.length)throw Error('Choose 1-5 unique new cards.')
  for(const id of ids){const card=this.cards.find(c=>c.id===id);if(!card||card.state!=='waiting'||card.activationLocked)throw Error('Research plan is not waiting.');this.validateChoices(validateDescriptor(card.descriptor))}
  this.batch={ids:[...ids],index:0};const first=this.launchBatchItem()
  if(first?.accepted===false)return {...first,plans:this.snapshot()}
  return {accepted:true,queued:true,message:`Started ${ids.length} researched command(s), with server checks and two-second spacing. Stop cancels the remaining steps.`,plans:this.snapshot()}
 }
 launchBatchItem(){
  if(!this.batch)return {accepted:false,queued:false,message:'No command batch is active.'}
  if(this.batch.index>=this.batch.ids.length){this.finishBatch('All queued commands processed.');return {accepted:true,queued:false,message:'All queued commands processed.'}}
  const card=this.cards.find(c=>c.id===this.batch.ids[this.batch.index]);if(!card||card.state!=='waiting'||card.activationLocked){this.finishBatch('Queue stopped because a command is no longer waiting.');return {accepted:false,queued:false,message:'Queue stopped because a command is no longer waiting.'}}
  try{
   const d=validateDescriptor(card.descriptor);this.validateChoices(d);card.activationLocked=true;card.state='running';this.running=card.id;this.activeStartedAt=Date.now();this.activeServerPoseAt=this.controller.world?.lastPoseAt||0;this.activeGoal=d.id==='walk'||d.id==='clear'?{x:d.values.x,y:d.values.y,z:d.values.z}:null
   const result=this.controller.handle(renderDescriptor(d));card.result=result?.message||''
   if(!result?.accepted){this.controller.learning?.record(d,'blocked',card.result);card.state='blocked';this.running=null;this.finishBatch(`Queue stopped at #${card.id}: ${card.result}`);return result||{accepted:false,queued:false,message:card.result}}
   this.controller.report?.(`Queue ${this.batch.index+1}/${this.batch.ids.length}: started #${card.id} ${renderDescriptor(d)}.`)
   if(!this.controller.navigation?.job&&!result?.queued&&!['ensure','rejoin'].includes(d.id)){this.controller.learning?.record(d,'unverified',card.result);card.state='completed';card.result=card.result||'Completed.';this.running=null;this.controller.report?.(`Command #${card.id} completed. Next queued command starts in two seconds.`);this.scheduleNext();return result}
   this.startPoll();return result
  }catch(e){this.controller.learning?.record(card.descriptor,'blocked',e.message);card.state='failed';card.result=e.message;this.running=null;this.finishBatch(`Queue stopped: ${e.message}`);return {accepted:false,queued:false,message:e.message}}
 }
 // Re-run the same failed walking card after checking the server terrain.
 // Never duplicate cards or blindly replay partly completed world edits.
 retryBlocked(id=null){
  this.reconcile()
  if(this.batch||this.running!==null||this.controller.navigation?.job)return {accepted:false,queued:false,message:'Stop or finish the current task before retrying.',plans:this.snapshot()}
  const eligible=this.cards.filter(c=>['blocked','failed'].includes(c.state)&&['walk','clear'].includes(c.descriptor.id))
  const card=id===null?eligible.at(-1):eligible.find(c=>c.id===id)
  if(!card)return {accepted:false,queued:false,message:'No blocked walking task can be retried safely. Building, mining and item actions need inspection before another attempt.',plans:this.snapshot()}
  const nav=this.controller.navigation,w=this.controller.world
  if(!this.controller.connection?.spawned||!nav?.client||!w?.position)return {accepted:false,queued:false,message:'Wait for the bot to spawn and receive its position before retrying.',plans:this.snapshot()}
  const oldResult=card.result
  try{
   w.requestNearby(nav.client)
   if(!w.terrainKnown())return {accepted:false,queued:false,message:'Nearby terrain is still unknown; requested fresh sections. Try Again after the chunks arrive. '+oldResult,plans:this.snapshot()}
   const gate=nav.movementBlock();if(gate)return {accepted:false,queued:false,message:'Still blocked: '+gate,plans:this.snapshot()}
   nav.blocked.clear();nav.progress.reset();nav.recoveryAttempts=0;nav.lastClearanceBlock=null
   card.state='waiting';card.activationLocked=false;card.result='Retrying original command after terrain recheck. Previous failure: '+oldResult
   this.batch={ids:[card.id],index:0}
   const response=this.launchBatchItem()
   return {...response,plans:this.snapshot(),retriedCardId:card.id}
  }catch(e){if(this.batch)this.finishBatch('Retry could not start.');card.state='blocked';card.result=oldResult;return {accepted:false,queued:false,message:'Retry refused: '+String(e.message||e),plans:this.snapshot()}}
 }
  startPoll(){if(this.batchPoll)return;this.batchPoll=setInterval(()=>this.pollBatch(),200);this.batchPoll.unref?.()}
 pollBatch(){
  if(!this.batch||this.running===null)return
  const card=this.cards.find(c=>c.id===this.running);if(!card){this.finishBatch('Queue lost its active card.');return}
  const nav=this.controller.navigation,descriptor=card.descriptor,elapsed=Date.now()-this.activeStartedAt
  if(descriptor.id==='ensure'){
   if(this.controller.world?.survivalVerified){this.completeActive('Server confirmed Survival mode and abilities.');return}
   if(elapsed>30000)this.failActive('Survival mode or abilities were not verified; remaining commands stayed queued.');return
  }
  if(descriptor.id==='rejoin'){
   if(this.controller.connection?.spawned&&elapsed>1000){this.completeActive('Realm connection and spawn were restored.');return}
   if(elapsed>60000)this.failActive('Realm rejoin was not confirmed; remaining commands stayed queued.');return
  }
  if(descriptor.id==='look'){if(nav?.survey)return;this.completeActive('360-degree survey finished or was interrupted; inspect scan results before acting.');return}
  if(['strip_mine','quarry'].includes(descriptor.id)){const task=this.controller.miningJobs;if(task?.active){if(task.active.state==='blocked')this.failActive(task.active.reason);return}if(task?.last?.state==='completed')this.completeActive(task.last.reason);else this.failActive(task?.last?.reason||'Excavation interrupted.');return}
  if(descriptor.id==='gather'){const task=this.controller.acquisition||this.controller.resources;if(task?.active){if(task.active.state==='blocked')this.failActive(task.active.reason);return;}if(task?.last?.state==='completed')this.completeActive(task.last.reason);else this.failActive(task?.last?.reason||'Gathering interrupted.');return}
  if(descriptor.id==='craft'){const ops=this.controller.operations;if(ops?.pending)return;if(ops?.state==='confirmed')this.completeActive(ops.reason);else this.failActive(ops?.reason||'Crafting unconfirmed.');return}
  if(descriptor.id==='follow')return // Continuous follow ends only when Stop is pressed.
  if(descriptor.id==='collect'){
   if(nav?.pickup?.state==='confirmed'){this.completeActive(nav.pickup.reason||'Server inventory confirms item pickup.');return}
   if(['failed','interrupted','unverified'].includes(nav?.pickup?.state)){this.failActive(nav.pickup.reason||'Item pickup not confirmed.');return}
  }
  if(descriptor.id==='dig'){
   if(nav?.mining?.result==='confirmed'||nav?.state==='confirmed'){this.completeActive(nav.reason||'Server confirmed the block break.');return}
   if(nav?.mining?.result==='cancelled'||['interrupted','stopped','failed'].includes(nav?.state)){this.failActive(nav.reason||'Mining did not complete.');return}
  }else if(['place','build_wall','build_floor','build_shelter'].includes(descriptor.id)){
   if(nav?.building?.state==='confirmed'){this.completeActive(nav.building.reason||'Server confirmed all placements.');return}
   if(['interrupted','cancelled','failed'].includes(nav?.building?.state)){this.failActive(nav.building.reason||'Building did not complete.');return}
  }else if(['walk','clear'].includes(descriptor.id)){
   const p=this.controller.world?.serverPosition,g=this.activeGoal,at=this.controller.world?.lastPoseAt||0
   if(!nav?.job&&nav?.state==='arrived-predicted'&&p&&g&&at>this.activeServerPoseAt&&Math.hypot(p.x-(g.x+.5),p.z-(g.z+.5))<.36&&Math.abs((p.y-1.62)-g.y)<.4){this.completeActive('Server position confirms the destination.');return}
   if(!nav?.job&&['stopped','blocked','waiting-for-terrain','failed'].includes(nav?.state)){this.failActive(nav.reason||'Movement was blocked or interrupted.');return}
   if(!nav?.job&&elapsed>12000)this.failActive('Movement inputs ended without server confirmation of the destination; remaining queue stayed waiting.')
  }else if(!nav?.job&&descriptor.id!=='rejoin'){
   this.completeActive(card.result||'Completed.');return
  }
  if(elapsed>180000)this.failActive('Command timed out without server confirmation; remaining queue stayed waiting.')
 }
 completeActive(reason){const card=this.cards.find(c=>c.id===this.running);if(card){this.controller.learning?.record(card.descriptor,'confirmed',reason);card.state='completed';card.result=reason;this.controller.report?.(`Command #${card.id} confirmed complete. Next queued command starts in two seconds.`)}this.running=null;this.persist();this.scheduleNext()}
 failActive(reason){const card=this.cards.find(c=>c.id===this.running);if(card){this.controller.learning?.record(card.descriptor,'blocked',reason);card.state='blocked';card.result=reason}this.running=null;this.finishBatch(`Queue stopped at #${card?.id||'?'}: ${reason}`)}
 scheduleNext(){if(!this.batch)return;this.persist();if(this.batch.index+1>=this.batch.ids.length){this.finishBatch('All queued commands processed.');return}if(this.batchTimer)clearTimeout(this.batchTimer);this.batchTimer=setTimeout(()=>{this.batchTimer=null;if(this.batch){this.batch.index++;this.launchBatchItem()}},this.batchDelayMs);this.batchTimer.unref?.()}
 finishBatch(message){if(this.batchPoll)clearInterval(this.batchPoll);this.batchPoll=null;if(this.batchTimer)clearTimeout(this.batchTimer);this.batchTimer=null;this.batch=null;this.running=null;this.lastBatchMessage=message;this.controller.report?.(message);this.controller.connection?.emit?.('plan-batch-update',{message});this.persist()}
 reconcile(){if(this.running===null||this.batch)return;const card=this.cards.find(c=>c.id===this.running);if(!this.controller.navigation?.job){if(card){card.state='finished-unverified';card.result=this.controller.navigation?.reason||'Inputs ended; live success is not verified.'}this.running=null}}
 interrupt(reason='Stopped by owner.') {if(this.batchTimer)clearTimeout(this.batchTimer);if(this.batchPoll)clearInterval(this.batchPoll);this.batchTimer=this.batchPoll=null;this.batch=null;if(this.running!==null){const card=this.cards.find(c=>c.id===this.running);if(card){this.controller.learning?.record(card.descriptor,'interrupted',reason);card.state='interrupted';card.result=reason}}this.running=null;for(const c of this.cards)if(c.state==='waiting')c.result=reason;this.persist()}
}
export function formOptions(world,query=''){return {players:[...world.players.values()].map(p=>p.name),hotbar:Array.from({length:9},(_,i)=>({slot:i+1,known:world.inventory.has(i),name:world.inventory.has(i)?(world.inventory.get(i)?.network_id?world.registry?.items?.[world.inventory.get(i).network_id]?.name||'unknown':'empty'):'unknown',count:world.inventory.get(i)?.count||0})),materials:searchCatalog(query),visible:world.scan().found.map(p=>{const assessment=miningAssessment(world,p,{explicit:true});return {...p,tool:assessment.tool||'unknown / unsuitable',durationMs:assessment.durationMs||null,eligible:assessment.ok,reason:assessment.reason||'Server must confirm removal'}}),heldSlot:world.selectedSlot===null?null:world.selectedSlot+1}}
