import test from 'node:test'
import assert from 'node:assert/strict'
import {OwnerInbox} from '../src/survival/owner-inbox.js'

const clock=()=>Date.now()
function fixture(scope='realm-A'){
 const triggered=[]
 const pending={review:null,proximityReview:null,pending:null,stage:1}
 const companion={editScope:()=>({realm:scope}),homeProject:pending,edits:{pending:null},
  handle:command=>{triggered.push(command);return {accepted:true,queued:true,message:'Allowed '+command}}}
 const connection={survival:{companion,world:{dimension:0},commandVocabulary:{scope}}}
 return {inbox:new OwnerInbox(connection),companion,connection,pending,triggered}
}
test('a visible sample question works before Realm spawn; both yes and no are zero-world-action acknowledgements',()=>{
 const {inbox,connection,triggered}=fixture()
 connection.survival=null
 assert.equal(inbox.snapshot().count,0)
 const a=inbox.createDemo()
 assert.equal(a.accepted,true)
 assert.equal(a.inbox.count,1)
 assert.equal(a.inbox.requests[0].kind,'demo')
 assert.match(a.inbox.requests[0].title,/practice/i)
 const again=inbox.createDemo()
 assert.equal(again.inbox.requests[0].id,a.inbox.requests[0].id,'no duplicate spam')
 const received=inbox.respond({id:a.inbox.requests[0].id,decision:'approve'})
 assert.match(received.message,/practice response received/i)
 assert.equal(received.inbox.count,0)
 assert.deepEqual(triggered,[])
 const b=inbox.createDemo()
 assert.equal(inbox.respond({id:b.inbox.requests[0].id,decision:'deny'}).accepted,true)
 assert.deepEqual(triggered,[])
})
test('practice explanation is a real dialog response, but not gameplay authorization',()=>{
 const {inbox,triggered}=fixture()
 const id=inbox.createDemo().inbox.requests[0].id
 const r=inbox.respond({id,decision:'explain',explanation:'This is my real test response'})
 assert.equal(r.accepted,true)
 assert.match(r.message,/no world action/i)
 assert.equal(r.inbox.count,0)
 assert.deepEqual(triggered,[])
 assert.equal(inbox.respond({id,decision:'approve'}).accepted,false,'cannot replay used test')
})
test('real permission is never impersonated by safe practice mode',()=>{
 const {inbox,pending,triggered}=fixture()
 const now=clock()
 const d=inbox.createDemo(now).inbox.requests[0]
 pending.proximityReview={code:'123456',scope:'realm-A',dimension:0,stage:1,expires:now+120000,nearby:'fence'}
 const list=inbox.snapshot(now)
 assert.equal(list.count,2)
 assert(list.requests.some(x=>x.kind==='permission'))
 assert(list.requests.some(x=>x.kind==='demo'))
 const demoApproval=inbox.respond({id:d.id,decision:'approve'},now)
 assert.equal(demoApproval.accepted,true)
 assert.equal(triggered.length,0)
 assert.equal(inbox.snapshot(now).count,1,'real request remains pending')
 const real=inbox.snapshot(now).requests[0]
 assert.equal(real.kind,'permission')
 const yes=inbox.respond({id:real.id,decision:'approve'},now)
 assert.equal(yes.accepted,true)
 assert.deepEqual(triggered,['confirm home proximity 123456'])
})
test('expired approval is visible only as non-actionable history and never authorizes a stale stage',()=>{
 const {inbox,pending,triggered}=fixture()
 const now=clock()
 pending.review={code:'654321',scope:'realm-A',dimension:0,stage:1,expires:now+1000,
  position:{x:1,y:65,z:2},name:'oak_log',reason:'near owned structure'}
 const r=inbox.snapshot(now)
 assert.equal(r.count,1)
 const staleId=r.requests[0].id
 const after=inbox.snapshot(now+4000)
 assert.equal(after.count,0)
 assert.equal(after.recent.length,1)
 assert.equal(after.recent[0].status,'expired')
 assert.equal(after.recent[0].actionable,false)
 assert.equal(after.recent[0].title,'Remove one obstruction?')
 assert.equal(inbox.respond({id:staleId,decision:'approve'},now+4000).accepted,false)
 assert.equal(triggered.length,0)
})
test('stale permission history vanishes on Realm switch without leaking previous questions',()=>{
 const {inbox,connection,pending}=fixture()
 const now=clock()
 pending.review={code:'111222',scope:'realm-A',dimension:0,stage:1,expires:now+2500,
  position:{x:2,y:64,z:2},name:'dirt'}
 inbox.snapshot(now)
 inbox.snapshot(now+3000)
 assert.equal(inbox.snapshot(now+3000).recent.length,1)
 connection.survival.companion.editScope=()=>({realm:'realm-B'})
 connection.survival.commandVocabulary.scope='realm-B'
 const newView=inbox.snapshot(now+3001)
 assert.equal(newView.recent.length,0)
 assert.equal(newView.count,0)
})
test('a help or clarification question is not confused with consent or practice card',()=>{
 const {inbox,triggered}=fixture()
 const now=clock()
 inbox.createDemo(now)
 const r=inbox.confirmSingleFromChat('confirm',now)
 assert.equal(r,null)
 assert.deepEqual(triggered,[])
})
