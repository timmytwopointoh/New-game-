// Phone-local owner inbox. Only currently matching, unexpired live approval
// tokens can change the Realm. A saved question/annotation is NOT a permit.
// A stale/reconnected request is never replayed as an action.
import crypto from 'node:crypto'
import {resolveActionTarget} from './command-vocabulary.js'
const idFor=(type,scope,code,extra='')=>type+'-'+crypto.createHash('sha256').update([scope,code,extra].join('|')).digest('hex').slice(0,16)
const text=s=>String(s||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240)
export class OwnerInbox{
 constructor(connection,{interpretation=()=>null,dispatch=()=>({accepted:false,message:'No interpreter.'}),guidance=()=>null,respondGuidance=()=>({accepted:false,message:'No guidance handler.'})}={}){
  this.connection=connection;this.interpretation=interpretation;this.dispatch=dispatch;this.guidance=guidance;this.respondGuidance=respondGuidance;this.lastNotes=[]
  this.demo=null;this.seen=new Map();this.seenScope=null
 }
 scope(){const c=this.connection.survival;return c?.companion?.editScope?.().realm||c?.commandVocabulary?.scope||null}
 // A TEST CARD, NOT a Minecraft edit permission. Works when the local bot
 // controller is active but the Realm is still loading or disconnected.
 createDemo(now=Date.now()){
  const fresh=!!this.demo&&this.demo.expiresAt>now
  if(!fresh)this.demo={
   id:'demo-'+crypto.randomBytes(8).toString('hex'),kind:'demo',
   title:'Practice: Can you see my message?',category:'Practice',
   prompt:'This is a safe inbox test from RoveKin. Tap Got it, No, or send an explanation.',
   detail:'Nothing in Minecraft will be changed. A real permission request uses a separate, expiring approval code.',
   options:[],expiresAt:now+15*60*1000,approvalRequired:false
  }
  return {accepted:true,queued:false,message:fresh?'The test question is already waiting in Inbox.':'Test question delivered. Open Inbox to answer it.',
   inbox:this.snapshot(now)}
 }
 pending(now=Date.now()){
  const c=this.connection.survival,home=c?.companion?.homeProject,edit=c?.companion?.edits,scope=this.scope()
  const items=[]
  if(this.demo&&now<this.demo.expiresAt)items.push({...this.demo})
  if(!scope)return items
  const add=(type,p,{title,prompt,detail='',options=[],kind='permission',category='Home',allowApproval=true}={})=>{
   if(!p||!Number.isFinite(p.expires)||now>p.expires)return
   if(p.scope!==undefined&&String(typeof p.scope==='object'?p.scope.realm:p.scope)!==String(scope))return
   if(p.dimension!==undefined&&p.dimension!==c.world.dimension)return
   if(p.stage!==undefined&&p.stage!==home?.stage)return
   if(!p.code||!/^\d{6}$/.test(String(p.code)))return
   items.push({id:idFor(type,scope,p.code,String(p.stage??'')),kind,category,title,prompt,detail,
    options,expiresAt:p.expires,approvalRequired:allowApproval})
  }
  add('home-proximity',home?.proximityReview,{title:'Build near another structure?',
   prompt:'RoveKin wants to continue one home stage near protected construction.',
   detail:'Nearby: '+text(home?.proximityReview?.nearby||'unknown')+'. The approval covers only this exact stage, not mining or replacing neighbors.'})
  add('clearance',home?.review,{title:'Remove one obstruction?',
   prompt:'Before I remove '+text(home?.review?.name||'a block')+' at '+[home?.review?.position?.x,home?.review?.position?.y,home?.review?.position?.z].join(', ')+'.',
   detail:text(home?.review?.reason)+' Only this observed block may be cleared after approval.'})
  add('home-plan',home?.pending,{title:'Start the home blueprint?',prompt:'Approve the saved home plan? ',
   detail:'This is a real block-placement job. All actual placements still need server confirmation.'})
  add('protected-edit',edit?.pending,{title:'Approve a protected block edit?',prompt:text(edit?.pending?.description||'A protected edit needs specific permission.'),
   detail:'Only the listed coordinates and current Realm are eligible.'})
  const interp=this.interpretation()
  if(interp&&interp.scope===scope&&now-(interp.createdAt||0)<=120000){
   const options=interp.kind==='unknown-action'?['dig','walk','find','follow','look','gather','craft','build','status']:
    Array.isArray(interp.choices)?interp.choices.map(x=>typeof x==='string'?x:
    typeof x?.definition==='string'?x.definition:'').filter(Boolean).slice(0,4):[]
   const code=String(interp.createdAt||0)+':'+String(interp.word||'')
   items.push({id:idFor('clarification',scope,code),kind:'clarification',category:'Understanding',
    title:'What did you mean by '+text(interp.word||'that')+'?',
    prompt:interp.kind==='unknown-action'?'Choose the supported action that matches your request.':
      interp.kind==='word-sense'?'Choose the intended meaning.':'Should I remember this correction for the Realm?',
    detail:'Original request: '+text(interp.input||interp.word||'')+
     '. Choosing a meaning prepares a plan only; it does not start a destructive task.',
    options,expiresAt:(interp.createdAt||now)+120000,approvalRequired:false})
  }
  const help=this.guidance()
  if(help&&help.kind==='guidance'&&typeof help.id==='string'&&Number.isFinite(help.expiresAt)&&help.expiresAt>now)items.push(help)
  return items
 }
 snapshot(now=Date.now()){
  const scope=this.scope()
  if(scope!==this.seenScope){this.seen.clear();this.seenScope=scope}
  const requests=this.pending(now),ids=new Set(requests.map(r=>r.id))
  // Remember a bounded set of titles only: no old codes, coordinates,
  // explanations or executable approval data in recent notifications.
  for(const req of requests)if(req.kind!=='demo'){
   this.seen.set(req.id,{id:req.id,title:req.title,category:req.category,kind:req.kind,
    expiresAt:req.expiresAt,lastSeenAt:now})
  }
  while(this.seen.size>8)this.seen.delete(this.seen.keys().next().value)
  const recent=[...this.seen.values()].filter(x=>!ids.has(x.id)&&now-x.lastSeenAt<30*60*1000)
   .slice(-4).reverse().map(x=>({title:x.title,category:x.category,
      status:x.expiresAt<=now?'expired':'no-longer-active',actionable:false}))
  return {count:requests.length,requests,recent,notes:this.lastNotes.slice(-4),
   realmScoped:!!scope,demoAvailable:true}
 }
 respond({id,decision,explanation='',choice=null}={},now=Date.now()){
  if(typeof id!=='string'||id.length>80||!['approve','deny','explain','choose'].includes(decision))
   return {accepted:false,queued:false,message:'Choose a valid current inbox request and response.'}
  const active=this.pending(now).find(r=>r.id===id)
  if(!active)return {accepted:false,queued:false,message:'That request expired, changed, or belongs to another Realm. No action was taken.',inbox:this.snapshot(now)}
  const c=this.connection.survival,comp=c?.companion,home=comp?.homeProject,scope=this.scope()
  if(active.kind==='demo'){
   if(decision==='choose')return {accepted:false,queued:false,message:'The practice card has no command choices.'}
   if(decision==='explain'){
    const note=text(explanation)
    if(note.length<2)return {accepted:false,queued:false,message:'Write a short explanation to test delivery.'}
    this.demo=null
    return {accepted:true,queued:false,message:'Your practice explanation reached RoveKin’s inbox. No world action was performed.',inbox:this.snapshot(now)}
   }
   this.demo=null
   return {accepted:true,queued:false,message:'Practice response received ('+(decision==='approve'?'Got it':'No')+'). The inbox is working; Minecraft was not changed.',inbox:this.snapshot(now)}
  }
  // Help cards are NEVER approval of world edits. Even a user tapping the
  // positive button only acknowledges the problem; a fresh command is needed.
  if(active.kind==='guidance'){
   if(decision==='choose')return {accepted:false,queued:false,message:'A help request does not offer a world-edit shortcut.'}
   const r=this.respondGuidance(id,decision,explanation,now)
   return {...r,inbox:this.snapshot(now)}
  }
  if(decision==='explain'){
   const note=text(explanation)
   if(note.length<2)return {accepted:false,queued:false,message:'Write a short explanation before sending.'}
   this.lastNotes.push({id,at:now,explanation:note});this.lastNotes=this.lastNotes.slice(-12)
   // A bounded, recognized action clarification goes through the existing
   // owner-teaching flow, which prepares a card but never activates it.
   const interpretation=this.interpretation()
   const safeTarget=active.kind==='clarification'&&interpretation?.kind==='unknown-action'?
     resolveActionTarget(note):null
   if(safeTarget){
    const result=this.dispatch(safeTarget)
    return {...result,message:'Understood: '+String(result?.message||'The action was explained.')+
      ' The correction was not permission to edit the world.',inbox:this.snapshot(now)}
   }
   // Free-form explanations are memory/context, NEVER grants or arbitrary
   // executable code. The original permission remains pending until its TTL.
   return {accepted:true,queued:false,message:'I received your explanation for “'+active.title+'”. No edit permission was granted. You can still Approve or Deny.',inbox:this.snapshot(now)}
  }
  let result
  if(active.kind==='clarification'){
   if(decision==='deny')result=this.dispatch('no')
   else if(decision==='choose'){
    if(!Number.isInteger(choice)||choice<0||choice>=active.options.length)return {accepted:false,queued:false,message:'Choose one of the listed meanings.'}
    // Word-sense support uses the exact original displayed definition;
    // material suggestions use a 1-based choice. Never send arbitrary input.
    const interp=this.interpretation()
    if(interp?.kind==='word-sense'||interp?.kind==='unknown-action')result=this.dispatch(active.options[choice])
    else result=this.dispatch(String(choice+1))
   }else if(decision==='approve'){
    if(active.options.length)return {accepted:false,queued:false,message:'Choose a specific meaning before learning it; no action was executed.'}
    result=this.dispatch('yes')
   }else return {accepted:false,queued:false,message:'Unsupported response.'}
  }else{
   if(decision==='choose')return {accepted:false,queued:false,message:'Only clarification cards have choices.'}
   const cmd=active.id.startsWith('home-proximity-')?decision==='approve'?'confirm home proximity '+home.proximityReview.code:'cancel home proximity':
     active.id.startsWith('clearance-')?decision==='approve'?'confirm clearance '+home.review.code:'cancel clearance':
     active.id.startsWith('home-plan-')?decision==='approve'?'confirm home '+home.pending.code:'cancel home':
     active.id.startsWith('protected-edit-')?decision==='approve'?'confirm edit '+comp.edits.pending.code:'cancel edit':null
   if(!cmd)return {accepted:false,queued:false,message:'This permission is no longer valid.'}
   // Read the current pending object again. A new stage/Realm cannot inherit
   // an approval from a card opened before the world changed.
   if(!this.pending(now).some(r=>r.id===id))return {accepted:false,queued:false,message:'Request changed before confirmation.'}
   result=comp.handle(cmd)
  }
  return {...(result||{accepted:false,queued:false,message:'No response received.'}),inbox:this.snapshot(now)}
 }
 confirmSingleFromChat(raw,now=Date.now()){
  const s=String(raw||'').trim().toLowerCase().replace(/[.!?]+$/,'')
  if(!/^(?:confirm|approve|yes|no|deny|decline)$/.test(s))return null
  const permissions=this.pending(now).filter(x=>x.kind==='permission')
  if(!permissions.length)return null
  if(permissions.length!==1)return {accepted:false,queued:false,message:'I have '+permissions.length+' permission requests. Open the envelope and choose the one you want to answer.'}
  return this.respond({id:permissions[0].id,decision:/^(?:no|deny|decline)$/.test(s)?'deny':'approve'},now)
 }
}
