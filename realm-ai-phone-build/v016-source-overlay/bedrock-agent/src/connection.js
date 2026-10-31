import {EventEmitter} from 'node:events'
import bedrock from 'bedrock-protocol'
import {buildClientOptions} from './options.js'
import {root} from '../tools/config.js'
import {attachRealmPacks} from './realm-packs.js'
import path from 'node:path'
import {SurvivalController} from './survival/controller.js'
export function safeDisconnectMessage(packet){
  if(packet==null)return ''
  const raw=typeof packet==='string'?packet:String(packet.message||packet.reason||packet.status||'')
  return raw.replace(/[\x00-\x1f\x7f]/g,' ').replace(/https?:\/\/\S+/gi,'[link omitted]').trim().slice(0,180)
}


export class Connection extends EventEmitter {
  constructor(config,log=console.log){
    super()
    this.config=config;this.log=log
    this.client=null;this.connected=false;this.joined=false;this.spawned=false
    this.survival=new SurvivalController(this,{plansDirectory:path.join(root,'private','command-plans'),scope:this.config.minecraft.realmId?String(this.config.minecraft.realmId):null});this.lastRejoinAt=0
    this.username='';this.authChallenge=null;this.authState='starting';this.lastPhase='starting';this.packRequestAt=0;this.packHeadersReceived=0;this.packChunksReceived=0;this.packBytesReceived=0;this.transportCloseReason='';this.packStatus={stage:'not-reached',message:'Pack stage not reached',done:0,total:0};this.lastError='';this.recentMessages=[];this.lastCommand='';this.nextEventId=0;this.events=[]
  }
  status(){return {survival:this.survival.snapshot(),connected:this.connected,joined:this.joined,spawned:this.spawned,username:this.username||null,server:this.config.minecraft.mode==='realm'?'Bedrock Realm':this.config.minecraft.host+':'+this.config.minecraft.port,lastError:this.lastError,lastPhase:this.lastPhase,
      packWaitSeconds:this.packRequestAt&&!this.spawned?Math.max(0,Math.floor((Date.now()-this.packRequestAt)/1000)):0,
      packHeadersReceived:this.packHeadersReceived,packChunksReceived:this.packChunksReceived,authState:this.authState,packStatus:this.packStatus,lastCommand:this.lastCommand,recentMessages:this.recentMessages.slice(-8),authChallenge:this.authChallenge}}
  reconnect(){
    if(this.spawned)return {accepted:true,queued:false,message:'Already joined. Use look around or survival status.'}
    if(this.client&&!this.client._closed&&!this.lastError)return {accepted:true,queued:false,message:'A join or sign-in is already in progress. Check the Microsoft code shown in the app.'}
    if(Date.now()-this.lastRejoinAt<10000)return {accepted:false,queued:false,message:'Wait ten seconds before another rejoin attempt.'}
    this.lastRejoinAt=Date.now()
    try{
      this.close();this.client?.removeAllListeners();this.client=null
      this.connected=false;this.joined=false;this.spawned=false;this.authChallenge=null;this.lastError='';this.lastPhase='starting';this.authState='starting'
      this.packRequestAt=0;this.packHeadersReceived=0;this.packChunksReceived=0;this.packBytesReceived=0;this.transportCloseReason=''
      this.packStatus={stage:'not-reached',message:'Rejoining with saved Microsoft session',done:0,total:0}
      this.start()
      return {accepted:true,queued:true,message:'Rejoining the Realm with the existing saved session. No login cache was deleted. Complete Microsoft sign-in only if the app requests it.'}
    }catch(e){this.lastError=String(e.message||e);this.authState='error';return {accepted:false,queued:false,message:'Rejoin failed: '+this.lastError}}
  }
  start(){
    const m=this.config.minecraft
    const options=buildClientOptions(m,root,data=>{
      const url=String(data?.verification_uri||'https://www.microsoft.com/link')
      const code=String(data?.user_code||data?.userCode||'(check login window)')
      // The app displays the official Microsoft device sign-in code locally.
      // Never log it, persist it to GitHub, or request an account password.
      this.authChallenge={verificationUri:url.startsWith('https://www.microsoft.com/')?url:'https://www.microsoft.com/link',userCode:code}
      this.lastPhase='sign-in-required';this.authState='sign-in-required';this.lastError=''
      this.emit('auth-code',this.authChallenge)
      this.log('Microsoft device-code sign-in needed on this device.')
    })
    // This callback is invoked by Bedrock Realms discovery for the signed-in account.
    if(options.realms?.pickRealm){
      const original=options.realms.pickRealm
      options.realms.pickRealm=realms=>{
        this.lastPhase='realm-selecting';this.authState='realm-selecting'
        this.log('Realm discovery returned '+(Array.isArray(realms)?realms.length:0)+' joined Realm(s).')
        try{
          const selected=original(realms)
          this.survival.commandPlans.setScope(String(selected.id))
          this.authChallenge=null;this.lastPhase='realm-selected';this.authState='realm-selected'
          this.log('Realm selected; attempting game connection.')
          return selected
        }catch(e){
          this.authChallenge=null;this.authState='error'
          this.lastError=String(e?.message||e).slice(0,180)
          this.log('Realm discovery failed: '+this.lastError)
          throw e
        }
      }
    }
    // Only a transient 503 on /worlds/{realmId}/join is retried. We never restart Xbox login.
    options.onRealmJoinRetry=({attempt,totalAttempts,delayMs})=>{
      this.lastPhase='realm-join-retry';this.authState='realm-join-retry';this.lastError=''
      this.log('Minecraft Realm join request returned HTTP 503; retry '+(attempt+1)+'/'+totalAttempts+' in '+Math.ceil(delayMs/1000)+'s')
    }
    const client=bedrock.createClient(options)
    this.client=client
    this.survival.attach(client)
    // These listeners run before the pack handler and record counts only.
    // Never persist pack URLs, auth data, or raw Minecraft packets to logs.
    client.on('resource_pack_data_info',()=>{this.packHeadersReceived++})
    client.on('resource_pack_chunk_data',p=>{
      this.packChunksReceived++
      this.packBytesReceived+=Math.max(0,Number(p?.payload?.length||0))
    })
    this.packHandler=attachRealmPacks(client,path.join(root,'private','realm-packs'),state=>{
      if(state.stage==='pack-request'){
        this.packRequestAt=Date.now()
        this.packHeadersReceived=0;this.packChunksReceived=0;this.packBytesReceived=0
      }
      this.packStatus=state
      if(state.stage!=='pack-error')this.lastPhase=state.stage
      if(state.stage==='pack-error'){
        this.authState='error'
        this.lastError='Resource pack: '+state.message
        this.log('Resource pack transfer failed: '+state.message)
      }else if(state.stage==='packs-ready'){
        this.joined=true;this.authState='packs-ready'
        this.log('Resource pack handshake completed; waiting for the Minecraft spawn event.')
      }else{
        this.authState=state.stage
        this.log('Realm pack stage: '+state.message)
      }
    })
    // The library reports authentication/transport separately from the game join.
    // Do not log tokens, automatically retry or infer that the game has spawned.
    client.on('session',()=>{
      this.authChallenge=null;this.lastPhase='authenticated';this.authState='authenticated';this.lastError=''
      this.log('Minecraft session established; joining the Realm.')
    })
    client.on('connect',()=>{this.connected=true;this.authChallenge=null;this.lastPhase='transport-connected';this.authState='connecting';this.log('Bedrock transport connected.')})
    client.on('join',()=>{
      // The transport can close silently without a Minecraft kick packet.
      // Capture its reason BEFORE bedrock-protocol calls close().
      const transport=client.connection
      if(transport&&typeof transport.onCloseConnection==='function'&&!transport.__veilforgeCloseObserved){
        transport.__veilforgeCloseObserved=true
        const previous=transport.onCloseConnection
        transport.onCloseConnection=(reason)=>{
          const msg=safeDisconnectMessage(reason)
          if(msg){
            this.transportCloseReason=msg
            if(!this.lastError)this.lastError='Transport closed: '+msg
          }
          return previous.call(transport,reason)
        }
      }
this.authChallenge=null;this.lastPhase='bedrock-login-accepted';this.authState='negotiating-packs';this.log('Bedrock handshake accepted; negotiating required Realm packs.')})
    client.on('spawn',()=>{
      this.spawned=true;this.lastPhase='spawned'
      this.authChallenge=null;this.authState='spawned';this.lastError=''
      this.username=client.profile?.name||client.username||m.botPlayerName
      this.log('Spawn event received. Display name reported: '+this.username)
      if(this.username!==m.botPlayerName)this.log('WARNING: gamertag in config differs from player identity. Server pack will not recognize commands; fix config and regenerate pack.')
    })
    client.on('text',p=>{
      const message=String(p.message||'').slice(0,240),source=String(p.source_name||'').slice(0,80)
      if(!message)return
      this.recentMessages.push({source,message})
      if(this.recentMessages.length>24)this.recentMessages.shift()
      if(message.startsWith('[VEILFORGE]') && (!source || source===m.botPlayerName)){
        this.events.push({id:++this.nextEventId,message:message.replace(/^\[VEILFORGE\]\s*/,''),source:'Realm'})
        if(this.events.length>64)this.events.shift()
        this.emit('realm-report',this.events[this.events.length-1])
        this.log('World bridge: '+message)
      }
      else if(source){
        this.log('Chat '+source+': '+message)
        // Ordinary server text is only an input event; never trust the displayed source
        // for authorization until the command router compares exact owner names.
        this.emit('player-chat',{source,message})
      }
    })
    const failure=(kind,packet)=>{
      const reason=safeDisconnectMessage(packet)
      if(reason&&!this.lastError)this.lastError=kind+': '+reason
      this.authChallenge=null;this.authState='error'
      if(this.lastError)this.log('Realm failed at '+this.lastPhase+': '+this.lastError)
    }
    client.on('play_status',p=>{
      const state=String(p?.status||'')
      if(state==='login_success')this.lastPhase='minecraft-login-ok'
      else if(state && state!=='player_spawn')failure('Minecraft login status',{message:state})
    })
    client.on('start_game',()=>{this.lastPhase='world-started';this.log('Minecraft start_game received; awaiting spawn.')})
    client.on('kick',p=>failure('Server rejected join',p))
    client.on('error',e=>failure('Bedrock protocol error',e))
    client.on('disconnect',p=>{
      failure('Server disconnect',p)
      this.emit('session-end');this.connected=false;this.joined=false;this.spawned=false
    })
    client.on('close',()=>{
      if(!this.lastError&&this.packRequestAt){
        const sec=Math.max(0,Math.round((Date.now()-this.packRequestAt)/1000))
        if(!this.packHeadersReceived&&this.packStatus?.stage==='pack-request'){
          this.lastError='Server closed '+sec+'s after pack request; no pack data was sent. This is not a slow download.'
        }else{
          this.lastError='Connection closed '+sec+'s after pack request: '+this.packHeadersReceived+' pack headers and '+this.packChunksReceived+' chunks received.'
        }
      }

      this.emit('session-end');this.connected=false;this.joined=false;this.spawned=false
      if(!this.lastError)this.lastError='Connection closed at '+this.lastPhase+'; no server reason was sent.'
      this.authChallenge=null;this.authState='disconnected'
    })
    client.on('end',()=>{
      this.emit('session-end');this.connected=false;this.joined=false;this.spawned=false
      if(!this.lastError)this.lastError='Connection ended at '+this.lastPhase+'; no server reason was sent.'
      this.authChallenge=null;this.authState='disconnected'
    })
    return client
  }
  send(command){
    if(!this.spawned||!this.client) return {accepted:false,message:'Bot has not spawned; no command sent.'}
    const text='!vf '+command
    try{
      this.queueChat(text)
      this.lastCommand=text
      return {accepted:true,message:'Command sent to Bedrock server chat. Check world bridge replies for execution; server acceptance not verified.'}
    }catch(err){this.lastError=err.message;return {accepted:false,message:'Bedrock chat send failed: '+err.message}}
  }
  // Gameplay / planner commands go to the optional Script API pack as !vf.
  // Ordinary bot replies work with basic Bedrock chat; they never imply an action succeeded.
  queueChat(message){
    if(!this.spawned||!this.client)throw new Error('Bot has not spawned yet.')
    const safe=String(message).replace(/[\x00-\x1f\x7f]/g,' ').trim()
    if(!safe||safe.length>235)throw new Error('Invalid chat length')
    this.client.queue('text',{type:'chat',needs_translation:false,source_name:this.username||this.config.minecraft.botPlayerName,xuid:'',platform_chat_id:'',filtered_message:'',message:safe})
  }
  say(message){
    try{this.queueChat('[VF AI] '+String(message).slice(0,185));return true}
    catch(err){this.lastError=String(err.message||err);return false}
  }
  close(){try{this.survival.close();this.packHandler?.cleanup();this.client?.close()}catch(_){} }
}
