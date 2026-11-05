import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync,existsSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {attachRealmPacks} from '../src/realm-packs.js'
const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')
function make(){
 const c=new EventEmitter(),sent=[],writes=[]
 c.options={version:'1.26.60'}
 c.connection={connected:true}
 c.serializer=createSerializer('1.26.60')
 c.deserializer=createDeserializer('1.26.60')
 c.queue=(name,packet)=>writes.push({name,packet,queued:true})
 c.write=(name,packet)=>writes.push({name,packet})
 c.sendBuffer=(frame,urgent)=>sent.push({frame,urgent})
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-headless-packs-'))
 const reports=[]
 const h=attachRealmPacks(c,path.join(dir,'cache'),x=>reports.push(x),{
  handshakeMode:'original-working',headlessPackProbe:true,heartbeatMs:50,now:()=>Date.now(),
  checkStorage:()=>({freeMB:50000,neededMB:0,reserveMB:256})
 })
 return {c,h,dir,reports,sent,writes,cleanup(){h.cleanup();rmSync(dir,{recursive:true,force:true})}}
}
test('headless modded Realm asks for stack, never downloads graphical archives, completes only on server response',t=>{
 const x=make();t.after(x.cleanup)
 x.c.emit('resource_packs_info',{texture_packs:[
  {uuid:'one',version:'1.0.0',size:100}, {uuid:'two',version:'1.0.0',size:100}
 ]})
 assert.equal(x.h.snapshot().headlessProbeSent,true)
 assert.equal(x.h.snapshot().headlessProbeAccepted,false)
 assert.equal(x.h.snapshot().finished,false)
 assert.equal(x.sent.length,1)
 const first=x.c.deserializer.parsePacketBuffer(x.sent[0].frame).data
 assert.equal(first.params.response_status,'have_all_packs')
 assert.equal(first.params.response_status_name,'DownloadingFinished')
 assert.equal(x.writes.filter(x=>x.name==='resource_pack_chunk_request').length,0)
 assert.equal(existsSync(path.join(x.dir,'cache')),false,'No fake cached/verified files')
 x.c.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(x.h.snapshot().headlessProbeAccepted,true)
 assert.equal(x.h.snapshot().finished,true)
 assert.equal(x.sent.length,2)
 const last=x.c.deserializer.parsePacketBuffer(x.sent[1].frame).data
 assert.equal(last.params.response_status,'completed')
 assert.equal(last.params.response_status_name,'ResourcePackStackFinished')
 assert.equal(x.reports.at(-1).stage,'packs-ready')
})
test('headless option leaves no-pack Realm exactly on original direct response path',t=>{
 const x=make();t.after(x.cleanup)
 x.c.emit('resource_packs_info',{texture_packs:[]})
 assert.equal(x.sent.length,0)
 assert.equal(x.writes.filter(x=>x.name==='resource_pack_client_response').length,1)
 assert.equal(x.writes.find(x=>x.name==='resource_pack_client_response').packet.response_status,'have_all_packs')
 assert.equal(x.h.snapshot().headlessProbeSent,false)
})
