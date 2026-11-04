// Bedrock 1.26.60 pack-only compatibility.
// The old Bedrock serializer used by the verified no-mod Realm encodes
// pack response selectors 0..3. Mojang's 1.26.60 protocol uses 1..4.
// Re-encode ONLY modded-Realm resource_pack_client_response packets while
// leaving all other packet serializers, transport, auth and gameplay intact.
//
// The two packet variants have the same fields. The old serializer builds
// the full packet (including exact pack ID list); only the one-byte selector
// needs correcting before passing the frame to the established Bedrock
// client's encrypted/reliable sendBuffer path.
const OLD={refused:0,send_packs:1,have_all_packs:2,completed:3}
const CURRENT={refused:1,send_packs:2,have_all_packs:3,completed:4}
const TITLES={refused:'Cancel',send_packs:'Downloading',have_all_packs:'DownloadingFinished',completed:'ResourcePackStackFinished'}

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
 const title=TITLES[status]
 const clean={response_status:status,response_status_name:title,resourcepackids:status==='send_packs'?packet.resourcepackids:[]}
 if(status==='send_packs'&&(!Array.isArray(clean.resourcepackids)||clean.resourcepackids.length===0||clean.resourcepackids.length>64))
  throw Error('Invalid count of server-advertised pack IDs')
 // The original serializer encodes the correct string and pack-ID sequence.
 const encoded=client.serializer.createPacketBuffer({name:'resource_pack_client_response',params:clean})
 if(!Buffer.isBuffer(encoded))throw Error('Unexpected Bedrock frame shape')
 const id=varuint(encoded,0)
 const selector=varuint(encoded,id.next)
 if(id.value!==8||selector.value!==OLD[status]||selector.next!==id.next+1)
  throw Error('Original pack response packet is not the expected v0.26 format')
 const stringHeader=varuint(encoded,selector.next)
 const actual=encoded.subarray(stringHeader.next,stringHeader.next+stringHeader.value).toString('utf8')
 if(actual!==title)throw Error('Incorrect serialized pack response name')
 const frame=Buffer.from(encoded)
 frame[id.next]=CURRENT[status]
 return {frame,observation:{
  available:true,verified:true,status,packIdCount:clean.resourcepackids.length,
  version:'1.26.60',statusCode:CURRENT[status],packetId:8,
  byteLength:frame.length,wireText:title,
  transportConnected:client?.connection?.connected===true
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
