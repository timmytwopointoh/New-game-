import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {classifyConversation,isConversationUtterance,respondToConversation} from '../src/conversation.js'
import {createApi} from '../src/api.js'
import {RealmChat} from '../src/realm-chat.js'

function memory(){return {recent:()=>[{role:'owner',text:'We were exploring a forest'}]}}
test('ordinary dialogue is NOT an unsupported Minecraft/code command',()=>{
 for(const q of [
  'Hi', 'Hello!', 'How are you?', 'Tell me a joke', 'Thanks', 
  "I'm bored", 'You keep getting stuck', 'You never answer me',
  'Tell me something','Do you understand me?', 'What do you think of building?',
  'What are you working on?', 'Are you okay?', 'What should we do next?',
  'I think the game needs more trees','What about that?'])
  assert.equal(isConversationUtterance(q),true,q)
 for(const action of ['follow me','mine 12 oak logs','walk to 1 64 2','build wall 2 by 2 with dirt at 1 64 2','command dig 1 64 2'])
  assert.equal(isConversationUtterance(action),false,action)
})
test('a live-state question describes real observation, not an imagined successful job',()=>{
 const nav={state:'waiting-for-readiness',reason:'Own server movement ability layer not yet received.',
  job:{kind:'follow'}}
 const said=respondToConversation('What are you working on?',{navigation:nav})
 assert.match(said,/waiting-for-readiness/)
 assert.match(said,/not yet received/)
 assert.doesNotMatch(said,/Got it|not an action|unsupported command/i)
 const health=respondToConversation('Are you okay?',{world:{attributes:{'minecraft:health':4}}})
 assert.match(health,/low on health/i)
 assert.match(health,/4/)
 const idle=respondToConversation('What are you doing?',{navigation:{state:'stopped',job:null}})
 assert.match(idle,/not have an active/)
})
test('recent Realm conversation is actually used for a follow-up but cannot authorize work',()=>{
 const said=respondToConversation('What about that?',{memory:memory()})
 assert.match(said,/exploring a forest/i)
 assert.match(said,/not assume a new Minecraft instruction/i)
})
test('open conversation questions get relevant bounded replies instead of one repeated code fallback',()=>{
 const m={memory:memory()}
 const questions=['Hi','How are you?','Tell me a joke',
  'Can you hear me?', "I'm bored", 'What do you think about my house?',
  'Why do you never answer me?', 'What should we do next?']
 const replies=questions.map(q=>respondToConversation(q,m))
 assert.equal(new Set(replies).size,questions.length)
 for(const text of replies){
  assert(typeof text==='string'&&text.length>15,text)
  assert(!/got it\. i.ll treat that as chat|isn.t a code response|unsupported command/i.test(text),text)
 }
})
class TestConnection extends EventEmitter{
 constructor(){
  super()
  this.spawned=true
  this.username='Bot'
  this.config={minecraft:{botPlayerName:'Bot'},ownerPlayerNames:['Owner']}
  this.events=[];this.nextEventId=0;this.actions=[]
  this.survival={
   world:{attributes:{'minecraft:health':20},inventoryKnown:false},
   navigation:{job:null,state:'stopped',reason:'Waiting for a safe movement task.'},
   companion:{handle:()=>null,beforeOwnerAction:()=>{},afterOwnerAction:()=>{}},
   resourceRecall:{handle:()=>null},
   commandPlans:{snapshot:()=>({cards:[],capacity:5,running:null})},
   commandVocabulary:{scope:null,expandMaterials:t=>({text:t}),meaning:()=>null},
   voice:{handle:()=>null,frame:s=>s},
   resources:{start:raw=>{this.actions.push('RESOURCE:'+raw);return null}},
   handle:raw=>{this.actions.push('GAME:'+raw);return {accepted:true,queued:true,message:'Started a game task.'}}
  }
 }
 send(raw){this.actions.push('SEND:'+raw);return {accepted:false,message:'Not authorized.'}}
 status(){return {connected:true,spawned:true}}
}
test('phone POST /message answers chat, greetings, feelings and knowledge without dispatching game commands',async()=>{
 const conn=new TestConnection()
 const token='q'.repeat(64)
 const server=createApi({localAPI:{token}},conn,()=>{})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const url='http://127.0.0.1:'+server.address().port
 const send=async message=>{
  const r=await fetch(url+'/message',{method:'POST',headers:{
   authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({message})})
  assert.equal(r.status,200)
  return await r.json()
 }
 try{
  const samples=['Hi', 'How are you?', 'Tell me a joke', "I'm bored",
   'Do you understand me?', 'Why do you never answer me?',
   'What do you think of building a house?', 'What are you doing?',
   'What is an oak log?']
  const responses=[]
  for(const q of samples){
   const response=await send(q)
   assert.equal(response.accepted,true,q)
   assert.equal(response.queued,false,q)
   assert(typeof response.message==='string'&&response.message.length>15,q)
   responses.push(response.message)
  }
  assert.equal(conn.actions.length,0,'no game command is launched by normal chat')
  assert(new Set(responses).size>=6,'different questions have meaningfully different replies')
  const next=await send('follow me')
  assert.equal(next.accepted,true)
  assert(conn.actions.includes('GAME:follow me'),'supported direct follow still works')
  const anonymous=await fetch(url+'/message',{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({message:'follow me'})})
  assert.equal(anonymous.status,401)
 }finally{await new Promise(resolve=>server.close(resolve))}
})

test('addressed in-Game owner greeting and check-in become real conversation, not connection ping',()=>{
 const c=new EventEmitter()
 c.username='Bot';c.config={minecraft:{botPlayerName:'Bot'}}
 c.spawned=true;c.chatDiagnostics={}
 const received=[],sent=[]
 c.say=m=>{sent.push(m);return true}
 const planner=new EventEmitter()
 const api={planner,message:q=>{received.push(q);return {accepted:true,queued:false,message:'Conversational reply to '+q}}}
 const chat=new RealmChat(c,api,{ownerPlayerNames:['Owner']},()=>{}, {cooldownMs:0,clock:(()=>{let n=1;return ()=>n++*1000})()})
 c.emit('player-chat',{source:'Owner',message:'Bot, hello'})
 c.emit('player-chat',{source:'Owner',message:'Bot, are you there?'})
 c.emit('player-chat',{source:'Other',message:'Bot, hello'})
 assert.deepEqual(received,['hello','are you there?'])
 assert.equal(sent.length,2)
 assert(sent.every(m=>m.startsWith('Conversational reply')))
 chat.stop()
})
