import test from 'node:test'
import assert from 'node:assert/strict'
import {selectRequiredRealmPacks} from '../src/realm-packs.js'

const idA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const idB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const idC='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const pack=(uuid,size=7)=>({uuid,version:'1.0.0',size,cdn_url:''})

test('v0.43.3: modern resource packs are detected even when legacy texture array is empty',()=>{
 const selection=selectRequiredRealmPacks({texture_packs:[],resource_packs:[pack(idA)]})
 assert.deepEqual(selection.required.map(p=>p.meta.uuid),[idA])
 assert.equal(selection.advertised,1)
 assert.equal(selection.resourceInfoCount,1)
 assert.equal(selection.textureInfoCount,0)
})

test('v0.43.3: mixed modern, legacy texture and behavior pack lists union without duplication',()=>{
 const selection=selectRequiredRealmPacks({
  resource_packs:[pack(idA),pack(idB)],
  texture_packs:[pack(idA),pack(idC)],
  behavior_packs:[pack(idB)]
 })
 assert.deepEqual(selection.required.map(p=>p.meta.uuid),[idA,idB,idC])
 assert.equal(selection.required.find(p=>p.meta.uuid===idB).origin,'behavior')
 assert.equal(selection.advertised,3)
 assert.equal(selection.duplicateListEntries,2)
 assert.equal(selection.behaviorInfoCount,1)
})

test('v0.43.3: modern list only, legacy texture list only, and behavior list only work',()=>{
 for(const info of [
   {resource_packs:[pack(idA)]},
   {texture_packs:[pack(idA)]},
   {behavior_packs:[pack(idA)]}
 ]){
   const result=selectRequiredRealmPacks(info)
   assert.equal(result.advertised,1)
   assert.equal(result.required[0].meta.uuid,idA)
 }
})

test('v0.43.3: zero pack world remains a zero-pack world',()=>{
 const selection=selectRequiredRealmPacks({resource_packs:[],texture_packs:[],behavior_packs:[]})
 assert.equal(selection.advertised,0)
 assert.deepEqual(selection.required,[])
})

test('v0.43.3: conflicting duplicated pack metadata is rejected, never silently accepted',()=>{
 assert.throws(()=>selectRequiredRealmPacks({resource_packs:[pack(idA,7)],texture_packs:[pack(idA,8)]}),/Conflicting Realm pack size/)
})

test('v0.43.3: duplicate entries retain resource flags and authoritative order',()=>{
 const selection=selectRequiredRealmPacks({
  resource_packs:[pack(idA),pack(idB)],
  texture_packs:[{...pack(idA),has_scripts:true}]
 })
 assert.equal(selection.advertised,2)
 assert.equal(selection.required[0].meta.has_scripts,true)
 assert.deepEqual(selection.required.map(p=>p.meta.uuid),[idA,idB])
})
