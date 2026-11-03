import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {classifyPack,packDirectory,packFilePath,priorPackLocations} from '../src/pack-storage.js'
import {inspectPackResponseWire} from '../src/pack-protocol-observer.js'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'
import {attachRealmPacks,selectRequiredRealmPacks} from '../src/realm-packs.js'

const require=createRequire(import.meta.url)

test('modern combined resource announcement is not mistaken for an empty behavior pack list',()=>{
 const packet={resource_packs:[
  {uuid:'behavior',version:'1.0.0',size:11,addon_pack:true},
  {uuid:'resources',version:'1.0.0',size:10,addon_pack:false}
 ]}
 const selection=selectRequiredRealmPacks(packet)
 assert.equal(selection.advertised,2)
 assert.equal(selection.required.length,2)
 assert.equal(selection.legacyBehaviorCount,0)
 assert.equal(classifyPack({origin:'resource',metadata:packet.resource_packs[0]}),'addon')
 assert.equal(classifyPack({origin:'resource',metadata:packet.resource_packs[1]}),'resource')
 assert.equal(classifyPack({origin:'resource',metadata:packet.resource_packs[1],serverType:'behavior'}),'behavior')
 assert.equal(classifyPack({origin:'resource',metadata:packet.resource_packs[0],serverType:'resources'}),'resource')
})

test('private hashed cache locations separate actual behavior and resource files',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vf-pack-types-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
 const client=new EventEmitter(),writes=[],stages=[]
 client.write=(name,payload)=>writes.push({name,payload})
 client.queue=()=>{}
 const bodyB=Buffer.from('behavior-pack-for-test'),bodyR=Buffer.from('resource-pack-for-test')
 const b={uuid:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',version:'1.0.0',size:bodyB.length,addon_pack:true,cdn_url:''}
 const r={uuid:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',version:'1.0.0',size:bodyR.length,cdn_url:''}
 const h=attachRealmPacks(client,root,state=>stages.push(state),{checkStorage:()=>({freeMB:10000,neededMB:1,reserveMB:256})})
 t.after(()=>h.cleanup())
 client.emit('resource_packs_info',{texture_packs:[b,r]})
 assert.deepEqual(writes.filter(x=>x.name==='resource_pack_client_response').map(x=>x.payload.resourcepackids),[
  [b.uuid+'_1.0.0',r.uuid+'_1.0.0']
 ])
 for(const [info,data,serverType] of [[b,bodyB,'behavior'],[r,bodyR,'resources']]){
  client.emit('resource_pack_data_info',{pack_id:info.uuid,pack_type:serverType,max_chunk_size:64,
   chunk_count:1,size:data.length,hash:crypto.createHash('sha256').update(data).digest()})
  assert.equal(writes.at(-1).name,'resource_pack_chunk_request')
  client.emit('resource_pack_chunk_data',{pack_id:info.uuid,chunk_index:0,progress:0,payload:data})
 }
 client.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.snapshot().finished,true)
 assert.deepEqual(h.snapshot().categoryCounts,{resource:1,behavior:1,addon:0})
 assert.deepEqual(stages.at(-1).packResourceClassifiedCount,1)
 assert.deepEqual(stages.at(-1).packBehaviorClassifiedCount,1)
 const filenameB=crypto.createHash('sha256').update(b.uuid+'_1.0.0').digest('hex')+'.mcpack'
 const filenameR=crypto.createHash('sha256').update(r.uuid+'_1.0.0').digest('hex')+'.mcpack'
 assert.deepEqual(fs.readFileSync(packFilePath(root,'behavior',filenameB)),bodyB)
 assert.deepEqual(fs.readFileSync(packFilePath(root,'resource',filenameR)),bodyR)
 assert.ok(priorPackLocations(root,filenameB,'behavior').includes(path.join(root,filenameB)))
 assert.notEqual(packDirectory(root,'behavior'),packDirectory(root,'resource'))
})

test('1.26.60 pack request is byte-correct, decoded with all pack identifiers, without exporting their values',()=>{
 preparePackResponseWire({version:'1.26.60'})
 const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer')
 const client={options:{version:'1.26.60'},connection:{connected:true},
  serializer:createSerializer('1.26.60'),deserializer:createDeserializer('1.26.60')}
 const ids=['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa_1.0.0','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb_1.0.0']
 const packet={response_status:'send_packs',response_status_name:'Downloading',resourcepackids:ids}
 const observation=inspectPackResponseWire(client,packet)
 assert.equal(observation.available,true)
 assert.equal(observation.verified,true)
 assert.equal(observation.packetId,8)
 assert.equal(observation.statusCode,2)
 assert.equal(observation.wireText,'Downloading')
 assert.equal(observation.packIdCount,2)
 assert.equal(observation.transportConnected,true)
 assert.equal(JSON.stringify(observation).includes('aaaaaaaa'),false)
 const bytes=client.serializer.createPacketBuffer({name:'resource_pack_client_response',params:packet})
 // Independent protocol fixture: packet 8, status 2, 11-byte lowercase
 // response string then count of pack IDs.
 assert.deepEqual([...bytes.subarray(0,3)],[8,2,11])
 assert.equal(bytes.subarray(3,14).toString('utf8'),'Downloading')
 assert.equal(bytes[14],2)
})

test('unsupported serializer enum fails before attempting to transmit pack response',()=>{
 const c={options:{version:'1.26.60'},serializer:{createPacketBuffer:()=>Buffer.from([8,1])},
  deserializer:{parsePacketBuffer:()=>({data:{name:'resource_pack_client_response',params:{}}})}}
 assert.throws(()=>inspectPackResponseWire(c,{response_status:'send_packs',response_status_name:'Downloading',resourcepackids:['x_1.0.0']}),/wrong on-wire status/)
})
