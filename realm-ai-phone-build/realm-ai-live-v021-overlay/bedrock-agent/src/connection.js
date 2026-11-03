import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {classifyConnectionFailure,instrumentAuthflow,authFailurePhase} from './connection-diagnostics.js'
const {Authflow}=createRequire(import.meta.url)('prismarine-auth')
import bedrock from 'bedrock-protocol'
import {buildClientOptions} from './options.js'
import {root} from '../tools/config.js'
import {attachRealmPacks} from './realm-packs.js'
import {preparePackResponseWire} from './bedrock-pack-wire-compat.js'
import {JoinLoadingLiveness,recoveryDecision} from './join-loading-liveness.js'
import {observeBedrockTransport,transportEvidenceSummary} from './transport-evidence.js'
import {createPackHandshakeForensics} from './pack-handshake-forensics.js'
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
    this.client=null;this.connected=false;this.joined=false;this.spawned=false;this.loadingLiveness=new JoinLoadingLiveness();this.recoveryAttempts=0;this.recoveryTimer=null;this.recoveryNextAt=0;this.manualRecoveryStop=false;this.loadingTicker=setInterval(()=>this.checkLoading(),5000);this.loadingTicker.unref?.()
    this.survival=new SurvivalController(this,{plansDirectory:path.join(root,'private','command-plans'),scope:this.config.minecraft.realmId?String(this.config.minecraft.realmId):null});this.lastRejoinAt=0
    this.chatDiagnostics={textPackets:0,playerChatPackets:0,aiRequests:0,ownerRequests:0,nonOwnerRequests:0,ignoredSelf:0,replyAttempts:0,replyQueued:0,replyFailures:0,lastPacketAt:null,lastCommandAt:null,lastRejection:'none',lastReplyError:'none'}
    this.username='';this.authChallenge=null;this.authState='starting';this.lastPhase='starting';this.packRequestAt=0;this.packHeadersReceived=0;this.packChunksReceived=0;this.packBytesReceived=0;this.transportCloseReason='';this.transportCloseKind='none';this.transportEvidence=null;this.packHandshakeAudit=null;this.packStatus={stage:'not-reached',message:'Pack stage not reached',done:0,total:0};this.lastError='';this.recentMessages=[];this.lastCommand='';this.nextEventId=0;this.events=[]
  }
  cancelAutoRecovery(){
    this.manualRecoveryStop=true
    if(this.recoveryTimer){clearTimeout(this.recoveryTimer);this.recoveryTimer=null}
    this.recoveryNextAt=0
  }
  scheduleLoadingRecovery(stage,reason){
    const choice=recoveryDecision({stage,reason,attempts:this.recoveryAttempts,spawned:this.spawned,authPending:!!this.authChallenge?.userCode||this.authState==='sign-in-required',manualStop:this.manualRecoveryStop})
    if(!choice.retry||this.recoveryTimer||!this.client)return false
    this.recoveryAttempts++
    this.recoveryNextAt=Date.now()+choice.delayMs
    this.lastError='Realm disconnected or stalled ('+reason+'). Bounded automatic rejoin '+this.recoveryAttempts+'/2 scheduled; saved login kept.'
    this.log('Realm join stalled at '+stage+'; retry '+this.recoveryAttempts+'/2 scheduled in '+Math.round(choice.delayMs/1000)+'s. No authentication files removed.')
    const generation=this.client
    this.recoveryTimer=setTimeout(()=>{
      this.recoveryTimer=null;this.recoveryNextAt=0
      if(this.spawned||this.manualRecoveryStop||this.client!==generation)return
      const result=this.reconnect({automatic:true})
      this.log('Automatic Realm rejoin: '+String(result?.message||'unknown result').slice(0,170))
    },choice.delayMs)
    this.recoveryTimer.unref?.()
    return true
  }
  checkLoading(){
    if(!this.client||this.spawned||this.manualRecoveryStop||this.recoveryTimer||this.authChallenge?.userCode)return
    if(!this.loadingLiveness.stalled())return
    // World loading and pack preparation can legitimately take >15 minutes.
    // Never use repeated keepalive/status as a progress reset.
    const stage=this.loadingLiveness.stage
    if(['pack-request','pack-storage','pack-retry','downloading-packs','pack-cached','world-started','world-data','packs-ready'].includes(stage)){
      this.lastPhase=stage;this.authState='loading-stalled'
      this.scheduleLoadingRecovery(stage,'loading-stalled')
    }
  }
  diagnostics(){return {schema:1,phase:this.lastPhase,authState:this.authState,connected:this.connected,joined:this.joined,spawned:this.spawned,deviceCodePending:!!this.authChallenge?.userCode,titleTokenRecoveryAttempted:this.titleTokenRecoveryAttempted===true,packStage:this.packStatus.stage,packReason:this.packStatus.reason||'none',packFreeMB:this.packStatus.freeMB??0,packNeededMB:this.packStatus.neededMB??0,packRetryable:this.packStatus.retryable===true,packCacheStatusIssued:this.packStatus.cacheStatusIssued===true,packDownloadRequestIssued:this.packStatus.downloadRequestIssued===true,packResponseCount:this.packStatus.packResponseCount??0,packServerCount:this.packStatus.serverPackCount??0,packCdnCount:this.packStatus.cdnPackCount??0,packAdvertisedCount:this.packStatus.packAdvertisedCount??0,packSkippedOptional:this.packStatus.packSkippedOptional??0,packSelectionPolicy:this.packStatus.packSelectionPolicy??'unknown',packLegacyBehaviorCount:this.packStatus.packLegacyBehaviorCount??0,packHeaders:this.packHeadersReceived,packChunks:this.packChunksReceived,...this.loadingLiveness.snapshot(),loadingRecoveryAttempts:this.recoveryAttempts,loadingRecoveryScheduled:!!this.recoveryTimer,loadingNextRetrySeconds:this.recoveryNextAt?Math.max(0,Math.ceil((this.recoveryNextAt-Date.now())/1000)):0,failure:this.lastFailure||null,clientIdentity:this.clientIdentity||null,...transportEvidenceSummary(this.client),transportCloseKind:this.transportCloseKind||'none',packWireProtocol:this.packWire?.version||'not-initialized',packWireMode:this.packWire?.mode||'unknown',packWireEncoded:this.packStatus.packWireEncoded===true,packWireVerified:this.packStatus.packWireVerified===true,packWireVersion:this.packStatus.packWireVersion||'unknown',packWireCode:this.packStatus.packWireCode||0,packWireBytes:this.packStatus.packWireBytes||0,packWireIds:this.packStatus.packWireIds||0,packWireText:this.packStatus.packWireText||'unknown',packTransportConnectedAtRequest:this.packStatus.packTransportConnectedAtRequest===true,packResourceClassifiedCount:this.packStatus.packResourceClassifiedCount||0,packBehaviorClassifiedCount:this.packStatus.packBehaviorClassifiedCount||0,packAddonClassifiedCount:this.packStatus.packAddonClassifiedCount||0,packHeadersSeenByHandler:this.packStatus.packHeadersSeenByHandler||0,packChunksSeenByHandler:this.packStatus.packChunksSeenByHandler||0,savedAuthentication:'kept'}}
  status(){return {chatDiagnostics:{...this.chatDiagnostics},support:this.trace?.summary(),diagnostics:this.diagnostics(),survival:this.survival.snapshot(),connected:this.connected,joined:this.joined,spawned:this.spawned,username:this.username||null,server:this.config.minecraft.mode==='realm'?'Bedrock Realm':this.config.minecraft.host+':'+this.config.minecraft.port,lastError:this.lastError,lastPhase:this.lastPhase,
      packWaitSeconds:this.packRequestAt&&!this.spawned?Math.max(0,Math.floor((Date.now()-this.packRequestAt)/1000)):0,
      packHeadersReceived:this.packHeadersReceived,packChunksReceived:this.packChunksReceived,authState:this.authState,packStatus:this.packStatus,lastCommand:this.lastCommand,recentMessages:this.recentMessages.slice(-8),authChallenge:this.authChallenge}}
  reconnect({automatic=false}={}){
    if(!automatic){this.cancelAutoRecovery();this.manualRecoveryStop=false;this.recoveryAttempts=0}
    if(this.spawned)return {accepted:true,queued:false,message:'Already joined. Use look around or survival status.'}
    if(this.client&&!this.client._closed&&!this.lastError)return {accepted:true,queued:false,message:'A join or sign-in is already in progress. Check the Microsoft code shown in the app.'}
    if(Date.now()-this.lastRejoinAt<10000)return {accepted:false,queued:false,message:'Wait ten seconds before another rejoin attempt.'}
    this.lastRejoinAt=Date.now()
    try{
      this.close();this.client?.removeAllListeners();this.client=null;this.manualRecoveryStop=false
      this.connected=false;this.joined=false;this.spawned=false;this.authChallenge=null;this.lastError='';this.lastPhase='starting';this.authState='starting'
      this.packRequestAt=0;this.packHeadersReceived=0;this.packChunksReceived=0;this.packBytesReceived=0;this.transportCloseReason='';this.transportCloseKind='none';this.transportEvidence=null
      this.packStatus={stage:'not-reached',message:'Rejoining with saved Microsoft session',done:0,total:0}
      this.loadingLiveness.reset()
      this.start()
      return {accepted:true,queued:true,message:'Rejoining the Realm with the existing saved session. No login cache was deleted. Complete Microsoft sign-in only if the app requests it.'}
    }catch(e){this.lastError=String(e.message||e);this.authState='error';return {accepted:false,queued:false,message:'Rejoin failed: '+this.lastError}}
  }
  start(){
    this.loadingLiveness.reset()
    this.lastFailure=null;this.titleTokenRecoveryAttempted=false
    const m=this.config.minecraft
    const options=buildClientOptions(m,root,data=>{
      const url=String(data?.verification_uri||'https://www.microsoft.com/link')
      const code=String(data?.user_code||data?.userCode||'(check login window)')
      // The app displays the official Microsoft device sign-in code locally.
      // Never log it, persist it to GitHub, or request an account password.
      this.authChallenge={verificationUri:url.startsWith('https://www.microsoft.com/')?url:'https://www.microsoft.com/link',userCode:code}
      this.lastPhase='sign-in-required';this.authState='sign-in-required';this.lastError=''
      this.emit('auth-code',this.authChallenge)
      this.emit('connection-diagnostics',this.diagnostics())
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
          this.survival.authorizeRealmClearing(String(selected.id))
          this.survival.commandPlans.setScope(String(selected.id))
          this.survival.learning.setScope(String(selected.id))
          this.survival.commandVocabulary.setScope(String(selected.id))
          this.survival.landmarks.setScope(String(selected.id))
          this.survival.workshop.setScope(String(selected.id))
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
    this.lastPhase=m.mode==='realm'?'realm-discovery':'minecraft-authentication';this.authState=this.lastPhase
    this.clientIdentity={platform:options.deviceType,deviceOS:options.deviceOS,flow:options.flow,accessTokenExpiryUnits:'seconds'}
    options.authflow=instrumentAuthflow(new Authflow(options.username,options.profilesFolder,options,options.onMsaCode),{
      getPhase:()=>this.lastPhase,
      setPhase:phase=>{this.lastPhase=phase;if(!this.lastError)this.authState=phase;this.emit('connection-diagnostics',this.diagnostics())},
      onTitleRecovery:()=>{this.titleTokenRecoveryAttempted=true;this.emit('connection-diagnostics',this.diagnostics())}
    })
    // Fix 1.26.60's stale third-party pack response enum before serializer compilation.
    // This changes only the pack handshake's status code, not authentication.
    this.packWire=preparePackResponseWire(options)
    const client=bedrock.createClient(options)
    this.client=client
    this.trace?.attachClient(client)
    this.survival.attach(client)
    this.packHandshakeAudit=createPackHandshakeForensics(client,path.join(root,'private','diagnostics','pack-handshake.json'))
    // These listeners run before the pack handler and record counts only.
    // Never persist pack URLs, auth data, or raw Minecraft packets to logs.
    client.on('resource_pack_data_info',p=>{this.packHeadersReceived++;this.loadingLiveness.note('resource_pack_data_info',String(p?.pack_id||'no-id'))})
    client.on('resource_pack_chunk_data',p=>{
      this.packChunksReceived++
      const size=Math.max(0,Number(p?.payload?.length||0));this.packBytesReceived+=size
      this.loadingLiveness.note('resource_pack_chunk_data',String(p?.pack_id||'no-id')+':'+String(p?.chunk_index??'unknown'),size)
    })
    this.packHandler=attachRealmPacks(client,path.join(root,'private','realm-packs'),state=>{
      if(this.client!==client)return
      this.loadingLiveness.setStage(state.stage)
      if(Number.isFinite(state.receivedMB))this.loadingLiveness.noteTransferBytes(state.receivedMB*1024*1024)
      if(state.stage==='pack-request'){
        this.packRequestAt=Date.now()
        this.packHeadersReceived=0;this.packChunksReceived=0;this.packBytesReceived=0
      }
      this.packStatus=state
      this.lastPhase=state.stage
      if(state.stage==='pack-error'){
        this.authState='error'
        this.lastError='Resource pack ('+(state.reason||'failed')+'): '+state.message
        this.log('Resource pack transfer failed: '+state.message)
        if(['server-no-pack-data','server-pack-stalled'].includes(state.reason))this.scheduleLoadingRecovery(state.stage,state.reason)
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
    client.on('resource_packs_info',p=>this.loadingLiveness.note('resource_packs_info',String(p?.texture_packs?.length??0)+':'+String(p?.behavior_packs?.length??0)))
    client.on('resource_pack_stack',p=>this.loadingLiveness.note('resource_pack_stack',String(p?.resource_packs?.length??0)))
    client.on('level_chunk',p=>this.loadingLiveness.note('level_chunk',String(p?.x??'')+','+String(p?.z??'')))
    client.on('sub_chunk',p=>this.loadingLiveness.note('sub_chunk',String(p?.dimension??'')+','+String(p?.origin?.x??p?.x??'')+','+String(p?.origin?.z??p?.z??'')+','+String(p?.origin?.y??p?.y??'')))
    client.on('session',()=>{
      this.authChallenge=null;this.lastPhase='authenticated';this.authState='authenticated';this.lastError=''
      this.log('Minecraft session established; joining the Realm.')
    })
    // The bundled Bedrock client does not emit a public 'connect' event.
    // Its 'join' event is emitted after server handshake completion instead.
    client.on('join',()=>{
      this.connected=true;this.transportEvidence=observeBedrockTransport(client)
      // The transport can close silently without a Minecraft kick packet.
      // Capture its reason BEFORE bedrock-protocol calls close().
      const transport=client.connection
      if(transport&&typeof transport.onCloseConnection==='function'&&!transport.__veilforgeCloseObserved){
        transport.__veilforgeCloseObserved=true
        const previous=transport.onCloseConnection
        transport.onCloseConnection=(reason)=>{
          this.packHandshakeAudit?.record('transport-closed')
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
      this.spawned=true;this.loadingLiveness.waiting=false;this.recoveryAttempts=0;this.cancelAutoRecovery();this.manualRecoveryStop=false;this.lastPhase='spawned'
      this.authChallenge=null;this.authState='spawned';this.lastError=''
      this.username=client.profile?.name||client.username||m.botPlayerName
      this.log('Spawn event received. Display name reported: '+this.username)
      if(this.username!==m.botPlayerName)this.log('WARNING: gamertag in config differs from player identity. Server pack will not recognize commands; fix config and regenerate pack.')
    })
    client.on('text',p=>{
      this.chatDiagnostics.textPackets++;this.chatDiagnostics.lastPacketAt=Date.now()
      const message=String(p.message||'').slice(0,240),source=String(p.source_name||'').trim().slice(0,80)
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
        this.chatDiagnostics.playerChatPackets++
        this.log('Chat '+source+': '+message)
        // Ordinary server text is only an input event; never trust the displayed source
        // for authorization until the command router compares exact owner names.
        this.emit('player-chat',{source,message})
      }
    })
    const failure=(kind,packet)=>{
      this.lastPhase=authFailurePhase(packet)||this.lastPhase
      this.lastFailure=classifyConnectionFailure(packet,this.lastPhase)
      const reason=safeDisconnectMessage(packet)
      if(reason&&!this.lastError)this.lastError=kind+': '+reason
      this.authChallenge=null;this.authState='error'
      this.emit('connection-diagnostics',this.diagnostics())
      if(this.lastError)this.log('Realm failed at '+this.lastPhase+': '+this.lastError)
    }
    client.on('play_status',p=>{
      const state=String(p?.status||'')
      this.loadingLiveness.note('play_status',state)
      if(state==='login_success')this.lastPhase='minecraft-login-ok'
      else if(state && state!=='player_spawn')failure('Minecraft login status',{message:state})
    })
    client.on('start_game',()=>{this.loadingLiveness.note('start_game','initial');this.lastPhase='world-started';this.log('Minecraft start_game received; awaiting spawn.')})
    client.on('kick',p=>{this.transportCloseKind='server-disconnect';failure('Server rejected join',p)})
    client.on('error',e=>{this.transportCloseKind='protocol-error';failure('Bedrock protocol error',e)})
    client.on('disconnect',p=>{
      if(this.client!==client)return
      this.transportCloseKind='server-disconnect'
      failure('Server disconnect',p)
      this.emit('session-end');this.connected=false;this.joined=false;this.spawned=false
    })
    client.on('close',()=>{
      if(this.client!==client)return
      const priorLoadingStage=this.loadingLiveness.stage
      if(this.transportCloseKind==='none')this.transportCloseKind='transport-close'
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
      // A transport closure during pack negotiation is not slow loading.
      // Retry with the preserved auth session (bounded to two attempts).
      if(!this.manualRecoveryStop&&this.packRequestAt&&!this.spawned)
        this.scheduleLoadingRecovery(priorLoadingStage,'transport-closed')
      else if(!this.lastFailure&&this.loadingLiveness.stalled()&&!this.manualRecoveryStop)
        this.scheduleLoadingRecovery(priorLoadingStage,'loading-stalled')
    })
    client.on('end',()=>{
      if(this.client!==client)return
      if(this.transportCloseKind==='none')this.transportCloseKind='transport-end'
      this.emit('session-end');this.connected=false;this.joined=false;this.spawned=false
      if(!this.lastError)this.lastError='Connection ended at '+this.lastPhase+'; no server reason was sent.'
      this.authChallenge=null;this.authState='disconnected'
      if(!this.manualRecoveryStop&&this.packRequestAt&&!this.spawned)
        this.scheduleLoadingRecovery(this.loadingLiveness.stage,'transport-closed')
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
    this.chatDiagnostics.replyAttempts++
    try{this.queueChat('[VF AI] '+String(message).slice(0,185));this.chatDiagnostics.replyQueued++;return true}
    catch(err){this.chatDiagnostics.replyFailures++;this.chatDiagnostics.lastReplyError=String(err.message||err).slice(0,100);this.lastError=String(err.message||err);return false}
  }
  close(){try{this.cancelAutoRecovery();this.survival.close();this.packHandler?.cleanup();this.client?.close()}catch(_){} }
}
