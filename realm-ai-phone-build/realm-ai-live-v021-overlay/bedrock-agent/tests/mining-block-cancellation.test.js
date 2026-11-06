import test from 'node:test'
import assert from 'node:assert/strict'
import {MiningJobs} from '../src/survival/mining-jobs.js'

// Regression: a failed mining/strip job must not throw a TypeError while
// it is trying to report the ORIGINAL reason for stopping. It must never
// create unverified blocks, pickups or successful task receipts.
test('blocked excavation preserves its reason if a legacy resource adapter has no cancel()',()=>{
 const calls=[]
 const c={navigation:{stop:(...args)=>calls.push(['navigation',args])},
  resources:{active:null},operations:{pending:null},report:reason=>calls.push(['report',reason])}
 const jobs=new MiningJobs(c)
 jobs.active={request:{kind:'strip'},state:'excavating',index:0,breaks:0,pickups:0,reason:''}
 assert.doesNotThrow(()=>jobs.block('Missing verified terrain'))
 assert.equal(jobs.active.state,'blocked')
 assert.equal(jobs.active.reason,'Missing verified terrain')
 assert.equal(jobs.snapshot().confirmedBreaks,0)
 assert.equal(jobs.snapshot().confirmedPickups,0)
 assert.deepEqual(calls.map(x=>x[0]),['navigation','report'])
 assert.equal(calls[1][1],'Missing verified terrain')
})

test('blocked excavation cancels initialized child services exactly once',()=>{
 const calls=[]
 const c={
  navigation:{stop:(reason,disconnect)=>calls.push(['navigation',reason,disconnect])},
  resources:{cancel:reason=>calls.push(['resources',reason])},
  operations:{cancel:reason=>calls.push(['operations',reason])},
  report:reason=>calls.push(['report',reason])
 }
 const jobs=new MiningJobs(c)
 jobs.active={request:{kind:'quarry'},state:'breaking',index:1,breaks:0,pickups:0}
 jobs.block('No server block receipt')
 assert.equal(jobs.active.state,'blocked')
 assert.deepEqual(calls.map(x=>x[0]),['navigation','resources','operations','report'])
 assert.equal(calls[0][2],false,'Stopping mining must not disconnect Realm')
 assert(calls.every(x=>x[1]==='No server block receipt'))
})
