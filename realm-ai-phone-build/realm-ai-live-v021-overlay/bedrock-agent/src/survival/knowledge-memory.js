// Expandable on-phone language memory (app private files directory).
// One bounded, hashed JSON record per word: no fixed 50-word/200-word TOTAL
// ceiling, no full-database load and no user-controlled filesystem paths.
// The limit is real phone free space. Stop writes before storage exhaustion.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const VALID=/^[a-z][a-z-]{1,29}$/
const NAME=s=>String(s||'').trim().toLowerCase()
const safeText=(s,max=240)=>String(s||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)
const cleanSense=s=>({partOfSpeech:safeText(s?.partOfSpeech,24),definition:safeText(s?.definition,240),
 synonyms:(Array.isArray(s?.synonyms)?s.synonyms:[]).slice(0,10).map(x=>safeText(x,30)).filter(Boolean)})
const diskReserve=64*1024*1024 // leave room for the OS, downloads and Realm packs
export class KnowledgeMemory{
 constructor({directory=null,scope=null}={}){this.directory=directory;this.scope=null;this.error='';this.readOnly=false;this.setScope(scope)}
 setScope(scope){
  this.scope=scope?String(scope):null;this.readOnly=false;this.error='';this.summaryCache=null
  this.base=this.directory&&this.scope?path.join(this.directory,crypto.createHash('sha256').update(this.scope).digest('hex')):null
 }
 filename(word){
  const w=NAME(word);if(!VALID.test(w)||!this.base)return null
  const hash=crypto.createHash('sha256').update(w).digest('hex')
  return path.join(this.base,hash.slice(0,2),hash+'.json')
 }
 canStore(){
  if(!this.base||this.readOnly)return false
  if(typeof fs.statfsSync!=='function')return true
  try{
   const p=fs.existsSync(this.base)?this.base:fs.existsSync(this.directory)?this.directory:path.dirname(this.directory)
   const stat=fs.statfsSync(p,{bigint:true})
   if(stat.bavail*stat.bsize<BigInt(diskReserve)){this.error='Phone storage is running low. Previous learning is preserved; new memories are paused.';return false}
   return true
  }catch{return true} // Android may not expose statfs in older Node
 }
 recall(word){
  const file=this.filename(word);if(!file||!fs.existsSync(file))return null
  try{
   const stat=fs.statSync(file)
   if(stat.size>16384||!stat.isFile())throw Error('Record is invalid')
   const data=JSON.parse(fs.readFileSync(file,'utf8'))
   if(data?.schema!==1||data.word!==NAME(word)||!Array.isArray(data.senses)||data.senses.length>4)throw Error('Record is invalid')
   return data
  }catch{this.error='A language memory could not be read; saved file remains for recovery.';return null}
 }
 learn(word,{meanings=[],source='offline',related=[],concept=null,context=''}={}){
  const w=NAME(word),file=this.filename(w)
  if(!file||!this.canStore())return false
  const senses=(Array.isArray(meanings)?meanings:[]).slice(0,4).map(cleanSense).filter(x=>x.definition)
  if(!senses.length)return false
  const refs=(Array.isArray(related)?related:[]).slice(0,64)
   .map(x=>NAME(typeof x==='string'?x:x?.word)).filter(x=>VALID.test(x)&&x!==w).slice(0,48)
  const prev=this.recall(w)
  const existing=prev?.senses||[]
  const merged=[...senses,...existing.filter(x=>!senses.some(y=>y.definition===x.definition))].slice(0,4)
  const now=Date.now()
  const record={schema:1,word:w,senses:merged,source:safeText(source,60),
   related:[...new Set([...refs,...(prev?.related||[])])].slice(0,48),
   // Contextual concept hints describe connections; they never become commands.
   comprehension:concept&&Number.isFinite(concept.score)?{
    score:Math.max(0,Math.min(1,concept.score)),evidence:Math.min(1000,Math.max(0,Math.floor(concept.evidence||0))),
    summary:safeText(concept.summary,240),ambiguous:!!concept.ambiguous
   }:prev?.comprehension||null,
   exampleContext:safeText(context,140),createdAt:prev?.createdAt||now,updatedAt:now}
  const payload=JSON.stringify(record)
  if(Buffer.byteLength(payload)>16000){this.error='Individual word record exceeded its safe size.';return false}
  try{
   fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700})
   const tmp=file+'.tmp'
   fs.writeFileSync(tmp,payload,{mode:0o600})
   fs.renameSync(tmp,file)
   this.error='';this.summaryCache=null
   return true
  }catch{
   this.error='Could not save knowledge; previously saved records are unchanged.'
   try{fs.unlinkSync(file+'.tmp')}catch{}
   return false
  }
 }
 learnExploration(root,result,tree,{context=''}={}){
  const primary=this.learn(root,{meanings:result.meanings?.flatMap(m=>
   (m.definitions||[]).map(definition=>({partOfSpeech:m.partOfSpeech,definition,synonyms:m.synonyms||[]})))||[],
   source:result.source||'dictionary',related:tree.terms,
   concept:tree.concept||null,context})
  let linked=0
  // Disk file per genuine observed definition: no total vocabulary cap.
  // A single lookup writes a bounded batch to avoid excessive I/O.
  for(const term of (tree.terms||[]).slice(0,40)){
   if(this.learn(term.word,{meanings:(term.senses||[]).map(s=>({partOfSpeech:s.partOfSpeech,definition:s.definition})),
    source:term.source||'offline',related:term.related||[],context:''}))linked++
  }
  return {primary,linked}
 }
 summary(){
  if(this.summaryCache&&Date.now()-this.summaryCache.at<60000)return {...this.summaryCache.value,error:this.error}
  if(!this.base)return {realmScoped:false,storage:'unavailable until Realm identified',error:this.error}
  let words=0
  try{
   if(fs.existsSync(this.base))for(const shard of fs.readdirSync(this.base,{withFileTypes:true})){
    if(!shard.isDirectory()||!/^[a-f0-9]{2}$/.test(shard.name))continue
    words+=fs.readdirSync(path.join(this.base,shard.name)).filter(x=>/^[a-f0-9]{64}\.json$/.test(x)).length
   }
  }catch{this.error='Could not count stored knowledge; memories were not removed.'}
  const value={realmScoped:true,words,storage:'private on-phone app files; limited by available device storage, not a preset word count',diskFreeReserveMB:64,error:this.error}
  this.summaryCache={at:Date.now(),value};return value
 }
}
