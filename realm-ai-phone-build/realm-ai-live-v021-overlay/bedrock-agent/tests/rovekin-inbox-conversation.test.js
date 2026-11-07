import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {OwnerInbox} from '../src/survival/owner-inbox.js'
import {ConversationMemory} from '../src/survival/conversation-memory.js'

function fixture(){
 const now=Date.now(),responses=[]
 const project={stage:2,review:null,proximityReview:null,pending:null}
 const comp={editScope:()=>({realm:'realm-A',dimension:0}),homeProject:project,edits:{pending:null},
  handle:command=>{responses.push(command);return {accepted:true,queued:true,message:'Handled '+command}}}
 const c={survival:{companion:comp,world:{dimension:0},commandVocabulary:{scope:'realm-A'}}}
 let interpretation=null
 const interpreted=[]
 const inbox=new OwnerInbox(c,{interpretation:()=>interpretation,dispatch:q=>{
  interpreted.push(q);return {accepted:true,queued:false,message:'Learned choice.'}
 }})
 return {inbox,comp,project,responses,now,interpreted,setInterpretation:v=>{interpretation=v}}
}
test('home clearance becomes one scoped envelope request and approves only its exact code',()=>{
 const {inbox,project,responses,now}=fixture()
 project.review={code:'123456',position:{x:17,y:64,z:11},name:'grass_block',scope:'realm-A',dimension:0,stage:2,expires:now+60000,reason:'near an old build'}
 const requests=inbox.snapshot(now).requests
 assert.equal(requests.length,1)
 assert.equal(requests[0].title,'Remove one obstruction?')
 const good=inbox.respond({id:requests[0].id,decision:'approve'},now)
 assert.equal(good.accepted,true)
 assert.deepEqual(responses,['confirm clearance 123456'])
 const fake=inbox.respond({id:'clearance-madeup',decision:'approve'},now)
 assert.equal(fake.accepted,false)
 assert.equal(responses.length,1)
})
test('explain is never secretly permission, denial cancels only the exact pending edit',()=>{
 const {inbox,project,responses,now}=fixture()
 project.proximityReview={code:'888222',nearby:'sign',stage:2,scope:'realm-A',dimension:0,expires:now+60000}
 const card=inbox.pending(now)[0]
 const note=inbox.respond({id:card.id,decision:'explain',explanation:'The sign is mine, but do not remove it.'},now)
 assert.equal(note.accepted,true)
 assert.equal(responses.length,0)
 assert.equal(inbox.snapshot(now).count,1)
 const no=inbox.respond({id:card.id,decision:'deny'},now)
 assert.equal(no.accepted,true)
 assert.deepEqual(responses,['cancel home proximity'])
})
test('multiple permissions never use ambiguous yes and a new stage invalidates old approval',()=>{
 const {inbox,project,responses,now}=fixture()
 project.proximityReview={code:'123456',scope:'realm-A',dimension:0,stage:2,expires:now+60000}
 project.review={code:'999444',scope:'realm-A',dimension:0,stage:2,expires:now+60000,position:{x:1,y:4,z:5}}
 assert.equal(inbox.confirmSingleFromChat('confirm',now).accepted,false)
 assert.equal(responses.length,0)
 const old=inbox.pending(now)[0]
 project.stage=3
 assert.equal(inbox.respond({id:old.id,decision:'approve'},now).accepted,false)
 assert.equal(responses.length,0)
})
test('stale Realm prompts and expired approval are never acted on',()=>{
 const {inbox,project,responses,comp,now}=fixture()
 project.review={code:'111222',scope:'realm-A',dimension:0,stage:2,expires:now+1000,position:{x:1,y:2,z:3}}
 const id=inbox.pending(now)[0].id
 assert.equal(inbox.respond({id,decision:'approve'},now+2000).accepted,false)
 comp.editScope=()=>({realm:'realm-B',dimension:0})
 assert.equal(inbox.pending(now).length,0)
 assert.equal(responses.length,0)
})
test('action teaching requires owner selection and never mines on its own',()=>{
 const {inbox,now,interpreted,setInterpretation}=fixture()
 setInterpretation({kind:'unknown-action',word:'flarn',input:'flarn some wood',scope:'realm-A',createdAt:now})
 const card=inbox.pending(now)[0]
 assert.equal(card.kind,'clarification')
 assert(card.options.includes('dig'))
 const item=card.options.indexOf('dig')
 assert.equal(inbox.respond({id:card.id,decision:'choose',choice:item},now).accepted,true)
 assert.deepEqual(interpreted,['dig'])
 assert.equal(inbox.respond({id:card.id,decision:'choose',choice:999},now).accepted,false)
})
test('recent conversation persists only per Realm, redacts secrets, and answers recall safely',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-recent-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const memory=new ConversationMemory({directory:dir,scope:'realm-A'})
 assert(memory.remember('owner','Please follow me to our home'))
 assert(memory.remember('rovekin','We are going to check your original house.'))
 assert(memory.remember('owner','Contact me at someone@example.com, thanks'))
 const reload=new ConversationMemory({directory:dir,scope:'realm-A'})
 assert.equal(reload.entries.length,3)
 assert.match(reload.entries[2].text,/\[private email\]/)
 assert.match(reload.respondToRecall('what did we talk about').message,/follow me/)
 reload.setScope('realm-B')
 assert.equal(reload.entries.length,0)
 assert.equal(reload.respondToRecall('do you remember what I said').conversation.remembered,0)
 assert.equal(reload.remember('owner','password: supersecret'),false)
})
