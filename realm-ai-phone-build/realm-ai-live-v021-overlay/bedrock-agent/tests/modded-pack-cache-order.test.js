import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {attachRealmPacks} from '../src/realm-packs.js'

function varuint(n){const a=[];do{let b=n&0x7f;n>>=7;if(n)b|=0x80;a.push(b)}while(n);return Buffer.from(a)}
function encode(name,params){
 assert.equal(name,'resource_pack_client_response')
 const types={refused:0,send_packs:1,have_all_packs:2,completed:3}
 const status=types[params.response_status],responseName=Buffer.from(params.response_status_name)
 const out=[varuint(8),varuint(status),varuint(responseName.length),responseName]
 if(status===1){const ids=params.resourcepackids;out.push(varuint(ids.length));for(const id of ids){const v=Buffer.from(id);out.push(varuint(v.length),v)}}
 return Buffer.concat(out)
}
function setup(){
 const c=new EventEmitter(),events=[]
 c.options={version:'1.26.60'};c.connection={connected:true}
 c.serializer={createPacketBuffer:({name,params})=>encode(name,params)}
 const originalQueue=c.queue=function(name,params){events.push({kind:'queue',name,params})}
 c.write=function(name,params){events.push({kind:'write',name,params})}
 c.sendBuffer=function(frame,immediate){events.push({kind:'frame',frame,immediate})}
 const dir=mkdtempSync(path.join(os.tmpdir(),'realm-cache-order-'))
 const h=attachRealmPacks(c,dir,()=>{}, {handshakeMode:'original-working',checkStorage:()=>({freeMB:1000,neededMB:1,reserveMB:256})})
 return {c,h,events,originalQueue,cleanup(){h.cleanup();rmSync(dir,{recursive:true,force:true})}}
}

test('modded Realm sends Downloading before optional cache status, without duplicate',t=>{
 const s=setup();t.after(s.cleanup)
 s.c.emit('resource_packs_info',{texture_packs:[{uuid:'11111111-2222-3333-4444-555555555555',version:'1.0.0',size:10}]})
 assert.deepEqual(s.events.map(e=>e.kind),['frame'])
 assert.equal(s.events[0].frame[1],2)
 assert.equal(s.events[0].immediate,true)
 s.c.queue('client_cache_status',{enabled:false})
 assert.equal(s.events.length,1,'must suppress queued cache status while packs download')
 assert.equal(s.h.snapshot().requested,1)
})
test('unmodded world retains byte-identical native queue behavior',t=>{
 const s=setup();t.after(s.cleanup)
 s.c.emit('resource_packs_info',{texture_packs:[]})
 assert.equal(s.c.queue,s.originalQueue)
 assert.equal(s.events.filter(e=>e.name==='client_cache_status').length,0)
 s.c.queue('client_cache_status',{enabled:false})
 assert.equal(s.events.filter(e=>e.kind==='queue').length,1)
 assert.equal(s.events.filter(e=>e.kind==='frame').length,0)
})

test('nine advertised packs are requested once before deferred cache status, without premature radius',t=>{
 const s=setup();t.after(s.cleanup)
 const packs=Array.from({length:9},(_,i)=>({uuid:'11111111-2222-3333-4444-'+String(i+1).padStart(12,'0'),version:'1.0.0',size:10}))
 s.c.emit('resource_packs_info',{texture_packs:packs})
 assert.deepEqual(s.events.map(e=>e.kind),['frame'])
 assert.equal(s.events[0].frame[1],2)
 assert.equal(s.h.snapshot().requested,9)
 assert.equal(s.h.snapshot().wire.packIdCount,9)
 s.c.queue('client_cache_status',{enabled:false})
 s.c.queue('request_chunk_radius',{chunk_radius:12})
 assert.equal(s.events.length,1,'no early cache status or chunk-radius request')
})
