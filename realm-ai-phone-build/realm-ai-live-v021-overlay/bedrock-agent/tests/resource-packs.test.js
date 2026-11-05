import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'
const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')
preparePackResponseWire({version:'1.26.60'},undefined,{strategy:'original-working'})
import {attachRealmPacks} from '../src/realm-packs.js'
import {packFilePath} from '../src/pack-storage.js'
function harness() {
  const client=new EventEmitter();const sent=[];const seen=[]
  const dir=mkdtempSync(path.join(os.tmpdir(),'vf-resource-packs-'))
  client.options={version:'1.26.60'}
  client.connection={connected:true}
  client.serializer=createSerializer('1.26.60')
  client.deserializer=createDeserializer('1.26.60')
  client.write=(packet,data)=>sent.push([packet,data])
  client.queue=client.write
  client.sendBuffer=(frame)=>{const decoded=client.deserializer.parsePacketBuffer(frame).data;sent.push([decoded.name,decoded.params])}
  const handler=attachRealmPacks(client,dir,item=>seen.push(item))
  return {client,sent,seen,dir,handler,done:()=>{handler.cleanup();rmSync(dir,{recursive:true,force:true})}}
}
const meta=(uuid='abc-def')=>({uuid,version:'1.0.0',size:6})
async function until(check){
 const deadline=Date.now()+4000
 while(!check()){
  if(Date.now()>deadline)throw Error('Pack test did not complete its asynchronous verification')
  await new Promise(resolve=>setTimeout(resolve,15))
 }
}
test('empty packs send have_all_packs, then completed on stack',t=>{
 const h=harness();t.after(h.done);h.client.emit('resource_packs_info',{texture_packs:[],must_accept:false})
 assert.equal(h.sent[0][1].response_status,'have_all_packs')
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.sent[1][1].response_status,'completed');assert.equal(h.handler.snapshot().finished,true)
})
test('required pack is downloaded, SHA verified, stored, and handshake completed',async t=>{
 const h=harness();t.after(h.done);const data=Buffer.from('foobar');const hash=crypto.createHash('sha256').update(data).digest()
 h.client.emit('resource_packs_info',{texture_packs:[meta()],must_accept:true})
 assert.deepEqual(h.sent[0][1].resourcepackids,['abc-def_1.0.0'])
 h.client.emit('resource_pack_data_info',{pack_id:'abc-def',max_chunk_size:3,chunk_count:2,size:6,hash})
 assert.deepEqual(h.sent[1],[ 'resource_pack_chunk_request',{pack_id:'abc-def',chunk_index:0}])
 h.client.emit('resource_pack_chunk_data',{pack_id:'abc-def',chunk_index:0,progress:0n,payload:data.subarray(0,3)})
 h.client.emit('resource_pack_chunk_data',{pack_id:'abc-def',chunk_index:1,progress:3n,payload:data.subarray(3)})
 await until(()=>h.sent.some(([,d])=>d?.response_status==='have_all_packs'))
 assert.equal(h.sent.filter(([,d])=>d?.response_status==='have_all_packs').length,1)
 h.client.emit('resource_pack_stack',{resource_packs:[meta()]})
 await until(()=>h.handler.snapshot().finished)
 assert.equal(h.sent.filter(([,d])=>d?.response_status==='completed').length,1)
 assert.equal(h.handler.snapshot().finished,true)
 assert.equal(readFileSync(packFilePath(h.dir,'resource',crypto.createHash('sha256').update('abc-def_1.0.0').digest('hex')+'.mcpack')).toString(),'foobar')
})
test('bad pack hash fails closed and does not send ready',async t=>{
 const h=harness();t.after(h.done)
 h.client.emit('resource_packs_info',{texture_packs:[meta()]})
 h.client.emit('resource_pack_data_info',{pack_id:'abc-def',max_chunk_size:6,chunk_count:1,size:6,hash:Buffer.alloc(32)})
 h.client.emit('resource_pack_chunk_data',{pack_id:'abc-def',chunk_index:0,progress:0,payload:Buffer.from('foobar')})
 await until(()=>h.handler.snapshot().failed)
 assert.equal(h.sent.some(([,d])=>d?.response_status==='have_all_packs'),false)
})
test('too many Realm packs fail without requesting downloads',t=>{
 const h=harness();t.after(h.done)
 h.client.emit('resource_packs_info',{texture_packs:Array.from({length:65},(_,i)=>meta('p'+i))})
 assert.equal(h.handler.snapshot().failed,true)
 assert.equal(h.sent.length,0)
})
test('oversized Realm pack rejected',t=>{
 const h=harness();t.after(h.done)
 h.client.emit('resource_packs_info',{texture_packs:[{uuid:'a',version:'1.0.0',size:1000000000}]})
 assert.equal(h.handler.snapshot().failed,true)
})
test('unmarked server-advertised texture is requested instead of silently skipped',t=>{
 const h=harness();t.after(h.done);h.client.emit('resource_packs_info',{texture_packs:[meta('optional')],must_accept:false})
 assert.equal(h.sent[0][1].response_status,'send_packs')
 assert.equal(h.handler.snapshot().requested,1)
 assert.equal(h.handler.snapshot().skippedOptional,0)
 h.client.emit('resource_pack_stack',{resource_packs:[meta('optional')]})
 assert.equal(h.handler.snapshot().finished,false)
})
test('addon dependencies are retained and an early stack waits for their completed download',t=>{
 const h=harness();t.after(h.done);h.client.emit('resource_packs_info',{texture_packs:[meta('cosmetic'),{...meta('needed'),addon_pack:true}],must_accept:false})
 assert.deepEqual(h.sent[0][1].resourcepackids,['cosmetic_1.0.0','needed_1.0.0']);assert.equal(h.handler.snapshot().skippedOptional,0)
 h.client.emit('resource_pack_stack',{resource_packs:[meta('needed')]});assert.equal(h.handler.snapshot().finished,false)
})
test('more than sixteen required packs are supported within the total byte limit',t=>{
 const h=harness();t.after(h.done);h.client.emit('resource_packs_info',{texture_packs:Array.from({length:20},(_,i)=>meta('pack'+i)),must_accept:true})
 assert.equal(h.handler.snapshot().failed,false);assert.equal(h.handler.snapshot().requested,20)
})
