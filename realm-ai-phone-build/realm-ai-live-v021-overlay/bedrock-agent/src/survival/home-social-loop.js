// Companion social attention: owner requests take precedence over the saved
// house goal; the bot returns to house work after the request has finished.
// Name calls are only accepted after the owner allowlist in RealmChat.
const escapeRegex=s=>String(s||'').replace(/[^\w-]/g,'\\$&')
const normalize=s=>String(s||'').trim().toLowerCase()
export function addressedByName(message,botName){
 const name=normalize(botName)
 if(name.length<3||name.length>32||!/^[-_a-z0-9 ]+$/.test(name))return false
 const regex=new RegExp('(^|[^a-z0-9_])'+escapeRegex(name)+'(?=$|[^a-z0-9_])','i')
 return regex.test(String(message||'').slice(0,190))
}
const ownerAction=/^(?:command\s+)?(?:follow\b|come here\b|walk\b|go to\b|route\b|gather\b|find\b|mine\b|dig\b|build\b|place\b|craft\b|explore\b|roam\b|look around\b|scan\b|survey\b|inventory\b|check inventory\b|position\b|where are you\b|movement status\b|status\b|collect\b|stop following\b|finish task\b|select slot\b|turn\b|jump\b|harvest\b|get wood\b|clear path\b|return home\b)/i
const homeControl=/^(?:pause home|resume home|home status|check home|bed supplies|craft home bed|place home bed|use home bed|this is your land|design (?:your|a) home|build your home|preview home build|confirm (?:home|clearance|edit)|cancel (?:home|clearance|edit)|this is your new home spot)/i

export class HomeSocialLoop {
 constructor(companion){this.companion=companion;this.reset()}
 reset(){this.mode='house';this.attentionAt=0;this.taskAt=0;this.idleSince=0;this.busySeen=false;this.lastNameAt=0;this.lastPartingAt=0;this.message='Home work is my default job.'}
 snapshot(){return {mode:this.mode,message:this.message,taskSeenBusy:this.busySeen,
  waitingForInstruction:this.mode==='listening',homeGoalSaved:!!this.companion.homeProject.plan}}
 isBusy(){
  const c=this.companion.c,n=c.navigation,p=c.commandPlans
  return !!(n?.job||n?.survey||c.resources?.active||c.acquisition?.active||c.miningJobs?.active||
   c.exploration?.active||c.operations?.pending||p?.batch||p?.running!==null&&p?.running!==undefined)
 }
 pauseHouse(){
  const p=this.companion.homeProject
  if(p.state==='running')p.pauseForOwner('House saved while helping the player.')
 }
 hearName(message,now=Date.now()){
  const c=this.companion.c,connection=c.connection
  if(!connection?.spawned||!addressedByName(message,connection.username||connection.config?.minecraft?.botPlayerName))return false
  if(now-this.lastNameAt<12000)return true
  this.lastNameAt=now;this.attentionAt=now
  if(this.mode!=='task')this.mode='listening'
  this.pauseHouse()
  this.message='Owner called my name. Waiting for their next instruction.'
  connection.say?.("Hey! Let's go do something! I have some ideas too. What are we trying today?")
  return true
 }
 beforeOwnerAction(raw,now=Date.now()){
  const s=String(raw||'').trim().toLowerCase().replace(/[.!?]+$/,'')
  if(!ownerAction.test(s)||homeControl.test(s))return false
  this.pauseHouse();if(this.mode!=='task')this.mode='listening'
  this.attentionAt=now
  this.message='Prioritizing player request, with the house stage saved.'
  return true
 }
 afterOwnerAction(raw,result,now=Date.now()){
  const s=String(raw||'').trim().toLowerCase().replace(/[.!?]+$/,'')
  if(!ownerAction.test(s)||homeControl.test(s))return
  if(!result?.accepted){if(this.mode==='listening')this.attentionAt=now-40000;return}
  this.mode='task';this.taskAt=now;this.idleSince=0
  this.busySeen=this.isBusy()||result.queued===true
  this.message="Working on the owner's requested task; house work is on hold."
 }
 finishTask(now=Date.now()){
  const p=this.companion.homeProject,c=this.companion.c
  if(this.mode==='task'&&c.connection?.spawned&&now-this.lastPartingAt>2500){
   c.connection.say?.("That was fun! Let's do something again soon. I'm heading back to my house!")
   this.lastPartingAt=now
  }
  this.mode='house';this.attentionAt=0;this.taskAt=0;this.idleSince=0;this.busySeen=false
  const r=p.resumeAfterOwnerTask(this.companion.editScope().realm)
  this.message=r?.accepted?'Back to my saved home project.':p.reason||'Available for house work.'
  return r
 }
 manualHold(){
  this.mode='held';this.message='Owner stopped work. Waiting for explicit resume or a new instruction.'
  this.attentionAt=0;this.taskAt=0;this.idleSince=0;this.busySeen=false
 }
 tick(now=Date.now()){
  if(this.mode==='held'||!this.companion.c.connection?.spawned)return
  if(this.mode==='house'){
   if(this.companion.homeProject.state==='owner-paused'){
    this.companion.homeProject.resumeAfterOwnerTask(this.companion.editScope().realm)
   }
   return
  }
  if(this.mode==='listening'){
   if(this.isBusy())return
   if(now-this.attentionAt>=45000)this.finishTask(now)
   return
  }
  if(this.mode!=='task')return
  if(this.isBusy()){this.busySeen=true;this.idleSince=0;return}
  if(!this.idleSince)this.idleSince=now
  // The delay avoids false completion during task setup, plan transitions and
  // short network gaps; queued inputs never prove a successful world edit.
  if(now-this.taskAt>=2200&&now-this.idleSince>=1400)this.finishTask(now)
 }
}
