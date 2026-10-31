// Chat commands sent in the REALM to the separate authenticated player bot.
// Not a mod: users type "!ai status" or "@veilforge plan ..." in ordinary chat.
// Strict owner allowlist; no automatic action from other players or echoed bot messages.
const PREFIX = /^(?:!ai|@veilforge)(?:\s+|$)/i
const LOCAL_PING = /^(?:ping|are you there|connection|connection status|are you connected|hello)$/i

export class RealmChat {
  constructor(connection, controller, config, log=()=>{}, {cooldownMs=900, clock=()=>Date.now()}={}){
    this.connection=connection
    this.controller=controller
    this.log=log
    this.clock=clock
    this.cooldownMs=cooldownMs
    this.owners=new Set(config.ownerPlayerNames||[])
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
    if(!PREFIX.test(raw))return
    const source=String(packet.source||'')
    if(!this.owners.has(source)){
      this.log('Ignoring in-world AI command from non-owner.')
      return
    }
    if(source===this.connection.username || source===this.connection.config?.minecraft?.botPlayerName)return
    const now=this.clock(), prev=this.last.get(source)||0
    const emergency=/^(stop|stop everything|cancel plan|stop following|stop walking|stop mining)$/i.test(raw.replace(PREFIX,'').trim())
    if(!emergency&&now-prev<this.cooldownMs)return
    this.last.set(source,now)
    const command=raw.replace(PREFIX,'').trim()
    this.log('Owner-only Realm text command received (not yet executed).')
    if(!command || command.length>190 || /[\x00-\x1f\x7f]/.test(command)){
      this.connection.say('Use !ai followed by one short instruction (max 190 characters).')
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
    this.observingPlan=Boolean(result.planner && result.planner.state==='running')
    this.connection.say(result.message)
  }
  stop(){this.active=false;this.connection.off('player-chat',this.onMessage);this.controller.planner.off('planner-update',this.onUpdate)}
}
