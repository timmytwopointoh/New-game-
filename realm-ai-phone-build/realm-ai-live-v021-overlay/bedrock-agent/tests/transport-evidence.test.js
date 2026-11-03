import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {observeBedrockTransport,markPackTransportRequest,transportEvidenceSummary} from '../src/transport-evidence.js'
function setup(connected) {
 const client=new EventEmitter()
 client.status=3
 client._closed=false
 const submitted=[]
 const original=function(buffer,immediate){submitted.push({buffer,immediate})}
 client.connection={connected,sendReliable:original}
 return {client,submitted,original}
}
test('join and sendReliable instrumentation distinguishes pack request and physical transport handoff',()=>{
 const {client,submitted,original}=setup(undefined) // JS RakNet leaves connected undefined
 let now=1000
 const o=observeBedrockTransport(client,{clock:()=>now})
 assert.equal(o.joinObserved,true)
 const pack=markPackTransportRequest(client,{clock:()=>now+100})
 assert.equal(pack.open,true)
 assert.equal(pack.joinObserved,true)
 client.connection.sendReliable(Buffer.from([42]),true)
 assert.equal(submitted.length,1)
 assert.equal(transportEvidenceSummary(client).transportReliableAfterPackRequest,1)
 assert.equal(transportEvidenceSummary(client).transportReliableWritesOpen,1)
 now=1700
 client._closed=true
 client.status=0
 client.emit('close')
 const status=transportEvidenceSummary(client)
 assert.equal(status.transportClosed,true)
 assert.equal(status.transportCloseKind,undefined)
 assert.equal(status.transportClosedAfterRequestSeconds,0)
 assert.equal(status.transportPackRequestOpen,true)
 assert.equal(client.connection.sendReliable,original)
})
test('transport known-closed at request is recorded and cannot be mistaken for a successful transmission',()=>{
 const {client,submitted}=setup(false)
 observeBedrockTransport(client)
 const mark=markPackTransportRequest(client)
 assert.equal(mark.open,false)
 client.connection.sendReliable(Buffer.from([8,2,0]),true)
 const status=transportEvidenceSummary(client)
 assert.equal(status.transportReliableWritesOpen,0)
 assert.equal(status.transportReliableWritesClosed,1)
 assert.equal(status.transportPackRequestOpen,false)
 assert.equal(submitted.length,1,'monitor observes even if backend mock accepts; only reports handed-to-backend')
})
test('safe summaries contain no payload, pack IDs, IPs, Microsoft tokens or URLs',()=>{
 const {client}=setup(undefined)
 observeBedrockTransport(client)
 markPackTransportRequest(client)
 client.connection.sendReliable(Buffer.from('private-token-and-pack-id'))
 const report=JSON.stringify(transportEvidenceSummary(client))
 assert.equal(report.includes('private-token'),false)
 assert.equal(report.includes('pack-id'),false)
 assert.equal(report.includes('http'),false)
})
