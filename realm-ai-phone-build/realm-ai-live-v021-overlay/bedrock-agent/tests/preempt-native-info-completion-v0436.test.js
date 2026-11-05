// Regression for native bedrock-protocol 3.61.0 listener registration order.
// The library attaches its premature Completed callback INSIDE createClient,
// before attachRealmPacks is called. Previous fixtures reversed this order and
// could not catch the early Completed sent before the Downloading request.
import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import os from 'node:os'
import {createRequire} from 'node:module'
import {attachRealmPacks} from '../src/realm-packs.js'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'
const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')
preparePackResponseWire({version:'1.26.60'},undefined,{strategy:'original-working'})

function harness(t){
 const client=new EventEmitter(),events=[]
 client.options={version:'1.26.60'}
 client.connection={connected:true}
 client.serializer=createSerializer('1.26.60')
 client.deserializer=createDeserializer('1.26.60')
 const write=function(name,data){
   events.push({kind:'native-write',name,status:data?.response_status,params:data})
 }
 const queue=function(name,data){
   events.push({kind:'native-queue',name,status:data?.response_status,params:data})
 }
 client.write=write;client.queue=queue
 client.sendBuffer=function(buf,reliable){
   const decoded=client.deserializer.parsePacketBuffer(buf).data
   events.push({kind:'wire',name:decoded.name,status:decoded.params?.response_status,
      frame:buf,reliable})
 }
 // Crucially, register native callback BEFORE our custom pack handler.
 const completeNative=()=>client.write('resource_pack_client_response',{
   response_status:'completed',
   response_status_name:'resourcepackstackfinished',
   resourcepackids:[]
 })
 client.once('resource_packs_info',()=>{
   completeNative()
   client.once('resource_pack_stack',completeNative)
   client.queue('client_cache_status',{enabled:false})
 })
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-0436-early-native-'))
 const handler=attachRealmPacks(client,dir,()=>{},{
   handshakeMode:'original-working',noPackGraceMs:0,
   checkStorage:()=>({freeMB:22000,neededMB:1,reserveMB:256})
 })
 t.after(()=>{handler.cleanup();rmSync(dir,{recursive:true,force:true})})
 return {client,events,handler,write,queue}
}
const meta={uuid:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',version:'1.0.0',size:6,cdn_url:''}
const responses=h=>h.events.filter(e=>e.name==='resource_pack_client_response')

test('native registered first cannot send Completed before required mod pack Downloading',t=>{
 const h=harness(t)
 h.client.emit('resource_packs_info',{resource_packs:[meta],texture_packs:[],behavior_packs:[]})
 const out=responses(h)
 assert.equal(out.length,1,'one outgoing Downloading and no premature native Completed')
 assert.equal(out[0].kind,'wire')
 assert.equal(out[0].status,'send_packs')
 assert.equal(out[0].reliable,true)
 assert.equal(h.client.deserializer.parsePacketBuffer(out[0].frame).data.params.response_status_name,'Downloading')
 assert.equal(h.handler.snapshot().suppressedNativePackCompletions,1)
 assert.equal(h.handler.snapshot().advertised,1)
 assert.equal(h.handler.snapshot().finished,false)
})

test('late native Completed on resource_pack_stack remains suppressed until SHA-verified download',async t=>{
 const h=harness(t)
 h.client.emit('resource_packs_info',{resource_packs:[meta],texture_packs:[]})
 h.client.emit('resource_pack_stack',{resource_packs:[meta]})
 assert.deepEqual(responses(h).map(r=>r.status),['send_packs'])
 assert.equal(h.handler.snapshot().suppressedNativePackCompletions,2)
 const data=Buffer.from('foobar')
 h.client.emit('resource_pack_data_info',{
   pack_id:meta.uuid+'_1.0.0',max_chunk_size:6,chunk_count:1,size:6,
   hash:crypto.createHash('sha256').update(data).digest()
 })
 h.client.emit('resource_pack_chunk_data',{
   pack_id:meta.uuid+'_1.0.0',chunk_index:0,progress:0,payload:data
 })
 const deadline=Date.now()+4000
 while(!h.handler.snapshot().finished){
   if(Date.now()>deadline)throw Error('real file SHA verification timed out')
   await new Promise(resolve=>setTimeout(resolve,12))
 }
 assert.deepEqual(responses(h).map(r=>r.status),['send_packs','have_all_packs','completed'])
 assert.equal(responses(h).every(r=>r.kind==='wire'),true)
})

test('empty-pack vanilla Realm does not intercept or suppress native auto-completion',t=>{
 const h=harness(t)
 h.client.emit('resource_packs_info',{resource_packs:[],texture_packs:[],behavior_packs:[]})
 assert.equal(h.client.write,h.write,'vanilla native writer untouched')
 assert.equal(h.handler.snapshot().suppressedNativePackCompletions,0)
 assert.equal(responses(h).filter(r=>r.kind==='native-write').length,2)
 assert.equal(responses(h).filter(r=>r.kind==='wire').length,0)
 assert.equal(h.handler.snapshot().advertised,0)
})

test('cleanup restores writer even when modded pack handshake never completes',t=>{
 const h=harness(t)
 h.client.emit('resource_packs_info',{resource_packs:[meta]})
 assert.notEqual(h.client.write,h.write)
 h.handler.cleanup()
 assert.equal(h.client.write,h.write)
})
