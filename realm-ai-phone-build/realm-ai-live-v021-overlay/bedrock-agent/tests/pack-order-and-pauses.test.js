import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {attachRealmPacks} from '../src/realm-packs.js'
import {realm} from './helpers/realm.js'

test('required downloads suppress the library early radius packet until completion AND start_game',()=>{
 const c=new EventEmitter(),sent=[],dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-pack-order-'))
 c.queue=c.write=(name,data)=>sent.push([name,data]);const original=c.queue,h=attachRealmPacks(c,dir)
 try{
  c.queue('client_cache_status',{enabled:false})
  c.emit('resource_packs_info',{must_accept:true,texture_packs:[{uuid:'needed',version:'1.0.0',size:6}]})
  assert.deepEqual(sent.slice(0,2).map(([n])=>n),['client_cache_status','resource_pack_client_response'])
  c.queue('request_chunk_radius',{chunk_radius:10});assert(!sent.some(([n])=>n==='request_chunk_radius'))
  c.emit('resource_pack_stack',{});assert(!h.snapshot().finished)
  const data=Buffer.from('foobar');c.emit('resource_pack_data_info',{pack_id:'needed',max_chunk_size:6,chunk_count:1,size:6,hash:crypto.createHash('sha256').update(data).digest()})
  c.emit('resource_pack_chunk_data',{pack_id:'needed',chunk_index:0,progress:0,payload:data})
  assert(h.snapshot().finished);assert(!sent.some(([n])=>n==='request_chunk_radius'))
  c.emit('start_game',{});assert.equal(sent.filter(([n])=>n==='request_chunk_radius').length,1)
  assert.equal(h.snapshot().radiusDeferred,1)
  assert(sent.findIndex(([n,d])=>n==='resource_pack_client_response'&&d.response_status==='completed')<sent.findIndex(([n])=>n==='request_chunk_radius'))
 }finally{h.cleanup();assert.equal(c.queue,original);fs.rmSync(dir,{recursive:true,force:true})}
})
test('empty pack Realms also wait for start_game, and cleanup never sends a deferred radius',()=>{
 const c=new EventEmitter(),sent=[],dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-empty-order-'));c.write=c.queue=(name,data)=>sent.push([name,data]);const h=attachRealmPacks(c,dir)
 try{c.emit('resource_packs_info',{texture_packs:[],must_accept:false});c.write('request_chunk_radius',{chunk_radius:10});c.emit('resource_pack_stack',{});assert(h.snapshot().finished);assert(!sent.some(([n])=>n==='request_chunk_radius'));h.cleanup();c.emit('start_game',{});assert(!sent.some(([n])=>n==='request_chunk_radius'))}finally{h.cleanup();fs.rmSync(dir,{recursive:true,force:true})}
})
test('CPU time in the previous movement tick is not misidentified as a phone pause',()=>{
 const f=realm();try{
  assert(f.n.walk({x:3,y:64,z:0}).accepted)
  f.n.lastInputAt=1000;f.n.lastWorkDurationMs=900;f.n.step(1950)
  assert(f.n.job);assert.equal(f.n.lastSchedulingGapMs,50);assert(!/Phone paused/.test(f.n.reason))
 }finally{f.close()}
})
test('a real scheduling pause cancels producers before the immediate neutral input',()=>{
 const f=realm();try{
  assert(f.n.walk({x:3,y:64,z:0}).accepted);let producer=true,pauses=0
  f.n.onSchedulingPause=()=>{producer=false;pauses++}
  f.n.onResourceTick=()=>{assert.equal(producer,false)}
  f.n.lastInputAt=1000;f.n.lastWorkDurationMs=20;f.n.step(2100)
  assert.equal(f.n.job,null);assert.equal(pauses,1);assert.match(f.n.reason,/outside the movement loop/)
  f.n.step(2150);assert.equal(pauses,1)
 }finally{f.close()}
})
test('repeated visibility scans share ray results, while live updates invalidate them',()=>{
 const f=realm();try{
  let rays=0;const original=f.w.rayVisible.bind(f.w);f.w.rayVisible=p=>{rays++;return original(p)}
  const p={x:2,y:64,z:0};assert(f.w.visible(p));assert(f.w.visible(p));assert.equal(rays,1)
  f.set({x:1,y:65,z:0},'stone');f.set({x:1,y:64,z:0},'stone');assert.equal(f.w.visible(p),false);assert.equal(rays,2)
 }finally{f.close()}
})
test('native library queues cache policy after our immediate response when its listener runs later',()=>{
 const c=new EventEmitter(),sent=[],dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-cache-order-'));c.queue=c.write=(name,data)=>sent.push([name,data]);const h=attachRealmPacks(c,dir)
 c.on('resource_packs_info',()=>c.queue('client_cache_status',{enabled:false}))
 try{c.emit('resource_packs_info',{texture_packs:[],must_accept:false});assert.deepEqual(sent.map(([n])=>n),['resource_pack_client_response','client_cache_status']);assert.equal(sent.filter(([n])=>n==='client_cache_status').length,1)}finally{h.cleanup();fs.rmSync(dir,{recursive:true,force:true})}
})
