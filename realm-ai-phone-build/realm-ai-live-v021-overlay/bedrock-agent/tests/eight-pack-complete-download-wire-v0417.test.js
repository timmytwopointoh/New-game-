import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'
import {attachRealmPacks} from '../src/realm-packs.js'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'

const require=createRequire(import.meta.url)
const {createSerializer}=require('bedrock-protocol/src/transforms/serializer.js')
preparePackResponseWire({version:'1.26.60'},undefined,{strategy:'original-working'})
const serializer=createSerializer('1.26.60')

function varuint(value){
 const a=[];do{let b=value%128;value=Math.floor(value/128);if(value)b|=128;a.push(b)}while(value)
 return Buffer.from(a)
}
const str=s=>Buffer.concat([varuint(Buffer.byteLength(s)),Buffer.from(s,'utf8')])
const packId=i=>'11111111-2222-3333-4444-'+String(i+1).padStart(12,'0')
function officialDownloadingFrame(ids){
 // Gophertunnel compatibility wire: variant index, lowercase response string and pack list.
 // Gophertunnel 0e179fc4 (protocol 2225); see stable-pack-2225-vectors.test.js.
 // packet ID varuint (8), oneOf Downloading index 1, response string and requested IDs.
 return Buffer.concat([varuint(8),varuint(1),str('downloading'),
   varuint(ids.length),...ids.map(str)])
}
test('all eight Realm packs use byte-exact Mojang 2225 Downloading request and complete verified transfer',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vf-eight-pack-transfer-'))
 const c=new EventEmitter(),writes=[],queue=[],frames=[],events=[]
 c.options={version:'1.26.60',transport:'nethernet'}
 c.connection={nethernet:{connection:{reliable:{readyState:'open'},rtcConnection:{
   connectionState:'connected',iceConnectionState:'connected'}}}}
 c.serializer=serializer
 c._closed=false
 c.write=(name,data)=>writes.push({name,data})
 c.queue=(name,data)=>queue.push({name,data})
 c.sendBuffer=(data,immediate)=>frames.push({data,immediate})
 const h=attachRealmPacks(c,dir,e=>events.push(e),{
   handshakeMode:'original-working',noPackGraceMs:0,serverPackIdleMs:30000,
   checkStorage:()=>({freeMB:26000,neededMB:1,reserveMB:256})})
 t.after(()=>{h.cleanup();fs.rmSync(dir,{recursive:true,force:true})})
 const contents=new Map()
 const announced=[]
 for(let i=0;i<8;i++){
   const id=packId(i),bytes=Buffer.from('pack-file-'+i+'-'.repeat(33))
   contents.set(id,bytes)
   announced.push({uuid:id,version:'1.0.0',size:bytes.length,cdn_url:'',
     addon_pack:i!==0,has_scripts:false,content_identity:''})
 }
 c.emit('resource_packs_info',{texture_packs:announced,must_accept:true})
 const expectedIDs=announced.map(p=>p.uuid+'_'+p.version)
 assert.equal(frames.length,1)
 assert.equal(frames[0].immediate,true)
 assert.deepEqual(frames[0].data,officialDownloadingFrame(expectedIDs))
 assert.equal(writes.length,1,'cache disabled is declared before the modern pack response')
 assert.equal(writes[0].name,'client_cache_status')
 assert.equal(writes[0].data.enabled,false)
 for(let i=0;i<8;i++){
   const id=packId(i),data=contents.get(id),hash=crypto.createHash('sha256').update(data).digest()
   const half=Math.ceil(data.length/2)
   c.emit('resource_pack_data_info',{pack_id:id,max_chunk_size:half,chunk_count:2,size:data.length,
     hash,pack_type:i===0?6:1,is_premium:false})
   assert.equal(writes.at(-1).name,'resource_pack_chunk_request')
   assert.equal(writes.at(-1).data.chunk_index,0)
   c.emit('resource_pack_chunk_data',{pack_id:id,chunk_index:0,progress:0,payload:data.subarray(0,half)})
   assert.equal(writes.at(-1).data.chunk_index,1)
   c.emit('resource_pack_chunk_data',{pack_id:id,chunk_index:1,progress:half,payload:data.subarray(half)})
 }
 assert.equal(h.snapshot().finished,false,'server stack must still arrive')
 assert.deepEqual(frames.map(f=>f.data[1]),[1,2])
 c.emit('resource_pack_stack',{resource_packs:announced})
 assert.equal(h.snapshot().finished,true)
 assert.deepEqual(frames.map(f=>f.data[1]),[1,2,3])
 assert.equal(queue.filter(e=>e.name==='client_cache_status').length,0,'no delayed duplicate cache status')
 assert.equal(writes.filter(e=>e.name==='resource_pack_chunk_request').length,16)
 assert.equal(events.at(-1).stage,'packs-ready')
 assert.equal(events.at(-1).total,8)
 assert.equal(events.filter(e=>e.stage==='pack-error').length,0)
})
