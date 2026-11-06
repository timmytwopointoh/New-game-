// Signed data-only Follow tuning. Never eval/import remote code or restart the Realm.
// To publish a new policy, sign the EXACT JSON payload with the offline Ed25519 key.
// No account/session data, coordinates, or diagnostics are uploaded.
import {verify} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const FOLLOW_PATCH_FEED='https://raw.githubusercontent.com/timmytwopointoh/New-game-/realm-ai-follow-live-patches-20261106/follow.json'
export const FOLLOW_PATCH_PUBLIC_KEY=`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAdsvjxHEYfoKNOpkh7CKt+NlxqSHZDfcxuCg6GmE3uhg=
-----END PUBLIC KEY-----`
export const FOLLOW_PATCH_DEFAULTS=Object.freeze({
 replanIntervalMs:1250,waypointCooldownMs:120000,waypointMaxVisits:2,
 maxSegmentBlocks:14,candidateLimit:24,maxRouteNodes:768,maxApproachBlocks:4
})
const LIMITS={
 replanIntervalMs:[750,10000],waypointCooldownMs:[10000,600000],
 waypointMaxVisits:[1,5],maxSegmentBlocks:[4,16],candidateLimit:[4,24],
 maxRouteNodes:[128,2048],maxApproachBlocks:[2,5]
}
const ordered=x=>Object.keys(x).sort().join('|')
const shape=(x,fields)=>x&&typeof x==='object'&&!Array.isArray(x)&&ordered(x)===fields.slice().sort().join('|')
export function verifyFollowPatch(raw,{now=Date.now(),minimumSequence=0}={}){
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>4096)throw Error('Patch missing or exceeds 4 KiB')
 let doc
 try{doc=JSON.parse(raw)}catch{throw Error('Bad patch JSON')}
 if(!shape(doc,['schema','sequence','channel','issuedAt','expiresAt','policy','signature']))
  throw Error('Unexpected patch manifest keys')
 if(doc.schema!==1||doc.channel!=='realm-follow-safe'||
    !Number.isSafeInteger(doc.sequence)||doc.sequence<1||doc.sequence>1000000||
    doc.sequence<minimumSequence)throw Error('Bad channel or replayed sequence')
 if(!shape(doc.policy,Object.keys(FOLLOW_PATCH_DEFAULTS)))throw Error('Unapproved navigation policy fields')
 for(const [name,[min,max]] of Object.entries(LIMITS)){
  const n=doc.policy[name]
  if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Out-of-range policy: '+name)
 }
 if(typeof doc.issuedAt!=='string'||typeof doc.expiresAt!=='string')throw Error('Missing patch dates')
 const issued=Date.parse(doc.issuedAt),expires=Date.parse(doc.expiresAt)
 if(!Number.isFinite(issued)||!Number.isFinite(expires)||expires<=issued||
    issued>now+300000||expires<=now||expires-issued>90*24*3600000)
    throw Error('Patch expired, too far in future, or overlong')
 if(typeof doc.signature!=='string'||!(/^[A-Za-z0-9+/]{86}==$/.test(doc.signature)))
  throw Error('Bad signature encoding')
 // Canonical insertion order; do not alphabetically sort the nested policy.
 const body={schema:doc.schema,sequence:doc.sequence,channel:doc.channel,
  issuedAt:doc.issuedAt,expiresAt:doc.expiresAt,policy:doc.policy}
 const valid=verify(null,Buffer.from(JSON.stringify(body),'utf8'),
  FOLLOW_PATCH_PUBLIC_KEY,Buffer.from(doc.signature,'base64'))
 if(!valid)throw Error('Invalid Ed25519 patch signature')
 return {sequence:doc.sequence,expiresAt:expires,policy:Object.freeze({...doc.policy})}
}

export class LiveFollowPatchStream{
 constructor(navigation,{file=null,fetcher=globalThis.fetch,report=()=>{},pollMs=30000}={}){
  this.navigation=navigation;this.file=file;this.fetcher=fetcher;this.report=report
  this.pollMs=Math.max(15000,Math.min(300000,pollMs))
  this.timer=null;this.busy=false;this.lastCheckAt=0;this.lastError=''
  this.sequence=0;this.expiresAt=0;this.source='bundled-defaults'
  this.navigation.liveFollowPolicy={...FOLLOW_PATCH_DEFAULTS}
  this.restore()
 }
 snapshot(){return {channel:'signed-data-only',sequence:this.sequence,source:this.source,
  lastCheckAt:this.lastCheckAt,expiresAt:this.expiresAt,error:this.lastError,
  active:!!this.timer,policy:{...this.navigation.liveFollowPolicy}}}
 restore(){
  if(!this.file)return
  try{
   const persisted=JSON.parse(fs.readFileSync(this.file,'utf8'))
   this.sequence=Number.isSafeInteger(persisted.sequence)&&persisted.sequence>=0?persisted.sequence:0
   if(typeof persisted.raw==='string'){
    const p=verifyFollowPatch(persisted.raw,{minimumSequence:this.sequence})
    this.navigation.liveFollowPolicy={...p.policy};this.expiresAt=p.expiresAt;this.source='signed-device-cache'
   }
  }catch(e){
   // Keep the highest known sequence even after expiration; never apply stale tuning.
   this.lastError='Saved patch not active: '+String(e.message||e).slice(0,90)
  }
 }
 async fetchSmall(){
  if(typeof this.fetcher!=='function')throw Error('HTTPS fetch unavailable')
  const response=await this.fetcher(FOLLOW_PATCH_FEED,{
   redirect:'error',signal:AbortSignal.timeout(6000),cache:'no-store',
   headers:{accept:'application/json'}
  })
  if(!response?.ok)throw Error('Patch feed HTTP '+String(response?.status||'unavailable'))
  const reader=response.body?.getReader?.()
  if(!reader)throw Error('Patch stream unavailable')
  const chunks=[];let count=0
  try{
   for(;;){
    const {done,value}=await reader.read();if(done)break
    count+=value.byteLength;if(count>4096)throw Error('Patch download exceeds 4 KiB')
    chunks.push(Buffer.from(value))
   }
  }finally{reader.releaseLock()}
  return Buffer.concat(chunks).toString('utf8')
 }
 async check(){
  if(this.busy)return {updated:false,reason:'check already running'}
  this.busy=true;this.lastCheckAt=Date.now()
  try{
   const raw=await this.fetchSmall()
   const patch=verifyFollowPatch(raw,{minimumSequence:this.sequence})
   if(patch.sequence===this.sequence){
    // A changed manifest at the same sequence must never silently replace policy.
    if(JSON.stringify(patch.policy)!==JSON.stringify(this.navigation.liveFollowPolicy))
      throw Error('Same-sequence policy changed; increment sequence')
    this.lastError='';return {updated:false,reason:'already current'}
   }
   if(this.file){
    const temp=this.file+'.tmp'
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})
    fs.writeFileSync(temp,JSON.stringify({sequence:patch.sequence,raw}),{mode:0o600})
    fs.renameSync(temp,this.file)
   }
   this.sequence=patch.sequence;this.expiresAt=patch.expiresAt
   this.navigation.liveFollowPolicy={...patch.policy};this.source='signed-live-update';this.lastError=''
   this.report('Live Follow policy '+this.sequence+' applied without stopping the Realm or Follow job.')
   return {updated:true,sequence:this.sequence}
  }catch(e){
   this.lastError=String(e.message||e).slice(0,150)
   return {updated:false,reason:this.lastError}
  }finally{this.busy=false}
 }
 start(){if(this.timer)return;void this.check()
  this.timer=setInterval(()=>void this.check(),this.pollMs);this.timer.unref?.()}
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null}
}
