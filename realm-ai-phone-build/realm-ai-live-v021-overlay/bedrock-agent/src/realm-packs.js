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
import {sendCurrentModdedPackResponse} from './modded-pack-response.js'
import {createPackChunkWindow} from './pack-chunk-window.js'

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
  // Bedrock's PackDataInfo Hash is encoded as a string on protocol 2225.
  // Allow only a full SHA-256 digest as 32 raw bytes, 64 hex digits or
  // canonical base64 (44 chars with one '='). Never bypass hash verification.
  let b=Buffer.isBuffer(v)?v:ArrayBuffer.isView(v)?Buffer.from(v.buffer,v.byteOffset,v.byteLength):Array.isArray(v)?Buffer.from(v):null
  if(typeof v==='string'){
    const hash=v.trim()
    if(/^[a-fA-F0-9]{64}$/.test(hash))b=Buffer.from(hash,'hex')
    else if(/^[A-Za-z0-9+/]{43}=$/.test(hash)){
      const decoded=Buffer.from(hash,'base64')
      if(decoded.length===32&&decoded.toString('base64')===hash)b=decoded
    }
  }
  if(!b || b.length!==32) throw Error('Pack hash missing or unsupported; refusing unverified content')
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
  // Bedrock 1.26.x can expose resource_packs, texture_packs, behavior_packs
  // or a combination of the old and modern lists. An empty texture_packs
  // array must NOT hide a populated resource_packs array.
  const fields=[
    ['resource_packs','resource'],
    ['texture_packs','resource'],
    ['behavior_packs','behavior']
  ]
  const counts={resource_packs:0,texture_packs:0,behavior_packs:0}
  const unique=new Map()
  let duplicateListEntries=0
  for(const [field,origin] of fields){
    const entries=packet?.[field]??[]
    if(!Array.isArray(entries))throw Error('Invalid Realm '+field+' list')
    counts[field]=entries.length
    if(entries.length>MAX_PACKS)throw Error('Too many Realm packs advertised')
    for(const meta of entries){
      if(!meta||typeof meta!=='object'||Array.isArray(meta))throw Error('Invalid Realm pack metadata')
      const key=packKey(meta)
      const previous=unique.get(key)
      if(!previous){
        if(unique.size>=MAX_PACKS)throw Error('Too many Realm packs requested')
        unique.set(key,{meta:{...meta},origin})
        continue
      }
      duplicateListEntries++
      const firstSize=previous.meta.size,otherSize=meta.size
      if(firstSize!=null&&otherSize!=null&&Number(firstSize)!==Number(otherSize))
        throw Error('Conflicting Realm pack size across lists')
      const firstCdn=String(previous.meta.cdn_url||'').trim()
      const otherCdn=String(meta.cdn_url||'').trim()
      if(firstCdn&&otherCdn&&firstCdn!==otherCdn)
        throw Error('Conflicting Realm pack URL across lists')
      // Keep the first (modern) list's order and metadata while filling in
      // missing fields from legacy lists. Preserve behavior/add-on hints.
      for(const [name,value] of Object.entries(meta)){
        if((previous.meta[name]==null||previous.meta[name]==='')&&value!=null&&value!=='')
          previous.meta[name]=value
      }
      previous.meta.addon_pack=previous.meta.addon_pack===true||meta.addon_pack===true
      previous.meta.has_scripts=previous.meta.has_scripts===true||meta.has_scripts===true
      if(origin==='behavior')previous.origin='behavior'
    }
  }
  const required=[...unique.values()]
  return {
    required,
    advertised:required.length,
    skippedOptional:0,
    policy:'all-advertised',
    selectionKnown:true,
    legacyBehaviorCount:counts.behavior_packs,
    resourceInfoCount:counts.resource_packs,
    textureInfoCount:counts.texture_packs,
    behaviorInfoCount:counts.behavior_packs,
    duplicateListEntries
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
   serverPackIdleMs=17*60*1000,heartbeatMs=2000,now=()=>Date.now(),handshakeMode='cache-first',noPackGraceMs=0,headlessPackProbe=false} = {}) {
  // Strictly bounded A/B protocol probes; never accept arbitrary packet behavior.
  if(!['original-working','native-queue','no-cache-status','cache-first'].includes(handshakeMode))throw Error('Unknown safe pack handshake mode')
  const packs = new Map()
  // v0.40.16 controlled modded-only handshake probe; no-mod path remains unchanged.
  // v0.42.9 isolated ordering probe: leave the optional blob-cache status out
  // of modded-pack negotiation until the server has provided a pack stack.
  // The v0.42.8 client announced cache status immediately before Downloading;
  // no pack headers arrived. Retain correct oneOf selector 1, lowercase wire
  // response and all pack IDs. Unmodded worlds keep the original client path.
  const deferModernCache=true
  const byUuid = new Map()
  // The server sends PackDataInfo and chunk packet IDs in either bare UUID
  // or UUID_version form. Reuse only identifiers advertised by this Realm.
  const advertisedPackFromWireId=wireId=>{
    const id=String(wireId??'').trim()
    const key=byUuid.get(id)||(packs.has(id)?id:null)
    return key?packs.get(key):null
  }
  let stackReceived=false, finished=false, failed=false,infoReceived=false,downloadFinishedAcknowledged=false
  let verifiedCacheCount=0,missingPackCount=0,noPackAckTimer=null,noPackAckIssued=false,noPackDirectStack=false
  let headlessProbeSent=false,headlessProbeAccepted=false,headlessProbeSince=0
  let totalBytes=0, skippedOptional=0, activeCdn=0,advertisedPacks=0,packSelectionPolicy='all-advertised',legacyBehaviorCount=0,resourceInfoCount=0,textureInfoCount=0,behaviorInfoCount=0,duplicateListEntries=0
  let serverWaitSince=0,lastServerPacketAt=0,serverPackHeaders=0,serverPackChunks=0,lastWaitNoticeAt=0
  const cdnQueue=[]
  // Original-working mode allows the bundled client to manage its own
  // cache-status and early terrain-radius packets as the proven v0.26 did.
  const originalQueue=client.queue,originalWrite=client.write
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
  let moddedRadiusGuard=null,moddedCacheStatusSent=false
  let loginCacheQueueGuard=null
  let moddedPrematureCompletionGuard=null,suppressedNativePackCompletions=0
  // The bundled bedrock-protocol createClient registers a one-shot listener
  // that writes ResourcePackStackFinished IMMEDIATELY on resource_packs_info,
  // before it has received or downloaded a pack. On a modded Realm, that
  // contradicts our Downloading response and can start an unready world.
  // Suppress ONLY that legacy shortcut for 1.26.60 WITH required packs.
  // The verified original no-pack path and all other packets stay unchanged.
  const suppressPrematureNativeCompletion=()=>{
    if(handshakeMode!=='original-working'||!packs.size||
       String(client?.options?.version)!=='1.26.60'||
       moddedPrematureCompletionGuard||typeof originalWrite!=='function')return
    moddedPrematureCompletionGuard=function(name,packet,...args){
      if(name==='resource_pack_client_response'&&
         packet?.response_status==='completed'&&
         String(packet?.response_status_name||'').toLowerCase()==='resourcepackstackfinished'){
        suppressedNativePackCompletions++
        return
      }
      return originalWrite.call(this,name,packet,...args)
    }
    client.write=moddedPrematureCompletionGuard
  }
  const installModdedRadiusGuard=()=>{
    if(handshakeMode!=='original-working'||!packs.size||moddedRadiusGuard||typeof originalQueue!=='function')return
    moddedRadiusGuard=function(name,packet,...args){
      // The native client queues this after resource_packs_info. For modded
      // worlds it was already sent synchronously before the pack request.
      // Leave the unmodded native queue completely unchanged.
      if(name==='client_cache_status'&&moddedCacheStatusSent)return
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
  // Gophertunnel's client declares blob-cache support synchronously on
  // PlayStatusLoginSuccess, BEFORE the ResourcePacksInfo packet. The bundled
  // Bedrock library queues the same announcement only after packs info,
  // which is too late for strict servers. Do this once for protocol 2225.
  // Suppress only the library's later duplicate; no-pack response handling,
  // saved identity and the Xbox/NetherNet login remain unchanged.
  const onLoginSuccess=packet=>{
    if(handshakeMode!=='original-working'||String(client?.options?.version)!=='1.26.60'||
       packet?.status!=='login_success'||cacheStatusIssued)return
    try{
      client.write('client_cache_status',{enabled:false})
      cacheStatusIssued=true
      if(typeof originalQueue==='function'){
        loginCacheQueueGuard=function(name,data,...args){
          if(name==='client_cache_status'){
            // On no-pack worlds restore the original queue immediately.
            // Modded worlds replace this with the radius/duplicate guard.
            if(!packs.size&&client.queue===loginCacheQueueGuard)client.queue=originalQueue
            return
          }
          return originalQueue.call(this,name,data,...args)
        }
        client.queue=loginCacheQueueGuard
      }
    }catch(error){failure(error)}
  }
  client.on('play_status',onLoginSuccess)
  const cancellation = new AbortController()
  // CDN downloads have their own idle timeout; only watch missing server chunk data.
  const pendingServerPacks=()=>[...packs.values()].some(p=>!p.cdn&&!p.ready)
  const packWatchdog=setInterval(()=>{
    if(headlessProbeSent&&!headlessProbeAccepted&&!finished&&!failed&&client._closed!==true){
      const wait=now()-headlessProbeSince
      if(wait>=30000&&now()-(lastWaitNoticeAt||0)>=10000){
        lastWaitNoticeAt=now()
        emit('headless-await-stack','Headless client offered no visual pack downloads; waiting for Realm stack confirmation ('+Math.floor(wait/1000)+'s)')
      }
      return
    }
    if(failed||finished||!serverWaitSince||!pendingServerPacks()||client._closed===true)return
    const elapsed=now()-serverWaitSince
    // A slow Realm can be alive with no visible pack progress.
    // Do not restart or reset the timeout for informational updates.
    if(serverPackHeaders===0&&elapsed>=10000&&now()-lastWaitNoticeAt>=10000){
      lastWaitNoticeAt=now()
      emit('pack-request','Still connected, waiting for Realm pack transfer ('+Math.floor(elapsed/1000)+'s); downloads may be uneven',0,packs.size,
        {waitingForServer:true,serverWaitSeconds:Math.floor(elapsed/1000)})
    }
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
    report({stage,message,done,total,...storageState,cacheStatusIssued,downloadRequestIssued,packResponseCount,suppressedNativePackCompletions,headlessPackProbe:headlessPackProbe===true,headlessProbeSent,headlessProbeAccepted,serverPackCount:[...packs.values()].filter(p=>!p.cdn).length,cdnPackCount:[...packs.values()].filter(p=>!!p.cdn).length,packSkippedOptional:skippedOptional,packAdvertisedCount:advertisedPacks,packSelectionPolicy,packHandshakeMode:handshakeMode,packInfoReceived:infoReceived,packStackReceived:stackReceived,packVerifiedCacheCount:verifiedCacheCount,packMissingCount:missingPackCount,packNoPackDirectStack:noPackDirectStack,packLegacyBehaviorCount:legacyBehaviorCount,packResourceInfoCount:resourceInfoCount,packTextureInfoCount:textureInfoCount,packBehaviorInfoCount:behaviorInfoCount,packDuplicateListEntries:duplicateListEntries,packResourceClassifiedCount:[...packs.values()].filter(p=>p.category==='resource').length,packBehaviorClassifiedCount:[...packs.values()].filter(p=>p.category==='behavior').length,packAddonClassifiedCount:[...packs.values()].filter(p=>p.category==='addon').length,packHeadersSeenByHandler:serverPackHeaders,packChunksSeenByHandler:serverPackChunks,packWireEncoded:packRequestWire.available,packWireVerified:packRequestWire.verified,packWireVersion:packRequestWire.version,packWireCode:packRequestWire.statusCode||0,packWireBytes:packRequestWire.byteLength||0,packWireText:packRequestWire.wireText||'unknown',packWireIds:packRequestWire.packIdCount||0,packTransportConnectedAtRequest:packRequestWire.transportConnected===true,...extra})
  }

  const response = (name,ids=[]) => {
    // Pre-0.39.5 used an immediate write and did reach the world. Do not
    // buffer critical handshake acknowledgements in the 20ms gameplay queue.
    // cache-first writes cache status here; native-queue lets the bundled
    // client enqueue it after the request, as in the earlier working build.
    // no-cache-status checks the protocol's optional-cache negotiation path.
    // v0.40.10 restored the original serializer and can join unmodded
    // Realms. Never alter that case. For a Realm advertising real packs,
    // Bedrock protocol 2225 retains outer variant index 1 for Downloading.
    // The pack-only response encoder tests Gophertunnel's lowercase wire
    // spelling while keeping pack IDs, variant shape and framing unchanged.
    const useCurrentModded=handshakeMode==='original-working'&&packs.size>0&&
      String(client?.options?.version)==='1.26.60'
    const packet={
      response_status:name,
      response_status_name:(useCurrentModded?
        {refused:'Cancel',send_packs:'Downloading',have_all_packs:'DownloadingFinished',completed:'ResourcePackStackFinished'}:
        handshakeMode==='original-working'?
        {refused:'cancel',send_packs:'downloading',have_all_packs:'downloadingfinished',completed:'resourcepackstackfinished'}:
        {refused:'Cancel',send_packs:'Downloading',have_all_packs:'DownloadingFinished',completed:'ResourcePackStackFinished'})[name]||name,
      resourcepackids:ids
    }
    if(name==='send_packs')markPackTransportRequest(client)
    const observation=useCurrentModded?
      sendCurrentModdedPackResponse(client,packet):
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
    // Report optional blob-cache status only after pack transfer has completed;
    // avoid interfering with the modded server's initial Downloading exchange.
    if(deferModernCache&&packs.size>0&&!cacheStatusIssued){
      originalQueue.call(client,'client_cache_status',{enabled:false})
      cacheStatusIssued=true
    }
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
      resourceInfoCount=selection.resourceInfoCount
      textureInfoCount=selection.textureInfoCount
      behaviorInfoCount=selection.behaviorInfoCount
      duplicateListEntries=selection.duplicateListEntries
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
      if(packs.size){
        // Install before the library's own later listener on this same
        // resource_packs_info event sends its premature Completed frame.
        suppressPrematureNativeCompletion()
        installModdedRadiusGuard()
        if(handshakeMode==='original-working'){
          // Suppress the library's native cache announcement until the modded
          // server finishes transfer; preserve native no-pack world ordering.
          moddedCacheStatusSent=true
          if(!deferModernCache){
            client.write('client_cache_status',{enabled:false})
            cacheStatusIssued=true
          }
        }
      }
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
      // Controlled Plan B for a non-rendering AI: do not fetch 156MB of
      // optional *visual* content. Acknowledge the advertised pack versions
      // but do not write fictitious files or mark downloads as verified.
      // Server acceptance is ONLY proven by a subsequent resource_pack_stack.
      if(headlessPackProbe){
        headlessProbeSent=true
        headlessProbeSince=now()
        missingPackCount=packs.size
        response('have_all_packs')
        emit('headless-await-stack','Headless Realm join probe: requested pack-stack confirmation without downloading graphics; waiting for server response',0,packs.size)
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
        response('send_packs',missing.map(p=>p.key))
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
      const p=advertisedPackFromWireId(packet.pack_id)
      if(!p)throw Error('Received an unexpected Realm pack')
      // CDN owns readiness, cache and temporary files for this pack.
      // Server chunk metadata must never advance or cancel that transfer.
      if(p.cdn)return
      serverPackHeaders++;lastServerPacketAt=now()
      if(p.requested||p.ready)throw Error('Duplicate pack data header')
      // Match the exact version-qualified ID provided by the server when
      // sending chunk requests, as Gophertunnel does.
      p.transferId=String(packet.pack_id)
      p.chunkSize=safeNumber(packet.max_chunk_size,MAX_CHUNK_BYTES)
      const serverChunkCount=safeNumber(packet.chunk_count??0,65536)
      p.expected=safeNumber(packet.size,MAX_PACK_BYTES)
      // Gophertunnel calculates the number of chunks from size and chunk size.
      // Some servers announce zero or inconsistent chunk_count while still
      // serving the correctly sized archive; bound and derive it ourselves.
      p.count=p.chunkSize>0?Math.ceil(p.expected/p.chunkSize):0
      if(p.expected>p.size || p.chunkSize<1 || p.count<1 || p.count>65536)throw Error('Invalid Realm pack chunk layout')
      p.announcedChunkCount=serverChunkCount
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
      // Gophertunnel-style bounded per-pack sliding window. Queue multiple
      // requests in one Bedrock batch, rather than waiting for chunk zero.
      // Uses private disk random-access writes and full-file SHA-256 after.
      p.written=0;p.requested=true;p.verifying=false
      p.window=createPackChunkWindow({
        chunkSize:p.chunkSize,chunkCount:p.count,size:p.expected,
        request:index=>{
          const send=typeof client.queue==='function'?client.queue:client.write
          send.call(client,'resource_pack_chunk_request',{pack_id:p.transferId,chunk_index:index})
        },
        write:(data,offset)=>{
          const count=fs.writeSync(p.fd,data,0,data.length,offset)
          if(count!==data.length)throw Error('Short Realm pack disk write')
          p.written+=count
        }
      })
      p.window.pump()
      emit('downloading-packs',`Downloading Realm packs: 0/${packs.size}`)
    }catch(e){failure(e)}
  })
  client.on('resource_pack_chunk_data',packet=>{
    if(failed)return
    try{
      const p=advertisedPackFromWireId(packet.pack_id)
      if(!p||!p.requested||!p.window)throw Error('Unexpected pack data chunk')
      // A late duplicate is not a failed transfer. Keep the authoritative
      // requested index/offset and size checks even after verification.
      if(p.ready)return
      const result=p.window.accept({
        index:packet.chunk_index,offset:packet.progress,
        payload:packet.payload
      })
      lastServerPacketAt=now()
      if(result.duplicate)return
      serverPackChunks++
      if(!result.complete||p.verifying)return
      p.verifying=true
      if(p.written!==p.expected)throw Error('Incomplete Realm pack download')
      fs.closeSync(p.fd);p.fd=undefined
      // Out-of-order downloads cannot be incrementally SHA-256 hashed in
      // arrival order. Stream the finished file in *file* order, without
      // reading a 512MB pack into mobile memory or executing any add-on.
      hashStoredFile(p.tmp).then(digest=>{
        if(failed||cancellation.signal.aborted)return
        if(digest!==p.hash){
          const e=Error('Downloaded Realm pack failed SHA-256 verification')
          e.code='PACK_INTEGRITY_FAILED'
          throw e
        }
        fs.renameSync(p.tmp,p.file);p.tmp=null
        fs.writeFileSync(p.file+'.sha256',p.hash,{mode:0o600})
        p.ready=true
        progress()
      }).catch(failure)
    }catch(e){failure(e)}
  })
  client.on('resource_pack_stack',()=>{
    if(failed)return
    stackReceived=true
    if(headlessProbeSent&&packs.size){
      // The Realm has explicitly advanced the handshake. This confirms
      // protocol acceptance, NOT local pack integrity. Don't pretend the
      // game has installed add-ons and never expose unverified files.
      headlessProbeAccepted=true
      finished=true
      response('completed')
      flushRadius()
      emit('packs-ready','Realm acknowledged headless pack-stack probe; graphics not downloaded or executed',0,packs.size)
      return
    }
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
  return {snapshot:()=>({policy:'all-advertised',handshakeMode,infoReceived,stackReceived,verifiedCacheCount,missingPackCount,noPackDirectStack,selection:packSelectionPolicy,advertised:advertisedPacks,sourceCounts:{resource:resourceInfoCount,texture:textureInfoCount,behavior:behaviorInfoCount,duplicates:duplicateListEntries},radiusDeferred,gameStarted,skippedOptional,requested:packs.size,suppressedNativePackCompletions,headlessPackProbe:headlessPackProbe===true,headlessProbeSent,headlessProbeAccepted,verified:[...packs.values()].filter(p=>p.ready).length,wire:packRequestWire,categoryCounts:{resource:[...packs.values()].filter(p=>p.category==='resource').length,behavior:[...packs.values()].filter(p=>p.category==='behavior').length,addon:[...packs.values()].filter(p=>p.category==='addon').length},failed,finished}),cleanup:()=>{
    pendingRadius=null;client.off('start_game',onStartGame);client.off('play_status',onLoginSuccess);client.off('resource_packs_info',cacheFirst)
    if(loginCacheQueueGuard&&client.queue===loginCacheQueueGuard)client.queue=originalQueue
    if(moddedPrematureCompletionGuard&&client.write===moddedPrematureCompletionGuard)client.write=originalWrite
    if(client.write===gatedWrite)client.write=originalWrite
    if(gatedQueue&&client.queue===gatedQueue)client.queue=originalQueue
    if(moddedRadiusGuard&&client.queue===moddedRadiusGuard)client.queue=originalQueue
    clearInterval(packWatchdog)
    if(noPackAckTimer)clearTimeout(noPackAckTimer)
    cancellation.abort()
    for(const p of packs.values()){
      if(p.fd!==undefined){try{fs.closeSync(p.fd)}catch{}}
      if(p.tmp&&!p.cdn){try{fs.rmSync(p.tmp,{force:true})}catch{}}
    }
  }}
}
