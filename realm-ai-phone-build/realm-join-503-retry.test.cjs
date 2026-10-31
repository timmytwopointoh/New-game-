'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const {joinRealmWithRetry,isJoinServiceUnavailable}=require('./realm-join-503-retry.cjs')
const httpError = (status) => Object.assign(new Error('HTTP '+status+' Service Unavailable'),{response:{status}})
test('only a transient join 503 retries and then succeeds with same request function',async()=>{
  let requests=0
  const state=[],waits=[]
  const joined=await joinRealmWithRetry(
    async()=>{requests++;if(requests<3)throw httpError(503);return {address:'server-placeholder',networkProtocol:'RAKNET'}},
    e=>state.push(e),
    async ms=>waits.push(ms)
  )
  assert.equal(requests,3); assert.equal(joined.address,'server-placeholder')
  assert.deepEqual(waits,[1800,3600])
  assert.deepEqual(state.map(x=>x.attempt),[1,2])
  assert.equal(state[1].totalAttempts,4)
})
test('failed permanent 503 stops after four requests without resetting auth',async()=>{
  let count=0
  await assert.rejects(joinRealmWithRetry(async()=>{count++;throw httpError(503)},()=>{},async()=>{}),/503 after 4 attempts/)
  assert.equal(count,4)
})
test('401 login error is not retried or converted to 503',async()=>{
  let n=0
  const err=httpError(401)
  await assert.rejects(joinRealmWithRetry(async()=>{n++;throw err},()=>{},async()=>{}), e=>e===err)
  assert.equal(n,1)
})
test('response status and 503 text recognized, without leaking private URL',async()=>{
  assert.equal(isJoinServiceUnavailable({response:{status:503}}),true)
  assert.equal(isJoinServiceUnavailable({response:{status:401},message:'503 Service Unavailable'}),false)
  assert.equal(isJoinServiceUnavailable({message:'503 Service Unavailable Retry again later'}),true)
  assert.equal(isJoinServiceUnavailable({message:'x503error'}),false)
})
test('UI callback failure never converts successful join into a failure',async()=>{
  let c=0
  const result=await joinRealmWithRetry(async()=>{c++;if(c===1)throw httpError(503);return 'joined'},()=>{throw Error('UI broken')},async()=>{})
  assert.equal(result,'joined')
})
