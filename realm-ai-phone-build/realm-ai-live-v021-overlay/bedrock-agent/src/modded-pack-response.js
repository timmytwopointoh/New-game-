// Bedrock 1.26.60 / protocol 2225 resource-pack response.
// Mojang protocol 2225 keeps the OUTER oneOf variant tag at 0..3:
// Cancel=0, Downloading=1, DownloadingFinished=2, StackFinished=3.
// The 1..4 change in Mojang's changelog refers to a separate ResourcePackResponse
// enum used in metadata, NOT the oneOf selector on the wire. v0.42.5 and
// v0.42.6 incorrectly patched that outer tag to 2 for Downloading. That made
// the server parse a Downloading+8 IDs request as DownloadingFinished, likely
// causing an immediate disconnect. Preserve the serializer's valid tag and
// response string. v0.42.8 tests the lowercase response spelling used by
// Gophertunnel while preserving the 0..3 oneOf tag and exact pack list.
// The official docs display capitalized strings; this is a targeted wire A/B
// experiment, not a proven server expectation. Unmodded worlds are unchanged.
import {inspectTransportState} from './transport-evidence.js'
const LEGACY={refused:0,send_packs:1,have_all_packs:2,completed:3}
const CURRENT={refused:0,send_packs:1,have_all_packs:2,completed:3}
const TITLES={refused:'Cancel',send_packs:'Downloading',have_all_packs:'DownloadingFinished',completed:'ResourcePackStackFinished'}
const WIRE_TITLES={refused:'cancel',send_packs:'downloading',have_all_packs:'downloadingfinished',completed:'resourcepackstackfinished'}

function varuint(bytes,offset){
 let n=0,multiplier=1
 for(let k=0;k<5;k++){
  if(offset+k>=bytes.length)throw Error('Truncated pack response frame')
  const b=bytes[offset+k]
  n+=(b&127)*multiplier
  if((b&128)===0)return {value:n,next:offset+k+1}
  multiplier*=128
 }
 throw Error('Invalid pack response varuint')
}

export function encodeCurrentModdedPackResponse(client,packet){
 if(String(client?.options?.version)!=='1.26.60')throw Error('Modern pack response only supported for Bedrock 1.26.60')
 const status=String(packet?.response_status||'')
 if(!Object.hasOwn(CURRENT,status))throw Error('Unsupported pack response variant')
 if(typeof client?.serializer?.createPacketBuffer!=='function')throw Error('Bedrock serializer is unavailable')
 const title=WIRE_TITLES[status]
 const clean={response_status:status,response_status_name:title,resourcepackids:status==='send_packs'?packet.resourcepackids:[]}
 if(status==='send_packs'&&(!Array.isArray(clean.resourcepackids)||clean.resourcepackids.length===0||clean.resourcepackids.length>64))
  throw Error('Invalid count of server-advertised pack IDs')
 // Keep the stable oneOf selector, lower-case compatibility spelling and exact pack-ID sequence together.
 const encoded=client.serializer.createPacketBuffer({name:'resource_pack_client_response',params:clean})
 if(!Buffer.isBuffer(encoded))throw Error('Unexpected Bedrock frame shape')
 const id=varuint(encoded,0)
 const selector=varuint(encoded,id.next)
 if(id.value!==8||selector.value!==LEGACY[status]||selector.next!==id.next+1)
  throw Error('Bundled serializer did not emit the exact expected legacy enum shape')
 const stringHeader=varuint(encoded,selector.next)
 const actual=encoded.subarray(stringHeader.next,stringHeader.next+stringHeader.value).toString('utf8')
 if(actual!==title)throw Error('Incorrect serialized pack response name')
 // The serializer already emits the correct 0..3 oneOf variant tag.
 // Never rewrite it to the 1..4 ResourcePackResponse metadata enum.
 const frame=Buffer.from(encoded)
 const corrected=varuint(frame,id.next)
 if(corrected.value!==CURRENT[status]||corrected.next!==selector.next)
  throw Error('Bedrock 2225 oneOf variant tag mismatch')
 return {frame,observation:{
  available:true,verified:true,status,packIdCount:clean.resourcepackids.length,
  version:'1.26.60',statusCode:CURRENT[status],packetId:8,
  byteLength:frame.length,wireText:title,
  transportConnected:inspectTransportState(client).transportReady
 }}
}

export function sendCurrentModdedPackResponse(client,packet){
 if(typeof client?.sendBuffer!=='function')throw Error('Bedrock reliable sendBuffer unavailable')
 const {frame,observation}=encodeCurrentModdedPackResponse(client,packet)
 // sendBuffer(..., true) retains the existing encryption, batching and
 // reliable transport; raw sendMCPE would bypass essential framing.
 client.sendBuffer(frame,true)
 // Local submission evidence only: this does NOT prove the Realm received
 // or acknowledged the request. Event carries counts, never private pack IDs.
 client.emit?.('vf-pack-response-submit',{
  status:TITLES[packet.response_status],
  packCount:observation.packIdCount,
  packetBytes:frame.length,
  selector:observation.statusCode
 })
 return observation
}
