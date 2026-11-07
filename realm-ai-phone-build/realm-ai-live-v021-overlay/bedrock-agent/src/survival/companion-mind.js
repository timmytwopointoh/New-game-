// Small adaptive preference model, per-install and per-Realm.
// It is NOT a neural LLM and does not generate unrestricted code. It really
// updates action/material preferences from server-confirmed outcomes, and
// retains an independent style/temperament between sessions.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0))
const key=s=>String(s||'').replace(/^minecraft:/,'').toLowerCase().replace(/[^a-z0-9_:-]/g,'').slice(0,72)
const validRecord=s=>s&&typeof s==='object'&&!Array.isArray(s)
const safeCount=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000
export class CompanionMind{
 constructor({directory=null,scope=null,random=Math.random}={}){
  this.directory=directory;this.random=random;this.scope=null;this.state=null;this.readOnly=false;this.error=''
  this.setScope(scope)
 }
 fileForScope(scope){return this.directory&&scope?path.join(this.directory,crypto.createHash('sha256').update(String(scope)).digest('hex')+'.json'):null}
 blank(){
  // Independent personality is generated only once when a Realm profile is
  // created; each future launch uses the same private persisted identity.
  const percent=()=>Number(clamp(this.random(),0,.999999).toFixed(4))
  return {schema:1,persona:crypto.randomBytes(6).toString('hex'),
   temperament:{curiosity:percent(),boldness:percent(),craftsmanship:percent(),sociability:percent()},
   decisions:0,verifiedSuccesses:0,verifiedFailures:0,
   experiences:{},createdAt:Date.now(),updatedAt:Date.now()}
 }
 setScope(scope){
  this.scope=scope?String(scope):null;this.file=this.fileForScope(this.scope)
  this.state=this.blank();this.readOnly=false;this.error=''
  if(!this.file)return
  // Lock in the initial persona as soon as the Realm identity exists.
  // Without this, a character that has not yet learned a task is randomly
  // recreated on every reconnect despite claiming a persistent personality.
  if(!fs.existsSync(this.file)){this.persist();return}
  try{
   const x=JSON.parse(fs.readFileSync(this.file,'utf8'))
   if(x?.schema!==1||typeof x.persona!=='string'||!/^([a-f0-9]{12})$/.test(x.persona)||
     !validRecord(x.temperament)||!validRecord(x.experiences)||Object.keys(x.experiences).length>192||
     !safeCount(x.decisions)||!safeCount(x.verifiedSuccesses)||!safeCount(x.verifiedFailures))throw Error('Invalid profile')
   for(const property of ['curiosity','boldness','craftsmanship','sociability']){
    const v=x.temperament[property]
    if(!Number.isFinite(v)||v<0||v>1)throw Error('Invalid temperament')
   }
   for(const [id,xp] of Object.entries(x.experiences))
    if(!/^[-a-z0-9_:]{1,96}$/.test(id)||!validRecord(xp)||!safeCount(xp.successes)||!safeCount(xp.failures))throw Error('Invalid learning')
   this.state=x
  }catch{this.readOnly=true;this.error='Saved companion mind could not be read. The original file is preserved.'}
 }
 persist(){
  if(this.readOnly||!this.file)return
  try{
   fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})
   const temp=this.file+'.tmp'
   fs.writeFileSync(temp,JSON.stringify(this.state),{mode:0o600})
   fs.renameSync(temp,this.file)
  }catch{this.error='Could not save adaptive learning; only this session is updated.'}
 }
 experience(kind,material){return String(kind).slice(0,18)+':'+key(material)}
 // Context-aware randomized exploration, biased by verified experience.
 // Higher success rate means the companion is more likely to reuse the idea.
 // Safety checks remain unconditional outside the preference model.
 weight(kind,material,{biome=null,base=1}={}){
  const k=String(kind)+':'+key(material),e=this.state.experiences[k]||{successes:0,failures:0}
  const mean=(e.successes+1)/(e.successes+e.failures+2)
  const b=biome?this.state.experiences['biome:'+key(biome)+':'+key(material)]:null
  const bonus=b?(b.successes+1)/(b.successes+b.failures+2):.5
  const curiosity=.3+this.state.temperament.curiosity*.5
  return Math.max(.01,Number(base)||1)*(.5+mean*1.3+bonus*.4+curiosity*Math.sqrt(1/(e.successes+e.failures+1)))
 }
 choose(kind,candidates,{biome=null,pick=this.random}={}){
  if(!Array.isArray(candidates)||!candidates.length)return null
  const weighted=candidates.map(c=>({c,w:this.weight(kind,c.material,{biome,base:c.weight||1})}))
  const sum=weighted.reduce((n,x)=>n+x.w,0)
  let roll=clamp(pick(),0,.999999)*sum,picked=weighted.at(-1).c
  for(const x of weighted){roll-=x.w;if(roll<0){picked=x.c;break}}
  this.state.decisions=Math.min(100000,this.state.decisions+1);this.state.updatedAt=Date.now();this.persist()
  return picked
 }
 record(kind,material,{outcome,biome=null,evidence=null}={}){
  if(!['confirmed','blocked'].includes(outcome)||!['server-block-update','server-inventory-increase','server-position',
   'verified-construction-stage'].includes(evidence)||!this.scope||this.readOnly)return false
  const group=String(kind).slice(0,18)+':'+key(material)
  if(!/^[-a-z0-9_:]{1,96}$/.test(group))return false
  const change=id=>{
   const x=this.state.experiences[id]||{successes:0,failures:0,updatedAt:0}
   x[outcome==='confirmed'?'successes':'failures']=Math.min(100000,x[outcome==='confirmed'?'successes':'failures']+1)
   x.updatedAt=Date.now();this.state.experiences[id]=x
  }
  change(group)
  if(biome&&key(biome))change('biome:'+key(biome)+':'+key(material))
  const ordered=Object.entries(this.state.experiences).sort((a,b)=>b[1].updatedAt-a[1].updatedAt)
  this.state.experiences=Object.fromEntries(ordered.slice(0,192))
  if(outcome==='confirmed')this.state.verifiedSuccesses=Math.min(100000,this.state.verifiedSuccesses+1)
  else this.state.verifiedFailures=Math.min(100000,this.state.verifiedFailures+1)
  this.state.updatedAt=Date.now();this.persist();return true
 }
 snapshot(){
  const x=this.state
  return {model:'on-device adaptive preference learner',neural:false,independentPersona:x.persona,
   temperament:{...x.temperament},decisions:x.decisions,
   verifiedSuccesses:x.verifiedSuccesses,verifiedFailures:x.verifiedFailures,
   learnedContexts:Object.keys(x.experiences).length,realmScoped:!!this.scope,error:this.error}
 }
}
