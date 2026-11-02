import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {attachRealmPacks,selectRequiredRealmPacks} from '../src/realm-packs.js'

const mb=n=>n*1024*1024
const addon=(name,size=mb(80))=>({uuid:name,version:'1.0.0',size,cdn_url:'',addon_pack:true,has_scripts:false})
const optional=(name,size=mb(58))=>({uuid:name,version:'1.0.0',size,cdn_url:'',addon_pack:false,has_scripts:false})
const prepare=()=> {
 const client=new EventEmitter(),sent=[],states=[]
 client.write=(name,params)=>sent.push({name,params})
 client.queue=(name,params)=>sent.push({name,params})
 const folder=mkdtempSync(path.join(os.tmpdir(),'vf-required-choice-'))
 const handler=attachRealmPacks(client,folder,s=>states.push(s),{
  checkStorage:(_dir,bytes)=>({freeMB:24000,neededMB:Math.ceil(bytes/1024/1024),reserveMB:256}),
  serverPackIdleMs:100000
 })
 return {client,sent,states,handler,close(){handler.cleanup();rmSync(folder,{force:true,recursive:true})}}
}
test('required-only with must_accept true excludes optional visual pack and requests 120 MB not 178 MB',t=>{
 const h=prepare();t.after(()=>h.close())
 const p={must_accept:true,has_addons:true,texture_packs:[addon('required-a',mb(80)),optional('visual-optional',mb(58)),addon('required-b',mb(40))]}
 h.client.emit('resource_packs_info',p)
 const reply=h.sent.find(x=>x.name==='resource_pack_client_response')
 assert.deepEqual(reply.params.resourcepackids,['required-a_1.0.0','required-b_1.0.0'])
 assert.equal(reply.params.response_status_name,'Downloading')
 assert.equal(h.states.find(x=>x.stage==='pack-storage').neededMB,120)
 assert.equal(h.states.at(-1).packAdvertisedCount,3)
 assert.equal(h.states.at(-1).packSkippedOptional,1)
 assert.equal(h.states.at(-1).packSelectionPolicy,'addon-required')
 assert.equal(h.handler.snapshot().requested,2)
})
test('required add-on content retained with must_accept false; optional visuals never requested',t=>{
 const h=prepare();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:false,texture_packs:[optional('shaders'),addon('furniture'),{...optional('script'),has_scripts:true}]})
 assert.deepEqual(h.sent.find(x=>x.name==='resource_pack_client_response').params.resourcepackids,['furniture_1.0.0','script_1.0.0'])
})
test('legacy behavior_packs stay required even when unmarked, while cosmetic texture packs are skipped',t=>{
 const h=prepare();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:true,behavior_packs:[optional('behavior')],texture_packs:[optional('visual')]})
 const response=h.sent.find(x=>x.name==='resource_pack_client_response')
 assert.deepEqual(response.params.resourcepackids,['behavior_1.0.0'])
 assert.equal(h.states.at(-1).packLegacyBehaviorCount,1)
})
test('unknown per-pack flags with mandatory server stack does not silently skip needed assets',t=>{
 const h=prepare();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:true,texture_packs:[optional('unmarked-a'),optional('unmarked-b')]})
 assert.deepEqual(h.sent.find(x=>x.name==='resource_pack_client_response').params.resourcepackids,['unmarked-a_1.0.0','unmarked-b_1.0.0'])
 assert.equal(h.states.at(-1).packSelectionPolicy,'server-required-fallback')
 assert.equal(h.states.at(-1).packSkippedOptional,0)
})
test('optional-only stack selects no packs and immediately acknowledges completion',t=>{
 const h=prepare();t.after(()=>h.close())
 h.client.emit('resource_packs_info',{must_accept:false,texture_packs:[optional('decor')]})
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 assert.deepEqual(h.sent.filter(x=>x.name==='resource_pack_client_response').map(x=>x.params.response_status_name),
  ['DownloadingFinished','ResourcePackStackFinished'])
 assert.equal(h.handler.snapshot().finished,true)
 assert.equal(h.handler.snapshot().skippedOptional,1)
})
test('selection is pure and errors for malformed pack collections',()=>{
 const orig={must_accept:true,texture_packs:[addon('r1'),optional('v1')]}
 const before=JSON.stringify(orig)
 assert.deepEqual(selectRequiredRealmPacks(orig).required.map(x=>x.meta.uuid),['r1'])
 assert.equal(JSON.stringify(orig),before)
 assert.throws(()=>selectRequiredRealmPacks({texture_packs:{}}),/Invalid/)
})
