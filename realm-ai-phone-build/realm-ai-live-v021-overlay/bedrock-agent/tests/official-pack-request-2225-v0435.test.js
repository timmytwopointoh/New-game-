// Contract tests against Mojang's official Bedrock protocol 2225 packet 8.
// Frozen expected bytes are independent of both our encoder and Prismarine.
// Only Downloading includes pack IDs; no login tokens or private IDs are logged.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {officialPackResponse2225,assertOfficialPackResponse2225} from '../src/official-pack-request-2225.js'
import {encodeCurrentModdedPackResponse} from '../src/modded-pack-response.js'
import {attachRealmPacks} from '../src/realm-packs.js'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'
const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')
preparePackResponseWire({version:'1.26.60'},undefined,{strategy:'original-working'})
const client=()=>({
 options:{version:'1.26.60'},
 connection:{connected:true},
 serializer:createSerializer('1.26.60'),
 deserializer:createDeserializer('1.26.60')
})
const cases=[
 ['refused','08000643616e63656c','Cancel'],
 ['send_packs','08010b446f776e6c6f6164696e6701096162635f312e302e30','Downloading'],
 ['have_all_packs','080213446f776e6c6f6164696e6746696e6973686564','DownloadingFinished'],
 ['completed','0803195265736f757263655061636b537461636b46696e6973686564','ResourcePackStackFinished']
]
for(const [status,hex,title] of cases){
 test('v0.43.5 independently checks official packet 8 byte vector: '+status,()=>{
   const ids=status==='send_packs'?['abc_1.0.0']:[]
   const expected=Buffer.from(hex,'hex')
   assert.deepEqual(officialPackResponse2225(status,ids),expected)
   const {frame}=encodeCurrentModdedPackResponse(client(),{response_status:status,resourcepackids:ids})
   assert.deepEqual(frame,expected)
   assert.equal(assertOfficialPackResponse2225(frame,status,ids).wireText,title)
   const decoded=client().deserializer.parsePacketBuffer(frame).data
   assert.equal(decoded.params.response_status_name,title)
 })
}
test('v0.43.5 exact one-pack Downloading request on modern resource_packs list, preserving UUID_version',t=>{
 const c=new EventEmitter(),frames=[],writes=[]
 Object.assign(c,client(),{
  sendBuffer:(frame,reliable)=>frames.push({frame,reliable}),
  write:(name,packet)=>writes.push({name,packet}),
  queue:(name,packet)=>writes.push({name,packet,queued:true})
 })
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-official-2225-'))
 const handler=attachRealmPacks(c,dir,()=>{},{
  handshakeMode:'original-working',noPackGraceMs:0,
  checkStorage:()=>({freeMB:22000,neededMB:1,reserveMB:256})
 })
 t.after(()=>{handler.cleanup();rmSync(dir,{recursive:true,force:true})})
 const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 c.emit('resource_packs_info',{resource_packs:[{uuid,version:'1.0.0',size:6,cdn_url:''}],texture_packs:[]})
 assert.equal(handler.snapshot().advertised,1)
 assert.equal(frames.length,1)
 assert.equal(frames[0].reliable,true)
 assert.deepEqual(frames[0].frame,officialPackResponse2225('send_packs',[uuid+'_1.0.0']))
 assert.equal(handler.snapshot().wire.verified,true)
 assert.equal(handler.snapshot().wire.wireText,'Downloading')
 assert.equal(writes.some(x=>x.name==='resource_pack_client_response'),false)
})
test('v0.43.5 reject wrong casing, omitted ID list and incorrect selector before sending',()=>{
 const expected=officialPackResponse2225('send_packs',['abc_1.0.0'])
 const lower=Buffer.from(expected)
 lower[3]='d'.charCodeAt(0)
 assert.throws(()=>assertOfficialPackResponse2225(lower,'send_packs',['abc_1.0.0']),/differs/)
 const wrongSelector=Buffer.from(expected)
 wrongSelector[1]=2
 assert.throws(()=>assertOfficialPackResponse2225(wrongSelector,'send_packs',['abc_1.0.0']),/differs/)
 assert.throws(()=>officialPackResponse2225('send_packs',[]),/needs/)
 assert.throws(()=>officialPackResponse2225('completed',['abc_1.0.0']),/cannot contain/)
})
