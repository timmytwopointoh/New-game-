import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'
import {encodeCurrentModdedPackResponse,sendCurrentModdedPackResponse} from '../src/modded-pack-response.js'
import {attachRealmPacks} from '../src/realm-packs.js'

const require=createRequire(import.meta.url)
const {createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer.js')
preparePackResponseWire({version:'1.26.60'},undefined,{strategy:'original-working'})

function fakeClient(){
 const c=new EventEmitter(),sends=[],writes=[]
 c.options={version:'1.26.60'}
 c.connection={connected:true}
 c.serializer=createSerializer('1.26.60')
 c.deserializer=createDeserializer('1.26.60')
 c.write=(name,data)=>writes.push({name,data})
 c.queue=(name,data)=>writes.push({name,data,queued:true})
 c.sendBuffer=(data,immediate)=>sends.push({data,immediate})
 return {c,sends,writes}
}
function varuint(bytes,at=0){
 let value=0,power=1
 for(let i=0;i<5;i++){const v=bytes[at+i];assert.notEqual(v,undefined);value+=(v&127)*power;if(!(v&128))return {value,next:at+i+1};power*=128}
 throw Error('varuint too long')
}
function inspect(frame,title,code){
 const pid=varuint(frame),sel=varuint(frame,pid.next),length=varuint(frame,sel.next)
 assert.equal(pid.value,8)
 assert.equal(sel.value,code)
 assert.equal(frame.subarray(length.next,length.next+length.value).toString(),title)
}
function setup(){
 const mock=fakeClient(),dir=mkdtempSync(path.join(os.tmpdir(),'vf-current-modded-pack-'))
 const report=[]
 const handler=attachRealmPacks(mock.c,dir,v=>report.push(v),{handshakeMode:'original-working',noPackGraceMs:0,
  checkStorage:()=>({freeMB:22000,neededMB:1,reserveMB:256})})
 return {...mock,handler,report,close(){handler.cleanup();rmSync(dir,{recursive:true,force:true})}}
}

test('only modded Realm uses 1.26.60 Downloading selector 2; packet IDs and reliable send are intact',t=>{
 const h=setup();t.after(h.close)
 h.c.emit('resource_packs_info',{texture_packs:[{uuid:'abc',version:'1.0.0',size:6}]})
 assert.equal(h.writes.length,0,'do not use legacy write in modded Realm')
 assert.equal(h.sends.length,1)
 assert.equal(h.sends[0].immediate,true)
 const frame=h.sends[0].data
 inspect(frame,'Downloading',2)
 const decodeLegacy=Buffer.from(frame);decodeLegacy[1]=1
 assert.deepEqual(h.c.deserializer.parsePacketBuffer(decodeLegacy).data.params.resourcepackids,['abc_1.0.0'])
 assert.equal(h.report.at(-1).packWireCode,2)
 assert.equal(h.report.at(-1).packWireText,'Downloading')
 assert.equal(h.report.at(-1).packWireIds,1)
 assert.equal(h.report.at(-1).packWireVerified,true)
})
test('after modded pack is received and SHA verified, response selectors 3/4 finish the stack',t=>{
 const h=setup();t.after(h.close)
 const data=Buffer.from('foobar'),hash=crypto.createHash('sha256').update(data).digest()
 h.c.emit('resource_packs_info',{texture_packs:[{uuid:'abc',version:'1.0.0',size:6}]})
 h.c.emit('resource_pack_data_info',{pack_id:'abc',max_chunk_size:6,chunk_count:1,size:6,hash})
 h.c.emit('resource_pack_chunk_data',{pack_id:'abc',chunk_index:0,progress:0,payload:data})
 h.c.emit('resource_pack_stack',{resource_packs:[]})
 assert.deepEqual(h.sends.map(v=>v.data[1]),[2,3,4])
 inspect(h.sends[1].data,'DownloadingFinished',3)
 inspect(h.sends[2].data,'ResourcePackStackFinished',4)
 assert.equal(h.handler.snapshot().finished,true)
})
test('no-pack Realm uses exact old v0.40.10 response and does not send rewritten modded buffers',t=>{
 const h=setup();t.after(h.close)
 h.c.emit('resource_packs_info',{texture_packs:[]})
 assert.equal(h.sends.length,0)
 assert.equal(h.writes.length,1)
 assert.equal(h.writes[0].name,'resource_pack_client_response')
 assert.equal(h.writes[0].data.response_status,'have_all_packs')
 assert.equal(h.writes[0].data.response_status_name,'downloadingfinished')
 h.c.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.sends.length,0)
 assert.equal(h.writes.at(-1).data.response_status_name,'resourcepackstackfinished')
 assert.equal(h.handler.snapshot().finished,true)
})
test('modded pack writer rejects unsupported schemas before sending a packet',()=>{
 const h=fakeClient()
 const bad={options:{version:'1.26.60'},serializer:{createPacketBuffer:()=>Buffer.from([8,0,0])}}
 assert.throws(()=>encodeCurrentModdedPackResponse(bad,{response_status:'send_packs',resourcepackids:['abc_1.0.0']}),/not the expected/)
 assert.throws(()=>sendCurrentModdedPackResponse(h.c,{response_status:'send_packs',resourcepackids:[]}),/Invalid count/)
 assert.equal(h.sends.length,0)
})

test('realistic library auto-Complete callback is blocked only for modded pack response',t=>{
 const fake=fakeClient()
 // bedrock-protocol 3.61.0 installs these automatic responses during connect.
 fake.c.on('resource_packs_info',()=>fake.c.write('resource_pack_client_response',{response_status:'completed',response_status_name:'resourcepackstackfinished',resourcepackids:[]}))
 fake.c.on('resource_pack_stack',()=>fake.c.write('resource_pack_client_response',{response_status:'completed',response_status_name:'resourcepackstackfinished',resourcepackids:[]}))
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-realistic-library-'))
 const handler=attachRealmPacks(fake.c,dir,()=>{},{handshakeMode:'original-working',noPackGraceMs:0,checkStorage:()=>({freeMB:20000,neededMB:2,reserveMB:256})})
 t.after(()=>{handler.cleanup();rmSync(dir,{recursive:true,force:true})})
 fake.c.emit('resource_packs_info',{texture_packs:[{uuid:'first-mod',version:'1.0.0',size:6}]})
 assert.equal(fake.writes.filter(x=>x.name==='resource_pack_client_response'&&x.data?.response_status==='completed').length,0)
 assert.equal(fake.sends.length,1)
 assert.equal(fake.sends[0].data[1],2)
 fake.c.emit('resource_pack_stack',{resource_packs:[{uuid:'first-mod',version:'1.0.0'}]})
 assert.equal(handler.snapshot().moddedLegacyCompletionsBlocked,2)
 assert.equal(fake.writes.filter(x=>x.name==='resource_pack_client_response').length,0)
})

test('unchanged unmodded stack still passes through library native ACK',t=>{
 const fake=fakeClient()
 fake.c.on('resource_packs_info',()=>fake.c.write('resource_pack_client_response',{response_status:'completed'}))
 fake.c.on('resource_pack_stack',()=>fake.c.write('resource_pack_client_response',{response_status:'completed'}))
 const native=fake.c.write,dir=mkdtempSync(path.join(os.tmpdir(),'vf-native-unmodded-'))
 const handler=attachRealmPacks(fake.c,dir,()=>{},{handshakeMode:'original-working',noPackGraceMs:0})
 t.after(()=>{handler.cleanup();rmSync(dir,{recursive:true,force:true})})
 fake.c.emit('resource_packs_info',{texture_packs:[],behavior_packs:[]})
 fake.c.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(fake.c.write,native)
 assert.equal(handler.snapshot().moddedNativeAckGuardActive,false)
 assert.equal(handler.snapshot().moddedLegacyCompletionsBlocked,0)
 assert.equal(fake.writes.filter(x=>x.data?.response_status==='completed').length,3)
 assert.equal(fake.sends.length,0)
})

test('candidate B: modded cache status is written exactly once before Downloading packet',t=>{
 const h=setup();t.after(h.close)
 const order=[]
 const native=h.c.write,originalSend=h.c.sendBuffer
 h.c.write=function(name,packet){order.push(name);return native(name,packet)}
 h.c.sendBuffer=function(frame,immediate){order.push('reliable-packet');return originalSend(frame,immediate)}
 h.c.emit('resource_packs_info',{texture_packs:[{uuid:'mod-entry',version:'1.0.0',size:6}]})
 h.c.queue('client_cache_status',{enabled:false})
 assert.deepEqual(order.slice(0,2),['client_cache_status','reliable-packet'])
 assert.equal(order.filter(x=>x==='client_cache_status').length,1)
 assert.equal(h.report.at(-1).packCacheStatusIssued,true)
 assert.equal(h.sends[0].data[1],2)
 assert.equal(h.handler.snapshot().advertised,1)
})

test('candidate B: an empty/unmodded pack list retains original cache queue behavior',t=>{
 const h=setup();t.after(h.close)
 const native=h.c.queue
 h.c.emit('resource_packs_info',{texture_packs:[],behavior_packs:[]})
 assert.equal(h.c.queue,native)
 h.c.queue('client_cache_status',{enabled:false})
 assert.equal(h.writes.filter(x=>x.name==='client_cache_status').length,1)
 assert.equal(h.writes.find(x=>x.name==='client_cache_status').queued,true)
 assert.equal(h.handler.snapshot().advertised,0)
 assert.equal(h.sends.length,0)
})
