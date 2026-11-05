import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import {mkdtempSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import {attachRealmPacks} from '../src/realm-packs.js'

const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')

function harness(){
 const c=new EventEmitter(),writes=[],sends=[]
 const originalWrite=function(name,params){writes.push({name,params})}
 const originalQueue=function(name,params){writes.push({name,params,queued:true})}
 c.write=originalWrite;c.queue=originalQueue
 c.options={version:'1.26.60'}
 c.serializer=createSerializer('1.26.60')
 c.deserializer=createDeserializer('1.26.60')
 c.connection={connected:true}
 c.sendBuffer=(bytes,flush)=>sends.push({bytes,flush})
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-v0423-packs-'))
 const handler=attachRealmPacks(c,dir,()=>{},{
  handshakeMode:'original-working',noPackGraceMs:0,
  checkStorage:()=>({freeMB:23000,neededMB:1,reserveMB:256})
 })
 // Exactly the premature behavior in the frozen bedrock-protocol createClient.
 // The library attaches these callbacks AFTER attachRealmPacks, on connect_allowed.
 const automaticComplete=()=>c.write('resource_pack_client_response',{
  response_status:'completed',response_status_name:'resourcepackstackfinished',resourcepackids:[]
 })
 c.once('resource_packs_info',()=>{
  automaticComplete()
  c.once('resource_pack_stack',automaticComplete)
  c.queue('client_cache_status',{enabled:false})
 })
 return {c,writes,sends,handler,originalWrite,originalQueue,
  cleanup(){handler.cleanup();rmSync(dir,{recursive:true,force:true})}}
}
function packInfo(){
 return {texture_packs:[{uuid:'realmPack',version:'1.0.0',size:6,cdn_url:''}]}
}
test('native immediate Completed is blocked on modded Realm while its eight-pack downloader remains active',async t=>{
 const h=harness();t.after(()=>h.cleanup())
 h.c.emit('resource_packs_info',packInfo())
 assert.equal(h.sends.length,1,'only Downloading is sent at initial pack announcement')
 assert.equal(h.sends[0].flush,true)
 assert.equal(h.writes.filter(x=>x.name==='resource_pack_client_response').length,0,
  'library must NOT send Completed before downloading')
 assert.equal(h.handler.snapshot().suppressedNativePackCompletions,1)
 assert.equal(h.handler.snapshot().finished,false)
 h.c.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.handler.snapshot().suppressedNativePackCompletions,2)
 assert.equal(h.sends.length,1,'native stack must not complete prematurely')
 const bytes=Buffer.from('foobar')
 h.c.emit('resource_pack_data_info',{
  pack_id:'realmPack',max_chunk_size:6,chunk_count:1,size:6,
  hash:crypto.createHash('sha256').update(bytes).digest()
 })
 h.c.emit('resource_pack_chunk_data',{pack_id:'realmPack',chunk_index:0,progress:0,payload:bytes})
 await new Promise((resolve,reject)=>{
  const deadline=Date.now()+4000
  const poll=()=>h.handler.snapshot().finished?resolve():
   Date.now()>deadline?reject(Error('Pack hash verification incomplete')):setTimeout(poll,15)
  poll()
 })
 assert.equal(h.handler.snapshot().finished,true)
 assert.equal(h.sends.length,3,'Downloading, DownloadingFinished, ResourcePackStackFinished')
 assert.deepEqual(h.sends.map(x=>x.bytes[1]),[1,2,3])
 assert.equal(h.writes.filter(x=>x.name==='resource_pack_client_response').length,0)
 h.handler.cleanup()
 assert.equal(h.c.write,h.originalWrite,'write interceptor restored on cleanup')
 assert.equal(h.c.queue,h.originalQueue,'queue interceptor restored on cleanup')
})
test('original unmodded Realm path stays identical, including native automatic complete',t=>{
 const h=harness();t.after(()=>h.cleanup())
 h.c.emit('resource_packs_info',{texture_packs:[]})
 assert.equal(h.c.write,h.originalWrite,'unmodded must never install interception')
 assert.equal(h.sends.length,0)
 assert.deepEqual(h.writes.filter(x=>x.name==='resource_pack_client_response').map(x=>x.params.response_status),
  ['have_all_packs','completed'])
 assert.equal(h.handler.snapshot().suppressedNativePackCompletions,0)
 h.c.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.writes.filter(x=>x.name==='resource_pack_client_response').length,4)
})
