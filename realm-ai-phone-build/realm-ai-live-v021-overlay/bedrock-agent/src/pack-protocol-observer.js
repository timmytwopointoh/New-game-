// Inspect the exact outbound Bedrock packet shape without recording packet
// contents, pack IDs, content keys, URLs, or authentication tokens.
function readVarUint(buf,offset){
 let value=0,mul=1
 for(let i=0;i<5;i++){
  if(offset+i>=buf.length)throw Error('Truncated Bedrock pack response')
  const byte=buf[offset+i]
  value+=(byte&127)*mul
  if(!(byte&128))return {value,next:offset+i+1}
  mul*=128
 }
 throw Error('Bad Bedrock packet varuint')
}
const CODE_BY_STATUS_12660={refused:1,send_packs:2,have_all_packs:3,completed:4}
const CODE_BY_STATUS_ORIGINAL={refused:0,send_packs:1,have_all_packs:2,completed:3}
export function inspectPackResponseWire(client,packet,{strategy='modern'}={}){
 const output={available:false,verified:false,status:packet.response_status,packIdCount:Array.isArray(packet.resourcepackids)?packet.resourcepackids.length:0,
  version:String(client?.options?.version||'unavailable'),transportConnected:client?.connection?.connected===true}
 if(typeof client?.serializer?.createPacketBuffer!=='function')return output // lightweight unit harness
 const frame=client.serializer.createPacketBuffer({name:'resource_pack_client_response',params:packet})
 const id=readVarUint(frame,0),status=readVarUint(frame,id.next)
 if(id.value!==8)throw Error('Pack response encoded with unexpected Bedrock packet ID')
 if(output.version==='1.26.60' && status.value!==(strategy==='original-working'?CODE_BY_STATUS_ORIGINAL:CODE_BY_STATUS_12660)[packet.response_status]){
  throw Error('Bedrock 1.26.60 pack response has wrong on-wire status code')
 }
 if(typeof client?.deserializer?.parsePacketBuffer!=='function')throw Error('Cannot verify Bedrock pack response locally')
 const decoded=client.deserializer.parsePacketBuffer(frame)?.data
 if(decoded?.name!=='resource_pack_client_response')throw Error('Bedrock pack response wire roundtrip failed')
 const actual=decoded.params||{}
 if(actual.response_status!==packet.response_status||actual.response_status_name!==packet.response_status_name||
  (Array.isArray(packet.resourcepackids)&&packet.response_status==='send_packs' &&
   JSON.stringify(actual.resourcepackids)!==JSON.stringify(packet.resourcepackids))){
   throw Error('Bedrock pack response wire content failed roundtrip verification')
 }
 return {...output,available:true,verified:true,packetId:id.value,statusCode:status.value,byteLength:frame.length,
  wireText:actual.response_status_name}
}
