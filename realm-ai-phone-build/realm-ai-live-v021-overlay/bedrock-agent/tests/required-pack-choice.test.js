import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {attachRealmPacks,selectRequiredRealmPacks} from '../src/realm-packs.js'

const mb=n=>n*1024*1024
const addon=(name,size=mb(80))=>({uuid:name,version:'1.0.0',size,cdn_url:'',addon_pack:true,has_scripts:false})
const unmarked=(name,size=mb(58))=>({uuid:name,version:'1.0.0',size,cdn_url:'',addon_pack:false,has_scripts:false})
function prepare(){
 const client=new EventEmitter(),sent=[],states=[]
 client.write=(name,params)=>sent.push({name,params})
 client.queue=(name,params)=>sent.push({name,params})
 const folder=mkdtempSync(path.join(os.tmpdir(),'vf-fullpack-choice-'))
 const handler=attachRealmPacks(client,folder,s=>states.push(s),{
  checkStorage:(_dir,bytes)=>({freeMB:24000,neededMB:Math.ceil(bytes/1024/1024),reserveMB:256}),
  serverPackIdleMs:100000
 })
 return {client,sent,states,handler,close(){handler.cleanup();rmSync(folder,{force:true,recursive:true})}}
}
test('required modded stack includes unmarked resource pack and counts complete download',t=>{
 const h=prepare();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:true,has_addons:true,texture_packs:[addon('required-a',mb(80)),unmarked('visual-optional',mb(58)),addon('required-b',mb(40))]})
 const reply=h.sent.find(x=>x.name==='resource_pack_client_response')
 assert.deepEqual(reply.params.resourcepackids,['required-a_1.0.0','visual-optional_1.0.0','required-b_1.0.0'])
 assert.equal(reply.params.response_status_name,'Downloading')
 assert.equal(h.states.find(x=>x.stage==='pack-storage').neededMB,178)
 assert.equal(h.states.at(-1).packAdvertisedCount,3)
 assert.equal(h.states.at(-1).packSkippedOptional,0)
 assert.equal(h.states.at(-1).packSelectionPolicy,'all-advertised')
 assert.equal(h.handler.snapshot().requested,3)
})
test('full stack is requested even when server must_accept is false',t=>{
 const h=prepare();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:false,texture_packs:[unmarked('shaders'),addon('furniture'),{...unmarked('script'),has_scripts:true}]})
 assert.deepEqual(h.sent.find(x=>x.name==='resource_pack_client_response').params.resourcepackids,['shaders_1.0.0','furniture_1.0.0','script_1.0.0'])
})
test('legacy behavior packs and resource packs preserve advertised order',t=>{
 const h=prepare();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:true,behavior_packs:[unmarked('behavior')],texture_packs:[unmarked('visual')]})
 const response=h.sent.find(x=>x.name==='resource_pack_client_response')
 assert.deepEqual(response.params.resourcepackids,['visual_1.0.0','behavior_1.0.0'])
 assert.equal(h.states.at(-1).packLegacyBehaviorCount,1)
})
test('mandatory unmarked resource pack is never silently skipped',t=>{
 const h=prepare();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:true,texture_packs:[unmarked('unmarked-a'),unmarked('unmarked-b')]})
 assert.deepEqual(h.sent.find(x=>x.name==='resource_pack_client_response').params.resourcepackids,['unmarked-a_1.0.0','unmarked-b_1.0.0'])
 assert.equal(h.states.at(-1).packSelectionPolicy,'all-advertised')
 assert.equal(h.states.at(-1).packSkippedOptional,0)
})
test('optional-only advertisement downloads one pack, without prematurely completing',t=>{
 const h=prepare();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:false,texture_packs:[unmarked('decor')]})
 h.client.emit('resource_pack_stack',{resource_packs:[unmarked('decor')]})
 assert.deepEqual(h.sent.filter(x=>x.name==='resource_pack_client_response').map(x=>x.params.response_status_name),['Downloading'])
 assert.equal(h.handler.snapshot().requested,1)
 assert.equal(h.handler.snapshot().finished,false)
 assert.equal(h.handler.snapshot().skippedOptional,0)
})
test('selection is pure, includes all flags and rejects malformed lists',()=>{
 const orig={must_accept:true,texture_packs:[addon('r1'),unmarked('v1')]}
 const before=JSON.stringify(orig)
 assert.deepEqual(selectRequiredRealmPacks(orig).required.map(x=>x.meta.uuid),['r1','v1'])
 assert.equal(JSON.stringify(orig),before)
 assert.throws(()=>selectRequiredRealmPacks({texture_packs:{}}),/Invalid/)
})
// November 2 all-in-one diagnostic: nine advertised, eight requested, zero
// pack headers. Verify we always send all nine UUID/version IDs in one ACK.
test('nine-pack modded Realm requests all nine with no unmarked pack skipped',t=>{
 const h=prepare();t.after(()=>h.close())
 const advertised=Array.from({length:9},(_,i)=>i===8?unmarked('unmarked-visual',mb(12)):addon('addon-'+i,mb(10)))
 h.client.emit('resource_packs_info',{must_accept:true,has_addons:true,texture_packs:advertised,behavior_packs:[]})
 const replies=h.sent.filter(x=>x.name==='resource_pack_client_response')
 assert.equal(replies.length,1)
 assert.equal(replies[0].params.response_status,'send_packs')
 assert.deepEqual(replies[0].params.resourcepackids,advertised.map(p=>p.uuid+'_1.0.0'))
 const status=h.states.at(-1)
 assert.equal(status.packAdvertisedCount,9)
 assert.equal(status.packSkippedOptional,0)
 assert.equal(status.packServerCount,9)
 assert.equal(status.packSelectionPolicy,'all-advertised')
 assert.equal(status.neededMB,92)
 assert.equal(h.handler.snapshot().requested,9)
})
