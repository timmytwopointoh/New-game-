import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {Readable} from 'node:stream'
import {mkdtempSync,writeFileSync,readFileSync,statSync,existsSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {attachRealmPacks,checkPackStorage,explainPackFailure} from '../src/realm-packs.js'
import {downloadRealmCdn} from '../src/cdn-download.js'
import {packFilePath} from '../src/pack-storage.js'
const data=Buffer.from('long-realm-pack-data')
const hash=x=>crypto.createHash('sha256').update(x).digest('hex')
function harness(downloadCdn,checkStorage){
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-large-packs-'))
 const client=new EventEmitter(),sent=[],events=[]
 client.write=(kind,body)=>sent.push([kind,body])
 const handler=attachRealmPacks(client,dir,stage=>events.push(stage),{downloadCdn,checkStorage})
 return {dir,client,events,sent,handler,clear(){handler.cleanup();rmSync(dir,{recursive:true,force:true})}}
}
const metadata={uuid:'world-textures',version:'1.0.0',size:data.length,cdn_url:'https://cdn.minecraft.net/signed/private/pack'}
async function until(predicate){for(let i=0;i<260;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10))}throw Error('operation timed out')}
test('preflight reports insufficient storage before requesting any pack',t=>{
 const h=harness(async()=>{throw Error('must not download')},()=>{let e=Error('no space');e.code='PACK_STORAGE_LOW';e.storage={freeMB:100,neededMB:200,reserveMB:256};throw e})
 t.after(h.clear)
 h.client.emit('resource_packs_info',{texture_packs:[metadata]})
 assert.equal(h.handler.snapshot().failed,true)
 assert.equal(h.sent.length,0)
 assert.equal(h.events.at(-1).reason,'storage-low')
 assert.equal(h.events.at(-1).freeMB,100)
 assert.equal(h.events.at(-1).retryable,false)
})
test('storage arithmetic reserves headroom and reports reliable required MB',()=>{
 const statfs=()=>({bavail:500,bsize:1024*1024})
 assert.deepEqual(checkPackStorage('/ignored',200*1024*1024,{statfs,reserveBytes:256*1024*1024}),{freeMB:500,neededMB:200,reserveMB:256})
 assert.throws(()=>checkPackStorage('/ignored',300*1024*1024,{statfs,reserveBytes:256*1024*1024}),e=>e.code==='PACK_STORAGE_LOW')
 assert.throws(()=>checkPackStorage('/ignored',0,{statfs:()=>{throw Error('unknown')}}),e=>e.code==='PACK_STORAGE_UNKNOWN')
})
test('interrupted CDN download retries using saved bytes and checks final file',async t=>{
 let attempts=0
 const h=harness(async({dest})=>{
   attempts++
   if(attempts===1){writeFileSync(dest,data.subarray(0,8));const e=Error('connection reset');e.code='ECONNRESET';throw e}
   assert.equal(readFileSync(dest).length,8)
   writeFileSync(dest,data.subarray(8),{flag:'a'})
   return {bytes:data.length,sha256:hash(data),resumed:true}
 })
 t.after(h.clear)
 h.client.emit('resource_packs_info',{texture_packs:[metadata],behavior_packs:[]})
 await until(()=>h.handler.snapshot().verified===1)
 assert.equal(attempts,2)
 assert(h.events.some(e=>e.stage==='pack-retry'))
 assert(h.events.some(e=>e.message.includes('resumed')))
 assert.equal(h.handler.snapshot().failed,false)
 assert.equal(readFileSync(packFilePath(h.dir,'resource',hash('world-textures_1.0.0')+'.mcpack')).toString(),data.toString())
})
test('cancelled session retains CDN partial, never reports all packs received',async t=>{
 let cancel
 const h=harness(async({dest,signal})=>{writeFileSync(dest,data.subarray(0,9));await new Promise(resolve=>{cancel=resolve;signal.addEventListener('abort',resolve,{once:true})});const e=Error('cancel');e.code='PACK_CANCELLED';throw e})
 t.after(h.clear)
 h.client.emit('resource_packs_info',{texture_packs:[metadata]})
 await until(()=>typeof cancel==='function')
 h.client.emit('close')
 await until(()=>existsSync(packFilePath(h.dir,'resource',hash('world-textures_1.0.0')+'.mcpack')+'.download'))
 assert.equal(h.handler.snapshot().verified,0)
 assert(!h.sent.some(([,p])=>p.response_status==='have_all_packs'))
})
test('oversized packs fail with clear limit reason',t=>{
 const h=harness(async()=>{throw Error('must not start')});t.after(h.clear)
 h.client.emit('resource_packs_info',{texture_packs:[{uuid:'large',version:'1.0',size:530*1024*1024}]})
 assert.equal(h.handler.snapshot().failed,true)
 assert.equal(h.events.at(-1).reason,'pack-size-limit')
})
test('failure codes distinguish denied, busy, interrupted, storage and integrity',()=>{
 for(const [code,reason] of [['CDN_HTTP_403','cdn-access-denied'],['CDN_HTTP_503','cdn-unavailable'],['CDN_IDLE_TIMEOUT','network-interrupted'],['ENOSPC','storage-low'],['PACK_INTEGRITY_FAILED','pack-integrity']]){
  assert.equal(explainPackFailure({code}).reason,reason)
 }
 assert(!explainPackFailure({code:'EDQUOT',message:'token=PRIVATE'}).message.includes('PRIVATE'))
})
function fakeHTTPS(status,body,headers={}){
 const calls=[]
 const get=(url,options,onResponse)=>{
  calls.push({url:url.toString(),range:options.headers.Range})
  const request=new EventEmitter();request.setTimeout=()=>{};request.destroy=e=>request.emit('error',e)
  queueMicrotask(()=>{const stream=Readable.from([body]);stream.statusCode=status;stream.headers=headers;onResponse(stream)})
  return request
 }
 return {get,calls}
}
test('HTTPS downloader resumes only with exact matching Content-Range',async t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-cdn-resume-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const dest=path.join(dir,'pack.download');writeFileSync(dest,data.subarray(0,7))
 const mock=fakeHTTPS(206,data.subarray(7),{'content-range':'bytes 7-'+(data.length-1)+'/'+data.length,'content-length':String(data.length-7)})
 const result=await downloadRealmCdn({url:metadata.cdn_url,dest,maxBytes:1024,expectedBytes:data.length,get:mock.get})
 assert.equal(mock.calls[0].range,'bytes=7-');assert.equal(result.resumed,true);assert.equal(result.sha256,hash(data))
 assert.equal(readFileSync(dest).toString(),data.toString())
})
test('HTTP 200 to a Range request safely restarts from byte zero',async t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-cdn-range-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const dest=path.join(dir,'partial');writeFileSync(dest,data.subarray(0,9))
 const mock=fakeHTTPS(200,data,{'content-length':String(data.length)})
 const result=await downloadRealmCdn({url:metadata.cdn_url,dest,maxBytes:1024,expectedBytes:data.length,get:mock.get})
 assert.equal(result.resumed,false);assert.equal(result.sha256,hash(data));assert.equal(readFileSync(dest).length,data.length)
})
test('invalid Content-Range is rejected without altering partial file',async t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-cdn-invalid-range-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const dest=path.join(dir,'partial');writeFileSync(dest,data.subarray(0,5))
 const mock=fakeHTTPS(206,data.subarray(5),{'content-range':'bytes 4-'+(data.length-1)+'/'+data.length,'content-length':String(data.length-5)})
 await assert.rejects(downloadRealmCdn({url:metadata.cdn_url,dest,maxBytes:1024,expectedBytes:data.length,get:mock.get}),e=>e.code==='CDN_RANGE_MISMATCH')
 assert.equal(statSync(dest).size,5)
})
