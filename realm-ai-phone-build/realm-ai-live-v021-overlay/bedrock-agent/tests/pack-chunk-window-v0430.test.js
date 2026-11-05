import test from 'node:test'
import assert from 'node:assert/strict'
import {createPackChunkWindow} from '../src/pack-chunk-window.js'

test('Gophertunnel-style independent pack windows issue 100 requests and replenish after unique arrivals',()=>{
 const requests=[],written=new Map(),size=256*128
 const w=createPackChunkWindow({chunkSize:128,chunkCount:256,size,
  request:n=>requests.push(n),write:(buf,offset,index)=>written.set(index,{offset,buf})})
 assert.equal(w.pump(),100)
 assert.deepEqual(requests,[...Array(100).keys()])
 const outOfOrder=w.accept({index:99,offset:99*128,payload:Buffer.alloc(128,99)})
 assert.equal(outOfOrder.received,1)
 assert.equal(requests.length,101)
 assert.equal(requests.at(-1),100)
 assert.equal(w.accept({index:99,offset:99*128,payload:Buffer.alloc(128,99)}).duplicate,true)
 assert.equal(requests.length,101,'duplicate must never advance window')
 for(let i=0;i<256;i++){
  if(i===99)continue
  const reply=w.accept({index:i,offset:i*128,payload:Buffer.alloc(128,i%256)})
  assert.equal(reply.duplicate,false)
 }
 assert.equal(requests.length,256)
 assert.equal(w.snapshot().complete,true)
 assert.equal(w.snapshot().received,256)
 assert.equal(w.snapshot().duplicates,1)
 assert.equal(written.size,256)
 assert.equal(written.get(99).offset,99*128)
})
test('window accepts an out-of-order short final chunk by server offset',()=>{
 const req=[],parts=[]
 const w=createPackChunkWindow({chunkSize:8,chunkCount:3,size:19,
  request:n=>req.push(n),write:(buf,offset)=>parts.push([offset,buf.length])})
 w.pump()
 assert.deepEqual(req,[0,1,2])
 w.accept({index:2,offset:16,payload:Buffer.alloc(3)})
 w.accept({index:0,offset:0,payload:Buffer.alloc(8)})
 w.accept({index:1,offset:8,payload:Buffer.alloc(8)})
 assert.deepEqual(parts,[[16,3],[0,8],[8,8]])
 assert.equal(w.snapshot().complete,true)
})
test('rejects unrequested, invalid offset, damaged size and unsupported limits',()=>{
 const w=createPackChunkWindow({chunkSize:6,chunkCount:2,size:12,
  windowSize:1,request:()=>{},write:()=>{}})
 w.pump()
 assert.throws(()=>w.accept({index:1,offset:6,payload:Buffer.alloc(6)}),/Unrequested/)
 assert.throws(()=>w.accept({index:0,offset:2,payload:Buffer.alloc(6)}),/offset mismatch/)
 assert.throws(()=>w.accept({index:0,offset:0,payload:Buffer.alloc(5)}),/chunk size/)
 assert.throws(()=>createPackChunkWindow({chunkSize:4,chunkCount:8,size:6,request:()=>{},write:()=>{}}),/Inconsistent/)
 assert.throws(()=>createPackChunkWindow({chunkSize:4,chunkCount:2,size:8,windowSize:101,request:()=>{},write:()=>{}}),/Invalid/)
})
