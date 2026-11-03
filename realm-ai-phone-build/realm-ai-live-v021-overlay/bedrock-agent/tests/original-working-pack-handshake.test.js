import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'
import {attachRealmPacks} from '../src/realm-packs.js'
import {sanitizeDiagnosticReport} from '../src/diagnostic-store.js'

const require=createRequire(import.meta.url)
const loadData=require('minecraft-data')
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')

function setup(){
 const c=new EventEmitter(),sent=[]
 const originalWrite=function(name,params){sent.push({via:'write',name,params})}
 const originalQueue=function(name,params){sent.push({via:'queue',name,params})}
 c.write=originalWrite;c.queue=originalQueue
 const dir=mkdtempSync(path.join(os.tmpdir(),'original-pack-handshake-'))
 const h=attachRealmPacks(c,dir,()=>{},{handshakeMode:'original-working',noPackGraceMs:0,checkStorage:()=>({freeMB:8000,neededMB:1,reserveMB:256})})
 return {c,sent,h,originalWrite,originalQueue,close(){h.cleanup();rmSync(dir,{recursive:true,force:true})}}
}

test('original v0.26 packet schema is retained without global mutation, and bytes are reversible',()=>{
 const original=loadData('bedrock_1.26.60').protocol.types.packet_resource_pack_client_response[1][0].type[1].mappings
 assert.deepEqual(original,{'0':'refused','1':'send_packs','2':'have_all_packs','3':'completed'})
 const result=preparePackResponseWire({version:'1.26.60'},undefined,{strategy:'original-working'})
 assert.equal(result.mode,'original-working')
 assert.equal(result.patched,false)
 assert.deepEqual(loadData('bedrock_1.26.60').protocol.types.packet_resource_pack_client_response[1][0].type[1].mappings,original)
 const serializer=createSerializer('1.26.60'),deserializer=createDeserializer('1.26.60')
 for(const [status,name,code] of [['send_packs','downloading',1],['have_all_packs','downloadingfinished',2],['completed','resourcepackstackfinished',3]]){
  const src={response_status:status,response_status_name:name,resourcepackids:status==='send_packs'?['a_1.0.0']:[]}
  const buf=serializer.createPacketBuffer({name:'resource_pack_client_response',params:src})
  assert.equal(buf[0],8)
  assert.equal(buf[1],code)
  const decoded=deserializer.parsePacketBuffer(buf).data
  assert.equal(decoded.params.response_status,status)
  assert.equal(decoded.params.response_status_name,name)
  if(status==='send_packs')assert.deepEqual(decoded.params.resourcepackids,src.resourcepackids)
 }
})

test('no-pack Realm uses original immediate response, leaves cache ordering and early radius alone',t=>{
 const v=setup();t.after(v.close)
 assert.equal(v.c.write,v.originalWrite)
 assert.equal(v.c.queue,v.originalQueue)
 v.c.emit('resource_packs_info',{texture_packs:[],must_accept:false})
 assert.equal(v.sent.length,1)
 assert.deepEqual([v.sent[0].name,v.sent[0].params.response_status_name],['resource_pack_client_response','downloadingfinished'])
 // The bedrock-protocol library owns these packets, not our pack handler.
 v.c.queue('client_cache_status',{enabled:false})
 v.c.queue('request_chunk_radius',{chunk_radius:10})
 assert.deepEqual(v.sent.slice(1).map(x=>x.name),['client_cache_status','request_chunk_radius'])
 assert.equal(v.h.snapshot().radiusDeferred,0)
 v.c.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(v.h.snapshot().finished,true)
 assert.equal(v.sent.at(-1).params.response_status_name,'resourcepackstackfinished')
 assert.equal(v.c.write,v.originalWrite)
 assert.equal(v.c.queue,v.originalQueue)
})

test('modded Realm requests only server-advertised missing packs using original response text',t=>{
 const v=setup();t.after(v.close)
 v.c.emit('resource_packs_info',{texture_packs:[{uuid:'needed',version:'1.0.0',size:6,cdn_url:''}]})
 const reply=v.sent.find(e=>e.name==='resource_pack_client_response')
 assert.equal(reply.params.response_status_name,'downloading')
 assert.equal(reply.params.response_status,'send_packs')
 assert.deepEqual(reply.params.resourcepackids,['needed_1.0.0'])
 assert.equal(v.h.snapshot().handshakeMode,'original-working')
 assert.equal(v.c.queue,v.originalQueue)
})

test('packless phase appears as packs-none rather than unknown',()=>{
 const r=sanitizeDiagnosticReport({phase:'packs-none',packStage:'packs-none',authState:'packs-none'})
 assert.equal(r.phase,'packs-none')
 assert.equal(r.packStage,'packs-none')
})
