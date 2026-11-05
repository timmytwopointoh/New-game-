// Independent frozen protocol-2225 fixtures, not a roundtrip through our writer.
// Gophertunnel 0e179fc4bb082c13e946c7d81ab1cf9f623d942c:
// minecraft/protocol/info.go and packet/resource_pack_client_response.go.
// Mojang docs 0879ab5c4c70be1bd520e32a8c49ea4a155616d6:
// Response oneOf discriminator and official case-sensitive status strings.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {encodeCurrentModdedPackResponse} from '../src/modded-pack-response.js'
const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')
const client=()=>({options:{version:'1.26.60'},serializer:createSerializer('1.26.60')})
const fixtures={
 refused:'08010643616e63656c',
 send_packs:'08020b446f776e6c6f6164696e6701096162635f312e302e30',
 have_all_packs:'080313446f776e6c6f6164696e6746696e6973686564',
 completed:'0804195265736f757263655061636b537461636b46696e6973686564'
}
for(const [status,hex] of Object.entries(fixtures))test('stable protocol 2225 exact bytes: '+status,()=>{
 const {frame}=encodeCurrentModdedPackResponse(client(),{response_status:status,resourcepackids:['abc_1.0.0']})
 assert.equal(frame.toString('hex'),hex)
})
test('nine advertised pack IDs survive the stable request without changing transport framing',()=>{
 const ids=Array.from({length:9},(_,i)=>'synthetic'+i+'_1.0.0')
 const {frame}=encodeCurrentModdedPackResponse(client(),{response_status:'send_packs',resourcepackids:ids})
 assert.equal(frame[1],2,'modern 2225 Downloading discriminant')
 const legacyCopy=Buffer.from(frame)
 legacyCopy[1]=1 // bundled deserializer has PRE-2225 mappings
 const decoded=createDeserializer('1.26.60').parsePacketBuffer(legacyCopy).data
 assert.equal(decoded.params.response_status,'send_packs')
 assert.equal(decoded.params.response_status_name,'Downloading')
 assert.deepEqual(decoded.params.resourcepackids,ids)
})
