import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {commandCatalog} from './command-plans.js'
import {readPrivateJson,writePrivateJson} from './private-json.js'
import {resolveMaterial,materialNames} from './catalog.js'

const copy=x=>JSON.parse(JSON.stringify(x))
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const actionTargets=new Set(commandCatalog.filter(d=>d.fields.length||['status','movement','look','view_off','inventory','help','plan_status','rejoin','ensure'].includes(d.id)).map(d=>d.id))
const actionAliases={
 dig:['mine','break','excavate','chip','dig up','mine block'], walk:['move','go','head','travel','navigate','move to','go to','travel to'], find:['locate','search','search for','look for','seek'],
 look:['scan','survey','inspect','observe','view'], follow:['track','trail','accompany','go with'], status:['status','check status'], inventory:['items','check inventory'],
 hotbar:['switch slots','switch slot items','change slots','change selected slot','change the selected hotbar slot','select a tool','equip a tool'],
 build_wall:['construct wall'], build_floor:['construct floor']
}
const targetPrefix=id=>{
 const d=commandCatalog.find(x=>x.id===id);if(!d)return null
 const ix=d.template.indexOf('{');return (ix<0?d.template:d.template.slice(0,ix)).trim()
}
const normalize=s=>String(s).toLowerCase().trim().replace(/[_-]+/g,' ').replace(/\s+/g,' ')

const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const entriesFor=kind=>kind==='action'?'actions':kind==='material'?'materials':null
const wordPattern=word=>word.split(' ').map(escapeRegex).join('[ _-]+')
export class CommandVocabulary{
 constructor({directory=null,scope=null,intentModel=null}={}){this.directory=directory;this.intentModel=intentModel;this.setScope(scope)}
 setScope(scope){
  this.intentModel?.setScope(scope)
  this.scope=scope||null;this.actions=Object.create(null);this.materials=Object.create(null);this.definitions=Object.create(null);this.readOnly=false;this.error=''
  this.file=this.directory&&scope?path.join(this.directory,crypto.createHash('sha256').update(String(scope)).digest('hex')+'.json'):null
  if(!this.file||!fs.existsSync(this.file))return
  try{
   const data=readPrivateJson(this.file)
   if(!isRecord(data)||!isRecord(data.actions)||!isRecord(data.materials)||Object.keys(data.actions).length+Object.keys(data.materials).length>200)throw Error()
   const actions=Object.create(null),materials=Object.create(null)
   for(const [word,id] of Object.entries(data.actions)){if(!this.validWord(word)||word!==normalize(word)||!actionTargets.has(id)||this.conflicts('action',word,id))throw Error();actions[word]=id}
   for(const [word,name] of Object.entries(data.materials)){if(!this.validWord(word)||word!==normalize(word)||typeof name!=='string'||resolveMaterial(name)!==name||this.conflicts('material',word,name))throw Error();materials[word]=name}
   this.actions=actions;this.materials=materials
   if(isRecord(data.definitions))for(const [word,value] of Object.entries(data.definitions).slice(-50)){const clean=this.cleanDefinition(word,value);if(clean)this.definitions[word]=clean}
  }catch{this.error='Saved vocabulary could not be read; original file preserved. No saved mappings were loaded.';this.readOnly=true}
 }
 validWord(word){return typeof word==='string'&&word.trim().length>=2&&word.trim().length<=48&&!/[\r\n\x00-\x1f{}=]/.test(word)&&!['__proto__','constructor','prototype'].includes(word.trim().toLowerCase())}
 conflicts(kind,word,target){
  if(/^(?:stop|cancel|abort|command|commands|teach|forget|activate)(?:\s|$)/.test(word))return true
  if(kind==='action'){
   const canonical=commandCatalog.find(d=>[d.id,normalize(d.template),normalize(d.template.split(/[ {]/)[0])].includes(word))
   const builtin=Object.entries(actionAliases).find(([,words])=>words.includes(word))?.[0]
   return !!((canonical&&canonical.id!==target)||(builtin&&builtin!==target))
  }
  const material=resolveMaterial(word)
  return !!(material&&material!==target)
 }
 persist(actions=this.actions,materials=this.materials){if(this.readOnly)throw Error(this.error);writePrivateJson(this.file,{actions,materials,definitions:this.definitions})}
 cleanDefinition(word,result){
  if(!/^[a-z][a-z-]{1,29}$/.test(word)||!isRecord(result)||typeof result.definition!=='string'||!result.definition.trim())return null
  const clean=value=>String(value||'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,200)
  return {definition:clean(result.definition),source:clean(result.source||'dictionary').slice(0,60),sourceCount:Number.isSafeInteger(result.sourceCount)?Math.max(1,Math.min(10,result.sourceCount)):1,
   meanings:(Array.isArray(result.meanings)?result.meanings:[]).slice(0,4).map(m=>({partOfSpeech:clean(m.partOfSpeech).slice(0,24),definitions:(Array.isArray(m.definitions)?m.definitions:[]).slice(0,3).map(clean)})),
   relatedTerms:(Array.isArray(result.relatedTerms)?result.relatedTerms:[]).slice(0,12).filter(t=>/^[a-z][a-z-]{1,29}$/.test(t?.word||'')).map(t=>({word:t.word,source:t.source==='dictionary'?'dictionary':'offline',senses:(Array.isArray(t.senses)?t.senses:[]).slice(0,2).map(m=>({partOfSpeech:clean(m.partOfSpeech).slice(0,24),definition:clean(m.definition)}))}))}
 }
 definitionFor(word){return this.definitions[normalize(word)]?copy(this.definitions[normalize(word)]):null}
 rememberDefinition(word,result){
  if(this.readOnly||this.directory&&!this.scope)return false
  const key=normalize(word),clean=this.cleanDefinition(key,result);if(!clean)return false
  const previous=this.definitions;this.definitions=Object.assign(Object.create(null),previous);delete this.definitions[key];this.definitions[key]=clean
  while(Object.keys(this.definitions).length>50)delete this.definitions[Object.keys(this.definitions)[0]]
  try{this.persist()}catch(e){this.definitions=previous;throw e}
  return true
 }
 teach(kind,word,target){
  if(this.directory&&!this.scope)throw Error('Join and identify the Realm before saving Realm-specific vocabulary.')
  const key=normalize(word),value=normalize(target)
  if(!this.validWord(key))throw Error('Use a word or short phrase from 2 to 48 characters.')
  const field=entriesFor(kind);if(!field)throw Error('Teach an action or material.')
  let learned
  if(kind==='action'){
   const def=commandCatalog.find(d=>d.id===String(target).trim().toLowerCase()||normalize(d.label)===value)
   learned=def?.id||Object.entries(actionAliases).find(([,words])=>words.includes(value))?.[0]
   if(!learned||!actionTargets.has(learned))throw Error('Choose a supported action such as dig, walk, find, follow, look, status or inventory.')
  }else{learned=resolveMaterial(value);if(!learned)throw Error('Choose a material name from the Minecraft catalog.')}
  if(this.conflicts(kind,key,learned))throw Error('That word already has a built-in meaning or is a control word. Choose a different nickname.')
  if(!Object.hasOwn(this[field],key)&&Object.keys(this.actions).length+Object.keys(this.materials).length>=200)throw Error('Vocabulary holds 200 mappings. Forget an old mapping before adding another.')
  const actions={...this.actions},materials={...this.materials};(kind==='action'?actions:materials)[key]=learned
  this.persist(actions,materials);this.actions=actions;this.materials=materials
  if(kind==='action')try{this.intentModel?.train(key,learned,{existingOwnerMapping:true})}catch{}
  return {accepted:true,queued:false,message:`Learned ${JSON.stringify(key)} as ${kind} ${learned}. It is saved for this Realm; complete direct instructions can run without Activate, while saved cards remain manual.`}
 }
 forget(kind,word){
  const field=entriesFor(kind),key=normalize(word);if(!field||!Object.hasOwn(this[field],key))throw Error('That learned word is not saved in this Realm.')
  const actions={...this.actions},materials={...this.materials};delete (kind==='action'?actions:materials)[key]
  this.persist(actions,materials);this.actions=actions;this.materials=materials
  if(kind==='action')try{this.intentModel?.forget(key)}catch{}
  return {accepted:true,queued:false,message:`Forgot the learned ${kind} word ${JSON.stringify(key)} for this Realm. Built-in vocabulary is unchanged.`}
 }
 list(){return {scopeKnown:!!this.scope,actions:copy(this.actions),materials:copy(this.materials),count:Object.keys(this.actions).length+Object.keys(this.materials).length,capacity:200,source:'owner-confirmed corrections',error:this.error}}
 meaning(word){const key=normalize(word);if(Object.hasOwn(this.materials,key))return {kind:'material',target:this.materials[key]};if(Object.hasOwn(this.actions,key))return {kind:'action',target:this.actions[key],label:commandCatalog.find(d=>d.id===this.actions[key])?.label};return null}
 expand(raw){
  let text=String(raw).trim(),changed=false
  const learned=new Set(Object.keys(this.actions)),actionEntries=[...Object.entries(actionAliases).flatMap(([id,words])=>words.map(word=>[normalize(word),id])).filter(([word])=>!learned.has(word)),...Object.entries(this.actions)]
  actionEntries.sort((a,b)=>b[0].length-a[0].length)
  for(const [word,id] of actionEntries){const re=new RegExp('^'+wordPattern(word)+'(?=$|\\s|[,])','i');if(re.test(text)){const prefix=targetPrefix(id);if(prefix){text=text.replace(re,prefix);text=text.replace(/^(walk to)\s+to\b/i,'$1');changed=true;break}}}
  text=text.replace(/^(find|search)\s+(?:for|out)\s+/i,'find ')
  return this.expandMaterials(text,changed)
 }
 expandMaterials(raw,changed=false){
  let text=String(raw)
  for(const [word,name] of Object.entries(this.materials).sort((a,b)=>b[0].length-a[0].length)){
   const re=new RegExp('(^|[^a-z0-9_])('+wordPattern(word)+')(?=$|[^a-z0-9_])','gi')
   text=text.replace(re,(_,prefix)=>{changed=true;return prefix+name})
  }
  return {text,changed}
 }
}

function distance(a,b){const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old}}return prev[b.length]}
export function suggestAction(raw,vocabulary){
 const first=normalize(raw).split(' ')[0];if(!first||first.length<3)return null
 const canonical=commandCatalog.map(d=>[normalize(d.template.split(/[ {]/)[0]),d.id])
 const entries=[...canonical,...Object.entries(actionAliases).flatMap(([id,words])=>words.map(word=>[normalize(word),id])),...Object.entries(vocabulary?.actions||{})]
 const best=entries.map(([word,id])=>({word,id,distance:distance(first,word)})).sort((a,b)=>a.distance-b.distance||a.word.localeCompare(b.word))[0]
 if(!best||best.distance>Math.max(1,Math.floor(first.length*0.22))){
   const suggestion=vocabulary?.intentModel?.suggest(first)
   return suggestion?{word:first,id:suggestion.id,source:'trained',confidence:suggestion.confidence,matched:suggestion.matched}:null
 }
 return best
}
export function resolveActionTarget(raw){
 const value=normalize(raw).replace(/^(?:i mean |it means |i meant |that means |use |to )/,'')
 const def=commandCatalog.find(d=>d.id===value||normalize(d.label)===value||normalize(d.template.split(/[ {]/)[0])===value)
 if(def&&actionTargets.has(def.id))return def.id
 for(const [id,words] of Object.entries(actionAliases))if(words.some(word=>normalize(word)===value))return id
 return null
}
export function suggestMaterial(raw){
 const query=normalize(raw).replace(/ /g,'_');if(query.length<3)return null
 const candidates=materialNames.map(name=>({name,forms:[name,name.replace(/_(?:ingot|ore|raw|block|item|planks?)$/,'').replace(/_/g,' '),name.replace(/_/g,'')]}))
 const ranked=candidates.map(({name,forms})=>({name,distance:Math.min(...forms.map(form=>Math.min(distance(query,form),distance(query.replace(/_/g,''),form.replace(/[ _]/g,'')))))})).sort((a,b)=>a.distance-b.distance||a.name.localeCompare(b.name))
 const best=ranked[0];if(!best||best.distance>Math.max(1,Math.floor(query.length*0.25)))return null
 const ties=ranked.filter(x=>x.distance===best.distance).slice(0,4).map(x=>x.name)
 return ties.length===1?best.name:ties
}
