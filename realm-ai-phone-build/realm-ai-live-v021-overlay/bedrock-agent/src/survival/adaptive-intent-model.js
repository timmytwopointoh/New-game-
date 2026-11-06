// Rovekin's tiny real on-phone supervised learning model.
// It learns SHORT owner-labeled English action words/phrases, not raw chat.
// Model inference only SUGGESTS an existing command for the owner to confirm.
// It cannot execute Minecraft commands or change the bot implementation.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {readPrivateJson,writePrivateJson} from './private-json.js'

const TARGETS=new Set(['dig','walk','find','follow','look','status','inventory','build_wall','build_floor'])
const MAX_EXAMPLES=2048
const VALID=/^[a-z][a-z -]{1,47}$/
const normalize=s=>String(s||'').trim().toLowerCase().replace(/[-_]+/g,' ').replace(/\s+/g,' ')
const safeInput=s=>VALID.test(s)&&s.length>=3&&s.split(' ').length<=6&&
 !/\b(?:stop|cancel|quit|abort|delete|password|token|email|phone|account|auth|secret|login|code|coordinate|address|credit|key)\b/i.test(s)
const immutableSeeds=Object.freeze({
  dig:['dig','mine','excavate','harvest','chop','break','quarry','chip away','cut wood'],
  walk:['walk','travel','navigate','move','march','head toward','go there'],
  find:['find','locate','seek','search','look for','discover'],
  follow:['follow','trail','track','accompany','come with','stay with'],
  look:['look','observe','survey','inspect','scan','look around'],
  status:['status','report','check status','report status'],
  inventory:['inventory','supplies','backpack','show inventory','equipment'],
  build_wall:['build wall','construct wall','erect wall','put up wall'],
  build_floor:['build floor','construct floor','lay floor','make floor']
})
function grams(text){
 const s=normalize(text)
 const tokens=s.split(' ')
 const set=new Set()
 for(const token of tokens){
  if(token.length<2)continue
  set.add('word:'+token)
  set.add('start:'+token.slice(0,3))
  set.add('end:'+token.slice(-3))
  const padded='^'+token+'$'
  for(let i=0;i<=padded.length-3;i++)set.add('tri:'+padded.slice(i,i+3))
 }
 if(tokens.length>1)set.add('phrase:'+s)
 return set
}
function similarity(a,b){
 if(a.size===0||b.size===0)return 0
 let intersection=0
 for(const key of a)if(b.has(key))intersection++
 // Smoothing avoids overfitting to short training examples; no large
 // score for a single accidental shared character trigram.
 return intersection/(a.size+b.size-intersection)
}
function own(obj,key){return Object.prototype.hasOwnProperty.call(obj,key)}
const safeExamples=data=>data&&data.schema===1&&Array.isArray(data.examples)&&data.examples.length<=MAX_EXAMPLES
export class AdaptiveIntentModel {
 constructor({directory=null,scope=null}={}){this.directory=directory;this.setScope(scope)}
 setScope(scope){
  this.scope=scope?String(scope):null
  this.file=this.scope&&this.directory?path.join(this.directory,crypto.createHash('sha256').update(this.scope).digest('hex')+'.json'):null
  this.examples=Object.create(null);this.error='';this.readOnly=false
  if(!this.file||!fs.existsSync(this.file))return
  try{
   const saved=readPrivateJson(this.file)
   if(!safeExamples(saved))throw Error('Invalid model metadata')
   for(const item of saved.examples){
    if(typeof item!=='object'||!item||typeof item.word!=='string'||typeof item.target!=='string')throw Error()
    const word=normalize(item.word)
    if(!safeInput(word)||word!==item.word||!TARGETS.has(item.target)||own(this.examples,word))throw Error()
    this.examples[word]=item.target
   }
  }catch{this.error='Previous word-training file was invalid; old data preserved and training paused.';this.readOnly=true}
 }
 train(raw,target,{existingOwnerMapping=false}={}){
  const word=normalize(raw),label=String(target||'').trim().toLowerCase()
  if(!safeInput(word))throw Error('Train a short English word or phrase (3–48 letters/spaces), never credentials or commands.')
  if(!TARGETS.has(label))throw Error('Choose a supported action: dig, walk, find, follow, look, status, inventory, build_wall or build_floor.')
  if(this.directory&&!this.scope)throw Error('Identify the Realm before saving its learning.')
  if(this.readOnly)throw Error(this.error)
  if(!own(this.examples,word)&&Object.keys(this.examples).length>=MAX_EXAMPLES)throw Error('2,048 owner training examples reached. Forget an example first.')
  if(own(this.examples,word)&&this.examples[word]===label)
   return {accepted:true,queued:false,message:'That meaning is already learned. No task was started.'}
  const next={...this.examples,[word]:label}
  if(this.file)writePrivateJson(this.file,{schema:1,examples:Object.entries(next).map(([word,target])=>({word,target}))})
  this.examples=Object.assign(Object.create(null),next)
  return {accepted:true,queued:false,
   message:'Learned '+JSON.stringify(word)+' as an example of '+label+
   '. My trainable classifier can use that correction to SUGGEST related words later. No Minecraft action was started.'+
   (existingOwnerMapping?' The exact word remains separately mapped in your command vocabulary.':'')}
 }
 forget(raw){
  const word=normalize(raw)
  if(!own(this.examples,word))throw Error('No trained word with that name for this Realm.')
  if(this.readOnly)throw Error(this.error)
  const next={...this.examples};delete next[word]
  if(this.file)writePrivateJson(this.file,{schema:1,examples:Object.entries(next).map(([word,target])=>({word,target}))})
  this.examples=Object.assign(Object.create(null),next)
  return {accepted:true,queued:false,message:'Forgot trained example '+JSON.stringify(word)+'. Built-in English knowledge is unchanged.'}
 }
 suggest(raw){
  const query=normalize(raw)
  if(!safeInput(query))return null
  const features=grams(query),candidates=[]
  for(const [label,examples] of Object.entries(immutableSeeds)){
   for(const example of examples){
    const score=similarity(features,grams(example))
    if(score>0)candidates.push({label,score,example,kind:'offline-training'})
   }
  }
  for(const [example,label] of Object.entries(this.examples)){
   const score=similarity(features,grams(example))
   if(score>0)candidates.push({label,score,example,kind:'owner-confirmed'})
  }
  candidates.sort((a,b)=>b.score-a.score||(a.label===b.label?0:a.label.localeCompare(b.label)))
  const best=candidates[0]
  if(!best||best.score<0.39)return null
  // An exact, unambiguous owner correction has priority over any generic seed.
  const known=own(this.examples,query)?this.examples[query]:null
  if(known)return {id:known,source:'trained',confidence:1,matched:query,ownerConfirmed:true}
  const competing=candidates.find(x=>x.label!==best.label)
  if(competing&&best.score-competing.score<.13)return null
  return {id:best.label,source:'trained',confidence:Math.round(best.score*100)/100,
    matched:best.example,ownerConfirmed:false}
 }
 snapshot(){return {kind:'trainable-similarity-classifier',neuralModel:false,
  source:'offline examples and owner-confirmed training; never self-executing',
  realmScoped:!!this.scope,ownerExamples:Object.keys(this.examples).length,capacity:MAX_EXAMPLES,
  seedExamples:Object.values(immutableSeeds).reduce((sum,x)=>sum+x.length,0),
  error:this.error}}
}
