import {understandCommand} from './survival/language.js'
// Owner-only commands sent as !ai, @veilforge or @<bot gamertag>.
// No AI can guarantee arbitrary language understanding: unsupported intents are rejected.
// Incoming player-chat source names are supplied by the Bedrock server, never by this handler.
const PREFIX=/^(?:!ai|@veilforge)(?:\s+|$)/i
const STOP=/^(?:stop|stop everything|cancel|cancel plan|cancel job|stop walking|stop mining|abort|wait here)$/i
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
export class RealmChat{
 constructor(connection,controller,config,log=()=>{},{cooldownMs=900,clock=()=>Date.now()}={}){
  this.connection=connection;this.controller=controller;this.log=log;this.clock=clock
  this.cooldownMs=cooldownMs;this.owners=new Set((config.ownerPlayerNames||[]).map(s=>String(s).toLowerCase()))
  this.last=new Map();this.active=true;this.observingPlan=false
  this.onMessage=this.onMessage.bind(this)
  connection.on('player-chat',this.onMessage)
  this.onUpdate=u=>{if(this.active&&this.observingPlan&&connection.spawned)connection.say('Plan: '+u.message.slice(0,150))}
  controller.planner?.on?.('planner-update',this.onUpdate)
  this.onQueueProgress=u=>{
   if(!this.active||!this.observingPlan||!connection.spawned)return
   // Only relay short, bounded queue statuses for a queue begun by owner chat.
   // Labels distinguish 'sent-unverified' from any server-confirmed success.
   connection.say('Queue: '+String(u.message||'').slice(0,160))
   if(!u.active)this.observingPlan=false
  }
  connection.on('realm-queue-progress',this.onQueueProgress)
 }
 extract(raw){
  if(PREFIX.test(raw))return raw.replace(PREFIX,'').trim()
  const bot=String(this.connection.username||this.connection.config?.minecraft?.botPlayerName||'').trim()
  if(bot){
   const tagged=raw.match(new RegExp('^@?'+escape(bot)+'(?:[:,]?\\s+|$)','i'))
   if(tagged)return raw.slice(tagged[0].length).trim()
  }
  return null
 }
 onMessage(packet){
  if(!this.active||typeof packet?.message!=='string')return
  const source=String(packet.source||''),raw=packet.message.trim()
  const instruction=this.extract(raw)
  if(instruction===null)return
  if(!this.owners.has(source.toLowerCase())){this.log('Ignored non-owner Realm AI command.');return}
  if(source.toLowerCase()===String(this.connection.username||'').toLowerCase())return
  if(instruction.length>190||/[\x00-\x1f\x7f]/.test(instruction)){this.connection.say('Use a short command (up to 190 characters).');return}
  const canonical=understandCommand(instruction)
  if(!canonical){this.connection.say('I did not understand that action. Try follow me, walk to X Y Z, dig X Y Z, diagnostics, or help.');return}
  const actor=source.toLowerCase(),now=this.clock(),prev=this.last.has(actor)?this.last.get(actor):-Infinity
  if(!STOP.test(canonical)&&now-prev<this.cooldownMs)return
  this.last.set(actor,now)
  let result
  try{
   if(canonical==='hello')result={accepted:true,message:this.connection.spawned?'I am in the Realm as '+(this.connection.username||'your AI player')+'.':'I have not spawned in the Realm yet.'}
   else if(canonical==='run queue'||canonical==='saved plans')result=this.controller.message(canonical)
   else if(canonical==='stop')result=this.controller.message('stop')
   else result=this.connection.survival?.handle?this.connection.survival.handle(canonical):this.controller.message(canonical)
   if(!result)result={accepted:false,message:'I cannot perform that command yet.'}
  }catch(e){result={accepted:false,message:'Command blocked: '+String(e.message||e).slice(0,130)}}
  if(Array.isArray(this.connection.events)&&Number.isSafeInteger(this.connection.nextEventId)){
   this.connection.events.push({id:++this.connection.nextEventId,source:'RealmChat',message:'Owner command: '+canonical.slice(0,120)})
   if(this.connection.events.length>64)this.connection.events.shift()
  }
  this.observingPlan=!!(result.plans?.runActive||result.planner?.state==='running')
  this.connection.say(String(result.message||'No response').slice(0,180))
 }
 stop(){this.active=false;this.connection.off('player-chat',this.onMessage);this.controller.planner?.off?.('planner-update',this.onUpdate);this.connection.off('realm-queue-progress',this.onQueueProgress)}
}
