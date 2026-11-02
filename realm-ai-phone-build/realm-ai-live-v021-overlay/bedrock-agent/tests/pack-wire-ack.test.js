import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {attachRealmPacks} from '../src/realm-packs.js'
const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')
const serializer=createSerializer('1.26.60')
const deserializer=createDeserializer('1.26.60')
function harness({packs}={}){
 const client=new EventEmitter(),writes=[],queued=[],stages=[]
 client.write=(name,packet)=>writes.push({name,packet})
 client.queue=(name,packet)=>queued.push({name,packet})
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-pack-ack-wire-'))
 const packsHandler=attachRealmPacks(client,dir,state=>stages.push(state),{
   checkStorage:()=>({freeMB:11000,neededMB:120,reserveMB:256})
 })
 return {client,writes,queued,stages,packsHandler,begin(){
    client.emit('resource_packs_info',{must_accept:true,
      texture_packs:packs??[{uuid:'aabbccdd-1234-4567-89ab-aabbccddeeff',version:'1.0.0',size:120*1024*1024,cdn_url:''}]})
    // Simulates the library callback installed *before* our handler.
    client.queue('client_cache_status',{enabled:false})
 },close(){packsHandler.cleanup();rmSync(dir,{recursive:true,force:true})}}
}
test('cache is sent immediately before Downloading and never queued a duplicate',t=>{
 const h=harness();t.after(()=>h.close());h.begin()
 assert.deepEqual(h.writes.map(x=>x.name),['client_cache_status','resource_pack_client_response'])
 assert.equal(h.queued.length,0)
 assert.equal(h.writes[0].packet.enabled,false)
 assert.equal(h.writes[1].packet.response_status,'send_packs')
 assert.equal(h.writes[1].packet.response_status_name,'Downloading')
 assert.deepEqual(h.writes[1].packet.resourcepackids,['aabbccdd-1234-4567-89ab-aabbccddeeff_1.0.0'])
 assert.equal(h.stages.at(-1).cacheStatusIssued,true)
 assert.equal(h.stages.at(-1).downloadRequestIssued,true)
 assert.equal(h.stages.at(-1).packResponseCount,1)
})
test('real Bedrock 1.26.60 serializer encodes Downloading response variant, string and pack IDs',()=>{
 const src={response_status:'send_packs',response_status_name:'Downloading',
  resourcepackids:['aabbccdd-1234-4567-89ab-aabbccddeeff_1.0.0']}
 const encoded=serializer.createPacketBuffer({name:'resource_pack_client_response',params:src})
 // 8 is pack response packet ID; following 1 is the Downloading variant selector.
 assert.equal(encoded[0]&0x7f,8)
 assert.equal(encoded[1],1)
 assert.equal(encoded[2],11)
 assert.equal(encoded.subarray(3,14).toString('utf8'),'Downloading')
 const decoded=deserializer.parsePacketBuffer(encoded)
 assert.equal(decoded.data.name,'resource_pack_client_response')
 assert.equal(decoded.data.params.response_status,'send_packs')
 assert.equal(decoded.data.params.response_status_name,'Downloading')
 assert.deepEqual(decoded.data.params.resourcepackids,src.resourcepackids)
})
test('empty required-pack world issues both immediate finish signals in order',t=>{
 const h=harness({packs:[]});t.after(()=>h.close());h.begin()
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 const codes=h.writes.filter(x=>x.name==='resource_pack_client_response').map(x=>x.packet.response_status_name)
 assert.deepEqual(codes,['DownloadingFinished','ResourcePackStackFinished'])
 assert.equal(h.queued.length,0)
 assert.equal(h.packsHandler.snapshot().finished,true)
})
test('pre-flight storage error never sends Downloading or falsely signals join',t=>{
 const h=harness();t.after(()=>h.close())
 // A bad size triggers pre-flight rejection before any Downloading ACK.
 h.client.emit('resource_packs_info',{must_accept:true,texture_packs:[{uuid:'big',version:'1.0.0',size:900*1024*1024}]})
 assert.equal(h.packsHandler.snapshot().failed,true)
 assert.equal(h.writes.filter(x=>x.packet?.response_status==='send_packs').length,0)
})
