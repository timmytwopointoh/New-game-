import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {classifyOwnerChatAction,executeOwnerChatAction} from '../src/owner-chat-actions.js'
import {createApi} from '../src/api.js'

const noAction=[
 'dang u should have grabbed that while you were there tirionomni',
 'tirionomni is near a tree',
 'you should have followed me yesterday',
 'i was thinking about how to follow me',
 'where is the player tirionomni?',
 'why did you not follow me?',
 'when you said follow me i laughed'
]
test('owner requests normalize to one direct follow job but casual remarks are not commands',()=>{
 for(const phrase of ['follow me','please follow me','can you follow me?',
  'come to me','come here','come her','walk to me','get over here','find me',
  'go ahead and follow me','follow Owner']){
  const intent=classifyOwnerChatAction(phrase)
  assert.equal(intent?.type,'follow',phrase)
 }
 for(const phrase of noAction)assert.equal(classifyOwnerChatAction(phrase),null,phrase)
})

test('live dispatch returns queued job receipt without falsely claiming server movement',()=>{
 const calls=[]
 const nav={pendingFollow:null,job:null,state:'idle'}
 const survival={navigation:nav,handle(raw){
  calls.push(raw);nav.pendingFollow={name:'Owner'};nav.state='waiting-for-readiness'
  return {accepted:true,queued:true,message:'I will follow when movement is verified.'}
 }}
 const result=executeOwnerChatAction('come here',survival)
 assert.deepEqual(calls,['follow me'])
 assert.equal(result.accepted,true)
 assert.equal(result.queued,true)
 assert.equal(result.action?.type,'follow')
 assert.equal(result.action?.state,'waiting-for-readiness')
 assert.equal(result.action?.verifiedMovement,false)
})

test('action refusal and missing controller are distinct from a completed job',()=>{
 const missing=executeOwnerChatAction('follow me',null)
 assert.equal(missing.accepted,false)
 assert.equal(missing.action.state,'not-connected')
 const rejected=executeOwnerChatAction('follow me',{
  navigation:{pendingFollow:null,job:null},
  handle:()=>({accepted:false,queued:false,message:'Actual player needs to spawn first.'})
 })
 assert.equal(rejected.action.state,'rejected')
 assert.equal(rejected.action.verifiedMovement,false)
})

test('real local HTTP /message sends a name-directed chat request to movement controller',async()=>{
 class FakeConnection extends EventEmitter {
  constructor(){super()
   this.spawned=true;this.username='tirionomni'
   this.config={minecraft:{botPlayerName:'tirionomni'},ownerPlayerNames:['Owner']}
   this.events=[];this.nextEventId=0;this.calls=[]
   const nav={pendingFollow:null,job:null,state:'idle'}
   this.survival={
    navigation:nav,
    companion:{handle:()=>null,beforeOwnerAction:()=>{},afterOwnerAction:()=>{}},
    voice:{handle:()=>null,frame:s=>s},
    resourceRecall:{handle:()=>null},
    commandPlans:{snapshot:()=>({cards:[],capacity:5,running:null})},
    handle:raw=>{
     this.calls.push(raw)
     if(raw==='follow me'||raw==='follow Owner'){
      nav.pendingFollow={name:'Owner'}
      nav.state='waiting-for-readiness'
      return {accepted:true,queued:true,message:'Following Owner when movement is safe.'}
     }
     return {accepted:false,queued:false,message:'Unrecognized action.'}
    }
   }
  }
  status(){return {spawned:true}}
  send(){return {accepted:false,message:'Not a verified in-game chat request.'}}
 }
 const connection=new FakeConnection()
 const server=createApi({localAPI:{token:'a'.repeat(64)}},connection,()=>{})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 try {
  const url='http://127.0.0.1:'+server.address().port
  const send=async message=>{
   const response=await fetch(url+'/message',{method:'POST',
    headers:{authorization:'Bearer '+'a'.repeat(64),'content-type':'application/json'},
    body:JSON.stringify({message,epoch:0})})
   return {status:response.status,body:await response.json()}
  }
  let result=await send('hey tirionomni come her')
  assert.equal(result.status,200)
  assert.equal(result.body.accepted,true)
  assert.equal(result.body.action?.type,'follow')
  assert.equal(result.body.action?.state,'waiting-for-readiness')
  assert.equal(result.body.action?.verifiedMovement,false)
  assert.deepEqual(connection.calls,['follow me'])
  const other=await send('dang u should have grabbed that while you were there tirionomni')
  assert.equal(other.status,200)
  assert.deepEqual(connection.calls,['follow me'],'third-person mention must not become a second job')
  result=await send('follow me')
  assert.equal(result.body.accepted,true)
  assert.deepEqual(connection.calls,['follow me','follow me'])
  const unauth=await fetch(url+'/message',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({message:'follow me'})})
  assert.equal(unauth.status,401)
 }finally{await new Promise(resolve=>server.close(resolve))}
})
