import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyFollowPatch,LiveFollowPatchStream,FOLLOW_PATCH_DEFAULTS,FOLLOW_PATCH_FEED} from '../src/live-follow-patches.js'

// This is an offline fixture signed by the field-trial Ed25519 key. Tests never
// fetch GitHub, move a bot or touch a real Realm.
const valid={
 schema:1,sequence:1,channel:'realm-follow-safe',
 issuedAt:'2026-11-06T00:00:00.000Z',expiresAt:'2026-12-31T23:59:59.000Z',
 policy:{replanIntervalMs:1250,waypointCooldownMs:120000,waypointMaxVisits:2,
  maxSegmentBlocks:14,candidateLimit:24,maxRouteNodes:768,maxApproachBlocks:4},
 signature:'OAxtbC/UFMPFRc4OdI4ElCBZIW9Be/m9MTcasoBbdw/iPSXKmhX3CAbAvY8WUnT2oowKvE8Uug1OCoR9Ui+lAQ=='
}
const at=Date.parse('2026-11-06T12:00:00Z')
test('only an Ed25519 signed, exact-shape, in-range navigation policy passes',()=>{
 const policy=verifyFollowPatch(JSON.stringify(valid),{now:at})
 assert.deepEqual(policy.policy,FOLLOW_PATCH_DEFAULTS)
 assert.equal(policy.sequence,1)
 for(const variant of [
  {...valid,policy:{...valid.policy,maxRouteNodes:10000}},
  {...valid,policy:{...valid.policy,replanIntervalMs:500}},
  {...valid,channel:'other'},
  {...valid,signature:'A'.repeat(86)+'=='},
  {...valid,schema:2},
  {...valid,extra:'eval'},
  {...valid,expiresAt:'2026-11-01T00:00:00Z'}
 ]){
  assert.throws(()=>verifyFollowPatch(JSON.stringify(variant),{now:at}))
 }
 assert.throws(()=>verifyFollowPatch(JSON.stringify(valid),{now:at,minimumSequence:2}))
})
test('signed policy updates a live Follow object in-place; no stop or reconnect',async()=>{
 const navigation={job:{kind:'follow',name:'Owner',goal:{x:162,y:96,z:53}},
  stop(){throw new Error('Should never stop Realm navigation')},detach(){throw new Error('No disconnect')}}
 let requests=0
 const fetcher=async(url,opts)=>{
  requests++;assert.equal(url,FOLLOW_PATCH_FEED)
  assert.equal(opts.redirect,'error')
  return new Response(JSON.stringify(valid),{status:200,headers:{'content-type':'application/json'}})
 }
 const events=[]
 const stream=new LiveFollowPatchStream(navigation,{fetcher,report:m=>events.push(m)})
 const clock=Date.now
 try{
  // The signed manifest has an actual expiry, so use an injected test clock.
  Date.now=()=>at
  const first=await stream.check()
  assert.equal(first.updated,true)
  assert.equal(stream.sequence,1)
  assert.equal(navigation.job.kind,'follow')
  assert.equal(navigation.job.name,'Owner')
  assert.equal(navigation.job.goal.x,162)
  assert.equal(navigation.liveFollowPolicy.maxApproachBlocks,4)
  const repeat=await stream.check()
  assert.equal(repeat.updated,false)
  assert.equal(requests,2)
  assert.equal(events.length,1)
 }finally{Date.now=clock;stream.stop()}
})
test('offline and invalid feeds leave existing policy and mission untouched',async()=>{
 const n={job:{kind:'follow',name:'Owner'}}
 const stream=new LiveFollowPatchStream(n,{fetcher:async()=>new Response('unauthorized',{status:403})})
 const result=await stream.check()
 assert.equal(result.updated,false)
 assert.equal(n.job.name,'Owner')
 assert.equal(n.liveFollowPolicy.maxRouteNodes,FOLLOW_PATCH_DEFAULTS.maxRouteNodes)
 stream.stop()
})
