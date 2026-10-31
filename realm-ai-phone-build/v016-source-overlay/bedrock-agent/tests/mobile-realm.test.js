import test from 'node:test'
import assert from 'node:assert/strict'
import {selectJoinedRealm,buildClientOptions} from '../src/options.js'
import {validate} from '../tools/config.js'
const m={mode:'realm',username:'mobile-auth-cache',botPlayerName:'BotGamerTag',realmName:'',realmId:'',realmInvite:'',offline:false}
const c={minecraft:m,ownerPlayerNames:['OwnerGamerTag'],localAPI:{port:8765,token:'a'.repeat(64)},worldBridge:{allowWorldEdits:false}}
test('existing account can discover realm without invite code',()=>assert.equal(validate(c),c))
test('one joined realm is selected',()=>assert.equal(selectJoinedRealm([{id:101,name:'My Realm'}]).id,101))
test('multiple joined realms require explicit selector',()=>assert.throws(()=>selectJoinedRealm([{name:'One'},{name:'Two'}]),/More than one/))
test('exact name selects one realm',()=>assert.equal(selectJoinedRealm([{name:'One'},{name:'Two'}],'two').name,'Two'))
test('unknown name fails without arbitrary selection',()=>assert.throws(()=>selectJoinedRealm([{name:'One'}],'Two'),/No joined Realm named/))
test('no joined realm fails visibly',()=>assert.throws(()=>selectJoinedRealm([]),/does not have any/))
test('realm options default to pickRealm callback',()=>{const o=buildClientOptions(m,'/tmp',()=>{}); assert.equal(typeof o.realms.pickRealm,'function'); assert.equal(o.raknetBackend,'jsp-raknet')})
