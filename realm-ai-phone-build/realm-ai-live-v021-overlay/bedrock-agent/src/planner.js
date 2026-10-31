// VEILFORGE goal planner v0.7: an intentionally bounded, explainable plan-and-execute engine.
// This is not an LLM or general Minecraft pathfinding. Every step is a validated Bedrock command.
import { EventEmitter } from 'node:events'
import {interpretMessage} from './chat.js'
import {parseCommand} from '../pack-template/scripts/commands.js'

const MAX_STEPS=4
const FAIL=/^(?:Mining is disabled|Building is disabled|No nearby |No .* found in the immediate|Need \d+ |Already doing |Already working\.|Cannot |Could not |Destination is blocked|Teleport rejected|Structure |Bridge needs |Stay near |The owner |An approved owner |Bot player |Bot .*not connected|I can only |Block not permitted|Ran out of |No inventory|No marked location|Mark is |Movement commands |That structure |Stopped (?:mining|building)|Stopped .+:|.*footprint obstructed|.*outside maximum build radius|.*requires solid supporting blocks)/i
const ENDING=/^(?:Finished (mining|building) (.+?): (\d+)\/(\d+) successful\.)$/i
const SIMPLE={
 inventory:/^Inventory(?: is empty|:)/i, position:/^Bot at /i, players:/^Online \(/i,
 survey:/^Nearby scan:/i, count:/^Found \d+ /i, find:/^Nearest scanned /i,
 status:/^Bot online at /i,task:/^(?:Job .*:|No active block job\.)/i,
 mark:/^Saved bot position /i,return:/^Returned to saved spot\./i,forget:/^Saved position cleared\./i,
 come:/^Moved close to owner\./i, go:/^Moved to nearby coordinates\./i, follow:/^Following /i,
 stay:/^Stopped follow and cancelled pending work\./i
}
const PLAN_HELP='Try “plan find iron ore then mine 2 iron ore”, “plan gather 3 oak logs then survey nearby”, or “plan build a wall 3 by 2 with cobblestone”. I will show the steps first. Say “start plan” to run, “plan status” to check, or “cancel plan” to stop.'
const UNSUPPORTED=/\b(?:house|shelter|castle|village|farm|craft|smelt|fight|combat|monster|creeper|travel|explore|tree farm|sort chests|trade|diamond sword)\b/i
function parseGoal(goal){
 if(typeof goal!=='string'||goal.length>180||/[\x00-\x1f\x7f]/.test(goal))return {error:'Describe the goal in one short message.'}
 let s=goal.trim().replace(/[.!?]+$/,'').replace(/^(?:please\s+|can you\s+|could you\s+|i want you to\s+)/i,'')
 if(UNSUPPORTED.test(s))return {error:'That goal needs abilities I do not have yet (large structures, crafting, distant exploration, or survival combat). I can plan small nearby tasks. '+PLAN_HELP}
 // Up to 4 explicit clauses, with an optional limited conjunctive gathering phrase.
 s=s.replace(/^(find|locate) (.+?) and (?:mine|gather|collect) (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (.+)$/i,(_,v,m,n,b)=>`find ${m} then gather ${n} ${b}`)
 const clauses=s.split(/\s+(?:then|and then|after that)\s+/i).map(v=>v.trim()).filter(Boolean)
 if(!clauses.length||clauses.length>MAX_STEPS)return {error:'Plans must have 1–4 short steps. '+PLAN_HELP}
 const steps=[]
 for(const phrase of clauses){
   const intent=interpretMessage(phrase)
   if(!intent.command)return {error:`I can't safely plan “${phrase.slice(0,70)}”. ${intent.message}`}
   const cmd=parseCommand(intent.command)
   if(cmd.action==='invalid'||['stop','stay','help'].includes(cmd.action))return {error:'That step cannot be included in a job plan.'}
   // Avoid running endlessly active follow mode as part of a multi-step sequence.
   if(cmd.action==='follow'&&clauses.length>1)return {error:'Follow mode is ongoing. Give that command separately, not in a multi-step plan.'}
   steps.push({command:intent.command,action:cmd.action,description:phrase,worldEdit:['mine','wall','floor','pillar','bridge'].includes(cmd.action),count:cmd.count||cmd.width*cmd.height||cmd.length||0})
 }
 return {goal:s,steps,needsApproval:steps.some(x=>x.worldEdit)}
}
function outcome(step,message){
 if(FAIL.test(message))return {done:true,ok:false,detail:message}
 if(step.worldEdit){
   const m=message.match(ENDING)
   if(!m)return {done:false}
   if(m[1].toLowerCase()!==(step.action==='mine'?'mining':'building'))return {done:false}
   if(step.action==='mine'&&!m[2].includes(step.command.split(' ').slice(-1)[0]))return {done:false}
   if(step.action!=='mine'&&!m[2].includes(step.action))return {done:false}
   const done=Number(m[3]),total=Number(m[4]);
   const ok=done===total&&done===step.count
   return {done:true,ok,detail:ok?message:`Only ${done}/${step.count} requested blocks completed; halted remaining steps.`}
 }
 return SIMPLE[step.action]?.test(message)?{done:true,ok:true,detail:message}:{done:false}
}
export class Planner extends EventEmitter{
 constructor(connection,{timeoutMs=90000}={}){
   super();this.connection=connection;this.timeoutMs=timeoutMs;this.sequence=0;this.plan=null;this.timer=null;this.eventFloor=0
   connection.on?.('realm-report',ev=>this.onReport(ev))
   connection.on?.('session-end',()=>this.halt('The bot disconnected before the goal was completed.'))
 }
 snapshot(){
   if(!this.plan)return {state:'idle',id:null,goal:null,current:0,total:0,steps:[],lastResult:''}
   const p=this.plan
   return {state:p.state,id:p.id,goal:p.goal,current:p.current,total:p.steps.length,
     steps:p.steps.map((x,i)=>({description:x.description,command:x.command,status:p.results[i]?.status||(p.state==='running'&&p.current===i?'running':'pending')})),lastResult:p.lastResult,worldEdits:p.needsApproval}
 }
 update(message){this.emit('planner-update',{message,...this.snapshot()})}
 preview(goal){
   if(this.plan?.state==='running')return {accepted:false,queued:false,message:'A plan is running. Say “cancel plan” first.',planner:this.snapshot()}
   const created=parseGoal(goal)
   if(created.error)return {accepted:true,queued:false,message:created.error,planner:this.snapshot()}
   this.clearTimer()
   this.plan={...created,id:++this.sequence,state:'preview',current:0,results:[],lastResult:'Awaiting approval.'}
   const intro=`Plan #${this.plan.id}: ${created.steps.map((s,i)=>`${i+1}) ${s.command}`).join(' • ')}. ${created.needsApproval?'This can modify your Realm. Back up the world and enable world edits explicitly. ':''}Type “start plan” to execute or “cancel plan” to discard.`
   this.update('Plan prepared: '+intro)
   return {accepted:true,queued:false,message:intro,planner:this.snapshot()}
 }
 start(){
   const p=this.plan
   if(!p||p.state!=='preview')return {accepted:false,queued:false,message:'No pending plan. '+PLAN_HELP,planner:this.snapshot()}
   if(!this.connection.spawned)return {accepted:false,queued:false,message:'The bot must join and spawn in the Realm before a plan can run.',planner:this.snapshot()}
   p.state='running';p.lastResult='Running';this.execute()
   return {accepted:true,queued:true,message:`Started plan #${p.id}. Step 1/${p.steps.length}: ${p.steps[0].command}. I will wait for a matching Realm reply before continuing.`,planner:this.snapshot()}
 }
 execute(){
   const p=this.plan
   if(!p||p.state!=='running')return
   if(p.current>=p.steps.length){p.state='completed';p.lastResult='All steps reported complete';this.update(`Plan #${p.id} finished. Reported steps: ${p.steps.length}/${p.steps.length}.`);return}
   const step=p.steps[p.current]
   this.eventFloor=this.connection.nextEventId||0
   this.clearTimer()
   this.timer=setTimeout(()=>this.halt(`Timed out waiting for the Realm to confirm “${step.command}”. No further steps were sent.`),this.timeoutMs)
   this.timer.unref?.()
   const index=p.current
   const response=this.connection.send(step.command)
   if(!response.accepted){this.halt('Unable to send step '+(index+1)+': '+response.message);return}
   if(p.state==='running'&&p.current===index)this.update(`Plan #${p.id} sent step ${index+1}/${p.steps.length}: ${step.command}. Waiting for a world reply.`)
 }
 onReport(ev){
   const p=this.plan
   if(!p||p.state!=='running'||!ev||!(Number(ev.id)>this.eventFloor))return
   const result=outcome(p.steps[p.current],String(ev.message||''))
   if(!result.done)return
   this.clearTimer()
   p.results[p.current]={status:result.ok?'completed':'failed',detail:result.detail}
   if(!result.ok){this.halt('Step '+(p.current+1)+' failed: '+result.detail);return}
   p.lastResult=result.detail;p.current++
   if(p.current>=p.steps.length){p.state='completed';this.update(`Plan #${p.id} completed according to the Realm bridge. ${p.steps.length} steps reported successful.`)}
   else this.execute()
 }
 halt(reason){
   const p=this.plan
   if(!p||p.state!=='running')return
   this.clearTimer();p.state='failed';p.lastResult=reason
   this.update(`Plan #${p.id} stopped: ${reason}`)
 }
 cancel(){
   const p=this.plan
   if(!p||!['preview','running'].includes(p.state))return {accepted:true,queued:false,message:'There is no pending or active plan.',planner:this.snapshot()}
   const wasRunning=p.state==='running';this.clearTimer();p.state='cancelled';p.lastResult='Cancelled by owner.'
   if(wasRunning&&this.connection.spawned){
     // Cancel the Realm pack's current task as well, but already modified blocks are not undone.
     const sent=this.connection.send('stop')
     if(!sent.accepted)p.lastResult+=' WARNING: unable to send stop to the Realm.'
   }
   this.update(`Plan #${p.id} cancelled. Already changed blocks are not rolled back.`)
   return {accepted:true,queued:false,message:`Plan #${p.id} cancelled. Already changed blocks cannot be undone automatically.`,planner:this.snapshot()}
 }
 clearTimer(){if(this.timer){clearTimeout(this.timer);this.timer=null}}
 handle(text){
   if(typeof text!=='string')return null
   const s=text.trim()
   if(/^(?:help plans?|what can you plan|planner help)$/i.test(s))return {accepted:true,queued:false,message:PLAN_HELP,planner:this.snapshot()}
   if(/^(?:plan status|planner status|show plan|what is the plan|plan progress)$/i.test(s)){const p=this.snapshot();return {accepted:true,queued:false,message:p.id?`Plan #${p.id}: ${p.state}, ${p.current}/${p.total} steps. ${p.lastResult}`:'No plan yet. '+PLAN_HELP,planner:p}}
   if(/^(?:start plan|execute plan|run plan|approve plan)$/i.test(s))return this.start()
   if(/^(?:cancel plan|discard plan|abort plan)$/i.test(s))return this.cancel()
   if(/^plan\s+\S/i.test(s))return this.preview(s.replace(/^plan\s+/i,''))
   if(/^do\s+.+\s+then\s+/i.test(s))return this.preview(s.replace(/^do\s+/i,''))
   return null
 }
}
export {parseGoal,outcome}
