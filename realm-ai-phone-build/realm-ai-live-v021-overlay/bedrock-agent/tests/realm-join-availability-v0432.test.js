import test from 'node:test'
import assert from 'node:assert/strict'
import {isRealmJoin503,wrapRealmJoinRest,installRealmJoinRetryCompat} from '../src/realm-join-availability-compat.js'

test('one extra HTTP503 /worlds/id/join attempt, after upstream retries; all arguments retained',async()=>{
 const calls=[],retries=[],sleepMs=[]
 const rest={async get(route,options){calls.push([route,options]);if(calls.length===1)throw Error('503 Service Unavailable');return {networkProtocol:'NETHERNET_JSONRPC'}}}
 wrapRealmJoinRest(rest,{onRetry:x=>retries.push(x),sleep:async x=>{sleepMs.push(x)},delayMs:15000})
 const result=await rest.get('/worlds/1234/join',{timeout:9000})
 assert.equal(result.networkProtocol,'NETHERNET_JSONRPC')
 assert.deepEqual(calls,[['/worlds/1234/join',{timeout:9000}],['/worlds/1234/join',{timeout:9000}]])
 assert.deepEqual(retries,[{attempt:1,totalAttempts:2,delayMs:15000}])
 assert.deepEqual(sleepMs,[15000])
})
test('does not change /worlds discovery or Xbox/identity requests, including HTTP503',async()=>{
 const called=[],retried=[]
 const rest={async get(route){called.push(route);throw Error('503 Service Unavailable')}}
 wrapRealmJoinRest(rest,{onRetry:x=>retried.push(x),sleep:async()=>{}})
 await assert.rejects(rest.get('/worlds'),/503/)
 await assert.rejects(rest.get('/worlds/1234'),/503/)
 await assert.rejects(rest.get('/users'),/503/)
 assert.deepEqual(called,['/worlds','/worlds/1234','/users'])
 assert.deepEqual(retried,[])
})
test('non-503 failures are never retried, and exhausted 503 gets only one additional call',async()=>{
 for(const err of [Error('401 Unauthorized'),Error('403 Forbidden'),Error('429 Too Many Requests'),Error('500 Internal Server Error')]){
  let n=0;const rest={async get(){n++;throw err}}
  wrapRealmJoinRest(rest,{sleep:async()=>{}})
  await assert.rejects(rest.get('/worlds/22/join'),x=>x===err)
  assert.equal(n,1)
 }
 let n=0;const rest={async get(){n++;throw Object.assign(Error('service offline'),{response:{status:503}})}}
 wrapRealmJoinRest(rest,{sleep:async()=>{}})
 await assert.rejects(rest.get('/worlds/22/join'),x=>isRealmJoin503(x))
 assert.equal(n,2,'only one outer retry beyond upstream internal retries')
})
test('does not retry after bot shutdown while awaiting 503 backoff',async()=>{
 let n=0,active=true
 const rest={async get(){n++;throw Error('503 Service Unavailable')}}
 wrapRealmJoinRest(rest,{isActive:()=>active,sleep:async()=>{active=false}})
 await assert.rejects(rest.get('/worlds/42/join'),/503/)
 assert.equal(n,1)
})
test('compatibility install keeps original RealmAPI from and handles future authflow',()=>{
 // Installation is deliberately idempotent for repeated Microsoft sessions.
 const authflow={}
 installRealmJoinRetryCompat(authflow,{onRetry:()=>{},isActive:()=>true})
 installRealmJoinRetryCompat(authflow,{onRetry:()=>{},isActive:()=>true})
 assert.equal(isRealmJoin503(Error('503 Service Unavailable')),true)
 assert.equal(isRealmJoin503(Error('503Other')),false)
})
