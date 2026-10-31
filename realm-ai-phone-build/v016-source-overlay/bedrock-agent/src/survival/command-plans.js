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
export class CommandPlans{
 constructor(controller,{directory=null,scope=null}={}){this.controller=controller;this.directory=directory;this.scope=null;this.file=null;this.cards=[];this.selected=null;this.running=null;this.sequence=0;this.setScope(scope)}
 setScope(scope){
  this.interrupt('Realm changed; no automatic resume.');this.scope=scope||null;this.cards=[];this.selected=null;this.readOnly=false;this.loadError=''
  this.file=this.directory&&scope?path.join(this.directory,crypto.createHash('sha256').update(scope).digest('hex')+'.json'):null
  if(this.file&&fs.existsSync(this.file)){try{const data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!Array.isArray(data.cards)||data.cards.length>5)throw Error();this.cards=data.cards.map((c,i)=>({id:i+1,descriptor:validateDescriptor(c.descriptor),state:'waiting',result:''}));this.sequence=this.cards.length}catch{this.loadError='Saved plans could not be read; original file preserved.';this.readOnly=true}}
 }
 persist(){if(this.readOnly)throw Error(this.loadError);if(!this.file)return;fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});fs.writeFileSync(this.file+'.tmp',JSON.stringify({cards:this.cards.map(c=>({descriptor:c.descriptor}))}),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file)}
 snapshot(){this.reconcile();return {scopeKnown:!!this.scope,cards:this.cards.map(c=>({...copy(c),command:renderDescriptor(c.descriptor),label:commandCatalog.find(d=>d.id===c.descriptor.id)?.label,note:commandCatalog.find(d=>d.id===c.descriptor.id)?.note})),selected:this.selected,running:this.running,error:this.loadError||'',capacity:5}}
 prepare(descriptor){
  if(this.directory&&!this.scope)throw Error('Join and identify the Realm before saving a Realm-scoped plan.')
  if(this.cards.length>=5)throw Error('Five plans are saved. Delete a card before preparing another.')
  const d=validateDescriptor(descriptor);this.validateChoices(d);const card={id:++this.sequence,descriptor:d,state:'waiting',result:''};this.cards.push(card);this.selected=null
  try{this.persist()}catch(e){this.cards.pop();throw e}
  return {accepted:true,queued:false,message:'Saved plan #'+card.id+': '+renderDescriptor(d)+'. Select it, then Activate Plan. Nothing executed.',plans:this.snapshot()}
 }
 validateChoices(d){
  const w=this.controller.world
  if(d.id==='follow'&&d.values.player!=='me'&&![...w.players.values()].some(p=>p.name.toLowerCase()===d.values.player.toLowerCase())&&!this.controller.connection.config?.ownerPlayerNames?.some(p=>p.toLowerCase()===d.values.player.toLowerCase()))throw Error('Choose an observed player or configured owner.')
  if(d.id==='hotbar'&&!w.inventory.has(d.values.slot-1))throw Error('That hotbar slot has not been received from the server.')
 }
 select(id){this.reconcile();if(this.running)throw Error('Stop the running plan before changing selection.');if(!this.cards.some(c=>c.id===id))throw Error('Choose a saved card.');this.selected=id;this.cards.find(c=>c.id===id).activationLocked=false;return this.snapshot()}
 delete(id){if(this.running===id)throw Error('Stop this plan before deleting it.');const before=this.cards;this.cards=this.cards.filter(c=>c.id!==id);try{this.persist()}catch(e){this.cards=before;throw e}if(this.selected===id)this.selected=null;return this.snapshot()}
 activate(id){
  this.reconcile();if(this.running!==null)throw Error('One plan is already running.');if(id!==this.selected)throw Error('Activate only the selected plan.')
  const card=this.cards.find(c=>c.id===id);if(!card)throw Error('Select a plan first.')
  // A completed card is reusable after explicit reselection. Duplicate activation taps are rejected.
  if(card.activationLocked)throw Error('Plan already activated. Select the card again to reuse it.')
  const d=validateDescriptor(card.descriptor),w=this.controller.world;this.validateChoices(d)
  if(d.id==='follow'&&d.values.player!=='me'&&![...w.players.values()].some(p=>p.name.toLowerCase()===d.values.player.toLowerCase())&&!this.controller.connection.config?.ownerPlayerNames?.some(p=>p.toLowerCase()===d.values.player.toLowerCase()))throw Error('Choose an observed player or configured owner.')
  card.activationLocked=true;card.state='running';this.running=id
  try{const result=this.controller.handle(renderDescriptor(d));card.result=result?.message||'';if(!result?.accepted){card.state='blocked';this.running=null}else if(!this.controller.navigation.job){card.state='completed';this.running=null}return {...result,plans:this.snapshot()}}catch(e){card.state='failed';this.running=null;card.result=e.message;throw e}
 }
 reconcile(){if(this.running===null)return;const card=this.cards.find(c=>c.id===this.running);if(!this.controller.navigation.job){if(card){card.state=this.controller.navigation.state==='stopped'?'interrupted':'finished-unverified';card.result=this.controller.navigation.reason||'Inputs finished; live success is not verified.'}this.running=null}}
 interrupt(reason='Stopped by owner.') {if(this.running!==null){const card=this.cards.find(c=>c.id===this.running);if(card){card.state='interrupted';card.result=reason}}this.running=null}
}
export function formOptions(world,query=''){return {players:[...world.players.values()].map(p=>p.name),hotbar:Array.from({length:9},(_,i)=>({slot:i+1,known:world.inventory.has(i),name:world.inventory.has(i)?(world.inventory.get(i)?.network_id?world.registry?.items?.[world.inventory.get(i).network_id]?.name||'unknown':'empty'):'unknown',count:world.inventory.get(i)?.count||0})),materials:searchCatalog(query),visible:world.scan().found.map(p=>{const assessment=miningAssessment(world,p,{explicit:true});return {...p,tool:assessment.tool||'unknown / unsuitable',durationMs:assessment.durationMs||null,eligible:assessment.ok,reason:assessment.reason||'Server must confirm removal'}}),heldSlot:world.selectedSlot===null?null:world.selectedSlot+1}}
