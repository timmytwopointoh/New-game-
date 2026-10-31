import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {instrumentAuthflow,authFailurePhase,classifyConnectionFailure} from '../src/connection-diagnostics.js'
import {Connection} from '../src/connection.js'
import {buildClientOptions} from '../src/options.js'
import {createApi} from '../src/api.js'
const {Authflow,Titles}=createRequire(import.meta.url)('prismarine-auth')

test('login uses the library Switch identity and isolated persistent cache, preserving original callback and old files',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-auth-test-'))
 try{
  const callback=()=>{},o=buildClientOptions({mode:'realm',username:'unchanged-cache',offline:false},dir,callback)
  assert.equal(o.authTitle,Titles.MinecraftNintendoSwitch);assert.equal(o.deviceType,'Nintendo');assert.equal(o.deviceOS,12);assert.equal(o.flow,'live')
  assert.equal(o.profilesFolder,path.join(dir,'private','auth','switch'));assert.equal(o.forceRefresh,undefined)
  fs.mkdirSync(o.profilesFolder,{recursive:true});const androidMarker=path.join(dir,'private','auth','existing-android-session.marker');fs.writeFileSync(androidMarker,'keep-old-login');const marker=path.join(o.profilesFolder,'existing-session.marker');fs.writeFileSync(marker,'preserve-me')
  const flow=new Authflow(o.username,o.profilesFolder,o,callback),observed=instrumentAuthflow(flow,{getPhase:()=> 'realm-discovery',setPhase:()=>{}})
  assert.strictEqual(observed,flow);assert.strictEqual(flow.codeCallback,callback);assert.strictEqual(flow.options,o)
  assert.equal(fs.readFileSync(marker,'utf8'),'preserve-me');assert.equal(fs.readFileSync(androidMarker,'utf8'),'keep-old-login');assert.equal(buildClientOptions({mode:'realm',username:'unchanged-cache'},dir,callback).profilesFolder,o.profilesFolder);assert.equal(o.forceRefresh,undefined)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('diagnostics preserve method arguments/results and attribute nested 403 to the exact failing token stage',async()=>{
 let phase='realm-discovery',calls=0
 const rejection=new Error('403 Forbidden {}'),flow={xbl:{async getDeviceToken(options){calls++;assert.deepEqual(options,{deviceType:'Android'});throw rejection}},async getXboxToken(){return await this.xbl.getDeviceToken({deviceType:'Android'})}}
 instrumentAuthflow(flow,{getPhase:()=>phase,setPhase:p=>{phase=p}})
 await assert.rejects(flow.getXboxToken(),e=>e===rejection)
 assert.equal(calls,1);assert.equal(authFailurePhase(rejection),'xbox-device-token')
 assert.equal(classifyConnectionFailure(rejection,authFailurePhase(rejection)).httpStatus,403)
 assert.equal(classifyConnectionFailure(rejection,authFailurePhase(rejection)).category,'access-denied')
})
test('a recovered token retry cannot mislabel a later Realm-list failure',async()=>{
 let phase='realm-discovery',calls=0
 const earlier=new Error('temporary token problem'),later=new Error('403 Forbidden {}')
 const flow={xbl:{async getDeviceToken(){if(++calls===1)throw earlier;return 'private-device-token'}},async getXboxToken(){try{return await this.xbl.getDeviceToken()}catch{return await this.xbl.getDeviceToken()}}}
 instrumentAuthflow(flow,{getPhase:()=>phase,setPhase:p=>{phase=p}})
 assert.equal(await flow.getXboxToken(),'private-device-token');assert.equal(calls,2);assert.equal(phase,'realm-discovery')
 assert.equal(authFailurePhase(later),undefined);assert.equal(classifyConnectionFailure(later,phase).phase,'realm-discovery')
})
test('device-code callback and existing cached session results are passed through without new calls',async()=>{
 let phase='realm-discovery',callbackCode='',calls=0
 const result={token:'PRIVATE',chain:['PRIVATE-CHAIN']},flow={msa:{async authDeviceCode(cb){calls++;cb({user_code:'ONE-TIME'});return result}},async getMsaToken(){return await this.msa.authDeviceCode(code=>{callbackCode=code.user_code})}}
 instrumentAuthflow(flow,{getPhase:()=>phase,setPhase:p=>{phase=p}})
 assert.strictEqual(await flow.getMsaToken(),result);assert.equal(calls,1);assert.equal(callbackCode,'ONE-TIME');assert.equal(phase,'realm-discovery')
})
test('authenticated diagnostic export contains no tokens, device codes, account names, URLs or raw errors',async()=>{
 const connection=new Connection({minecraft:{mode:'realm',username:'PRIVATE-EMAIL',botPlayerName:'PRIVATE-NAME'},ownerPlayerNames:[]},()=>{})
 connection.lastPhase='realm-discovery';connection.authChallenge={userCode:'PRIVATE-CODE'};connection.lastError='403 Forbidden Bearer PRIVATE-TOKEN https://secret.invalid'
 connection.lastFailure=classifyConnectionFailure(new Error(connection.lastError),connection.lastPhase)
 const api=createApi({localAPI:{token:'PRIVATE-API'}},connection,()=>{});await new Promise(r=>api.listen(0,'127.0.0.1',r))
 try{
  const url='http://127.0.0.1:'+api.address().port+'/diagnostics'
  assert.equal((await fetch(url)).status,401)
  const response=await fetch(url,{headers:{Authorization:'Bearer PRIVATE-API'}}),text=await response.text(),data=JSON.parse(text)
  assert.equal(response.status,200);assert.equal(data.failure.httpStatus,403);assert.equal(data.deviceCodePending,true);assert.equal(data.savedAuthentication,'kept')
  for(const secret of ['PRIVATE-EMAIL','PRIVATE-NAME','PRIVATE-CODE','PRIVATE-TOKEN','PRIVATE-API','secret.invalid'])assert(!text.includes(secret))
  assert.equal(connection.authChallenge.userCode,'PRIVATE-CODE')
 }finally{await new Promise(r=>api.close(r))}
})

test('cached Live access-token expiry uses seconds, retains cache and refresh token, and expires at the correct time',async()=>{
 const {correctLiveTokenExpiry}=await import('../src/connection-diagnostics.js')
 const cached={token:{obtainedOn:1000000,expires_in:3600,access_token:'PRIVATE-ACCESS',refresh_token:'PRIVATE-REFRESH'}}
 let now=1010000,reads=0
 const flow={options:{flow:'live'},msa:{cache:{async getCached(){reads++;return cached}}}}
 correctLiveTokenExpiry(flow,{clock:()=>now})
 const valid=await flow.msa.getAccessToken();assert.equal(valid.valid,true);assert.equal(valid.until,3590000);assert.equal(valid.token,'PRIVATE-ACCESS')
 now=4600000;assert.equal((await flow.msa.getAccessToken()).valid,false)
 assert.equal(cached.token.refresh_token,'PRIVATE-REFRESH');assert.equal(reads,2)
 for(const expires_in of [0,-1,'garbage',Infinity,999999999]){cached.token.expires_in=expires_in;assert.equal(await flow.msa.getAccessToken(),undefined)}
 const unchanged=()=>{};const other={options:{flow:'msal'},msa:{getAccessToken:unchanged,cache:{getCached(){}}}};correctLiveTokenExpiry(other);assert.strictEqual(other.msa.getAccessToken,unchanged)
})

test('the actual bundled auth library reuses a ten-second-old one-hour token after the unit fix without any network login',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-token-regression-'))
 try{
  const options=buildClientOptions({mode:'realm',username:'saved-session',offline:false},dir,()=>{throw Error('Must not request a new code for a valid token')})
  const flow=new Authflow(options.username,options.profilesFolder,options,()=>{throw Error('Must not request a new code')})
  await flow.msa.cache.setCachedPartial({token:{obtainedOn:Date.now()-10000,expires_in:3600,access_token:'SAVED-ACCESS',refresh_token:'SAVED-REFRESH'}})
  assert.equal((await flow.msa.getAccessToken()).valid,false,'Reproduce the bundled seconds/milliseconds bug')
  flow.msa.refreshTokens=()=>{throw Error('Unexpected network refresh')}
  let phase='realm-discovery';instrumentAuthflow(flow,{getPhase:()=>phase,setPhase:p=>{phase=p}})
  assert.equal((await flow.msa.getAccessToken()).valid,true)
  assert.equal(await flow.getMsaToken(),'SAVED-ACCESS')
  assert.equal(phase,'realm-discovery')
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
