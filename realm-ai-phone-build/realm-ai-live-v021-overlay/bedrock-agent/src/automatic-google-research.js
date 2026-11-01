// Owner-initiated Google Search-grounded instructions. A Google API key is
// provisioned locally through the phone Settings UI, never embedded in APK.
// An external model only PROPOSES text. Game actions still go through the
// existing typed descriptor, observed-world validation and survival queue.
import fs from 'node:fs'
import path from 'node:path'
import {root} from '../tools/config.js'
import {extractGooglePlan,googleResearchPrompt} from './research-action-plan.js'
const PRIVATE=path.join(root,'private','google-research.json')
const MODELS=new Set(['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-2.5-flash'])
const validKey=k=>typeof k==='string'&&k.length>=18&&k.length<=200&&/^[A-Za-z0-9_-]+$/.test(k)
export class PrivateResearchKey {
 constructor(file=PRIVATE){this.file=file}
 get(){try{const x=JSON.parse(fs.readFileSync(this.file,'utf8'));return validKey(x.key)?x.key:null}catch{return null}}
 set(key){if(!validKey(key))throw Error('Enter a valid Google AI Studio API key; it stays in private app storage.')
  fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify({key}),{mode:0o600});fs.renameSync(temp,this.file)}
 clear(){try{fs.unlinkSync(this.file)}catch(e){if(e.code!=='ENOENT')throw e}}
 configured(){return !!this.get()}
}
export function observedResearchContext(world){
 const self=world?.standPosition?.();if(!self)return null
 const blocks=world.scan?.(null,{range:7})?.found||[]
 const inventory=world.items?.()||{}
 return {mode:world.gameMode,position:self,nearbyVisibleBlocks:blocks.slice(0,12).map(b=>({x:b.x,y:b.y,z:b.z,name:b.name})),inventory:Object.fromEntries(Object.entries(inventory).slice(0,30))}
}
// Plans are checked against *actual received* blocks. The Google answer never
// creates coordinates, inventory, player names, or authority for itself.
export function validateObservedPlan(task,answer,world){
 const proposal=extractGooglePlan(task,answer);const commands=[];const warnings=[...proposal.warnings];const self=world?.standPosition?.()
 for(const step of proposal.commands){
  try{
   const cmd=step.text
   const id=/^walk to /i.test(cmd)?'walk':/^route to /i.test(cmd)?'route':/^dig /i.test(cmd)?'dig':/^place /i.test(cmd)?'place':/^build wall /i.test(cmd)?'build_wall':/^build floor /i.test(cmd)?'build_floor':/^build shelter /i.test(cmd)?'build_shelter':'read_only'
   const m=cmd.match(/(-?\d+)\s+(-?\d+)\s+(-?\d+)$/),v=m?{x:Number(m[1]),y:Number(m[2]),z:Number(m[3])}:{}
   if(['walk','route','dig','place','build_wall','build_floor','build_shelter'].includes(id)){
    if(!self||![v.x,v.y,v.z].every(Number.isSafeInteger)||Math.abs(v.x-self.x)+Math.abs(v.y-self.y)+Math.abs(v.z-self.z)>12)throw Error('Unobserved or distant coordinates')
    const p={x:v.x,y:v.y,z:v.z}
    if(id==='walk'&&!world.walkable?.(p))throw Error('Destination is not a verified standing cell')
    if(id==='dig'&&(!world.block?.(p)||['air','cave_air','void_air'].includes(world.block?.(p)?.name)||!world.visible?.(p)))throw Error('Target is not an observed visible block')
    if(['place','build_wall','build_floor','build_shelter'].includes(id)&&!world.airAt?.(p))throw Error('Build origin is not known air')
   }
   commands.push(step)
  }catch{warnings.push('Excluded an unverified or unsupported world action.')}
 }
 return {...proposal,commands,warnings:[...new Set(warnings)]}
}
export class AutomaticGoogleResearch {
 constructor({keyStore=new PrivateResearchKey(),fetcher=globalThis.fetch,model='gemini-3.8-flash',timeoutMs=17000}={}){
  this.keyStore=keyStore;this.fetcher=fetcher;this.model=MODELS.has(model)?model:'gemini-3.8-flash';this.timeoutMs=timeoutMs
 }
 configured(){return this.keyStore.configured()}
 async plan(task,world,{signal}={}){
  const key=this.keyStore.get();if(!key)throw Error('Set a private Google AI Studio API key in Internet lookup first.')
  if(typeof task!=='string'||task.length>190||task.trim().length<3)throw Error('Enter a short Minecraft instruction (3–190 characters).')
  const context=observedResearchContext(world);if(!context)throw Error('Join the Realm and receive an authoritative position before researching actions.')
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),this.timeoutMs)
  const stop=()=>abort.abort();signal?.addEventListener('abort',stop,{once:true})
  try{
   const response=await this.fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,{
    method:'POST',signal:abort.signal,redirect:'error',headers:{'content-type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:googleResearchPrompt(task)+ '\nREAL REALM OBSERVATIONS (untrusted for visibility beyond listed cells): '+JSON.stringify(context)+'\nUse only these coordinates when recommending world edits; never invent items or claim future success. Do not output secrets, scripts, URLs, permission changes or instructions to install an addon. Respond with short explanation and COMMAND: lines only. If pickup, crafting or combat cannot be completed as an ordinary supported command, explicitly say it is unavailable.'}]}],tools:[{google_search:{}}],generationConfig:{temperature:0.1,maxOutputTokens:950}})
   })
   if(!response?.ok)throw Error('Google research HTTP '+String(response?.status||'unknown'))
   const raw=await response.text();if(raw.length>48000)throw Error('Research response is too large.')
   const data=JSON.parse(raw);const answer=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').slice(0,7000)
   if(!answer)throw Error('Google returned no usable explanation.')
   const checked=validateObservedPlan(task,answer,world)
   return {...checked,summary:answer.replace(/^\s*COMMAND:.*$/gmi,'').trim().slice(0,800),grounded:!!data.candidates?.[0]?.groundingMetadata,source:'Gemini API / Google Search',configured:true}
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',stop)}
 }
}
