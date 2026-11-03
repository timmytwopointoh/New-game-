import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'
import {attachRealmPacks} from '../src/realm-packs.js'

preparePackResponseWire({version:'1.26.60'})
const meta={uuid:'aabbccdd-1234-4567-89ab-aabbccddeeff',version:'1.0.0',size:16,cdn_url:''}

function harness(handshakeMode){
 const client=new EventEmitter(),traffic=[],updates=[]
 client.write=(name,packet)=>traffic.push({method:'write',name,packet})
 client.queue=(name,packet)=>traffic.push({method:'queue',name,packet})
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-pack-ab-'))
 const handler=attachRealmPacks(client,dir,x=>updates.push(x),{
  handshakeMode,checkStorage:()=>({freeMB:1000,neededMB:1,reserveMB:256})
 })
 // Native 1.26.60 bundled client installs this listener after our handler.
 client.once('resource_packs_info',()=>client.queue('client_cache_status',{enabled:false}))
 return {traffic,updates,handler,begin(){
  client.emit('resource_packs_info',{must_accept:true,texture_packs:[meta]})
 },close(){handler.cleanup();rmSync(dir,{force:true,recursive:true})}}
}

for(const [handshakeMode,expected] of [
 ['native-queue',[['write','resource_pack_client_response'],['queue','client_cache_status']]],
 ['no-cache-status',[['write','resource_pack_client_response']]],
 ['cache-first',[['write','client_cache_status'],['write','resource_pack_client_response']]]
]){
 test('handshake sequence '+handshakeMode+' controls exactly the intended packet order',t=>{
  const h=harness(handshakeMode);t.after(()=>h.close());h.begin()
  assert.deepEqual(h.traffic.map(x=>[x.method,x.name]),expected)
  assert.equal(h.handler.snapshot().handshakeMode,handshakeMode)
  const packet=h.traffic.find(x=>x.name==='resource_pack_client_response')?.packet
  assert.equal(packet.response_status,'send_packs')
  assert.equal(packet.response_status_name,'Downloading')
  assert.deepEqual(packet.resourcepackids,[meta.uuid+'_'+meta.version])
  assert.equal(h.updates.at(-1).packHandshakeMode,handshakeMode)
 })
}

test('unknown mode rejected before attaching any listeners',()=>{
 const client=new EventEmitter();client.write=()=>{};client.queue=()=>{}
 assert.throws(()=>attachRealmPacks(client,'/tmp/no-cache',()=>{},{handshakeMode:'arbitrary'}),/Unknown safe pack handshake mode/)
 assert.equal(client.listenerCount('resource_packs_info'),0)
})
