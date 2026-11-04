import test from 'node:test'
import assert from 'node:assert/strict'
import {buildClientOptions} from '../src/options.js'
const base={mode:'realm',username:'auth-cache',realmInvite:'abc',offline:false}
test('Realm join uses invite without host/port',()=>{const o=buildClientOptions(base,'/tmp/bot',()=>{});assert.deepEqual(o.realms,{realmInvite:'abc'});assert.equal(o.host,undefined);assert.equal(o.offline,false)})
test('Realm id takes precedence when present',()=>assert.deepEqual(buildClientOptions({...base,realmId:'123'},'/tmp/bot',()=>{}).realms,{realmId:'123'}))
test('ordinary server joins by host and port',()=>{const o=buildClientOptions({...base,mode:'server',host:'localhost',port:19132},'/tmp/bot',()=>{});assert.equal(o.host,'localhost');assert.equal(o.port,19132);assert.equal(o.realms,undefined)})
test('phone client restores Switch authentication with its own persistent cache and keeps touch movement input',()=>{const o=buildClientOptions(base,'/private/bot',()=>{});assert.equal(o.authTitle,'00000000441cc96b');assert.equal(o.deviceType,'Nintendo');assert.equal(o.deviceOS,12);assert.equal(o.flow,'live');assert.deepEqual(o.skinData,{CurrentInputMode:2,DefaultInputMode:2});assert.equal(o.profilesFolder,'/private/bot/private/auth/switch');assert.equal(o.forceRefresh,undefined)})

import {selectJoinedRealm} from '../src/options.js'
test('single joined Realm is selected even when the saved display name is stale',()=>{
 const only={id:'real-world-id',name:'Whatever the Realm currently reports'}
 assert.equal(selectJoinedRealm([only],'My Realm'),only)
 assert.equal(selectJoinedRealm([only],''),only)
})
test('multiple joined Realms still need a unique match',()=>{
 const a={id:'a',name:'My Realm'};const b={id:'b',name:'Other Realm'}
 assert.equal(selectJoinedRealm([a,b],'My Realm'),a)
 assert.throws(()=>selectJoinedRealm([a,b],''),/More than one joined Realm/)
})

test('duplicate Realm names prefer the confirmed owner rather than another owner',()=>{
 const own={id:'wanted',name:'My Realm',owner:'ezilyincred',state:'OPEN'}
 const other={id:'other',name:'My Realm',owner:'someone-else',state:'OPEN'}
 assert.equal(selectJoinedRealm([other,own],'My Realm','ezilyincred'),own)
 assert.equal(buildClientOptions({mode:'realm',realmName:'My Realm',username:'bot'},'/tmp/bot',()=>{}).realms.pickRealm([other,own]),own)
})
test('duplicate Realm entries fail closed when owner cannot be distinguished',()=>{
 const a={id:'a',name:'My Realm',owner:'ezilyincred',state:'OPEN'}
 const b={id:'b',name:'My Realm',owner:'ezilyincred',state:'OPEN'}
 assert.throws(()=>selectJoinedRealm([a,b],'My Realm','ezilyincred'),/Duplicate Realm names/)
})
test('single expected Realm owner remains selectable after renaming',()=>{
 const owner={id:'a',name:'Changed display name',owner:'ezilyincred'}
 assert.equal(selectJoinedRealm([owner,{id:'other',name:'My Realm',owner:'other'}],'My Realm','ezilyincred'),owner)
})

test('never select even a single Realm with confirmed wrong owner',()=>{
 assert.throws(()=>selectJoinedRealm([{id:'wrong',name:'My Realm',owner:'other'}],'My Realm','ezilyincred'),/unexpected owner/)
})
