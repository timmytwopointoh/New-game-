// Safe one-session transport delivery evidence. Never saves packet payloads,
// addresses, Realm IDs, Microsoft tokens, resource pack IDs or endpoints.
// Observes calls into Bedrock's live RakNet/NetherNet sendReliable boundary.
const MAX=1000000000
const number=v=>Number.isSafeInteger(v)&&v>=0?Math.min(v,MAX):0
export function observeBedrockTransport(client,{clock=()=>Date.now()}={}){
 const transport=client?.connection
 if(!transport || typeof transport.sendReliable!=='function')return null
 if(client.__vfTransportEvidence)return client.__vfTransportEvidence
 const evidence={
  joinObserved:true,joinAt:clock(),closedAt:0,reliableCalls:0,
  reliableCallsWithTransportOpen:0,reliableCallsWithTransportClosed:0,
  packRequestAt:0,packReliableCallsAtRequest:0,packReliableCallsAfterRequest:0,
  outboundPackResponseObserved:false
 }
 const original=transport.sendReliable
 transport.sendReliable=function(frame,...args){
  evidence.reliableCalls=Math.min(MAX,evidence.reliableCalls+1)
  if(this.connected===false||client._closed||client.status===0)
   evidence.reliableCallsWithTransportClosed=Math.min(MAX,evidence.reliableCallsWithTransportClosed+1)
  else evidence.reliableCallsWithTransportOpen=Math.min(MAX,evidence.reliableCallsWithTransportOpen+1)
  if(evidence.packRequestAt>0&&evidence.closedAt===0)
   evidence.packReliableCallsAfterRequest=Math.min(MAX,evidence.packReliableCallsAfterRequest+1)
  return original.call(this,frame,...args)
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
  transportObservedPackRequest:e?.outboundPackResponseObserved===true,
  transportPackRequestOpen:e?.packRequestAt>0&&client?._closed!==true&&client?.status!==0&&client?.connection?.connected!==false,
  transportClosed:e?.closedAt>0||client?._closed===true,
  transportClosedAfterRequestSeconds:e?.closedAt>0&&e?.packRequestAt>0?number(Math.floor((e.closedAt-e.packRequestAt)/1000)):0
 }
}
