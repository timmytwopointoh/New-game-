// Chat commands sent in the REALM to the separate authenticated player bot.
// Not a mod: users type "!ai status" or "@veilforge plan ..." in ordinary chat.
// Strict owner allowlist; no automatic action from other players or echoed bot messages.
import {interpretNameUtterance} from './name-intent.js'
const PREFIX = /^(?:!ai|@veilforge)(?:\s+|$)/i
const LOCAL_PING = /^(?:ping|are you there|connection|connection status|are you connected|hello)$/i
const normalizedName = value => String(value||'').trim().toLocaleLowerCase('en-US')

export class RealmChat {
  constructor(connection, controller, config, log=()=>{}, {cooldownMs=900, clock=()=>Date.now()}={}){
    this.connection=connection
    this.controller=controller
    this.log=log
    this.clock=clock
    this.cooldownMs=cooldownMs
    this.owners=new Set((config.ownerPlayerNames||[]).map(normalizedName))
    this.last=new Map()
    this.active=true
    this.onMessage=this.onMessage.bind(this)
    connection.on('player-chat',this.onMessage)
    this.onUpdate=u=>{
      if(this.active && this.observingPlan && connection.spawned)connection.say('Plan update: '+u.message.slice(0,160))
    }
    controller.planner.on('planner-update',this.onUpdate)
  }
  onMessage(packet){
    if(!this.active || !packet || typeof packet.message!=='string')return
    const raw=packet.message.trim()
    const explicit=PREFIX.test(raw)
    const nameIntent=explicit?null:interpretNameUtterance(raw,
      this.connection.username||this.connection.config?.minecraft?.botPlayerName)
    // Ordinary Realm conversation never starts an action merely because
    // somebody mentioned the bot in the middle or end of a statement.
    if(!explicit&&!nameIntent?.addressed)return
    const stats=this.connection.chatDiagnostics
    if(stats)stats.aiRequests++
    const source=String(packet.source||'').trim()
    if(!this.owners.has(normalizedName(source))){
      if(stats){stats.nonOwnerRequests++;stats.lastRejection='sender not in configured owner list'}
      this.log('Ignoring in-world AI command from non-owner.')
      return
    }
    if(normalizedName(source)===normalizedName(this.connection.username)||normalizedName(source)===normalizedName(this.connection.config?.minecraft?.botPlayerName)){
      if(stats){stats.ignoredSelf++;stats.lastRejection='self-message excluded'}
      return
    }
    if(stats){stats.ownerRequests++;stats.lastCommandAt=this.clock();stats.lastRejection='none'}
    const now=this.clock(), prev=this.last.get(source)||0
    const instruction=explicit?raw.replace(PREFIX,'').trim():
      nameIntent?.command||nameIntent?.content||''
    const emergency=/^(stop|stop everything|cancel plan|stop following|stop walking|stop mining)$/i.test(instruction)
    if(!emergency&&now-prev<this.cooldownMs)return
    this.last.set(source,now)
    if(nameIntent?.kind==='attention'){
      const heard=this.connection.survival?.companion?.hearName?.(raw)
      if(!heard)this.connection.say("I'm here! What would you like to do?")
      return
    }
    const command=instruction
    this.log('Owner-only Realm text command received (not yet executed).')
    if(!command || command.length>190 || /[\x00-\x1f\x7f]/.test(command)){
      this.connection.say('Tell me what you want to do or ask me a question (max 190 characters).')
      return
    }
    if(LOCAL_PING.test(command)){
      const s=this.connection.status()
      this.connection.say(s.spawned?'I am in the Realm as '+(s.username||'your AI player')+'.':'I have not spawned yet.')
      return
    }
    // The planner object is the SAME one used by the phone API.  Never spawn a second plan queue.
    const result=this.controller.message(command)
    if(Array.isArray(this.connection.events) && typeof this.connection.nextEventId==='number'){
      this.connection.events.push({id:++this.connection.nextEventId,source:'RealmChat',message:`${source} requested: ${command.slice(0,145)}`})
      if(this.connection.events.length>64)this.connection.events.shift()
    }
    this.observingPlan=Boolean(result?.planner && result.planner.state==='running')
    this.connection.say(result?.message||'I heard you, but I need a little more detail.')
  }
  stop(){this.active=false;this.connection.off('player-chat',this.onMessage);this.controller.planner.off('planner-update',this.onUpdate)}
}
