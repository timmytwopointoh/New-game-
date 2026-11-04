// On-device forensic timeline for the pack handshake. This file contains ONLY
// fixed event names, numeric counters and booleans. No raw packets, network
// addresses, pack IDs, URLs, gamertags, exceptions, or Microsoft auth objects.
import {readPrivateJson,writePrivateJson} from './survival/private-json.js'

const INPUT_NAMES=new Set(['network_settings','server_to_client_handshake','play_status','resource_packs_info','resource_pack_data_info','resource_pack_chunk_data','resource_pack_stack','start_game','disconnect'])
const OUTPUT_NAMES=new Set(['client_to_server_handshake','client_cache_status','resource_pack_client_response','request_chunk_radius','resource_pack_chunk_request'])
const KINDS=new Set(['session-start','joined','client-session','received','write-attempt','queue-attempt','send-mcpe','raw-pack-submit','client-closed','server-disconnect','client-error','transport-closed','world-spawned'])
const SHORT_MAX=9007199254740991
const finite=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,SHORT_MAX):0
const elapsed=(now,start)=>finite(now>=start?now-start:0)
const responseValue=x=>({refused:'Cancel',send_packs:'Downloading',have_all_packs:'DownloadingFinished',completed:'ResourcePackStackFinished'})[x]||'unknown'
function safeEntry(data){
 if(!data||typeof data!=='object')return null
 const kind=KINDS.has(data.kind)?data.kind:'client-error'
 const packet=INPUT_NAMES.has(data.packet)||OUTPUT_NAMES.has(data.packet)?data.packet:'unknown'
 const transport=data.transport==='open'||data.transport==='closed'?data.transport:'unknown'
 const status=['none','Cancel','Downloading','DownloadingFinished','ResourcePackStackFinished'].includes(data.status)?data.status:'none'
 return {ms:finite(data.ms),kind,packet,transport,status,packCount:finite(data.packCount),
  packetBytes:finite(data.packetBytes),selector:finite(data.selector),reasonCode:finite(data.reasonCode)}
}
export function createPackHandshakeForensics(client,file,{clock=()=>Date.now()}={}){
 const started=clock()
 const previous=(()=>{try{
  const old=readPrivateJson(file,48000)
  return Array.isArray(old.sessions)?old.sessions.slice(-2).map(s=>({
   startedAt:finite(s.startedAt),state:['closed','world-spawned','pack-requested','server-reply','starting'].includes(s.state)?s.state:'starting',
   events:(Array.isArray(s.events)?s.events:[]).slice(-64).map(safeEntry).filter(Boolean)
  })):[]
 }catch{return []}})()
 const session={startedAt:finite(started),state:'starting',events:[]}
 let lastPersistAt=-1
 const snapshot=()=>({schema:1,capturedAt:finite(clock()),sessions:[...previous,session]})
 function persist(){try{writePrivateJson(file,snapshot())}catch{}}
 function record(kind,packet='unknown',extra={}){
  const when=clock(),conn=client?.connection
  const transport=client?._closed===true||client?.status===0||conn?.connected===false?'closed':
    conn?.connected===true?'open':'unknown'
  const item=safeEntry({ms:elapsed(when,started),kind,packet,transport,
   status:extra.status||'none',packCount:finite(extra.packCount),
   packetBytes:extra.packetBytes,selector:extra.selector,reasonCode:extra.reasonCode})
  session.events.push(item)
  if(session.events.length>64)session.events.shift()
  if(kind==='client-closed'||kind==='server-disconnect'||kind==='transport-closed')session.state='closed'
  else if(kind==='world-spawned')session.state='world-spawned'
  else if(kind==='received'&&packet==='resource_pack_data_info')session.state='server-reply'
  else if((kind==='write-attempt'||kind==='raw-pack-submit')&&packet==='resource_pack_client_response'&&item.status==='Downloading')session.state='pack-requested' 
  // Never throttle meaningful handshake events; only periodic noisy chunk data.
  if(kind==='received'&&packet==='resource_pack_chunk_data'&&when-lastPersistAt<750)return item
  lastPersistAt=when;persist();return item
 }
 function seenPacket(packet){
  const name=String(packet?.data?.name||'')
  if(INPUT_NAMES.has(name))record('received',name,{
    packCount:name==='resource_packs_info'?finite((packet.data.params?.texture_packs??packet.data.params?.resource_packs??[]).length):0})
 }
 const originalWrite=client.write,originalQueue=client.queue,originalSend=client.sendMCPE
 client.write=function(name,params,...args){
  if(OUTPUT_NAMES.has(name))record('write-attempt',name,{status:name==='resource_pack_client_response'?responseValue(params?.response_status):'none',
   packCount:name==='resource_pack_client_response'?finite(params?.resourcepackids?.length):0})
  return originalWrite.call(this,name,params,...args)
 }
 if(typeof originalQueue==='function')client.queue=function(name,params,...args){
  if(OUTPUT_NAMES.has(name))record('queue-attempt',name,{status:name==='resource_pack_client_response'?responseValue(params?.response_status):'none',
   packCount:name==='resource_pack_client_response'?finite(params?.resourcepackids?.length):0})
  return originalQueue.call(this,name,params,...args)
 }
 if(typeof originalSend==='function')client.sendMCPE=function(buffer,immediate,...args){
  // This call is BEFORE the Bedrock transport checks connectivity. It is
  // not server receipt/acknowledgement, merely attempted RakNet handoff.
  record('send-mcpe','unknown')
  return originalSend.call(this,buffer,immediate,...args)
 }
 // The modified pack-only sender bypasses client.write(). Record a structured
 // raw response submission without storing IDs, content keys, or payloads.
 const rawPackSubmitted=event=>record('raw-pack-submit','resource_pack_client_response',event)
 client.on('vf-pack-response-submit',rawPackSubmitted)
 client.on('packet',seenPacket)
 client.on('join',()=>record('joined'))
 client.on('session',()=>record('client-session'))
 client.on('disconnect',()=>record('server-disconnect','disconnect'))
 client.on('error',()=>record('client-error'))
 client.on('spawn',()=>record('world-spawned'))
 client.on('close',()=>record('client-closed'))
 record('session-start')
 return {record,snapshot,cleanup(){
  client.off('vf-pack-response-submit',rawPackSubmitted)
  client.off('packet',seenPacket)
  if(client.write!==originalWrite)client.write=originalWrite
  if(client.queue!==originalQueue)client.queue=originalQueue
  if(client.sendMCPE!==originalSend)client.sendMCPE=originalSend
 }}
}
