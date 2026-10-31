import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {attachRealmPacks} from '../src/realm-packs.js'
import {checkCdnUrl} from '../src/cdn-download.js'
function setup(downloadCdn,shared){
 const client=new EventEmitter(),sent=[],stages=[]
 const dir=shared||mkdtempSync(path.join(os.tmpdir(),'vf-cdn-test-'))
 client.write=(name,packet)=>sent.push([name,packet])
 const h=attachRealmPacks(client,dir,s=>stages.push(s),{downloadCdn})
 return {client,sent,stages,dir,h,clear(){h.cleanup();if(!shared)rmSync(dir,{force:true,recursive:true})}}
}
const archive=Buffer.from('PK\x03\x04zip')
const meta={uuid:'abc123',version:'1.0.0',size:7,cdn_url:'https://cdn.minecraft.net/pack?signature=private'}
const tick=async test=>{for(let n=0;n<90;n++){if(test())return;await new Promise(r=>setTimeout(r,4))}throw Error('CDN operation timed out')}
test('CDN pack downloads and completes handshake only after download',async t=>{
 const h=setup(async ({url,dest,expectedBytes,maxBytes})=>{
  assert.equal(new URL(url).hostname,'cdn.minecraft.net');assert(expectedBytes<maxBytes)
  writeFileSync(dest,archive)
  return {bytes:7,sha256:crypto.createHash('sha256').update(archive).digest('hex')}
 });t.after(()=>h.clear())
 h.client.emit('resource_packs_info',{texture_packs:[meta]})
 assert.equal(h.sent[0][1].response_status_name,'Downloading')
 await tick(()=>h.h.snapshot().verified===1)
 h.client.emit('resource_pack_stack',{resource_packs:[meta]})
 await tick(()=>h.h.snapshot().finished)
 assert.equal(h.sent.at(-1)[1].response_status_name,'ResourcePackStackFinished')
 assert.equal(h.h.snapshot().failed,false)
})
test('CDN packs cached privately, second join does not re-download',async t=>{
 const h=setup(async({dest})=>{writeFileSync(dest,archive);return {bytes:7,sha256:crypto.createHash('sha256').update(archive).digest('hex')}})
 t.after(()=>h.clear());h.client.emit('resource_packs_info',{texture_packs:[meta]});await tick(()=>h.h.snapshot().verified===1)
 const g=setup(async()=>{throw Error('Should use private cache')},h.dir);t.after(()=>g.h.cleanup())
 g.client.emit('resource_packs_info',{texture_packs:[meta]});await tick(()=>g.h.snapshot().verified===1)
})
test('CDN failure does not send false have_all_packs',async t=>{
 const h=setup(async()=>{throw Error('Unreachable CDN')});t.after(()=>h.clear())
 h.client.emit('resource_packs_info',{texture_packs:[meta]})
 await tick(()=>h.h.snapshot().failed)
 assert(!h.sent.some(([name,packet])=>packet.response_status==='have_all_packs'))
})
test('reject non-HTTPS, loopback, credentials and local hosts',()=>{
 for(const url of ['http://example.com/p','https://127.0.0.1/p','https://localhost/p','https://cdn.local/p','https://u:p@example.com/p','file:///tmp/e'])assert.throws(()=>checkCdnUrl(url))
 assert.equal(checkCdnUrl(meta.cdn_url).protocol,'https:')
})
