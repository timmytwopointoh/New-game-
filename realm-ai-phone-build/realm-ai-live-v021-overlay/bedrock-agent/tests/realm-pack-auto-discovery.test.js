import test from 'node:test'
import assert from 'node:assert/strict'
import {selectRequiredRealmPacks} from '../src/realm-packs.js'

function samplePack(index,{size=1000000,addon=false,cdn='',version='1.0.0'}={}) {
  return {uuid: `00000000-0000-0000-0000-${String(index).padStart(12,'0')}`, version,size,addon_pack:addon,cdn_url:cdn}
}

test('a Realm with no packs requires none',()=>{
 const result=selectRequiredRealmPacks({texture_packs:[],must_accept:false})
 assert.equal(result.advertised,0)
 assert.deepEqual(result.required,[])
})

test('a Realm with one resource pack discovers it without configured UUIDs',()=>{
 const pack=samplePack(1)
 const result=selectRequiredRealmPacks({texture_packs:[pack],must_accept:true})
 assert.equal(result.advertised,1)
 assert.deepEqual(result.required,[{meta:pack,origin:'resource'}])
})

test('a modern Realm with eight resource/addon packs discovers all server-advertised entries in order',()=>{
 const packs=Array.from({length:8},(_,i)=>samplePack(i+1,{size:(i+1)*2000000,addon:i>0,version:`1.${i}.0`}))
 const result=selectRequiredRealmPacks({texture_packs:packs,has_addons:true,must_accept:true})
 assert.equal(result.advertised,8)
 assert.equal(result.skippedOptional,0)
 assert.deepEqual(result.required.map(x=>x.meta.uuid),packs.map(x=>x.uuid))
 assert.equal(result.policy,'all-advertised')
})

test('a different Realm dynamically discovers nine completely different packs',()=>{
 const packs=Array.from({length:9},(_,i)=>samplePack(i+101,{size:10000000,version:`2.${i}.1`}))
 const result=selectRequiredRealmPacks({texture_packs:packs,must_accept:true})
 assert.equal(result.advertised,9)
 assert.deepEqual(result.required.map(x=>x.meta.version),packs.map(x=>x.version))
})

test('legacy separate behavior pack list is also discovered without hardcoding',()=>{
 const resource=samplePack(20)
 const behavior=samplePack(21,{addon:true})
 const result=selectRequiredRealmPacks({texture_packs:[resource],behavior_packs:[behavior]})
 assert.equal(result.advertised,2)
 assert.deepEqual(result.required.map(x=>x.origin),['resource','behavior'])
 assert.equal(result.legacyBehaviorCount,1)
})

test('both server-packet list names work; CDN pack metadata is preserved',()=>{
 const p=samplePack(24,{cdn:'https://example.com/safe-pack.mcpack'})
 const modern=selectRequiredRealmPacks({resource_packs:[p]})
 assert.deepEqual(modern.required[0].meta,p)
 assert.equal(modern.advertised,1)
})

test('unbounded or malformed lists are rejected rather than silently skipped',()=>{
 assert.throws(()=>selectRequiredRealmPacks({texture_packs:Array(65).fill(samplePack(1))}),/Too many/)
 assert.throws(()=>selectRequiredRealmPacks({texture_packs:'unknown'}),/Invalid/)
})
