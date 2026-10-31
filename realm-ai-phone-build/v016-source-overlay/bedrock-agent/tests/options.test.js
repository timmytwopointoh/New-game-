import test from 'node:test'
import assert from 'node:assert/strict'
import {buildClientOptions} from '../src/options.js'
const base={mode:'realm',username:'auth-cache',realmInvite:'abc',offline:false}
test('Realm join uses invite without host/port',()=>{const o=buildClientOptions(base,'/tmp/bot',()=>{});assert.deepEqual(o.realms,{realmInvite:'abc'});assert.equal(o.host,undefined);assert.equal(o.offline,false)})
test('Realm id takes precedence when present',()=>assert.deepEqual(buildClientOptions({...base,realmId:'123'},'/tmp/bot',()=>{}).realms,{realmId:'123'}))
test('ordinary server joins by host and port',()=>{const o=buildClientOptions({...base,mode:'server',host:'localhost',port:19132},'/tmp/bot',()=>{});assert.equal(o.host,'localhost');assert.equal(o.port,19132);assert.equal(o.realms,undefined)})
