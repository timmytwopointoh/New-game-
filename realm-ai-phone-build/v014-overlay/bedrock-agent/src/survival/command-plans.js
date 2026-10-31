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
 const aliases={status:'diagnostics',position:'diagnostics','survival status':'diagnostics','movement status':'diagnostics','combat status':'diagnostics','control status':'diagnostics','player identity':'diagnostics','inventory status':'diagnostics',look:'look around','view on':'look around',help:'help survival',commands:'help survival',rejoin:'rejoin realm','show plan':'plan status'};s=aliases[s.toLowerCase()]||s
 for(const def of commandCatalog){
  const names=[];let pattern=def.template.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{(\w+)\}/g,(_,k)=>{names.push(k);const f=def.fields.find(x=>x.id===k);return f.type==='integer'||f.type==='slot'?'(-?\\d+)':'(.+?)'})
  const match=s.match(new RegExp('^'+pattern+'$','i'));if(!match)continue
  const values=Object.fromEntries(names.map((name,i)=>[name,match[i+1]]));if(def.id==='follow'&&values.player.toLowerCase()==='me')values.player='me'
  return validateDescriptor({id:def.id,values})
 }
 throw Error('Unsupported command. Use Commands to prepare a supported plan; “move forward 3 blocks” is not supported.')
}
// A run owns the complete saved card list: one job at a time, never auto-restarted.
// The next card starts 2 seconds AFTER the prior card completes or its read-only result.
export class CommandPlans{
 constructor(controller,{directory=null,scope=null,schedule=setTimeout,unschedule=clearTimeout,clock=Date.now}={}){
  this.controller=controller;this.directory=directory;this.scope=null;this.file=null;this.cards=[];this.running=null
  this.cursor=0;this.nextAt=null;this.runActive=false;this.sequence=0;this.timer=null
  this.schedule=schedule;this.unschedule=unschedule;this.clock=clock;this.generation=0;this.setScope(scope)
 }
 setScope(scope){
  this.interrupt('Realm changed; no automatic resume.');this.scope=scope||null;this.cards=[];this.readOnly=false;this.loadError=''
  this.file=this.directory&&scope?path.join(this.directory,crypto.createHash('sha256').update(scope).digest('hex')+'.json'):null
  if(this.file&&fs.existsSync(this.file)){
   try{
    const data=JSON.parse(fs.readFileSync(this.file,'utf8'))
    if(!Array.isArray(data.cards)||data.cards.length>5)throw Error()
    this.cards=data.cards.map((c,i)=>({id:i+1,descriptor:validateDescriptor(c.descriptor),state:'waiting',result:''}))
    this.sequence=this.cards.length
   }catch{this.loadError='Saved plans could not be read; original file preserved.';this.readOnly=true}
  }
 }
 persist(){
  if(this.readOnly)throw Error(this.loadError)
  if(!this.file)return
  fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})
  fs.writeFileSync(this.file+'.tmp',JSON.stringify({cards:this.cards.map(c=>({descriptor:c.descriptor}))}),{mode:0o600})
  fs.renameSync(this.file+'.tmp',this.file)
 }
 snapshot(){
  this.reconcile()
  return {scopeKnown:!!this.scope,cards:this.cards.map(c=>({...copy(c),command:renderDescriptor(c.descriptor),label:commandCatalog.find(d=>d.id===c.descriptor.id)?.label,note:commandCatalog.find(d=>d.id===c.descriptor.id)?.note})),
   running:this.running,runActive:this.runActive,nextAt:this.nextAt,cursor:this.cursor,total:this.cards.length,delayMs:2000,error:this.loadError||'',capacity:5}
 }
 prepare(descriptor){
  if(this.runActive)throw Error('Stop the current queue before editing saved commands.')
  if(this.directory&&!this.scope)throw Error('Join and identify the Realm before saving Realm-scoped commands.')
  if(this.cards.length>=5)throw Error('Five saved commands maximum. Delete one before adding another.')
  const d=validateDescriptor(descriptor)
  this.validateChoices(d)
  const card={id:++this.sequence,descriptor:d,state:'waiting',result:''}
  this.cards.push(card);try{this.persist()}catch(e){this.cards.pop();throw e}
  return {accepted:true,queued:false,message:'Saved #'+card.id+': '+renderDescriptor(d)+'. Run Queue starts ALL commands in order.',plans:this.snapshot()}
 }
 validateChoices(d){
  const w=this.controller.world
  if(d.id==='follow'&&d.values.player!=='me'&&![...w.players.values()].some(p=>p.name.toLowerCase()===d.values.player.toLowerCase())&&!this.controller.connection.config?.ownerPlayerNames?.some(p=>p.toLowerCase()===d.values.player.toLowerCase()))throw Error('Choose an observed player or configured owner.')
  if(d.id==='hotbar'&&!w.inventory.has(d.values.slot-1))throw Error('That hotbar slot has not been received from the server.')
 }
 delete(id){
  if(this.runActive)throw Error('Stop the queue before deleting commands.')
  const before=this.cards;this.cards=this.cards.filter(c=>c.id!==id)
  if(this.cards.length===before.length)throw Error('Command not found.')
  try{this.persist()}catch(e){this.cards=before;throw e}
  return this.snapshot()
 }
 move(id,direction){
  if(this.runActive)throw Error('Stop the queue before changing order.')
  if(direction!==-1&&direction!==1)throw Error('Choose up or down.')
  const i=this.cards.findIndex(c=>c.id===id),j=i+direction
  if(i<0||j<0||j>=this.cards.length)throw Error('Cannot move that command.')
  const before=this.cards.slice();[this.cards[i],this.cards[j]]=[this.cards[j],this.cards[i]]
  try{this.persist()}catch(e){this.cards=before;throw e}
  return this.snapshot()
 }
 // Deprecated single-card activation must not bypass the ordered queue.
 select(){throw Error('Selection was removed. Use Run Queue to execute all saved commands in order.')}
 activate(){throw Error('Individual activation was removed. Use Run Queue.')}
 startAll(){
  if(this.runActive)throw Error('The command queue is already running.')
  if(!this.cards.length)throw Error('Save a command before starting the queue.')
  if(this.directory&&!this.scope)throw Error('Join a Realm before running a Realm-scoped queue.')
  if(!this.controller.connection.spawned)throw Error('Bot must be spawned in the Realm to run the queue.')
  if(this.controller.navigation.job||this.controller.navigation.mining.job)throw Error('Stop the current movement or mining job before starting a queue.')
  this.generation++;this.runActive=true;this.running=null;this.cursor=0;this.nextAt=null
  for(const c of this.cards){c.state='waiting';c.result=''}
  this.dispatchNext()
  return {accepted:true,queued:this.runActive,message:this.runActive?'Queue started. Commands run top to bottom, with 2 seconds between completed actions.':'All saved commands processed.',plans:this.snapshot()}
 }
 dispatchNext(){
  if(!this.runActive)return
  if(this.cursor>=this.cards.length){this.finish();return}
  if(!this.controller.connection.spawned){this.interrupt('Disconnected; queue stopped without automatic resume.');return}
  const card=this.cards[this.cursor]
  this.running=card.id;card.state='running';card.result=''
  try{
   const d=validateDescriptor(card.descriptor);this.validateChoices(d)
   const response=this.controller.handle(renderDescriptor(d))
   card.result=String(response?.message||'No response from command.')
   if(!response?.accepted){card.state='blocked';this.interrupt('Command rejected; remaining queue stopped.');return}
   // Long-running navigation must finish before the 2-second inter-command delay.
   if(this.controller.navigation.job||this.controller.navigation.mining.job){this.schedulePoll();return}
   card.state=['wall','floor','shelter','supply','route'].includes(d.id)?'preview-only':'completed'
   this.advance()
  }catch(e){card.state='failed';card.result=String(e.message||e);this.interrupt('Command failed; remaining queue stopped.')}
 }
 schedulePoll(){
  this.clearTimer()
  const token=this.generation
  this.timer=this.schedule(()=>{this.timer=null;if(token!==this.generation||!this.runActive)return;this.reconcile();if(this.runActive&&this.running!==null)this.schedulePoll()},250)
  this.timer?.unref?.()
 }
 reconcile(){
  if(!this.runActive||this.running===null)return
  if(this.controller.navigation.job||this.controller.navigation.mining.job)return
  const card=this.cards.find(c=>c.id===this.running)
  const nav=this.controller.navigation
  if(card){
   if(nav.state==='stopped'||nav.state==='cancelled'){card.state='interrupted';card.result=nav.reason||'Movement interrupted.';this.interrupt('Movement interrupted; remaining queue stopped.');return}
   card.state=nav.state==='confirmed'?'completed':'finished-unverified'
   if(nav.reason)card.result=nav.reason
  }
  this.advance()
 }
 advance(){
  if(!this.runActive)return
  this.running=null;this.cursor++
  if(this.cursor>=this.cards.length){this.finish();return}
  this.nextAt=this.clock()+2000
  this.clearTimer()
  const token=this.generation
  this.timer=this.schedule(()=>{this.timer=null;if(token!==this.generation||!this.runActive)return;this.nextAt=null;this.dispatchNext()},2000)
  this.timer?.unref?.()
 }
 finish(){this.clearTimer();this.generation++;this.runActive=false;this.running=null;this.nextAt=null}
 clearTimer(){if(this.timer!==null){this.unschedule(this.timer);this.timer=null}}
 interrupt(reason='Stopped by owner.'){
  this.clearTimer();this.generation++
  if(this.running!==null){const c=this.cards.find(x=>x.id===this.running);if(c&&c.state==='running'){c.state='interrupted';c.result=reason}}
  this.running=null;this.runActive=false;this.nextAt=null
 }
}

export function formOptions(world,query=''){return {players:[...world.players.values()].map(p=>p.name),hotbar:Array.from({length:9},(_,i)=>({slot:i+1,known:world.inventory.has(i),name:world.inventory.has(i)?(world.inventory.get(i)?.network_id?world.registry?.items?.[world.inventory.get(i).network_id]?.name||'unknown':'empty'):'unknown',count:world.inventory.get(i)?.count||0})),materials:searchCatalog(query),visible:world.scan().found.map(p=>{const assessment=miningAssessment(world,p,{explicit:true});return {...p,tool:assessment.tool||'unknown / unsuitable',durationMs:assessment.durationMs||null,eligible:assessment.ok,reason:assessment.reason||'Server must confirm removal'}}),heldSlot:world.selectedSlot===null?null:world.selectedSlot+1}}
