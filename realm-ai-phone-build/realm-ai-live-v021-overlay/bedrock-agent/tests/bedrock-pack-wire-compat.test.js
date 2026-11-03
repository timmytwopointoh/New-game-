import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {correctPackResponseSchema,preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'

const require=createRequire(import.meta.url)
const loadData=require('minecraft-data')
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer')

test('Mojang 1.26.60 response codes update the installed 0-3 schema to 1-4',()=>{
 const wire=preparePackResponseWire({version:'1.26.60'})
 assert.equal(wire.version,'1.26.60')
 assert.equal(wire.mode,'modern-1-to-4')
 const mapper=loadData('bedrock_1.26.60').protocol.types.packet_resource_pack_client_response[1][0].type[1].mappings
 assert.deepEqual(mapper,{'1':'refused','2':'send_packs','3':'have_all_packs','4':'completed'})
 assert.equal(preparePackResponseWire({version:'1.26.60'}).patched,false)
})

test('1.26.60 Downloading packet goes onto the wire with enum 2, not legacy 1',()=>{
 preparePackResponseWire({version:'1.26.60'})
 const serializer=createSerializer('1.26.60')
 const deserializer=createDeserializer('1.26.60')
 const ids=['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa_1.0.0','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb_1.0.0']
 const buffer=serializer.createPacketBuffer({name:'resource_pack_client_response',params:{
  response_status:'send_packs',response_status_name:'Downloading',resourcepackids:ids
 }})
 assert.equal(buffer[0],8,'resource_pack_client_response packet ID')
 assert.equal(buffer[1],2,'1.26.60 must encode Downloading as 2, not the old 1')
 const parsed=deserializer.parsePacketBuffer(buffer).data
 assert.equal(parsed.name,'resource_pack_client_response')
 assert.equal(parsed.params.response_status,'send_packs')
 assert.equal(parsed.params.response_status_name,'Downloading')
 assert.deepEqual(parsed.params.resourcepackids,ids)
})

test('1.26.60 completed responses use wire status 3/4 and no pack ID array',()=>{
 preparePackResponseWire({version:'1.26.60'})
 const serialize=createSerializer('1.26.60')
 for(const [status,title,code] of [['have_all_packs','DownloadingFinished',3],['completed','ResourcePackStackFinished',4]]){
  const bytes=serialize.createPacketBuffer({name:'resource_pack_client_response',params:{response_status:status,response_status_name:title,resourcepackids:[]}})
  assert.equal(bytes[1],code)
 }
})

test('1.26.51 protocol retains its historical 0-3 response codes',()=>{
 const wire=preparePackResponseWire({version:'1.26.51'})
 assert.equal(wire.mode,'unchanged-version')
 const serialize=createSerializer('1.26.51')
 const packet=serialize.createPacketBuffer({name:'resource_pack_client_response',params:{
  response_status:'send_packs',response_status_name:'Downloading',resourcepackids:['any_1.0.0']
 }})
 assert.equal(packet[1],1)
})

test('unexpected modern protocol mapping fails closed rather than guessed packet codes',()=>{
 const bogus={types:{packet_resource_pack_client_response:['container',[
  {name:'response_status',type:['mapper',{type:'varint',mappings:{'7':'unknown'}}]}
 ]]}}
 assert.throws(()=>correctPackResponseSchema('1.26.60',bogus),/Unsupported Bedrock/)
})
