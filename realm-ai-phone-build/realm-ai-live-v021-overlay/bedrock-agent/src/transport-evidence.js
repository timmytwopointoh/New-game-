// Safe one-session transport delivery evidence. Never saves packet payloads,
// addresses, Realm IDs, Microsoft tokens, resource pack IDs or endpoints.
// Observes calls into Bedrock's live RakNet/NetherNet sendReliable boundary.
const MAX=1000000000
const RAKNET_CODES=Object.freeze({
  21:'remote-disconnect-notice',
  22:'raknet-connection-lost',
  23:'connection-banned',
  25:'protocol-incompatible'
})
// The RakNet backend delivers numeric reason codes. Never expose raw reason
// text or transport objects in exported diagnostics.
const RTC_CONNECTION_STATES=new Set(['new','connecting','connected','disconnected','failed','closed'])
const RTC_ICE_STATES=new Set(['new','checking','connected','completed','disconnected','failed','closed'])
const DATA_CHANNEL_STATES=new Set(['connecting','open','closing','closed'])
const checked=(value,allowed)=>allowed.has(value)?value:'unknown'

// Read-only, fixed enum snapshots: never save SDP, ICE candidates, endpoints,
// authentication tokens, real usernames, or WebRTC error objects.
export function inspectTransportState(client){
  const conn=client?.connection
  const kind=client?.options?.transport==='nethernet'?'nethernet':
    client?.options?.transport==='raknet'?'raknet':'unknown'
  const peer=kind==='nethernet'?conn?.nethernet?.connection:null
  const rtc=peer?.rtcConnection||conn?.nethernet?.rtcConnection
  const rtcConnectionState=checked(rtc?.connectionState,RTC_CONNECTION_STATES)
  const rtcIceState=checked(rtc?.iceConnectionState,RTC_ICE_STATES)
  const rtcReliableState=checked(peer?.reliable?.readyState,DATA_CHANNEL_STATES)
  const transportReady=conn?.connected===true||
    (kind==='nethernet'&&rtcReliableState==='open')
  return {transportKind:kind,rtcConnectionState,rtcIceState,rtcReliableState,transportReady}
}
export function classifyTransportClose(reason,transportKind='unknown'){
  const value=typeof reason==='number'?reason:reason&&typeof reason==='object'?reason.reason:null
  const raw=typeof reason==='string'?reason:typeof value==='string'?value:''
  const match=/^connecterror:([0-9]{1,3})$/.exec(raw)
  if(transportKind==='nethernet'){
    if(match){
      const code=Number(match[1])
      return {code:code<=255?code:0,label:'nethernet-connect-error'}
    }
    if(raw==='disconnected')return {code:0,label:'nethernet-disconnected'}
    if(raw==='closed')return {code:0,label:'nethernet-closed'}
  }
  const code=Number.isSafeInteger(value)&&value>=0&&value<=255?value:0
  return {code,label:RAKNET_CODES[code]||'unknown-code'}
}
const number=v=>Number.isSafeInteger(v)&&v>=0?Math.min(v,MAX):0
export function observeBedrockTransport(client,{clock=()=>Date.now()}={}){
 const transport=client?.connection
 if(!transport || typeof transport.sendReliable!=='function')return null
 if(client.__vfTransportEvidence)return client.__vfTransportEvidence
 const evidence={
  joinObserved:true,joinAt:clock(),closedAt:0,reliableCalls:0,
  reliableCallsWithTransportOpen:0,reliableCallsWithTransportClosed:0,
  packRequestAt:0,packReliableCallsAtRequest:0,packReliableCallsAfterRequest:0,
  packReliableSubmissions:0,packReliableErrors:0,
  outboundPackResponseObserved:false,packRequestWasOpen:false
 }
 const original=transport.sendReliable
 transport.sendReliable=function(frame,...args){
  evidence.reliableCalls=Math.min(MAX,evidence.reliableCalls+1)
  if(this.connected===false||client._closed||client.status===0)
   evidence.reliableCallsWithTransportClosed=Math.min(MAX,evidence.reliableCallsWithTransportClosed+1)
  else evidence.reliableCallsWithTransportOpen=Math.min(MAX,evidence.reliableCallsWithTransportOpen+1)
  if(evidence.packRequestAt>0&&evidence.closedAt===0)
   evidence.packReliableCallsAfterRequest=Math.min(MAX,evidence.packReliableCallsAfterRequest+1)
  try{
    const result=original.call(this,frame,...args)
    if(evidence.packRequestAt>0&&evidence.closedAt===0)
      evidence.packReliableSubmissions=Math.min(MAX,evidence.packReliableSubmissions+1)
    return result
  }catch(error){
    if(evidence.packRequestAt>0&&evidence.closedAt===0)
      evidence.packReliableErrors=Math.min(MAX,evidence.packReliableErrors+1)
    throw error
  }
 }
 client.__vfTransportEvidence=evidence
 client.once('close',()=>{evidence.closedAt=clock();if(transport.sendReliable===evidence.wrapped)transport.sendReliable=original})
 evidence.wrapped=transport.sendReliable
 return evidence
}
export function markPackTransportRequest(client,{clock=()=>Date.now()}={}){
 const evidence=client?.__vfTransportEvidence
 if(!evidence)return {joinObserved:false,open:false,reliableCalls:0}
 evidence.packRequestAt=clock();evidence.packReliableCallsAtRequest=evidence.reliableCalls
 evidence.outboundPackResponseObserved=true
 evidence.packRequestWasOpen=client?._closed!==true&&client?.status!==0&&client?.connection?.connected!==false
 return {joinObserved:true,open:client?._closed!==true&&client?.status!==0&&client?.connection?.connected!==false,
  reliableCalls:number(evidence.reliableCalls)}
}
export function transportEvidenceSummary(client,{clock=()=>Date.now()}={}){
 const e=client?.__vfTransportEvidence
 return {
  transportJoinObserved:e?.joinObserved===true,
  transportReliableWrites:number(e?.reliableCalls),
  transportReliableWritesOpen:number(e?.reliableCallsWithTransportOpen),
  transportReliableWritesClosed:number(e?.reliableCallsWithTransportClosed),
  transportReliableAfterPackRequest:number(e?.packReliableCallsAfterRequest),
  transportPackReliableSubmissions:number(e?.packReliableSubmissions),
  transportPackReliableErrors:number(e?.packReliableErrors),
  transportAckObservable:false,
  transportObservedPackRequest:e?.outboundPackResponseObserved===true,
  transportPackRequestOpen:e?.packRequestWasOpen===true,
  transportClosed:e?.closedAt>0||client?._closed===true,
  transportClosedAfterRequestSeconds:e?.closedAt>0&&e?.packRequestAt>0?number(Math.floor((e.closedAt-e.packRequestAt)/1000)):0
 }
}
