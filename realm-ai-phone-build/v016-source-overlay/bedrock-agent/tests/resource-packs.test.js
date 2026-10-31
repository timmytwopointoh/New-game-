import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {attachRealmPacks} from '../src/realm-packs.js'
function harness() {
  const client=new EventEmitter();const sent=[];const seen=[]
  const dir=mkdtempSync(path.join(os.tmpdir(),'vf-resource-packs-'))
  client.write=(packet,data)=>sent.push([packet,data])
  const handler=attachRealmPacks(client,dir,item=>seen.push(item))
  return {client,sent,seen,dir,handler,done:()=>{handler.cleanup();rmSync(dir,{recursive:true,force:true})}}
}
const meta=(uuid='abc-def')=>({uuid,version:'1.0.0',size:6})
test('empty packs send have_all_packs, then completed on stack',t=>{
 const h=harness();t.after(h.done);h.client.emit('resource_packs_info',{texture_packs:[],must_accept:false})
 assert.equal(h.sent[0][1].response_status,'have_all_packs')
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.sent[1][1].response_status,'completed');assert.equal(h.handler.snapshot().finished,true)
})
test('required pack is downloaded, SHA verified, stored, and handshake completed',t=>{
 const h=harness();t.after(h.done);const data=Buffer.from('foobar');const hash=crypto.createHash('sha256').update(data).digest()
 h.client.emit('resource_packs_info',{texture_packs:[meta()],must_accept:true})
 assert.deepEqual(h.sent[0][1].resourcepackids,['abc-def_1.0.0'])
 h.client.emit('resource_pack_data_info',{pack_id:'abc-def',max_chunk_size:3,chunk_count:2,size:6,hash})
 assert.deepEqual(h.sent[1],[ 'resource_pack_chunk_request',{pack_id:'abc-def',chunk_index:0}])
 h.client.emit('resource_pack_chunk_data',{pack_id:'abc-def',chunk_index:0,progress:0n,payload:data.subarray(0,3)})
 h.client.emit('resource_pack_chunk_data',{pack_id:'abc-def',chunk_index:1,progress:3n,payload:data.subarray(3)})
 assert.equal(h.sent[3][1].response_status,'have_all_packs')
 h.client.emit('resource_pack_stack',{resource_packs:[meta()]})
 assert.equal(h.sent[4][1].response_status,'completed')
 assert.equal(h.handler.snapshot().finished,true)
 assert.equal(readFileSync(path.join(h.dir,crypto.createHash('sha256').update('abc-def_1.0.0').digest('hex')+'.mcpack')).toString(),'foobar')
})
test('bad pack hash fails closed and does not send ready',t=>{
 const h=harness();t.after(h.done)
 h.client.emit('resource_packs_info',{texture_packs:[meta()]})
 h.client.emit('resource_pack_data_info',{pack_id:'abc-def',max_chunk_size:6,chunk_count:1,size:6,hash:Buffer.alloc(32)})
 h.client.emit('resource_pack_chunk_data',{pack_id:'abc-def',chunk_index:0,progress:0,payload:Buffer.from('foobar')})
 assert.equal(h.handler.snapshot().failed,true)
 assert.equal(h.sent.some(([,d])=>d.response_status==='have_all_packs'),false)
})
test('too many Realm packs fail without requesting downloads',t=>{
 const h=harness();t.after(h.done)
 h.client.emit('resource_packs_info',{texture_packs:Array.from({length:17},(_,i)=>meta('p'+i))})
 assert.equal(h.handler.snapshot().failed,true)
 assert.equal(h.sent.length,0)
})
test('oversized Realm pack rejected',t=>{
 const h=harness();t.after(h.done)
 h.client.emit('resource_packs_info',{texture_packs:[{uuid:'a',version:'1.0.0',size:1000000000}]})
 assert.equal(h.handler.snapshot().failed,true)
})
