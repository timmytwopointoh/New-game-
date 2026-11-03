import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {attachRealmPacks} from '../src/realm-packs.js'
import {packFilePath} from '../src/pack-storage.js'

const meta=(id='one')=>({uuid:id,version:'1.0.0',size:6})
function setup(dir=mkdtempSync(path.join(os.tmpdir(),'realm-cache-probe-'))){
 const client=new EventEmitter(),sent=[],events=[]
 client.write=(name,data)=>{sent.push({name,data})}
 client.queue=client.write
 const handler=attachRealmPacks(client,dir,e=>events.push(e),{handshakeMode:'native-queue',checkStorage:()=>({freeMB:6000,neededMB:0,reserveMB:256})})
 return {client,handler,sent,events,dir,stop:()=>{handler.cleanup();rmSync(dir,{recursive:true,force:true})}}
}
function store(h,id,data=Buffer.from('foobar'),marker){
 const key=id+'_1.0.0',filename=crypto.createHash('sha256').update(key).digest('hex')+'.mcpack'
 const file=packFilePath(h.dir,'resource',filename)
 mkdirSync(path.dirname(file),{recursive:true})
 writeFileSync(file,data)
 if(marker!==null)writeFileSync(file+'.sha256',marker??crypto.createHash('sha256').update(data).digest('hex'))
 return file
}
async function until(fn){for(let n=0;n<120;n++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,10))}throw Error('Timed out awaiting local cache verification')}

test('empty Realm emits no Downloading, finishes on stack, and ignores duplicate empty announcement',t=>{
 const h=setup();t.after(h.stop)
 h.client.emit('resource_packs_info',{texture_packs:[]})
 h.client.emit('resource_packs_info',{texture_packs:[]})
 assert.deepEqual(h.sent.filter(x=>x.name==='resource_pack_client_response').map(x=>x.data.response_status),['have_all_packs'])
 assert.equal(h.sent.some(x=>x.data?.response_status==='send_packs'),false)
 assert.equal(h.handler.snapshot().missingPackCount,0)
 assert.equal(h.handler.snapshot().infoReceived,true)
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.handler.snapshot().stackReceived,true)
 assert.equal(h.handler.snapshot().finished,true)
 assert.deepEqual(h.sent.map(x=>x.data.response_status),['have_all_packs','completed'])
})

test('server may send an empty stack without any prior pack announcement',t=>{
 const h=setup();t.after(h.stop)
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.handler.snapshot().finished,true)
 assert.equal(h.sent.some(x=>x.data?.response_status==='send_packs'),false)
})

test('all SHA-verified server packs are reused without a Downloading request',async t=>{
 const h=setup();t.after(h.stop)
 store(h,'one')
 h.client.emit('resource_packs_info',{texture_packs:[meta('one')]})
 await until(()=>h.handler.snapshot().verifiedCacheCount===1)
 assert.equal(h.handler.snapshot().missingPackCount,0)
 assert.equal(h.sent.some(x=>x.data?.response_status==='send_packs'),false)
 assert.deepEqual(h.sent.filter(x=>x.name==='resource_pack_client_response').map(x=>x.data.response_status),['have_all_packs'])
 h.client.emit('resource_pack_stack',{resource_packs:[meta('one')]})
 assert.equal(h.handler.snapshot().finished,true)
 assert.equal(h.sent.at(-1).data.response_status,'completed')
})

test('mixed pack inventory requests ONLY the missing server-advertised pack',async t=>{
 const h=setup();t.after(h.stop)
 store(h,'one')
 h.client.emit('resource_packs_info',{texture_packs:[meta('one'),meta('two')]})
 await until(()=>h.handler.snapshot().missingPackCount===1)
 const wanted=h.sent.filter(x=>x.data?.response_status==='send_packs')
 assert.equal(wanted.length,1)
 assert.deepEqual(wanted[0].data.resourcepackids,['two_1.0.0'])
 assert.equal(h.handler.snapshot().verifiedCacheCount,1)
 const data=Buffer.from('foobar'),hash=crypto.createHash('sha256').update(data).digest()
 h.client.emit('resource_pack_data_info',{pack_id:'two',max_chunk_size:6,chunk_count:1,size:6,hash})
 h.client.emit('resource_pack_chunk_data',{pack_id:'two',chunk_index:0,progress:0,payload:data})
 assert.equal(h.sent.filter(x=>x.data?.response_status==='have_all_packs').length,1)
 h.client.emit('resource_pack_stack',{resource_packs:[meta('one'),meta('two')]})
 assert.equal(h.handler.snapshot().finished,true)
})

test('bad or missing hash markers are NEVER trusted: server must supply the file',async t=>{
 const h=setup();t.after(h.stop)
 const file=store(h,'one',Buffer.from('BADBAD'),crypto.createHash('sha256').update('foobar').digest('hex'))
 h.client.emit('resource_packs_info',{texture_packs:[meta('one')]})
 await until(()=>h.handler.snapshot().missingPackCount===1)
 assert.equal(h.handler.snapshot().verifiedCacheCount,0)
 assert.equal(h.sent.find(x=>x.data?.response_status==='send_packs').data.resourcepackids[0],'one_1.0.0')
 assert.equal(readFileSync(file).toString(),'BADBAD')
})

test('successful server pack transfer saves its verified hash for the next join',async t=>{
 const h=setup();t.after(h.stop)
 h.client.emit('resource_packs_info',{texture_packs:[meta('one')]})
 const data=Buffer.from('foobar'),hash=crypto.createHash('sha256').update(data).digest()
 h.client.emit('resource_pack_data_info',{pack_id:'one',max_chunk_size:6,chunk_count:1,size:6,hash})
 h.client.emit('resource_pack_chunk_data',{pack_id:'one',chunk_index:0,progress:0,payload:data})
 const key=crypto.createHash('sha256').update('one_1.0.0').digest('hex')+'.mcpack'
 const file=packFilePath(h.dir,'resource',key)
 assert.equal(existsSync(file+'.sha256'),true)
 assert.equal(readFileSync(file+'.sha256','utf8'),hash.toString('hex'))
 h.handler.cleanup()
 const g=setup(h.dir);t.after(()=>g.handler.cleanup())
 g.client.emit('resource_packs_info',{texture_packs:[meta('one')]})
 await until(()=>g.handler.snapshot().verifiedCacheCount===1)
 assert.equal(g.sent.some(x=>x.data?.response_status==='send_packs'),false)
})
