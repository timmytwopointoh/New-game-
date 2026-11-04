// Experimental, bounded Minecraft Bedrock Realm resource pack negotiation.
// Receives only authorized Realm packets; stores archives in app-private files.
// It does not unpack, execute, parse addon scripts or modify the world.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {downloadRealmCdn,checkCdnUrl} from './cdn-download.js'
import {classifyPack,packDirectory,packFilePath,priorPackLocations,PACK_CATEGORIES} from './pack-storage.js'
import {inspectPackResponseWire} from './pack-protocol-observer.js'
import {markPackTransportRequest} from './transport-evidence.js'
import {encodeCurrentModdedPackResponse} from './modded-pack-response.js'
import {installModdedNativeAckGuard} from './modded-native-ack-guard.js'

const MAX_PACKS = 64
const MAX_PACK_BYTES = 512 * 1024 * 1024
const MAX_TOTAL_BYTES = 1536 * 1024 * 1024
const FREE_SPACE_RESERVE = 256 * 1024 * 1024
const MAX_CDN_ATTEMPTS = 3
const MiB = 1024 * 1024
const MAX_CHUNK_BYTES = 2 * 1024 * 1024

function packKey(p) {
  const uuid = String(p.uuid || p.pack_id || p.id || '').trim()
  const version = String(p.version || '').trim()
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(uuid) || !/^[0-9][0-9a-zA-Z_.-]{0,39}$/.test(version)) throw Error('Invalid Realm resource pack metadata')
  return `${uuid}_${version}`
}
function safeNumber(v, max) {
  const n = Number(v)
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw Error('Realm pack exceeds permitted download size')
  return n
}
function packHash(v) {
  const b = Buffer.isBuffer(v) ? v : ArrayBuffer.isView(v) ? Buffer.from(v.buffer,v.byteOffset,v.byteLength) : Array.isArray(v) ? Buffer.from(v) : null
  if (!b || b.length!==32) throw Error('Pack hash missing or unsupported; refusing unverified content')
  return b.toString('hex')
}
export function explainPackFailure(error){
 const code=String(error?.code||'')
 const raw=String(error?.message||'')
 if(code==='ENOSPC'||code==='EDQUOT'||code==='PACK_STORAGE_LOW')return {reason:'storage-low',retryable:false,message:'Not enough free phone storage for Realm packs. Free space, then rejoin; existing verified packs are kept.'}
 if(code==='PACK_NO_SERVER_DATA')return {reason:'server-no-pack-data',retryable:true,message:'The Realm sent no resource-pack headers during the extended 17-minute loading window. This is a stalled handshake; the bot may attempt a bounded rejoin with saved login.'}
 if(code==='PACK_SERVER_STALLED')return {reason:'server-pack-stalled',retryable:true,message:'The Realm stopped sending resource-pack chunks for 17 minutes. The bot may attempt a bounded rejoin with its existing saved login.'}
 if(code==='PACK_STORAGE_UNKNOWN')return {reason:'storage-unknown',retryable:false,message:'Cannot determine available phone storage for the required Realm packs.'}
 if(code==='PACK_LIMIT'||/exceeds (?:the )?(?:permitted|download|pack)|too many Realm packs/i.test(raw))return {reason:'pack-size-limit',retryable:false,message:'This Realm requires more pack data than the bounded download limit allows.'}
 if(code==='CDN_HTTP_401'||code==='CDN_HTTP_403')return {reason:'cdn-access-denied',retryable:false,message:'Realm pack CDN access was denied or its download link expired. Rejoin to request a fresh URL.'}
 if(code==='CDN_HTTP_404'||code==='CDN_HTTP_410')return {reason:'cdn-missing',retryable:false,message:'A requested Realm resource pack is no longer at its CDN address.'}
 if(/^CDN_HTTP_(429|5\d\d)$/.test(code))return {reason:'cdn-unavailable',retryable:true,message:'Realm pack CDN is busy or unavailable; download can be retried.'}
 if(['ETIMEDOUT','ECONNRESET','ECONNABORTED','EPIPE','EAI_AGAIN','ENETUNREACH','ENOTFOUND','EHOSTUNREACH','ECONNREFUSED','ERR_STREAM_PREMATURE_CLOSE','CDN_IDLE_TIMEOUT','PACK_INCOMPLETE','PACK_CANCELLED'].includes(code))return {reason:'network-interrupted',retryable:true,message:'Realm pack download was interrupted by the network or stalled; the partial CDN file can resume.'}
 if(['PACK_SIZE_MISMATCH','CDN_LENGTH_MISMATCH','CDN_RANGE_MISMATCH','PACK_PARTIAL_INVALID','CDN_BAD_RESPONSE','PACK_INTEGRITY_FAILED'].includes(code)||/SHA-256|hash|chunk layout|offset mismatch/i.test(raw))return {reason:'pack-integrity',retryable:false,message:'Realm pack bytes failed the expected size, range or integrity checks. Corrupt files will not be used.'}
 return {reason:'pack-transfer-failed',retryable:false,message:'Realm resource pack transfer failed; export the connection report for the download stage.'}
}

/**
 * Download the whole server-advertised pack stack for a modded Realm.
 *
 * Bedrock pack metadata is not a reliable per-pack opt-out mechanism:
 * must_accept refers to server policy for the stack, and addon_pack /
 * has_scripts are descriptive flags, not a proof that an unmarked resource
 * is unnecessary. v0.40.0 selected eight of nine packs in a failing Realm.
 *
 * Keep the server-advertised order and both modern texture_packs and legacy
 * behavior_packs. Never download anything not explicitly advertised by the
 * connected server. All bytes still pass the normal limits, cache checks,
 * per-chunk hashes and private storage rules. No add-on scripts are run.
 */
export function selectRequiredRealmPacks(packet) {
  const texture=packet?.texture_packs??packet?.resource_packs??[], behavior=packet?.behavior_packs??[]
  if(!Array.isArray(texture)||!Array.isArray(behavior))throw Error('Invalid Realm pack list')
  const advertised=[
    ...texture.map(meta=>({meta,origin:'resource'})),
    ...behavior.map(meta=>({meta,origin:'behavior'}))
  ]
  if(advertised.length>MAX_PACKS)throw Error('Too many Realm packs requested')
  return {
    required:advertised,
    advertised:advertised.length,
    skippedOptional:0,
    policy:'all-advertised',
    selectionKnown:true,
    legacyBehaviorCount:behavior.length
  }
}

export function checkPackStorage(cacheDir,requiredBytes,{statfs=fs.statfsSync,reserveBytes=FREE_SPACE_RESERVE}={}){
 try{
  const disk=statfs(cacheDir)
  const available=BigInt(disk.bavail)*BigInt(disk.bsize)
  const needed=BigInt(Math.max(0,requiredBytes)),reserve=BigInt(reserveBytes)
  const info={freeMB:Number(available/BigInt(MiB)),neededMB:Number((needed+BigInt(MiB)-1n)/BigInt(MiB)),reserveMB:Math.ceil(reserveBytes/MiB)}
  if(available<needed+reserve){const e=Error('Phone storage below Realm pack reservation');e.code='PACK_STORAGE_LOW';e.storage=info;throw e}
  return info
 }catch(e){if(e.code==='PACK_STORAGE_LOW')throw e;const failure=Error('Phone free space not available');failure.code='PACK_STORAGE_UNKNOWN';throw failure}
}
async function hashStoredFile(filename){
 const hash=crypto.createHash('sha256')
 for await(const part of fs.createReadStream(filename))hash.update(part)
 return hash.digest('hex')
}
export function attachRealmPacks(client, cacheDir, report = () => {},
  {downloadCdn=downloadRealmCdn,checkStorage=checkPackStorage,
   serverPackIdleMs=17*60*1000,heartbeatMs=2000,now=()=>Date.now(),handshakeMode='cache-first',noPackGraceMs=0} = {}) {
  // Strictly bounded A/B protocol probes; never accept arbitrary packet behavior.
  if(!['original-working','native-queue','no-cache-status','cache-first'].includes(handshakeMode))throw Error('Unknown safe pack handshake mode')
  const packs = new Map()
  const byUuid = new Map()
  let stackReceived=false, finished=false, failed=false,infoReceived=false,downloadFinishedAcknowledged=false
  let verifiedCacheCount=0,missingPackCount=0,noPackAckTimer=null,noPackAckIssued=false,noPackDirectStack=false
  let totalBytes=0, skippedOptional=0, activeCdn=0,advertisedPacks=0,packSelectionPolicy='all-advertised',legacyBehaviorCount=0
  let serverWaitSince=0,lastServerPacketAt=0,serverPackHeaders=0,serverPackChunks=0
  const cdnQueue=[]
  // Original-working mode allows the bundled client to manage its own
  // cache-status and early terrain-radius packets as the proven v0.26 did.
  const originalQueue=client.queue,originalWrite=client.write
  // Underlying Bedrock 3.61.0 sends premature legacy Completed replies on
  // both pack events. Guard only modded stacks; unmodded native writes stay intact.
  const nativeAckGuard=handshakeMode==='original-working'?installModdedNativeAckGuard(client):null
  let gameStarted=false,pendingRadius=null,radiusDeferred=0,cacheQueued=false
  let cacheStatusIssued=false,downloadRequestIssued=false,packResponseCount=0
  let packRequestWire={available:false,verified:false,packIdCount:0,statusCode:0,byteLength:0,version:'unknown',wireText:'unknown',transportConnected:false}
  const canRequestTerrain=()=>finished&&gameStarted&&!failed
  function gate(method,queued=false){return function(name,packet,...args){
    if(queued&&name==='client_cache_status'){
      if(handshakeMode==='no-cache-status'||cacheQueued)return
      cacheQueued=true;cacheStatusIssued=true
    }
    if(name==='request_chunk_radius'&&!canRequestTerrain()){pendingRadius={method,packet,args};radiusDeferred++;return}
    return method.call(this,name,packet,...args)
  }}
  const gatedWrite=gate(originalWrite),gatedQueue=originalQueue?gate(originalQueue,true):null
  // The known-good no-mod Realm retains the EXACT original client queue.
  // A modded Realm, however, must finish its mandatory pack exchange
  // before asking for terrain. Install this narrow queue guard ONLY
  // after a non-empty pack announcement (never for empty worlds).
  let moddedRadiusGuard=null
  const installModdedRadiusGuard=()=>{
    if(handshakeMode!=='original-working'||!packs.size||moddedRadiusGuard||typeof originalQueue!=='function')return
    moddedRadiusGuard=function(name,packet,...args){
      // The modded-only probe already sent cache policy immediately; suppress
      // the built-in library's queued duplicate without changing empty worlds.
      // Candidate D: optional cache-status packet is suppressed for modded Realm only.
      if(name==='client_cache_status'&&cacheStatusIssued)return
      if(name==='request_chunk_radius'&&!canRequestTerrain()){
        pendingRadius={method:originalQueue,packet,args};radiusDeferred++
        return
      }
      return originalQueue.call(this,name,packet,...args)
    }
    client.queue=moddedRadiusGuard
  }
  if(handshakeMode!=='original-working'){
    client.write=gatedWrite;if(gatedQueue)client.queue=gatedQueue
  }
  function flushRadius(){
    if(!pendingRadius||!canRequestTerrain())return
    const request=pendingRadius;pendingRadius=null
    request.method.call(client,'request_chunk_radius',request.packet,...request.args)
  }
  const onStartGame=()=>{gameStarted=true;flushRadius()}
  client.on('start_game',onStartGame)
  // createClient installs its own info listener asynchronously after this one.
  // Announce cache policy FIRST and suppress the later queued duplicate.
  const cacheFirst=()=>{
    if(!gatedQueue||cacheQueued)return
    // Send cache policy *before* a direct Downloading response, not in a
    // queued batch which might be flushed after the response.
    cacheQueued=true
    try{
      client.write('client_cache_status',{enabled:false})
      cacheStatusIssued=true
    }catch(error){cacheQueued=false;throw error}
  }
  if(handshakeMode==='cache-first')client.prependListener('resource_packs_info',cacheFirst)
  const cancellation = new AbortController()
  // CDN downloads have their own idle timeout; only watch missing server chunk data.
  const pendingServerPacks=()=>[...packs.values()].some(p=>!p.cdn&&!p.ready)
  const packWatchdog=setInterval(()=>{
    if(failed||finished||!serverWaitSince||!pendingServerPacks())return
    if(now()-lastServerPacketAt<serverPackIdleMs)return
    const code=serverPackHeaders===0?'PACK_NO_SERVER_DATA':'PACK_SERVER_STALLED'
    const error=Error(code==='PACK_NO_SERVER_DATA'?
      'The Realm did not send any pack headers after the request.':
      'The Realm stopped sending pack chunks before completing the downloads.')
    error.code=code
    failure(error)
  },heartbeatMs)
  packWatchdog.unref?.()
  let storageState={}
  const emit = (stage, message, done=0, total=packs.size,extra={}) => {
    if(extra.freeMB!==undefined)storageState={freeMB:extra.freeMB,neededMB:extra.neededMB,reserveMB:extra.reserveMB}
    report({stage,message,done,total,...storageState,cacheStatusIssued,downloadRequestIssued,packResponseCount,serverPackCount:[...packs.values()].filter(p=>!p.cdn).length,cdnPackCount:[...packs.values()].filter(p=>!!p.cdn).length,packSkippedOptional:skippedOptional,packAdvertisedCount:advertisedPacks,packSelectionPolicy,packHandshakeMode:handshakeMode,packInfoReceived:infoReceived,packStackReceived:stackReceived,packVerifiedCacheCount:verifiedCacheCount,packMissingCount:missingPackCount,packNoPackDirectStack:noPackDirectStack,packLegacyBehaviorCount:legacyBehaviorCount,packResourceClassifiedCount:[...packs.values()].filter(p=>p.category==='resource').length,packBehaviorClassifiedCount:[...packs.values()].filter(p=>p.category==='behavior').length,packAddonClassifiedCount:[...packs.values()].filter(p=>p.category==='addon').length,packHeadersSeenByHandler:serverPackHeaders,packChunksSeenByHandler:serverPackChunks,packWireEncoded:packRequestWire.available,packWireVerified:packRequestWire.verified,packWireVersion:packRequestWire.version,packWireCode:packRequestWire.statusCode||0,packWireBytes:packRequestWire.byteLength||0,packWireText:packRequestWire.wireText||'unknown',packWireIds:packRequestWire.packIdCount||0,packTransportConnectedAtRequest:packRequestWire.transportConnected===true,...(nativeAckGuard?.snapshot()||{}),...extra})
  }

  // Candidate C: only modded pack responses are batched by the native 20ms sender.
  // The packet fields, authentication and no-mod path remain unchanged.
  const sendModdedResponseQueued=(packet)=>{
    // Candidate F: isolate the legacy selector (1 instead of 2) while keeping
    // the identical one-pack ID list, string label, batching and transport.
    const frame=client.serializer.createPacketBuffer({name:'resource_pack_client_response',params:packet})
    // Candidate H: immediate reliable send with legacy selector and one pack ID.
    // Variant P: same K/O packet fields and serializer, native write() delivery.
    client.write('resource_pack_client_response',packet)
    return {available:true,verified:true,status:packet.response_status,
      packIdCount:packet.resourcepackids.length,version:'1.26.60',statusCode:1,
      packetId:8,byteLength:frame.length,wireText:packet.response_status_name,
      transportConnected:client?.connection?.connected===true}
  }
  const response = (name,ids=[]) => {
    // Pre-0.39.5 used an immediate write and did reach the world. Do not
    // buffer critical handshake acknowledgements in the 20ms gameplay queue.
    // cache-first writes cache status here; native-queue lets the bundled
    // client enqueue it after the request, as in the earlier working build.
    // no-cache-status checks the protocol's optional-cache negotiation path.
    // v0.40.10 restored the original serializer and can join unmodded
    // Realms. Never alter that case. For a Realm advertising real packs,
    // Bedrock 1.26.60 instead requires the NEW numeric selector (2 for
    // Downloading, not legacy 1=Cancel). Build the same packet body with
    // the old verified serializer, then correct only the response selector.
    const useCurrentModded=handshakeMode==='original-working'&&packs.size>0&&
      String(client?.options?.version)==='1.26.60'
    const packet={
      response_status:name,
      response_status_name:(useCurrentModded?
        // Candidate I: legacy lower-case modded response label with immediate send.
        {refused:'cancel',send_packs:'Downloading',have_all_packs:'downloadingfinished',completed:'resourcepackstackfinished'}:
        handshakeMode==='original-working'?
        {refused:'cancel',send_packs:'downloading',have_all_packs:'downloadingfinished',completed:'resourcepackstackfinished'}:
        {refused:'Cancel',send_packs:'Downloading',have_all_packs:'DownloadingFinished',completed:'ResourcePackStackFinished'})[name]||name,
      resourcepackids:ids
    }
    if(name==='send_packs')markPackTransportRequest(client)
    const observation=useCurrentModded?
      sendModdedResponseQueued(packet):
      inspectPackResponseWire(client,packet,{strategy:handshakeMode==='original-working'?'original-working':'modern'})
    if(!useCurrentModded)client.write('resource_pack_client_response',packet)
    packResponseCount++
    if(name==='send_packs'){downloadRequestIssued=true;packRequestWire=observation}
  }
  const failure = err => {
    if(failed) return
    failed=true
    clearInterval(packWatchdog)
    cancellation.abort()
    const detail=explainPackFailure(err)
    for(const p of packs.values()){
      if(p.fd!==undefined){try{fs.closeSync(p.fd)}catch{}}
      if(p.tmp&&(!p.cdn||detail.reason==='pack-integrity')){try{fs.rmSync(p.tmp,{force:true})}catch{}}
    }
    emit('pack-error',detail.message,0,packs.size,{reason:detail.reason,retryable:detail.retryable,...(err?.storage||{})})
  }
  function progress(){
    if(failed || finished)return
    const done=[...packs.values()].filter(p=>p.ready).length
    emit('downloading-packs',`Realm packs verified: ${done}/${packs.size}`,done)
    if(packs.size && done===packs.size&&!downloadFinishedAcknowledged){
      downloadFinishedAcknowledged=true
      response('have_all_packs')
      emit('packs-downloaded',`All ${done} Realm packs downloaded and verified`,done)
      if(stackReceived) complete()
    }
  }
  function complete(){
    if(failed||finished)return
    if([...packs.values()].some(p=>!p.ready))return
    finished=true
    response('completed')
    flushRadius()
    emit('packs-ready',`Realm pack handshake completed (${packs.size} packs)`,packs.size)
  }
  function pumpCdn(){
    while(activeCdn<2&&cdnQueue.length&&!failed&&!cancellation.signal.aborted){const p=cdnQueue.shift();activeCdn++;startCdn(p).finally(()=>{activeCdn--;pumpCdn()})}
  }
  async function startCdn(p){
    p.file=priorPackLocations(cacheDir,p.basename,p.category).find(f=>fs.existsSync(f)&&fs.existsSync(f+'.sha256'))||packFilePath(cacheDir,p.category,p.basename)
    fs.mkdirSync(path.dirname(p.file),{recursive:true,mode:0o700})
    p.tmp=p.file+'.download'
    const marker=p.file+'.sha256'
    try{
      if(fs.existsSync(p.file)&&fs.existsSync(marker)){
        const digest=fs.readFileSync(marker,'utf8').trim()
        if(fs.statSync(p.file).size===p.size&&/^[a-f0-9]{64}$/.test(digest)&&await hashStoredFile(p.file)===digest){
          p.ready=true;emit('pack-cached','Previously downloaded CDN pack passed local cache verification');progress();return
        }
      }
      let lastError
      for(let attempt=1;attempt<=MAX_CDN_ATTEMPTS;attempt++){
        if(cancellation.signal.aborted)return
        try{
          const partialSize=fs.existsSync(p.tmp)?fs.statSync(p.tmp).size:0
          const remaining=p.size-(partialSize>0&&partialSize<p.size?partialSize:0)
          const storage=checkStorage(cacheDir,remaining)
          if(attempt>1)emit('pack-retry','Retrying interrupted CDN pack ('+attempt+'/'+MAX_CDN_ATTEMPTS+'); keeping downloaded bytes',0,packs.size,{attempt,maxAttempts:MAX_CDN_ATTEMPTS,...storage})
          let lastReportAt=0,lastReportMB=-1
          const done=await downloadCdn({url:p.cdn,dest:p.tmp,maxBytes:MAX_PACK_BYTES,expectedBytes:p.size,signal:cancellation.signal,onProgress:bytes=>{
            const mb=Math.floor(bytes/MiB),now=Date.now()
            if(!failed&&(mb!==lastReportMB||now-lastReportAt>5000)){
              lastReportMB=mb;lastReportAt=now
              emit('downloading-packs','Receiving Realm CDN pack '+mb+'/'+Math.ceil(p.size/MiB)+' MB',0,packs.size,{receivedMB:mb,totalMB:Math.ceil(p.size/MiB),attempt})
            }
          }})
          if(failed||cancellation.signal.aborted)return
          if(done.bytes!==p.size||!/^[a-f0-9]{64}$/.test(done.sha256)){
            const error=Error('Realm CDN result failed size or integrity checks');error.code='PACK_INTEGRITY_FAILED';throw error
          }
          // Local-cache SHA-256 is NOT a Mojang-authenticated source hash.
          fs.renameSync(p.tmp,p.file);p.tmp=null
          fs.writeFileSync(marker,done.sha256,{mode:0o600})
          p.ready=true
          emit('pack-cached',done.resumed?'Interrupted CDN download resumed and cached':'CDN archive stored in private app cache')
          progress();return
        }catch(e){
          lastError=e
          const detail=explainPackFailure(e)
          if(cancellation.signal.aborted)return
          if(!detail.retryable||attempt===MAX_CDN_ATTEMPTS)break
          await new Promise(resolve=>setTimeout(resolve,attempt*1000))
        }
      }
      failure(lastError)
    }catch(e){failure(e)}
  }
  client.on('resource_packs_info',packet=>{
    try{
      if(infoReceived||finished||failed)return
      infoReceived=true
      const selection=selectRequiredRealmPacks(packet)
      skippedOptional=selection.skippedOptional
      advertisedPacks=selection.advertised
      packSelectionPolicy=selection.policy
      legacyBehaviorCount=selection.legacyBehaviorCount
      totalBytes=0
      for(const {meta,origin} of selection.required){
        const key=packKey(meta)
        if(packs.has(key))throw Error('Duplicate Realm pack')
        const size=safeNumber(meta.size,MAX_PACK_BYTES)
        totalBytes+=size
        if(totalBytes>MAX_TOTAL_BYTES){const e=Error('Realm packs exceed 1536MB bounded total');e.code='PACK_LIMIT';throw e}
        const uuid=String(meta.uuid||meta.pack_id||meta.id)
        const basename=crypto.createHash('sha256').update(key).digest('hex')+'.mcpack'
        const cdn=String(meta.cdn_url||'').trim()
        if(cdn)checkCdnUrl(cdn)
        packs.set(key,{key,uuid,size,basename,ready:false,cdn,origin,flags:{addon_pack:meta.addon_pack===true,has_scripts:meta.has_scripts===true},category:classifyPack({origin,metadata:meta})})
        if(byUuid.has(uuid))throw Error('Ambiguous Realm packs with duplicate IDs')
        byUuid.set(uuid,key)
      }
      if(packs.size)installModdedRadiusGuard()
      if(!packs.size){
        missingPackCount=0
        // Servers may send the empty pack stack directly without requiring
        // either client response. In the live app, briefly observe before
        // acknowledging; default zero grace preserves legacy test behavior.
        emit('packs-none','Realm advertised zero packs; waiting for stack or handshake acknowledgment',0,0)
        if(noPackGraceMs>0){
          noPackAckTimer=setTimeout(()=>{
            noPackAckTimer=null
            if(failed||finished||stackReceived||cancellation.signal.aborted)return
            try{
              noPackAckIssued=true
              response('have_all_packs')
              emit('packs-none','Realm requested empty-pack acknowledgment; awaiting world stack',0,0)
            }catch(error){failure(error)}
          },noPackGraceMs)
          noPackAckTimer.unref?.()
        }else{
          noPackAckIssued=true
          response('have_all_packs')
        }
        return
      }
      fs.mkdirSync(cacheDir,{recursive:true,mode:0o700})
      for(const category of PACK_CATEGORIES)fs.mkdirSync(packDirectory(cacheDir,category),{recursive:true,mode:0o700})
      const candidates=[]
      for(const p of packs.values()){
        // Local size alone is not proof of validity. Require a saved marker
        // from a previously verified transfer and check the file hash again.
        const file=priorPackLocations(cacheDir,p.basename,p.category).find(f=>{
          try{return fs.statSync(f).size===p.size&&fs.existsSync(f+'.sha256')}catch{return false}
        })
        if(file)candidates.push({pack:p,file})
      }
      const finishProbe=()=>{
        if(failed||finished||cancellation.signal.aborted)return
        const missing=[...packs.values()].filter(p=>!p.ready)
        missingPackCount=missing.length
        let required=0
        for(const p of missing){
          const partial=packFilePath(cacheDir,p.category,p.basename)+'.download'
          const partialSize=p.cdn&&fs.existsSync(partial)?fs.statSync(partial).size:0
          required+=p.size-(partialSize>0&&partialSize<p.size?partialSize:0)
        }
        const storage=checkStorage(cacheDir,required)
        emit('pack-storage','Verified cached packs '+verifiedCacheCount+'/'+packs.size+'; still missing '+missing.length,verifiedCacheCount,packs.size,storage)
        if(!missing.length){
          // All advertised files already exist and passed SHA verification.
          // Never send a redundant Downloading packet.
          progress()
          return
        }
        // Send a request ONLY for missing packs previously advertised
        // by this Realm. The server subsequently supplies their bytes.
        // One atomic modded-only protocol probe: send cache policy BEFORE the
        // reliable Downloading response. The native library otherwise queues
        // its cache policy after this response, potentially too late.
        // Candidate E: request ONE of the advertised missing packs in the first response.
        // Once the server returns a header, add bounded sequential requests separately.
        // Candidate K: restore optional cache policy BEFORE legacy Downloading
        // response; no other protocol fields or unmodded path change.
        if(handshakeMode==='original-working'&&!cacheStatusIssued){
          client.write('client_cache_status',{enabled:false})
          cacheStatusIssued=true
        }
        // Candidate Q: delay ONLY the modded initial Downloading response by 750ms
        // after resource_packs_info so the Realm can finish announcing its packs.
        // Packet contents, cache policy, native writer and auth remain identical to P.
        const pendingPackKeys=missing.map(p=>p.key)
        setTimeout(()=>{
          if(failed||finished||stackReceived||cancellation.signal.aborted)return
          try{response('send_packs',pendingPackKeys)}catch(error){failure(error)}
        },750).unref?.()
        emit('pack-request','Requesting '+missing.length+' missing Realm packs; '+verifiedCacheCount+' verified in cache',verifiedCacheCount,packs.size)
        if(missing.some(p=>!p.cdn)){serverWaitSince=now();lastServerPacketAt=serverWaitSince}
        for(const p of missing)if(p.cdn)cdnQueue.push(p)
        pumpCdn()
      }
      if(!candidates.length){finishProbe();return}
      void (async()=>{
        for(const {pack:p,file} of candidates){
          if(failed||cancellation.signal.aborted)return
          try{
            const digest=fs.readFileSync(file+'.sha256','utf8').trim()
            if(/^[a-f0-9]{64}$/.test(digest)&&await hashStoredFile(file)===digest){
              p.file=file;p.ready=true;verifiedCacheCount++
            }
          }catch{}
        }
        finishProbe()
      })().catch(failure)
    }catch(e){failure(e)}
  })
  client.on('resource_pack_data_info',packet=>{
    if(failed)return
    try{
      const key=byUuid.get(String(packet.pack_id))
      const p=key?packs.get(key):null
      if(!p)throw Error('Received an unexpected Realm pack')
      // CDN owns readiness, cache and temporary files for this pack.
      // Server chunk metadata must never advance or cancel that transfer.
      if(p.cdn)return
      serverPackHeaders++;lastServerPacketAt=now()
      if(p.requested||p.ready)throw Error('Duplicate pack data header')
      p.chunkSize=safeNumber(packet.max_chunk_size,MAX_CHUNK_BYTES)
      p.count=safeNumber(packet.chunk_count,65536)
      p.expected=safeNumber(packet.size,MAX_PACK_BYTES)
      if(p.expected>p.size || p.chunkSize<1 || p.count<1 || p.count*p.chunkSize<p.expected || (p.count-1)*p.chunkSize>=p.expected)throw Error('Invalid Realm pack chunk layout')
      p.hash=packHash(packet.hash)
      // Transfer header is authoritative about pack kind. The modern info
      // packet combines resources and addons into a single announced list.
      p.category=classifyPack({origin:p.origin,metadata:p.flags,serverType:packet.pack_type})
      p.file=packFilePath(cacheDir,p.category,p.basename)
      for(const candidate of priorPackLocations(cacheDir,p.basename,p.category)){
        if(!fs.existsSync(candidate))continue
        const stat=fs.statSync(candidate)
        if(stat.size!==p.expected)continue
        if(crypto.createHash('sha256').update(fs.readFileSync(candidate)).digest('hex')===p.hash){
          p.file=candidate;p.ready=true
          emit('pack-cached','Verified previously downloaded '+p.category+' Realm pack');progress();return
        }
      }
      checkStorage(cacheDir,p.expected)
      fs.mkdirSync(path.dirname(p.file),{recursive:true,mode:0o700})
      p.tmp=p.file+'.download'
      p.fd=fs.openSync(p.tmp,'w',0o600)
      p.hashContext=crypto.createHash('sha256')
      p.next=0;p.written=0;p.requested=true
      client.write('resource_pack_chunk_request',{pack_id:p.uuid,chunk_index:0})
      emit('downloading-packs',`Downloading Realm packs: 0/${packs.size}`)
    }catch(e){failure(e)}
  })
  client.on('resource_pack_chunk_data',packet=>{
    if(failed)return
    try{
      const key=byUuid.get(String(packet.pack_id));const p=key?packs.get(key):null
      if(!p || !p.requested || p.ready)throw Error('Unexpected pack data chunk')
      if(packet.chunk_index!==p.next)throw Error('Out-of-order Realm pack chunk')
      const data=Buffer.isBuffer(packet.payload)?packet.payload:Buffer.from(packet.payload||[])
      if(data.length>p.chunkSize || p.written+data.length>p.expected || !data.length)throw Error('Invalid Realm pack chunk size')
      if(BigInt(packet.progress??p.written)!==BigInt(p.written))throw Error('Realm pack offset mismatch')
      fs.writeSync(p.fd,data,0,data.length,p.written);p.hashContext.update(data)
      p.written+=data.length;p.next++
      serverPackChunks++;lastServerPacketAt=now()
      if(p.next<p.count){client.write('resource_pack_chunk_request',{pack_id:p.uuid,chunk_index:p.next});return}
      fs.closeSync(p.fd);p.fd=undefined
      if(p.written!==p.expected || p.hashContext.digest('hex')!==p.hash){const e=Error('Downloaded Realm pack failed SHA-256 verification');e.code='PACK_INTEGRITY_FAILED';throw e}
      fs.renameSync(p.tmp,p.file);p.tmp=null
      fs.writeFileSync(p.file+'.sha256',p.hash,{mode:0o600})
      p.ready=true
      progress()
    }catch(e){failure(e)}
  })
  client.on('resource_pack_stack',()=>{
    if(failed)return
    stackReceived=true
    if(!packs.size&&noPackGraceMs>0&&!noPackAckIssued){
      // This server chose the official direct-stack no-packs pathway.
      // No download request, DownloadingFinished or Completed packet.
      if(noPackAckTimer){clearTimeout(noPackAckTimer);noPackAckTimer=null}
      noPackDirectStack=true;finished=true
      emit('packs-ready','Realm provided empty pack stack directly; proceeding to world start',0,0)
      return
    }
    if([...packs.values()].every(p=>p.ready)) complete()
    else emit('downloading-packs','Waiting for required Realm packs before completing join')
  })
  client.once('close',()=>{clearInterval(packWatchdog);if(noPackAckTimer)clearTimeout(noPackAckTimer);cancellation.abort()})
  return {snapshot:()=>({policy:'all-advertised',handshakeMode,infoReceived,stackReceived,verifiedCacheCount,missingPackCount,noPackDirectStack,selection:packSelectionPolicy,advertised:advertisedPacks,...(nativeAckGuard?.snapshot()||{}),radiusDeferred,gameStarted,skippedOptional,requested:packs.size,verified:[...packs.values()].filter(p=>p.ready).length,wire:packRequestWire,categoryCounts:{resource:[...packs.values()].filter(p=>p.category==='resource').length,behavior:[...packs.values()].filter(p=>p.category==='behavior').length,addon:[...packs.values()].filter(p=>p.category==='addon').length},failed,finished}),cleanup:()=>{
    pendingRadius=null;client.off('start_game',onStartGame);client.off('resource_packs_info',cacheFirst)
    if(client.write===gatedWrite)client.write=originalWrite
    if(gatedQueue&&client.queue===gatedQueue)client.queue=originalQueue
    if(moddedRadiusGuard&&client.queue===moddedRadiusGuard)client.queue=originalQueue
    nativeAckGuard?.cleanup()
    clearInterval(packWatchdog)
    if(noPackAckTimer)clearTimeout(noPackAckTimer)
    cancellation.abort()
    for(const p of packs.values()){
      if(p.fd!==undefined){try{fs.closeSync(p.fd)}catch{}}
      if(p.tmp&&!p.cdn){try{fs.rmSync(p.tmp,{force:true})}catch{}}
    }
  }}
}
