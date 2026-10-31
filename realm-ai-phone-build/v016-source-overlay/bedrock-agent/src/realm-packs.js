// Experimental, bounded Minecraft Bedrock Realm resource pack negotiation.
// Receives only authorized Realm packets; stores archives in app-private files.
// It does not unpack, execute, parse addon scripts or modify the world.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {downloadRealmCdn,checkCdnUrl} from './cdn-download.js'

const MAX_PACKS = 16
const MAX_PACK_BYTES = 192 * 1024 * 1024
const MAX_TOTAL_BYTES = 512 * 1024 * 1024
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
export function attachRealmPacks(client, cacheDir, report = () => {}, {downloadCdn=downloadRealmCdn} = {}) {
  const packs = new Map()
  const byUuid = new Map()
  let stackReceived=false, finished=false, failed=false
  let totalBytes=0
  const cancellation = new AbortController()
  const emit = (stage, message, done=0, total=packs.size) => report({stage,message,done,total})
  const response = (name,ids=[]) => {
    client.write('resource_pack_client_response', {
      response_status:name,
      // Modern Bedrock's response text differs from Prismarine enum labels.
      // Variant tags are 0..3; wire response strings are lowercase (Gophertunnel reference).
      response_status_name:({refused:'cancel',send_packs:'downloading',
        have_all_packs:'downloadingfinished',completed:'resourcepackstackfinished'})[name]||name,
      resourcepackids:ids
    })
  }
  const failure = err => {
    if(failed) return
    failed=true
    cancellation.abort()
    for(const p of packs.values()){
      if(p.fd!==undefined){try{fs.closeSync(p.fd)}catch{}}
      if(p.tmp){try{fs.rmSync(p.tmp,{force:true})}catch{}}
    }
    const msg=String(err?.message||err).slice(0,180)
    emit('pack-error',msg)
  }
  function progress(){
    if(failed || finished)return
    const done=[...packs.values()].filter(p=>p.ready).length
    emit('downloading-packs',`Realm packs verified: ${done}/${packs.size}`,done)
    if(packs.size && done===packs.size){
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
    emit('packs-ready',`Realm pack handshake completed (${packs.size} packs)`,packs.size)
  }
  async function startCdn(p){
    try{
      p.file=path.join(cacheDir,p.basename);p.tmp=p.file+'.download'
      const marker=p.file+'.sha256'
      if(fs.existsSync(p.file)&&fs.existsSync(marker)){
        const digest=fs.readFileSync(marker,'utf8').trim()
        if(fs.statSync(p.file).size===p.size&&/^[a-f0-9]{64}$/.test(digest)&&crypto.createHash('sha256').update(fs.readFileSync(p.file)).digest('hex')===digest){
          p.ready=true;emit('pack-cached','Realm CDN pack previously downloaded',0,packs.size);progress();return
        }
      }
      emit('downloading-packs','Downloading Realm pack from secure CDN',0,packs.size)
      const done=await downloadCdn({url:p.cdn,dest:p.tmp,maxBytes:MAX_PACK_BYTES,expectedBytes:p.size,signal:cancellation.signal,onProgress:bytes=>{
        if(!failed)emit('downloading-packs','Receiving Realm pack: '+Math.floor(bytes/1048576)+' MB',0,packs.size)
      }})
      if(failed||cancellation.signal.aborted)return
      if(done.bytes!==p.size||!/^[a-f0-9]{64}$/.test(done.sha256))throw Error('CDN response size or local digest invalid')
      // The digest is local-cache integrity, NOT an authenticated Mojang-supplied hash.
      fs.renameSync(p.tmp,p.file);p.tmp=null
      fs.writeFileSync(marker,done.sha256,{mode:0o600})
      p.ready=true;emit('pack-cached','CDN archive stored in private app cache',0,packs.size);progress()
    }catch(e){failure(e)}
  }
  client.on('resource_packs_info',packet=>{
    try{
      if(packs.size || finished || failed)return
      const incoming=packet.texture_packs||[]
      if(!Array.isArray(incoming) || incoming.length>MAX_PACKS)throw Error('Too many Realm packs requested')
      totalBytes=0
      for(const meta of incoming){
        const key=packKey(meta)
        if(packs.has(key))throw Error('Duplicate Realm pack')
        const size=safeNumber(meta.size,MAX_PACK_BYTES)
        totalBytes+=size
        if(totalBytes>MAX_TOTAL_BYTES)throw Error('Realm packs exceed 512MB download limit')
        const uuid=String(meta.uuid||meta.pack_id||meta.id)
        const basename=crypto.createHash('sha256').update(key).digest('hex')+'.mcpack'
        const cdn=String(meta.cdn_url||'').trim()
        if(cdn)checkCdnUrl(cdn)
        packs.set(key,{key,uuid,size,basename,ready:false,cdn})
        if(byUuid.has(uuid))throw Error('Ambiguous Realm packs with duplicate IDs')
        byUuid.set(uuid,key)
      }
      if(!packs.size){
        response('have_all_packs')
        emit('packs-none','No Realm download packs required',0,0)
      }else{
        fs.mkdirSync(cacheDir,{recursive:true,mode:0o700})
        emit('pack-request',`Requesting ${packs.size} required Realm pack(s)`,0,packs.size)
        response('send_packs',[...packs.keys()])
        for(const p of packs.values())if(p.cdn)void startCdn(p)
      }
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
      if(p.requested||p.ready)throw Error('Duplicate pack data header')
      p.chunkSize=safeNumber(packet.max_chunk_size,MAX_CHUNK_BYTES)
      p.count=safeNumber(packet.chunk_count,65536)
      p.expected=safeNumber(packet.size,MAX_PACK_BYTES)
      if(p.expected>p.size || p.chunkSize<1 || p.count<1 || p.count*p.chunkSize<p.expected || (p.count-1)*p.chunkSize>=p.expected)throw Error('Invalid Realm pack chunk layout')
      p.hash=packHash(packet.hash)
      p.file=path.join(cacheDir,p.basename)
      p.tmp=p.file+'.download'
      if(fs.existsSync(p.file)){
        const stat=fs.statSync(p.file)
        if(stat.size===p.expected && crypto.createHash('sha256').update(fs.readFileSync(p.file)).digest('hex')===p.hash){
          p.ready=true;emit('pack-cached','Verified previously downloaded Realm pack');progress();return
        }
      }
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
      if(p.next<p.count){client.write('resource_pack_chunk_request',{pack_id:p.uuid,chunk_index:p.next});return}
      fs.closeSync(p.fd);p.fd=undefined
      if(p.written!==p.expected || p.hashContext.digest('hex')!==p.hash)throw Error('Downloaded Realm pack failed SHA-256 verification')
      fs.renameSync(p.tmp,p.file);p.tmp=null;p.ready=true
      progress()
    }catch(e){failure(e)}
  })
  client.on('resource_pack_stack',()=>{
    if(failed)return
    stackReceived=true
    if([...packs.values()].every(p=>p.ready)) complete()
    else emit('downloading-packs','Waiting for required Realm packs before completing join')
  })
  client.once('close',()=>cancellation.abort())
  return {snapshot:()=>({requested:packs.size,verified:[...packs.values()].filter(p=>p.ready).length,failed,finished}),cleanup:()=>{
    cancellation.abort()
    for(const p of packs.values()){
      if(p.fd!==undefined){try{fs.closeSync(p.fd)}catch{}}
      if(p.tmp){try{fs.rmSync(p.tmp,{force:true})}catch{}}
    }
  }}
}
