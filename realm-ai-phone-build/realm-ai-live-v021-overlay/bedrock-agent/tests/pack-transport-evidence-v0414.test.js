import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {classifyTransportClose,inspectTransportState,observeBedrockTransport,markPackTransportRequest,transportEvidenceSummary} from '../src/transport-evidence.js'
import {createPackHandshakeForensics} from '../src/pack-handshake-forensics.js'
import {sanitizeDiagnosticReport} from '../src/diagnostic-store.js'

test('numeric RakNet disconnect codes map to fixed non-sensitive labels',()=>{
 assert.deepEqual(classifyTransportClose(22),{code:22,label:'raknet-connection-lost'})
 assert.deepEqual(classifyTransportClose({reason:21}),{code:21,label:'remote-disconnect-notice'})
 assert.deepEqual(classifyTransportClose(25),{code:25,label:'protocol-incompatible'})
 assert.deepEqual(classifyTransportClose('username / private address'),{code:0,label:'unknown-code'})
 assert.deepEqual(classifyTransportClose({reason:999}),{code:0,label:'unknown-code'})
})

test('outbound transport counts mean local submission, never server ACK',()=>{
 let calls=0
 const client=new EventEmitter();client._closed=false;client.status=3
 client.connection={connected:true,sendReliable(){calls++}}
 observeBedrockTransport(client)
 markPackTransportRequest(client)
 client.connection.sendReliable(Buffer.from([1]),true)
 client.connection.sendReliable(Buffer.from([2]),true)
 const evidence=transportEvidenceSummary(client)
 assert.equal(calls,2)
 assert.equal(evidence.transportPackReliableSubmissions,2)
 assert.equal(evidence.transportPackReliableErrors,0)
 assert.equal(evidence.transportAckObservable,false)
 client.emit('close')
})

test('forensics records raw pack response and transport reason without IDs or secrets',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'vf-pack-evidence-'))
 try{
  const f=path.join(folder,'pack-handshake.json')
  const client=new EventEmitter()
  client.connection={connected:true}
  client.status=3
  client.write=()=>{}
  client.queue=()=>{}
  client.sendMCPE=()=>{}
  const h=createPackHandshakeForensics(client,f)
  client.emit('vf-pack-response-submit',{status:'Downloading',packCount:8,selector:2,packetBytes:364,resourcepackids:['SHOULD_NOT_LEAK']})
  h.record('transport-closed','unknown',{reasonCode:22})
  const report=JSON.parse(fs.readFileSync(f,'utf8'))
  const ev=report.sessions.at(-1).events
  assert.equal(ev.find(e=>e.kind==='raw-pack-submit').packCount,8)
  assert.equal(ev.find(e=>e.kind==='raw-pack-submit').selector,2)
  assert.equal(ev.find(e=>e.kind==='raw-pack-submit').packetBytes,364)
  assert.equal(ev.find(e=>e.kind==='transport-closed').reasonCode,22)
  assert.equal(JSON.stringify(report).includes('SHOULD_NOT_LEAK'),false)
  h.cleanup()
 }finally{fs.rmSync(folder,{recursive:true,force:true})}
})

test('exported connection summary preserves only allowlisted transport evidence',()=>{
 const summary=sanitizeDiagnosticReport({phase:'pack-request',authState:'disconnected',
  transportCloseCode:22,transportCloseLabel:'raknet-connection-lost',
  transportPackReliableSubmissions:2,transportPackReliableErrors:0,transportAckObservable:false,
  privateToken:'do-not-export'})
 assert.equal(summary.transportCloseCode,22)
 assert.equal(summary.transportCloseLabel,'raknet-connection-lost')
 assert.equal(summary.transportPackReliableSubmissions,2)
 assert.equal(summary.transportAckObservable,false)
 assert.equal(JSON.stringify(summary).includes('do-not-export'),false)
})

test('NetherNet closes are textual, not numeric RakNet codes; never expose raw private errors',()=>{
 assert.deepEqual(classifyTransportClose('disconnected','nethernet'),{code:0,label:'nethernet-disconnected'})
 assert.deepEqual(classifyTransportClose('closed','nethernet'),{code:0,label:'nethernet-closed'})
 assert.deepEqual(classifyTransportClose('connecterror:37','nethernet'),{code:37,label:'nethernet-connect-error'})
 assert.deepEqual(classifyTransportClose('private-hostname secret-token','nethernet'),{code:0,label:'unknown-code'})
 assert.deepEqual(classifyTransportClose('disconnected','raknet'),{code:0,label:'unknown-code'})
})
test('WebRTC reliable channel open is evidence of live transport even without RakNet connected flag',()=>{
 const client={options:{transport:'nethernet'},connection:{nethernet:{connection:{
  reliable:{readyState:'open'},rtcConnection:{connectionState:'connected',iceConnectionState:'completed'}
 }}}}
 const evidence=inspectTransportState(client)
 assert.equal(evidence.transportKind,'nethernet')
 assert.equal(evidence.transportReady,true)
 assert.equal(evidence.rtcConnectionState,'connected')
 assert.equal(evidence.rtcIceState,'completed')
 assert.equal(evidence.rtcReliableState,'open')
 client.connection.nethernet.connection.reliable.readyState='closed'
 client.connection.nethernet.connection.rtcConnection.iceConnectionState='failed'
 const end=inspectTransportState(client)
 assert.equal(end.transportReady,false)
 assert.equal(end.rtcIceState,'failed')
 const safe=sanitizeDiagnosticReport({phase:'pack-request',transportKind:'nethernet',
  rtcConnectionState:'connected',rtcIceState:'failed',rtcReliableState:'closed',
  transportCloseLabel:'nethernet-disconnected',rawSdp:'private-address-secret'})
 assert.equal(safe.transportKind,'nethernet')
 assert.equal(safe.rtcIceState,'failed')
 assert.equal(safe.rtcReliableState,'closed')
 assert.equal(safe.transportCloseLabel,'nethernet-disconnected')
 assert.equal(JSON.stringify(safe).includes('private-address-secret'),false)
})
