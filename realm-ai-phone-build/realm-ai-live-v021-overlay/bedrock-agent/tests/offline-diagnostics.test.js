import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createDiagnosticRecorder,sanitizeDiagnosticReport} from '../src/diagnostic-store.js'
import {instrumentAuthflow,authFailurePhase,classifyConnectionFailure} from '../src/connection-diagnostics.js'

test('private diagnostics survive child-process restart and retain the last failure through a new attempt',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-diag-'))
 try{
  const file=path.join(dir,'private','diagnostics','connection.json');let now=100
  const record=createDiagnosticRecorder(file,{clock:()=>now})
  assert(record({phase:'xbox-title-token',authState:'error',failure:{phase:'xbox-title-token',httpStatus:403,advice:'SECRET-ADVICE'},token:'PRIVATE-TOKEN',authChallenge:{userCode:'PRIVATE-CODE'},lastError:'RAW-ERROR',processState:'running'}))
  const text=fs.readFileSync(file,'utf8');for(const secret of ['SECRET-ADVICE','PRIVATE-TOKEN','PRIVATE-CODE','RAW-ERROR'])assert(!text.includes(secret))
  assert.equal(fs.statSync(file).mode&0o077,0);assert.equal(JSON.parse(text).lastFailure.phase,'xbox-title-token')
  now=200;const restarted=createDiagnosticRecorder(file,{clock:()=>now});assert(restarted({phase:'starting',processState:'running'}))
  const report=JSON.parse(fs.readFileSync(file));assert.equal(report.phase,'starting');assert.equal(report.recordedAt,200);assert.equal(report.lastFailure.httpStatus,403);assert.equal(report.lastFailure.recordedAt,100)
  assert.equal(classifyConnectionFailure(new Error('403 Forbidden {}'),'xbox-title-token').advice.includes('before any Realm connection'),true)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('diagnostic snapshots whitelist fields and a disk failure cannot crash the connection',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-diag-'))
 try{
  assert.equal(sanitizeDiagnosticReport(null).phase,'unknown')
  const safe=sanitizeDiagnosticReport({phase:'secret-account@example.com',authState:'token-secret',failure:{phase:'xbox-title-token',httpStatus:403,token:'SECRET'},clientIdentity:{platform:'Android',deviceOS:1,flow:'live',token:'OTHER-SECRET'}})
  assert.equal(safe.phase,'unknown');assert(!JSON.stringify(safe).includes('SECRET'));assert(!JSON.stringify(safe).includes('@'))
  const blocking=path.join(dir,'block');fs.writeFileSync(blocking,'block');assert.equal(createDiagnosticRecorder(path.join(blocking,'data.json'))({phase:'starting'}),false)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
function mobileFlow({status=403,phase='title',valid=true,healthy=false,recoveryDenied=false}={}){
 let current='realm-discovery',recoveries=0,devices=0,sisu=0,reads=0
 const originalError=Object.assign(new Error(`${status} Forbidden {}`),{statusCode:status}),recoveryError=Object.assign(new Error('403 Forbidden {}'),{statusCode:403}),result={XSTSToken:'PRIVATE-XSTS',userHash:'HASH',expiresOn:'future'}
 const flow={options:{flow:'live',authTitle:'0000000048183522',deviceType:'Android'},msa:{async getAccessToken(){reads++;return {valid,token:'EXISTING-MSA'}}},xbl:{
  async getTitleToken(){throw originalError},
  async getDeviceToken(options){devices++;assert.equal(options.deviceType,'Android');assert.equal(options.authTitle,'0000000048183522');return 'NEW-DEVICE'},
  async doSisuAuth(msa,device,options){sisu++;assert.equal(msa,'EXISTING-MSA');assert.equal(device,'NEW-DEVICE');assert.equal(options.relyingParty,'https://pocket.realms.minecraft.net/');if(recoveryDenied)throw recoveryError;return result}
 },async getMsaToken(){throw Error('A recovery must never start a new Microsoft login')},async getXboxToken(){if(healthy)return result;if(phase==='device')throw originalError;return await this.xbl.getTitleToken('EXISTING-MSA','OLD-DEVICE')}}
 instrumentAuthflow(flow,{getPhase:()=>current,setPhase:value=>{current=value},onTitleRecovery:()=>{recoveries++}})
 return {flow,result,originalError,recoveryError,counts:()=>({recoveries,devices,sisu,reads,current})}
}
test('a title-token 403 gets one mobile Sisu attempt using the same Android app identity and cached Microsoft session',async()=>{
 const f=mobileFlow();assert.strictEqual(await f.flow.getXboxToken('https://pocket.realms.minecraft.net/'),f.result)
 assert.deepEqual(f.counts(),{recoveries:1,devices:1,sisu:1,reads:1,current:'realm-discovery'})
 await assert.rejects(f.flow.getXboxToken('https://pocket.realms.minecraft.net/'),e=>e===f.originalError)
 assert.equal(f.counts().recoveries,1);assert.equal(f.counts().sisu,1)
})
test('healthy login, unrelated errors and an expired MSA cache never trigger Sisu or a new login',async()=>{
 for(const config of [{healthy:true},{status:401},{phase:'device'},{valid:false}]){
  const f=mobileFlow(config)
  if(config.healthy)assert.strictEqual(await f.flow.getXboxToken('https://pocket.realms.minecraft.net/'),f.result)
  else await assert.rejects(f.flow.getXboxToken('https://pocket.realms.minecraft.net/'),e=>e===f.originalError)
  assert.equal(f.counts().sisu,0);assert.equal(f.counts().devices,0)
 }
})
test('denied Sisu recovery reports its own stage and does not loop',async()=>{
 const f=mobileFlow({recoveryDenied:true})
 await assert.rejects(f.flow.getXboxToken('https://pocket.realms.minecraft.net/'),e=>e===f.recoveryError)
 assert.equal(authFailurePhase(f.recoveryError),'xbox-sisu-authentication')
 await assert.rejects(f.flow.getXboxToken('https://pocket.realms.minecraft.net/'))
 assert.equal(f.counts().sisu,1)
})
