// Durable, bounded companion intentions: separate what the OWNER asked for,
// what was ATTEMPTED and what the Realm actually confirmed.
// This is not an autonomous executor. It never resumes a command on reboot,
// authorizes editing, or treats a chat reply as proof a task finished.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {companionPriorities} from './companion-priorities.js'
const MAX_GOALS=16
const statuses=new Set(['requested','working','blocked','waiting-owner','interrupted','shell-verified','completed','cancelled'])
const categories=new Set(['home','follow','movement','materials','build','craft','explore','other'])
const safeText=(s,limit=180)=>String(s??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,limit)
const sensitive=/\b(?:password|passcode|login|auth(?:entication)? token|access token|device code|microsoft code|e-mail|email|private key|secret)\b/i
export function classifyCompanionGoal(raw){
 const s=safeText(raw,180).toLowerCase().replace(/[.!?]+$/,'').replace(/^(?:hey rovekin |rovekin |please |can you |could you )/,'')
 if(!s||sensitive.test(s))return null
 if(/^(?:this is your (?:new )?home spot|give you (?:a )?home|design (?:your )?home|build (?:your |the )?home|start building (?:your |the )?home|resume (?:home|building home|house work)|home field (?:test|trial))\b/.test(s))return 'home'
 if(/^(?:follow(?: me)?|come (?:to|with) me|find me|come here|walk to me)\b/.test(s))return 'follow'
 if(/^(?:go (?:back )?home|return home|head home)\b/.test(s))return 'movement'
 if(/^(?:walk|go to|travel|move to|navigate|climb)\b/.test(s))return 'movement'
 if(/^(?:get|gather|collect|mine|dig|chop|harvest|quarry|strip|fetch|find and mine)\b/.test(s))return 'materials'
 if(/^(?:build|place|make a (?:house|shelter|wall|floor)|construct)\b/.test(s))return 'build'
 if(/^(?:craft|smelt|make (?:a |some )?(?:pickaxe|axe|shovel|furnace|chest|torch|planks|sticks|bed))\b/.test(s))return 'craft'
 if(/^(?:roam|explore|scout|survey|search the area)\b/.test(s))return 'explore'
 return null
}
const validGoal=g=>g&&typeof g.id==='string'&&/^[a-f0-9]{16}$/.test(g.id)&&categories.has(g.category)&&statuses.has(g.status)&&typeof g.intent==='string'&&g.intent.length<=180&&Number.isSafeInteger(g.at)&&Number.isSafeInteger(g.updatedAt)&&typeof g.detail==='string'&&g.detail.length<=180&&
 (g.note===undefined||(typeof g.note==='string'&&g.note.length<=150))
export class CompanionGoalJournal{
 constructor({directory=null,scope=null}={}){
  this.directory=directory;this.scope=null;this.file=null;this.goals=[];this.error='';this.readOnly=false;this.counter=0
  this.setScope(scope)
 }
 setScope(scope){
  const next=scope?String(scope):null
  if(next===this.scope)return
  this.scope=next;this.goals=[];this.error='';this.readOnly=false
  this.file=this.directory&&next?path.join(this.directory,crypto.createHash('sha256').update(next).digest('hex')+'.json'):null
  if(!this.file||!fs.existsSync(this.file))return
  try{
   const data=JSON.parse(fs.readFileSync(this.file,'utf8'))
   if(data?.schema!==1||!Array.isArray(data.goals)||data.goals.length>MAX_GOALS)throw Error('Invalid journal')
   if(!data.goals.every(validGoal))throw Error('Corrupted goal entry')
   this.goals=data.goals.slice(-MAX_GOALS)
   // A persisted record is NOT evidence that the Android service, socket,
   // movement input or pending permissions survived the restart.
   const latest=this.latest()
   if(latest&&['requested','working','waiting-owner','blocked'].includes(latest.status)){
    latest.status='interrupted';latest.updatedAt=Date.now()
    latest.detail='The phone service restarted. I remember your goal, but execution and old permissions were not resumed.'
    this.save()
   }
  }catch{this.readOnly=true;this.error='The saved goal journal is unreadable; kept intact instead of overwriting.'}
 }
 save(){
  if(this.readOnly)return false
  if(!this.file)return true
  try{
   fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})
   const tmp=this.file+'.tmp'
   fs.writeFileSync(tmp,JSON.stringify({schema:1,goals:this.goals}),{mode:0o600})
   fs.renameSync(tmp,this.file)
   this.error='';return true
  }catch{this.error='Goal journal could not be saved to private app storage.';return false}
 }
 latest(){return this.goals.at(-1)||null}
 recordRequest(raw,result,now=Date.now()){
  if(!this.scope||this.readOnly)return null
  const category=classifyCompanionGoal(raw),text=safeText(raw)
  if(!category||!text||sensitive.test(text)||!result)return null
  // The interpreter must have accepted the task, queued real work or issued
  // a specific pending confirmation. A rejected or conversational guess is
  // not a new active job.
  const granted=result.accepted===true||result.queued===true||result.confirmationRequired===true
  if(!granted)return null
  const status=result.confirmationRequired===true?'waiting-owner':'requested'
  const same=this.latest()
  if(same&&same.intent.toLowerCase()===text.toLowerCase()&&now-same.at<15000&&
     ['requested','working','waiting-owner','blocked'].includes(same.status))return {...same}
  const id=crypto.createHash('sha256').update(String(this.scope)+'|'+String(now)+'|'+String(this.counter++)+'|'+text).digest('hex').slice(0,16)
  if(result.queued===true&&same&&['requested','working','waiting-owner','blocked'].includes(same.status))
   this.transition('interrupted','A new owner task replaced this active attempt; its previous outcome is not confirmed.',now)
  const item={id,category,intent:text,status,detail:result.confirmationRequired===true?
   'Waiting for your permission; no world edit was made.':
   result.queued===true?'Request accepted or queued; the Realm has not confirmed completion.':
    'Request understood; execution is not confirmed.',
   at:now,updatedAt:now,progress:0,helpVersion:0,ackVersion:0}
  this.goals.push(item);this.goals=this.goals.slice(-MAX_GOALS);this.save()
  return {...item}
 }
 transition(status,detail,now=Date.now(),{progress=null}={}){
  const g=this.latest()
  if(!g||this.readOnly||!statuses.has(status))return false
  const msg=safeText(detail||g.detail)
  const nextProgress=Number.isSafeInteger(progress)&&progress>=0&&progress<=100000?progress:g.progress||0
  if(g.status===status&&g.detail===msg&&(g.progress||0)===nextProgress)return false
  if((status==='blocked'||status==='waiting-owner')&&g.status!==status)g.helpVersion=(g.helpVersion||0)+1
  g.status=status;g.detail=msg;g.updatedAt=now;g.progress=nextProgress
  this.save()
  return true
 }
 observe({survival=null,spawned=false}={},now=Date.now()){
  const g=this.latest()
  if(!g||this.readOnly||!survival||!spawned||['completed','cancelled'].includes(g.status))return
  // Never mark a command "completed" from a successful chat/plan response.
  if(g.category==='home'){
   const home=survival.companion?.homeProject
   if(!home)return
   const stage=home.stage||0,steps=home.plan?.stagesTotal||home.plan?.stages?.length||0
   const count=home.plan?.placementsVerified||0
   const detail='Home stage '+stage+(steps?'/'+steps:'')+
     ', '+count+' blocks server-verified. '+safeText(home.reason,90)
   if(home.proximityReview||home.review||home.pending)
    this.transition('waiting-owner','An exact home-stage permission is waiting in the envelope. No protected edit was sent.',now,{progress:count})
   else if(home.state==='running')this.transition('working',detail,now,{progress:count})
   else if(home.state==='paused'){
    if(!survival.companion?.homeMemory?.record?.autoResume)
     this.transition('interrupted','Home is saved and on an owner hold. Say resume home if you want to continue.',now,{progress:count})
    else this.transition('blocked',detail,now,{progress:count})
   }
   else if(home.state==='restoring')this.transition('interrupted','Checking saved home stages against current server terrain before doing anything.',now,{progress:count})
   else if(home.state==='furnishing')this.transition('shell-verified','Home shell stages verified; bed, storage and lighting are still separate jobs.',now,{progress:count})
   return
  }
  const nav=survival.navigation
  if(g.category==='follow'||g.category==='movement'){
   if(nav?.job?.kind==='follow'||(g.category==='movement'&&nav?.job?.kind==='walk')){
    this.transition('working',safeText(nav.reason||'Traveling using observed dry ground.',180),now)
   }else if(nav?.state==='blocked')
    this.transition('blocked','Movement blocked: '+safeText(nav.reason,150),now)
   else if(nav?.pendingFollow)this.transition('interrupted','Waiting for server terrain and position before trying a safe Follow route.',now)
   return
  }
  if(g.category==='materials'&&
      (survival.resources?.active||survival.miningJobs?.active||survival.acquisition?.active))
   this.transition('working','Collecting resources; inventory progress must be verified by Minecraft.',now)
  if(g.category==='explore'&&survival.exploration?.active)
   this.transition('working','Exploring observed terrain; do not assume unknown chunks are safe.',now)
 }
 noteVerifiedProgress(message,now=Date.now()){
  const g=this.latest()
  if(!g||this.readOnly)return false
  const s=safeText(message)
  if(g.category==='home'&&/^Home stage \d+\/\d+ verified, \d+ blocks confirmed/i.test(s))
   return this.transition('working',s,now)
  // Individual server-confirmed pickup, placement and travel are milestones,
  // never whole-goal completion without dedicated end-to-end confirmation.
  if(g.category==='materials'&&/server.confirmed.*(?:pickup|inventory)|inventory.*server.confirmed/i.test(s))
   return this.transition('working','Inventory progress was reported as server-confirmed. '+s.slice(0,80),now)
  return false
 }
 interrupt(reason='Realm session interrupted.',now=Date.now()){
  const g=this.latest()
  if(!g||!['working','requested','waiting-owner','blocked'].includes(g.status))return false
  return this.transition('interrupted',safeText(reason)+' The goal is remembered, but work will not secretly restart.',now)
 }
 answer(raw,{survival=null,spawned=false}={}){
  const t=safeText(raw).toLowerCase().replace(/[.!?]+$/,'')
  const status=/^(?:what (?:are|were) you (?:working on|doing)|what (?:were|are) we (?:doing|working on)|what was (?:my|our) last (?:task|goal|command)|what's your (?:current|last) goal|current goal|goal status|my goals|task journal|what happened to (?:the|my|our) (?:last )?(?:task|goal)|what stopped you|why did you stop|do you still remember my task)$/.test(t)
  const help=/^(?:what do you need from me|how can i help you|do you need (?:help|anything)|what should (?:we|i) do next|what's next|why are you waiting|any suggestions|what would help|what are your priorities)$/.test(t)
  if(!status&&!help)return null
  const g=this.latest()
  const priorities=companionPriorities({survival,spawned})
  const advice=priorities.length?' My top observed priority is: '+priorities[0].title+'. '+priorities[0].why+
   ' Suggested next step: '+priorities[0].suggestedOwnerRequest:''
  if(!g)return {accepted:true,queued:false,message:
   'I have no remembered active task for this Realm. I will not invent completed work.'+(help?advice:
   ' You can ask me to follow, collect materials, or give me one permanent home.'),
   priorities:help?priorities:undefined}
  this.observe({survival,spawned})
  const current=this.latest()
  const currentText='Your last '+current.category+' goal was “'+current.intent+'”. Status: '+current.status+
   '. '+current.detail+(current.note?' Your saved guidance: '+current.note+'.':'')
  let next=' I will not restart interrupted or destructive work without a new owner instruction.'
  if(help){
   if(current.status==='blocked')next=' Please inspect the obstruction or choose a safe route, then ask me to retry. I will re-check the Realm before acting.'
   else if(current.status==='waiting-owner')next=' Check the top-right envelope for the exact pending approval. A saved note is not edit permission.'
   else if(current.status==='working')next=' I am attempting it now; server-confirmed progress is shown separately.'
   else if(current.category==='home')next=' You can request home status, or explicitly say resume home after checking the plot.'
  }
  return {accepted:true,queued:false,message:currentText+next+(help?advice:''),goal:{...current},priorities:help?priorities:undefined}
 }
 helpPrompt({spawned=false}={},now=Date.now()){
  const g=this.latest()
  if(!spawned||!g||g.status!=='blocked'||g.ackVersion===g.helpVersion)return null
  if(!g.helpVersion||now-g.updatedAt>1800000)return null
  return {id:'guidance-'+g.id+'-'+g.helpVersion,kind:'guidance',category:'Help',
   title:g.category==='home'?'Home work needs your help':'I need a little help',
   prompt:'I was asked to: '+g.intent,
   detail:safeText(g.detail,180)+' No work will restart from this card.',
   options:[],expiresAt:g.updatedAt+1800000,approvalRequired:false}
 }
 respondToHelp(id,decision,explanation='',now=Date.now()){
  const active=this.helpPrompt({spawned:true},now)
  if(!active||active.id!==id)return {accepted:false,queued:false,message:'This help request is no longer current; no task was started.'}
  if(decision==='explain'){
   const safe=safeText(explanation,150)
   if(safe.length<2||sensitive.test(safe))return {accepted:false,queued:false,message:'Please give a short, non-sensitive explanation.'}
   // Notes are context for a later owner action; not command execution.
   this.latest().note=safe;this.latest().updatedAt=now;this.save()
   return {accepted:true,queued:false,message:'I remember your guidance for this goal. Nothing restarted. Say try again or resume home when the world is ready.'}
  }
  if(decision==='approve'||decision==='deny'){
   this.latest().ackVersion=this.latest().helpVersion;this.save()
   return {accepted:true,queued:false,message:decision==='approve'?
    'Got it. I will keep the problem in mind. Give me a safe retry instruction when you are ready.':
    'Understood. I will leave that blocked goal alone. Its history is saved.'}
  }
  return {accepted:false,queued:false,message:'This help card accepts Got it, No, or an explanation; it never grants world edits.'}
 }
 snapshot(){
  return {scopeKnown:!!this.scope,error:this.error,count:this.goals.length,
   latest:this.latest()?{...this.latest()}:null,
   recent:this.goals.slice(-5).map(g=>({id:g.id,category:g.category,status:g.status,at:g.at,updatedAt:g.updatedAt}))}
 }
}
