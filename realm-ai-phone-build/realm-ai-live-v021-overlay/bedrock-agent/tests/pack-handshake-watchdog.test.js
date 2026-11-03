import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {attachRealmPacks,explainPackFailure} from '../src/realm-packs.js'
import {sanitizeDiagnosticReport} from '../src/diagnostic-store.js'

const meta=(id='pack1',cdn='')=>({uuid:id,version:'1.0.0',size:6,cdn_url:cdn})
function harness({cdn=false,idle=45}={}){
 const client=new EventEmitter(),packets=[],updates=[]
 const folder=mkdtempSync(path.join(os.tmpdir(),'vf-handshake-regression-'))
 let clock=1000
 client.write=(name,data)=>packets.push({name,data})
 const options={
   serverPackIdleMs:idle,heartbeatMs:10,now:()=>clock,
   checkStorage:()=>({freeMB:2000,neededMB:1,reserveMB:256}),
   downloadCdn:()=>new Promise(()=>{})
 }
 const handler=attachRealmPacks(client,folder,x=>updates.push(x),options)
 return {
   client,packets,updates,handler,
   begin(){client.emit('resource_packs_info',{must_accept:true,texture_packs:[meta('testpack',cdn?'https://public.minecraft.example/packs/a':'')]})},
   advance(ms){clock+=ms},
   close(){handler.cleanup();rmSync(folder,{recursive:true,force:true})}
 }
}
const nap=ms=>new Promise(r=>setTimeout(r,ms))
const wait=async(fn)=>{for(let i=0;i<40;i++){if(fn())return;await nap(12)}throw Error('test timed out')}
test('modern Bedrock Downloading response includes canonical text and exact pack ID, sent only once',t=>{
 const h=harness();t.after(()=>h.close());h.begin()
 const response=h.packets.filter(p=>p.name==='resource_pack_client_response')
 assert.equal(response.length,1)
 assert.equal(response[0].data.response_status,'send_packs')
 assert.equal(response[0].data.response_status_name,'Downloading')
 assert.deepEqual(response[0].data.resourcepackids,['testpack_1.0.0'])
 h.client.emit('resource_packs_info',{texture_packs:[meta('repeat')]})
 assert.equal(h.packets.filter(p=>p.name==='resource_pack_client_response').length,1)
})
test('empty-world pack handshake sends canonical completion strings, no watchdog failure',async t=>{
 const h=harness();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:true,texture_packs:[]})
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 const res=h.packets.filter(p=>p.name==='resource_pack_client_response').map(p=>p.data)
 assert.equal(res[0].response_status_name,'DownloadingFinished')
 assert.equal(res[1].response_status_name,'ResourcePackStackFinished')
 h.advance(120000);await nap(35)
 assert.equal(h.updates.some(x=>x.stage==='pack-error'),false)
})
test('simulated 45ms server-idle stall is detected without misidentifying storage',async t=>{
 const h=harness();t.after(()=>h.close());h.begin();h.advance(70)
 await wait(()=>h.updates.some(x=>x.stage==='pack-error'))
 const error=h.updates.at(-1)
 assert.equal(error.reason,'server-no-pack-data')
 assert.equal(error.retryable,true)
 assert.match(error.message,/no resource-pack headers/)
 assert.equal(h.handler.snapshot().failed,true)
 assert.equal(h.packets.some(p=>p.data?.response_status==='have_all_packs'),false)
})
test('a header arrives but no chunks: classified as incomplete server stream',async t=>{
 const h=harness();t.after(()=>h.close());h.begin()
 h.client.emit('resource_pack_data_info',{pack_id:'testpack',max_chunk_size:3,chunk_count:2,size:6,hash:Buffer.alloc(32)})
 assert.equal(h.packets.some(p=>p.name==='resource_pack_chunk_request'),true)
 h.advance(80);await wait(()=>h.updates.some(x=>x.stage==='pack-error'))
 assert.equal(h.updates.at(-1).reason,'server-pack-stalled')
 assert.equal(h.handler.snapshot().verified,0)
})
test('progressing server chunks reset the watchdog, never time out active transfer',async t=>{
 const h=harness({idle:70});t.after(()=>h.close());h.begin()
 h.client.emit('resource_pack_data_info',{pack_id:'testpack',max_chunk_size:3,chunk_count:2,size:6,hash:Buffer.alloc(32)})
 h.advance(50)
 h.client.emit('resource_pack_chunk_data',{pack_id:'testpack',chunk_index:0,progress:0,payload:Buffer.from('foo')})
 h.advance(50);await nap(35)
 assert.equal(h.handler.snapshot().failed,false)
 assert.equal(h.packets.filter(x=>x.name==='resource_pack_chunk_request').length,2)
})
test('CDN transfer never falsely flagged as missing server-streamed packets',async t=>{
 const h=harness({cdn:true});t.after(()=>h.close());h.begin()
 h.advance(500000);await nap(35)
 assert.equal(h.handler.snapshot().failed,false)
 assert.equal(h.updates.some(x=>x.reason==='server-no-pack-data'),false)
})
test('sanitized reports preserve only the classified failure code, no raw strings',()=>{
 for(const [code,reason] of [['PACK_NO_SERVER_DATA','server-no-pack-data'],['PACK_SERVER_STALLED','server-pack-stalled']]){
  assert.equal(explainPackFailure({code}).reason,reason)
  const report=sanitizeDiagnosticReport({packReason:reason,phase:'pack-request',secret:'PRIVATE',token:'DO-NOT-LEAK'})
  assert.equal(report.packReason,reason)
  assert.equal(report.secret,undefined)
  assert.equal(report.token,undefined)
 }
})
