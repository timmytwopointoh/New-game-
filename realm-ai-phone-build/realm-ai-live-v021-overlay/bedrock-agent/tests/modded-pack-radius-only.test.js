import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'
import {attachRealmPacks} from '../src/realm-packs.js'
const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')
preparePackResponseWire({version:'1.26.60'},undefined,{strategy:'original-working'})

function setup(){
 const client=new EventEmitter(),writes=[],queues=[],frames=[],stages=[]
 client.options={version:'1.26.60'}
 client.connection={connected:true}
 client.serializer=createSerializer('1.26.60')
 client.deserializer=createDeserializer('1.26.60')
 client.write=(name,p)=>writes.push({name,p})
 client.queue=(name,p)=>queues.push({name,p})
 client.sendBuffer=(frame,immediate)=>frames.push({frame,immediate})
 const queue=client.queue,write=client.write
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'modded-radius-only-'))
 const handler=attachRealmPacks(client,directory,s=>stages.push(s),{
  handshakeMode:'original-working',
  checkStorage:()=>({freeMB:16000,neededMB:1,reserveMB:256}),
  noPackGraceMs:0
 })
 return {client,writes,queues,frames,stages,handler,queue,write,
   close(){handler.cleanup();fs.rmSync(directory,{recursive:true,force:true})}}
}
function pack(id='mod-one'){return {uuid:id,version:'1.0.0',size:6}}
function download(h,id='mod-one'){
 const bytes=Buffer.from('foobar')
 const hash=crypto.createHash('sha256').update(bytes).digest()
 h.client.emit('resource_pack_data_info',{pack_id:id,max_chunk_size:6,chunk_count:1,size:6,hash})
 h.client.emit('resource_pack_chunk_data',{pack_id:id,chunk_index:0,progress:0,payload:bytes})
}

test('no-mod world keeps the identical native queue function and forwards radius immediately',t=>{
 const h=setup();t.after(h.close)
 h.client.emit('resource_packs_info',{texture_packs:[]})
 assert.equal(h.client.queue,h.queue)
 h.client.queue('client_cache_status',{enabled:false})
 h.client.queue('request_chunk_radius',{chunk_radius:12})
 assert.deepEqual(h.queues.map(x=>x.name),['client_cache_status','request_chunk_radius'])
 assert.equal(h.handler.snapshot().radiusDeferred,0)
 assert.equal(h.frames.length,0,'no-mod handshake must not use modded packet writer')
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.handler.snapshot().finished,true)
})

test('modded world leaves cache queue native but holds premature terrain request until stack + start_game',t=>{
 const h=setup();t.after(h.close)
 h.client.emit('resource_packs_info',{texture_packs:[pack()]})
 assert.notEqual(h.client.queue,h.queue,'modded realm alone installs the radius gate')
 h.client.queue('client_cache_status',{enabled:false})
 h.client.queue('request_chunk_radius',{chunk_radius:12})
 assert.deepEqual(h.queues.map(x=>x.name),[],'early modded cache and terrain requests suppressed')
 assert.deepEqual(h.writes.map(x=>x.name),[],'no modded cache status before pack transfer')
 assert.equal(h.handler.snapshot().radiusDeferred,1)
 assert.equal(h.frames.length,1,'modded Downloading packet is still sent')
 assert.equal(h.frames[0].frame[1],1,'Bedrock 1.26.60 Downloading alternative tag is 1')
 download(h)
 assert.equal(h.handler.snapshot().finished,false)
 assert.equal(h.queues.some(x=>x.name==='request_chunk_radius'),false)
 h.client.emit('resource_pack_stack',{resource_packs:[pack()]})
 assert.equal(h.handler.snapshot().finished,true)
 assert.equal(h.queues.some(x=>x.name==='request_chunk_radius'),false)
 h.client.emit('start_game',{})
 assert.deepEqual(h.queues.map(x=>x.name),['client_cache_status','request_chunk_radius'])
 assert.equal(h.queues[1].p.chunk_radius,12)
 h.handler.cleanup()
 assert.equal(h.client.queue,h.queue,'pack guard must clean up without damaging original queue')
 assert.equal(h.client.write,h.write)
})

test('modded early start_game does not free radius until server pack stack completes',t=>{
 const h=setup();t.after(h.close)
 h.client.emit('resource_packs_info',{texture_packs:[pack()]})
 h.client.queue('request_chunk_radius',{chunk_radius:10})
 h.client.emit('start_game',{})
 assert.equal(h.queues.length,0)
 download(h)
 assert.equal(h.queues.length,0)
 h.client.emit('resource_pack_stack',{resource_packs:[pack()]})
 assert.equal(h.handler.snapshot().finished,true)
 assert.deepEqual(h.queues.map(x=>x.name),['client_cache_status','request_chunk_radius'])
 assert.equal(h.handler.snapshot().radiusDeferred,1)
})
