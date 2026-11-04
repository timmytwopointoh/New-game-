import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {JoinLoadingLiveness,JOIN_LOADING_GRACE_MS} from '../src/join-loading-liveness.js'
import {attachRealmPacks} from '../src/realm-packs.js'

test('slow Bedrock loading remains active well beyond 0.6 seconds with no traffic',()=>{
 let now=1000
 const observer=new JoinLoadingLiveness({now:()=>now})
 observer.setStage('pack-request')
 now+=15000
 assert.equal(observer.stalled(),false)
 assert.equal(observer.snapshot().loadingNoProgressSeconds,15)
 now+=JOIN_LOADING_GRACE_MS-16000
 assert.equal(observer.stalled(),false)
 now+=1001
 assert.equal(observer.stalled(),true)
})

test('connected-but-idle pack transfer emits honest wait notices without disconnecting',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vf-slow-realm-'))
 const client=new EventEmitter(),sent=[],events=[]
 let now=1000
 client._closed=false
 client.connection={connected:true}
 client.write=(name,data)=>sent.push({name,data})
 client.queue=client.write
 const handler=attachRealmPacks(client,dir,event=>events.push(event),{
   handshakeMode:'native-queue',noPackGraceMs:0,heartbeatMs:5,now:()=>now,
   serverPackIdleMs:17*60*1000,
   checkStorage:()=>({freeMB:24000,neededMB:1,reserveMB:256})
 })
 t.after(()=>{handler.cleanup();fs.rmSync(dir,{force:true,recursive:true})})
 client.emit('resource_packs_info',{texture_packs:[{uuid:'abc123',version:'1.0.0',size:1024}]})
 assert.equal(events.at(-1).stage,'pack-request')
 assert.equal(sent.filter(p=>p.name==='resource_pack_client_response').length,1)
 now=12000
 await new Promise(resolve=>setTimeout(resolve,30))
 const wait=events.find(e=>e.waitingForServer===true)
 assert.ok(wait,'Expected visible wait status for live connection')
 assert.ok(wait.serverWaitSeconds>=10)
 assert.match(wait.message,/Still connected, waiting/)
 assert.equal(client._closed,false)
 assert.equal(sent.filter(p=>p.name==='resource_pack_client_response').length,1,
   'Quiet periods must not repeat the download request')
 assert.equal(handler.snapshot().failed,false)
})

test('transport already closed must not continue emitting connected wait status',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vf-close-realm-'))
 const c=new EventEmitter(),events=[]
 let now=1000
 c.connection={connected:true};c._closed=false
 c.write=()=>{};c.queue=()=>{}
 const h=attachRealmPacks(c,dir,v=>events.push(v),{handshakeMode:'native-queue',heartbeatMs:5,now:()=>now,
   checkStorage:()=>({freeMB:10000,neededMB:1,reserveMB:256})})
 t.after(()=>{h.cleanup();fs.rmSync(dir,{recursive:true,force:true})})
 c.emit('resource_packs_info',{texture_packs:[{uuid:'abc123',version:'1.0.0',size:1024}]})
 c._closed=true;now=12000
 await new Promise(resolve=>setTimeout(resolve,30))
 assert.equal(events.some(e=>e.waitingForServer===true),false)
})
