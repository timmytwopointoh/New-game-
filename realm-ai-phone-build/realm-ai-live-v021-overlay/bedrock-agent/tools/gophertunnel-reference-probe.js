// Run only on loopback against reference-lab/gophertunnel-pack-peer.
// Uses real Bedrock protocol networking and the application's pack handler,
// not EventEmitter-simulated pack packets. No account tokens or real Realm.
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {attachRealmPacks} from '../src/realm-packs.js'
import {preparePackResponseWire} from '../src/bedrock-pack-wire-compat.js'

const require=createRequire(import.meta.url)
const {createClient}=require('bedrock-protocol')
const port=Number(process.env.VF_REF_PORT||19174)
if(process.env.VF_REFERENCE_TEST!=='1'||!Number.isSafeInteger(port)||port<1024||port>65535)
  throw Error('Reference lab must be explicitly enabled and use a valid loopback port')
preparePackResponseWire({version:'1.26.60'},undefined,{strategy:'original-working'})
const dir=mkdtempSync(path.join(os.tmpdir(),'vf-gophertunnel-ref-'))
const client=createClient({
  host:'127.0.0.1',port,version:'1.26.60',transport:'raknet',
  offline:true,username:'VFReferenceProbe',skipPing:true,autoInitPlayer:false,
  raknetBackend:'jsp-raknet',
  conLog:(...args)=>console.log('VF_REF_BOT_CONNECTION: '+args.map(String).join(' ').slice(0,250))
})
let headers=0,chunks=0,ready=false,closed=false,packInfo=false,infoCount=0
let handler
for(const event of ['connect_allowed','session','join','play_status','network_settings','server_to_client_handshake'])
  client.on(event,()=>console.log('VF_REF_BOT_EVENT: '+event))
function end(ok,why){
  if(closed)return
  closed=true
  console.log('VF_REF_BOT_FINAL: '+JSON.stringify({
    result:ok?'first-header-confirmed':'failed',reason:why,
    packInfo,infoCount,headers,chunks,ready
  }))
  try{handler?.cleanup?.()}catch{}
  try{client.close()}catch{}
  try{rmSync(dir,{recursive:true,force:true})}catch{}
  setTimeout(()=>process.exit(ok?0:1),25)
}
handler=attachRealmPacks(client,path.join(dir,'cache'),state=>{
  if(state.stage==='packs-ready')ready=true
  if(state.stage==='pack-error')console.error('VF_REF_BOT_PACK_ERROR: '+state.reason)
},{handshakeMode:'original-working',noPackGraceMs:0,heartbeatMs:100,
  checkStorage:()=>({freeMB:20000,neededMB:10,reserveMB:256})})
client.on('resource_packs_info',p=>{
  packInfo=true;infoCount=Array.isArray(p?.texture_packs)?p.texture_packs.length:0
  console.log('VF_REF_BOT_PACK_INFO: '+infoCount)
})
client.on('resource_pack_data_info',()=>{
  headers++
  console.log('VF_REF_BOT_HEADER: '+headers)
  // The first server-originated header is the gate that live Realm attempts
  // have not yet passed; let the real handler proceed for subsequent packets.
})
client.on('resource_pack_chunk_data',()=>{chunks++})
client.on('resource_pack_stack',()=>{console.log('VF_REF_BOT_STACK: received')})
client.on('start_game',()=>{console.log('VF_REF_BOT_START_GAME: true');end(headers>0,'start-game')})
client.on('error',e=>console.error('VF_REF_BOT_CLIENT_ERROR: '+String(e?.stack||e?.message||e).slice(0,550)))
client.on('close',()=>end(headers>0,'closed'))
setTimeout(()=>end(headers>0,'bounded-timeout'),30000)
