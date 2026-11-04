import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {installModdedNativeAckGuard} from '../src/modded-native-ack-guard.js'

function harness(){
 const client=new EventEmitter(),writes=[]
 const original=function(name,packet){writes.push({name,packet})}
 client.write=original
 // Simulate the Bedrock 3.61.0 library automatically sending a
 // premature Completed on info and again on stack.
 client.on('resource_packs_info',()=>client.write('resource_pack_client_response',{response_status:'completed'}))
 client.on('resource_pack_stack',()=>client.write('resource_pack_client_response',{response_status:'completed'}))
 return {client,writes,original}
}

test('unmodded realm never changes the original writer or native ACK behavior',()=>{
 const h=harness(),guard=installModdedNativeAckGuard(h.client)
 h.client.emit('resource_packs_info',{texture_packs:[],behavior_packs:[]})
 assert.equal(h.client.write,h.original)
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.writes.length,2)
 assert.equal(guard.snapshot().moddedLegacyCompletionsBlocked,0)
 assert.equal(guard.snapshot().moddedNativeAckGuardActive,false)
 guard.cleanup()
 assert.equal(h.client.write,h.original)
})

test('modded realm blocks automatic premature completion for both events',()=>{
 const h=harness(),guard=installModdedNativeAckGuard(h.client)
 h.client.emit('resource_packs_info',{texture_packs:[{uuid:'server-advertised'}]})
 assert.notEqual(h.client.write,h.original)
 assert.equal(h.writes.length,0)
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.writes.length,0)
 assert.equal(guard.snapshot().moddedLegacyCompletionsBlocked,2)
 guard.cleanup()
 assert.equal(h.client.write,h.original)
})

test('modded guard still permits download requests, cache policy, and game traffic',()=>{
 const h=harness(),guard=installModdedNativeAckGuard(h.client)
 h.client.emit('resource_packs_info',{behavior_packs:[{uuid:'mod-behavior'}],texture_packs:[]})
 h.client.write('resource_pack_client_response',{response_status:'send_packs',resourcepackids:['mod-behavior_1.0.0']})
 h.client.write('resource_pack_chunk_request',{pack_id:'mod-behavior',chunk_index:0})
 h.client.write('client_cache_status',{enabled:false})
 assert.deepEqual(h.writes.map(x=>x.name),[
  'resource_pack_client_response','resource_pack_chunk_request','client_cache_status'
 ])
 assert.equal(h.writes[0].packet.response_status,'send_packs')
 guard.cleanup()
})

test('only non-empty advertised pack list activates guard, even with unrelated events',()=>{
 const h=harness(),guard=installModdedNativeAckGuard(h.client)
 h.client.emit('resource_pack_stack',{resource_packs:[]})
 assert.equal(h.client.write,h.original)
 h.client.emit('resource_packs_info',{texture_packs:[],behavior_packs:[]})
 assert.equal(h.client.write,h.original)
 h.client.emit('resource_packs_info',{texture_packs:[{uuid:'mod-one'}]})
 assert.notEqual(h.client.write,h.original)
 guard.cleanup()
 assert.equal(h.client.write,h.original)
})
