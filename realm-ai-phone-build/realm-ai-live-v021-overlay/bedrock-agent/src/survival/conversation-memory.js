// Small, Realm-scoped continuity journal; NOT a neural memory or permission store.
// Disk is Android private app storage. Never save account details, auth, tokens,
// full free-form logs or approvals. Decisions still require a fresh live permit.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const MAX=48
const mask=s=>{
 let x=String(s??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,280)
 x=x.replace(/(?:[\w.+-]+)@(?:[\w.-]+\.)+[a-z]{2,}/gi,'[private email]')
 x=x.replace(/\b(?:bearer|password|passcode|auth token|access token|device code|microsoft code)\s*[:=]?\s*\S+/gi,'[private credential]')
 x=x.replace(/\b[a-f0-9]{32,}\b/gi,'[private token]')
 x=x.replace(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/g,'[private code]')
 return x
}
export class ConversationMemory{
 constructor({directory=null,scope=null}={}){this.directory=directory;this.scope=null;this.file=null;this.entries=[];this.error='';this.readOnly=false;this.setScope(scope)}
 setScope(scope){
  const next=scope?String(scope):null
  if(next===this.scope)return
  this.scope=next;this.entries=[];this.error='';this.readOnly=false
  this.file=this.directory&&next?path.join(this.directory,crypto.createHash('sha256').update(next).digest('hex')+'.json'):null
  if(!this.file||!fs.existsSync(this.file))return
  try{
   const v=JSON.parse(fs.readFileSync(this.file,'utf8'))
   if(v?.schema!==1||!Array.isArray(v.entries)||v.entries.length>MAX)throw Error('Invalid memory')
   this.entries=v.entries.filter(e=>['owner','rovekin'].includes(e?.role)&&typeof e.text==='string'&&Number.isSafeInteger(e.at)).slice(-MAX)
  }catch{this.error='Saved conversation summary unreadable; original file kept.';this.readOnly=true}
 }
 remember(role,text,at=Date.now()){
  if(!this.scope||this.readOnly||!['owner','rovekin'].includes(role))return false
  // Do not persist a credential-bearing utterance, even in redacted form.
  if(/\b(?:password|passcode|auth token|access token|device code|microsoft code|login code)\b/i.test(String(text||'')))return false
  const safe=mask(text)
  if(!safe||/\b(?:password|sign.?in code|microsoft\.com\/link|device code)\b/i.test(safe))return false
  if(role==='rovekin'&&safe===this.entries.at(-1)?.text)return false
  this.entries.push({role,text:safe,at:Number.isFinite(at)?at:Date.now()})
  this.entries=this.entries.slice(-MAX)
  if(!this.file)return true
  try{
   fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})
   const temp=this.file+'.tmp'
   fs.writeFileSync(temp,JSON.stringify({schema:1,entries:this.entries}),{mode:0o600})
   fs.renameSync(temp,this.file)
   return true
  }catch{this.error='Recent conversation could not be saved.';return false}
 }
 recent(limit=6){return this.entries.slice(-Math.max(1,Math.min(12,Number(limit)||6))).map(e=>({...e}))}
 respondToRecall(raw){
  const s=String(raw||'').trim().toLowerCase().replace(/[.!?]+$/,'')
  if(!/^(?:what did (?:we|i|you) (?:just )?(?:talk about|say|ask)|what were we (?:talking about|doing)|do you remember (?:what (?:we|i) said|our conversation)|remember our conversation|conversation history|what are we working on)$/.test(s))return null
  const messages=this.recent(8)
  return {accepted:true,queued:false,message:messages.length?
   'I remember the recent conversation in this Realm: '+messages.slice(-5).map(e=>(e.role==='owner'?'You: ':'Me: ')+e.text).join(' | ')+'. I keep permission requests separate so saying yes will not approve an unrelated edit.':
   'I do not have a saved conversation for this Realm yet. I remember my permanent home separately if you assigned one.',
   conversation:{remembered:messages.length,scopeKnown:!!this.scope}}
 }
 snapshot(){return {remembered:this.entries.length,scopeKnown:!!this.scope,error:this.error}}
}
