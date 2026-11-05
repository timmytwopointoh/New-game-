import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'
import {attachRealmPacks} from '../src/realm-packs.js'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'

const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')
preparePackResponseWire({version:'1.26.60'},undefined,{strategy:'original-working'})
function harness(t){
 const c=new EventEmitter(),writes=[],frames=[]
 const originalQueue=function(name,packet){writes.push({name,packet,queued:true})}
 const originalWrite=function(name,packet){writes.push({name,packet})}
 c.queue=originalQueue;c.write=originalWrite
 c.sendBuffer=(buf,immediate)=>frames.push({buf,immediate})
 c.serializer=createSerializer('1.26.60')
 c.deserializer=createDeserializer('1.26.60')
 c.options={version:'1.26.60',transport:'nethernet'}
 c.connection={connected:true}
 const dir=mkdtempSync(path.join(tmpdir(),'vf-0431-gophertunnel-'))
 const reports=[]
 const handler=attachRealmPacks(c,dir,r=>reports.push(r),{
  handshakeMode:'original-working',noPackGraceMs:0,heartbeatMs:50,
  checkStorage:()=>({freeMB:24000,neededMB:1,reserveMB:256})
 })
 t.after(()=>{handler.cleanup();rmSync(dir,{recursive:true,force:true})})
 return {c,writes,frames,handler,reports,originalQueue,originalWrite}
}
const id='f0e1d2c3-a4b5-46c7-89ab-000000000005'
const version='1.0.0'
const info={texture_packs:[{uuid:id,version,size:25,cdn_url:''}]}
const statusWrites=x=>x.writes.filter(v=>v.name==='client_cache_status')
async function verified(handler){
 const deadline=Date.now()+4000
 while(handler.snapshot().verified<1){
  if(Date.now()>deadline)throw Error('Timeout verifying complete file')
  await new Promise(r=>setTimeout(r,15))
 }
}
test('Gophertunnel timing: cache status on login success before the first pack-info message; no duplicate later',async t=>{
 const h=harness(t)
 h.c.emit('play_status',{status:'login_success'})
 assert.equal(statusWrites(h).length,1)
 assert.deepEqual(h.writes[0].packet,{enabled:false})
 h.c.emit('resource_packs_info',info)
 assert.equal(h.frames.length,1)
 assert.equal(h.frames[0].buf[1],1)
 h.c.queue('client_cache_status',{enabled:false}) // upstream's delayed duplicate
 assert.equal(statusWrites(h).length,1,'native post-info cache packet must be suppressed')
 assert.equal(h.reports.some(r=>r.cacheStatusIssued===true),true)
 const payload=Buffer.from('gophertunnel-fixture-data')
 assert.equal(payload.length,25)
 const completeId=id+'_'+version
 h.c.emit('resource_pack_data_info',{
  pack_id:completeId,max_chunk_size:9,chunk_count:0,size:25,
  hash:crypto.createHash('sha256').update(payload).digest(),pack_type:6
 })
 const requests=h.writes.filter(x=>x.name==='resource_pack_chunk_request')
 assert.deepEqual(requests.map(x=>x.packet.chunk_index),[0,1,2])
 assert.ok(requests.every(x=>x.packet.pack_id===completeId),'must echo server UUID_version')
 for(const index of [2,0,1]){
  const offset=index*9
  h.c.emit('resource_pack_chunk_data',{pack_id:completeId,chunk_index:index,
   progress:offset,payload:payload.subarray(offset,offset+9)})
 }
 await verified(h.handler)
 h.c.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.handler.snapshot().finished,true)
 assert.deepEqual(h.frames.map(x=>x.buf[1]),[1,2,3])
 assert.equal(statusWrites(h).length,1,'no cache status after finished download')
})
test('early login-success cache announcement does not alter unmodded native response flow',t=>{
 const h=harness(t)
 h.c.emit('play_status',{status:'login_success'})
 h.c.emit('resource_packs_info',{texture_packs:[]})
 assert.equal(h.frames.length,0)
 assert.equal(h.writes.filter(x=>x.name==='resource_pack_client_response').length,1)
 h.c.queue('client_cache_status',{enabled:false})
 assert.equal(statusWrites(h).length,1)
 assert.equal(h.c.queue,h.originalQueue,'restore original queue after suppressing one duplicate')
 h.c.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.handler.snapshot().finished,true)
 assert.deepEqual(h.writes.filter(x=>x.name==='resource_pack_client_response').map(x=>x.packet.response_status),
   ['have_all_packs','completed'])
})
test('ignores login status other than success and never confuses different pack versions',t=>{
 const h=harness(t)
 h.c.emit('play_status',{status:'player_spawn'})
 assert.equal(statusWrites(h).length,0)
 h.c.emit('resource_packs_info',info)
 h.c.emit('resource_pack_data_info',{pack_id:id+'_9.9.9',max_chunk_size:9,chunk_count:3,size:25,hash:Buffer.alloc(32)})
 assert.equal(h.handler.snapshot().failed,true,'unadvertised pack version cannot enter cache')
})
