import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {commandCatalog} from './command-plans.js'
import {resolveMaterial,materialNames} from './catalog.js'

const copy=x=>JSON.parse(JSON.stringify(x))
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const actionTargets=new Set(commandCatalog.filter(d=>d.fields.length||['status','movement','look','view_off','inventory','help','plan_status','rejoin','ensure'].includes(d.id)).map(d=>d.id))
const actionAliases={
 dig:['mine','break','excavate','chip'], walk:['move','go','head'], find:['locate','search'],
 look:['scan','survey'], follow:['track'], status:['status','check status'], inventory:['items','check inventory'],
 build_wall:['construct wall'], build_floor:['construct floor']
}
const targetPrefix=id=>{
 const d=commandCatalog.find(x=>x.id===id);if(!d)return null
 const ix=d.template.indexOf('{');return (ix<0?d.template:d.template.slice(0,ix)).trim()
}
const normalize=s=>String(s).toLowerCase().trim().replace(/[_-]+/g,' ').replace(/\s+/g,' ')

export class CommandVocabulary{
 constructor({directory=null,scope=null}={}){this.directory=directory;this.scope=null;this.file=null;this.actions={};this.materials={};this.readOnly=false;this.error='';this.setScope(scope)}
 setScope(scope){this.scope=scope||null;this.actions={};this.materials={};this.readOnly=false;this.error='';this.file=this.directory&&scope?path.join(this.directory,crypto.createHash('sha256').update(String(scope)).digest('hex')+'.json'):null;if(this.file&&fs.existsSync(this.file)){try{const data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!data||typeof data.actions!=='object'||typeof data.materials!=='object'||Object.keys(data.actions).length+Object.keys(data.materials).length>200)throw Error();this.actions=data.actions;this.materials=data.materials;for(const [word,id] of Object.entries(this.actions)){if(!this.validWord(word)||!actionTargets.has(id))throw Error()}for(const [word,name] of Object.entries(this.materials)){if(!this.validWord(word)||!resolveMaterial(name))throw Error()}}catch{this.error='Saved vocabulary could not be read; original file preserved.';this.readOnly=true}}}
 validWord(word){return typeof word==='string'&&word.trim().length>=2&&word.trim().length<=48&&!/[\r\n\x00-\x1f{}=]/.test(word)&&!['__proto__','constructor','prototype'].includes(word.trim().toLowerCase())}
 persist(){if(this.readOnly)throw Error(this.error);if(!this.file)return;fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});fs.writeFileSync(this.file+'.tmp',JSON.stringify({actions:this.actions,materials:this.materials}),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file)}
 teach(kind,word,target){
  if(this.directory&&!this.scope)throw Error('Join and identify the Realm before saving Realm-specific vocabulary.')
  const key=normalize(word),value=normalize(target)
  if(!this.validWord(key))throw Error('Use a word or short phrase from 2 to 48 characters.')
  let learned
  if(kind==='action'){
   const def=commandCatalog.find(d=>d.id===value||normalize(d.label)===value)
   const aliasTarget=def?.id||Object.entries(actionAliases).find(([id,words])=>words.some(w=>normalize(w)===value))?.[0]
   if(!aliasTarget||!actionTargets.has(aliasTarget))throw Error('Choose a supported action such as dig, walk, find, follow, look, status or inventory.')
   learned=aliasTarget;this.actions[key]=aliasTarget
  }else if(kind==='material'){
   const material=resolveMaterial(value);if(!material)throw Error('Choose a material name from the Minecraft catalog.')
   this.materials[key]=material
  }else throw Error('Teach an action or material.')
  this.persist();return {accepted:true,queued:false,message:`Learned ${JSON.stringify(key)} as ${kind} ${kind==='action'?learned:this.materials[key]}. It is saved for this Realm; actions still need the command prefix and Activate.`}
 }
 list(){return {scopeKnown:!!this.scope,actions:copy(this.actions),materials:copy(this.materials),error:this.error}}
 expand(raw){
  let text=String(raw),changed=false
  const learned=new Set(Object.keys(this.actions)),actionEntries=[...Object.entries(actionAliases).flatMap(([id,words])=>words.map(word=>[normalize(word),id])).filter(([word])=>!learned.has(word)),...Object.entries(this.actions)]
  actionEntries.sort((a,b)=>b[0].length-a[0].length)
  for(const [word,id] of actionEntries){const re=new RegExp('^'+escapeRegex(word)+'(?=$|\\s|[,])','i');if(re.test(normalize(text))){const prefix=targetPrefix(id);if(prefix){text=text.replace(re,prefix);if(/\bto$/i.test(prefix))text=text.replace(/^(walk to)\s+to\b/i,'$1');changed=true;break}}}
  const materialEntries=Object.entries(this.materials).sort((a,b)=>b[0].length-a[0].length)
  for(const [word,name] of materialEntries){const re=new RegExp('\\b'+escapeRegex(word)+'\\b','i');if(re.test(text)){text=text.replace(re,name);changed=true}}
  return {text,changed}
 }
}

function distance(a,b){const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old}}return prev[b.length]}
export function suggestAction(raw,vocabulary){
 const first=normalize(raw).split(' ')[0];if(!first||first.length<3)return null
 const canonical=commandCatalog.map(d=>[normalize(d.template.split(/[ {]/)[0]),d.id])
 const entries=[...canonical,...Object.entries(actionAliases).flatMap(([id,words])=>words.map(word=>[normalize(word),id])),...Object.entries(vocabulary?.actions||{})]
 const best=entries.map(([word,id])=>({word,id,distance:distance(first,word)})).sort((a,b)=>a.distance-b.distance||a.word.localeCompare(b.word))[0]
 if(!best||best.distance>Math.max(1,Math.floor(first.length*0.22)))return null
 return best
}
export function resolveActionTarget(raw){
 const value=normalize(raw).replace(/^(?:i mean |it means |i meant |that means |use )/,'')
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
