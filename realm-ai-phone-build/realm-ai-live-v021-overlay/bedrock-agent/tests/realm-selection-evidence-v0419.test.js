import test from 'node:test'
import assert from 'node:assert/strict'
import {summarizeJoinedRealmMatches,selectJoinedRealm} from '../src/options.js'
import {sanitizeDiagnosticReport} from '../src/diagnostic-store.js'

test('Realm name evidence counts matches without leaking private joined Realm names or IDs',()=>{
 const realms=[
  {name:'Petalwimds Copy',id:'PRIVATE_REALM_ID'},
  {name:'Other Private Realm',id:'PRIVATE_OTHER_ID'}
 ]
 const evidence=summarizeJoinedRealmMatches(realms,'My World')
 assert.deepEqual(evidence,{joinedRealmsCount:2,exactNameMatches:0,petalNameCandidates:1,configuredNamePresent:true})
 assert.doesNotMatch(JSON.stringify(evidence),/Petalwimds|PRIVATE_|Other Private/)
 const saved=sanitizeDiagnosticReport({phase:'realm-selecting',state:'exact-name-not-found',...evidence,realmInvite:'SECRET_INVITE',secret:'PRIVATE_REALM_ID'})
 assert.equal(saved.realmSelectionState,'exact-name-not-found')
 assert.equal(saved.joinedRealmsCount,2)
 assert.equal(saved.exactNameMatches,0)
 assert.equal(saved.petalNameCandidates,1)
 assert.doesNotMatch(JSON.stringify(saved),/SECRET_INVITE|PRIVATE_REALM_ID|Petalwimds/)
 assert.throws(()=>selectJoinedRealm(realms,'My World'),/No joined Realm named/)
 assert.deepEqual(selectJoinedRealm(realms,'Petalwimds Copy'),realms[0])
})

test('One exact matching Realm is selected without choosing a different world by default',()=>{
 const realms=[{name:'My World',id:'r1'},{name:'Other',id:'r2'}]
 const evidence=summarizeJoinedRealmMatches(realms,'My World')
 assert.equal(evidence.exactNameMatches,1)
 assert.equal(evidence.petalNameCandidates,0)
 assert.equal(selectJoinedRealm(realms,'My World').id,'r1')
 assert.throws(()=>selectJoinedRealm(realms,'Wrong World'),/No joined Realm named/)
})

test('Missing or ambiguous Realm matches never trigger an arbitrary first-Realm selection',()=>{
 assert.deepEqual(summarizeJoinedRealmMatches([], 'My World'),{joinedRealmsCount:0,exactNameMatches:0,petalNameCandidates:0,configuredNamePresent:true})
 assert.throws(()=>selectJoinedRealm([], 'My World'),/does not have any joined Realms/)
 assert.throws(()=>selectJoinedRealm([{name:'My World'},{name:'MY WORLD'}], 'My World'),/Multiple joined Realms/)
})
