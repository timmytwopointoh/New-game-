import test from 'node:test'
import assert from 'node:assert/strict'
import {buildClientOptions} from '../src/options.js'
const base={mode:'realm',username:'auth-cache',realmInvite:'abc',offline:false}
test('Realm join uses invite without host/port',()=>{const o=buildClientOptions(base,'/tmp/bot',()=>{});assert.deepEqual(o.realms,{realmInvite:'abc'});assert.equal(o.host,undefined);assert.equal(o.offline,false)})
test('Realm id takes precedence when present',()=>assert.deepEqual(buildClientOptions({...base,realmId:'123'},'/tmp/bot',()=>{}).realms,{realmId:'123'}))
test('ordinary server joins by host and port',()=>{const o=buildClientOptions({...base,mode:'server',host:'localhost',port:19132},'/tmp/bot',()=>{});assert.equal(o.host,'localhost');assert.equal(o.port,19132);assert.equal(o.realms,undefined)})
test('phone client identifies as Minecraft Android and preserves the existing live auth cache',()=>{const o=buildClientOptions(base,'/private/bot',()=>{});assert.equal(o.authTitle,'0000000048183522');assert.equal(o.deviceType,'Android');assert.equal(o.deviceOS,1);assert.equal(o.flow,'live');assert.deepEqual(o.skinData,{CurrentInputMode:2,DefaultInputMode:2});assert.equal(o.profilesFolder,'/private/bot/private/auth');assert.equal(o.forceRefresh,undefined)})
