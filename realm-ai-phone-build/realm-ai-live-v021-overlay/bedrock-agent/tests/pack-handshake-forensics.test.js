import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createPackHandshakeForensics} from '../src/pack-handshake-forensics.js'

function harness(clock){
 const client=new EventEmitter()
 const calls=[]
 client.status=3;client._closed=false;client.connection={connected:true}
 client.write=(name,packet)=>calls.push({name,packet})
 client.queue=(name,packet)=>calls.push({name,packet,queued:true})
 client.sendMCPE=(frame,immediate)=>calls.push({frame,immediate})
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-handshake-forensics-'))
 return {client,calls,dir,file:path.join(dir,'pack-handshake.json'),cleanup:()=>rmSync(dir,{recursive:true,force:true})}
}

test('pack handshake audit captures packet sequence and close without raw IDs or token data',t=>{
 let now=1000
 const h=harness();t.after(h.cleanup)
 createPackHandshakeForensics(h.client,h.file,{clock:()=>now})
 now+=200;h.client.emit('join')
 now+=10;h.client.emit('packet',{data:{name:'resource_packs_info',params:{texture_packs:[{uuid:'secret-pack-id',cdn_url:'https://secret.example/private'}]}}})
 now+=5;h.client.write('client_cache_status',{enabled:false})
 now+=1;h.client.sendMCPE(Buffer.from('PRIVATE-MICROSOFT-TOKEN'),true)
 now+=3;h.client.write('resource_pack_client_response',{response_status:'send_packs',response_status_name:'Downloading',
   resourcepackids:['secret-pack-id_1.0.0']})
 now+=1;h.client.sendMCPE(Buffer.from('REALM-SENSITIVE-RAW-PACKET'),true)
 now+=100;h.client.emit('disconnect',{reason:'private-url https://bad.example/key'})
 h.client._closed=true;h.client.status=0
 now+=2;h.client.emit('close')
 const record=JSON.parse(readFileSync(h.file,'utf8'))
 assert.equal(record.schema,1)
 assert.equal(record.sessions.length,1)
 assert.equal(record.sessions[0].state,'closed')
 const events=record.sessions[0].events
 assert.deepEqual(events.map(e=>e.kind),[
  'session-start','joined','received','write-attempt','send-mcpe','write-attempt','send-mcpe','server-disconnect','client-closed'
 ])
 assert.deepEqual(events.filter(e=>e.kind==='write-attempt').map(e=>e.packet),['client_cache_status','resource_pack_client_response'])
 assert.equal(events.find(e=>e.status==='Downloading').packCount,1)
 assert.equal(events.at(-1).transport,'closed')
 const raw=JSON.stringify(record)
 for(const secret of ['secret-pack-id','PRIVATE-MICROSOFT-TOKEN','REALM-SENSITIVE-RAW-PACKET','https://bad.example','private-url'])assert.equal(raw.includes(secret),false)
})

test('second connection preserves up to two older failed sessions, bounds events and hides unknown packet payloads',t=>{
 let now=2000
 const h=harness();t.after(h.cleanup)
 const audit=createPackHandshakeForensics(h.client,h.file,{clock:()=>now})
 for(let i=0;i<100;i++){now+=1;audit.record('received','resource_pack_chunk_data')}
 h.client.emit('close')
 assert.equal(JSON.parse(readFileSync(h.file,'utf8')).sessions[0].events.length,64)
 for(let n=0;n<3;n++){
  const fresh=harness()
  const replacement=fresh.client
  now+=10000
  createPackHandshakeForensics(replacement,h.file,{clock:()=>now})
  replacement.emit('packet',{data:{name:'PRIVATE_UNKNOWN_TYPE',params:{token:'never serialize'}}})
  replacement.emit('close')
  fresh.cleanup()
 }
 const report=JSON.parse(readFileSync(h.file,'utf8'))
 assert.equal(report.sessions.length,3)
 assert.equal(report.sessions.at(-1).events.at(-2).kind,'session-start')
 assert.equal(JSON.stringify(report).includes('PRIVATE_UNKNOWN_TYPE'),false)
 assert.equal(JSON.stringify(report).includes('never serialize'),false)
})

test('unknown transport status stays unknown instead of falsely claiming delivery',t=>{
 const h=harness();t.after(h.cleanup)
 h.client.connection.connected=undefined
 createPackHandshakeForensics(h.client,h.file,{clock:()=>500})
 h.client.write('resource_pack_client_response',{response_status:'send_packs',resourcepackids:['hidden']})
 const e=JSON.parse(readFileSync(h.file,'utf8')).sessions[0].events.at(-1)
 assert.equal(e.transport,'unknown')
 assert.equal(e.status,'Downloading')
 assert.equal(e.packCount,1)
})
