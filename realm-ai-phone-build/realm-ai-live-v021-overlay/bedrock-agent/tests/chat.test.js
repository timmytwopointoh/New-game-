import test from 'node:test'
import assert from 'node:assert/strict'
import {interpretMessage} from '../src/chat.js'
import {chatDispatch,authorized,createApi} from '../src/api.js'

test('friendly conversational follow',()=>assert.equal(interpretMessage('Hey bot, can you follow me around?').command,'follow me'))
test('polite stop',()=>assert.equal(interpretMessage('Please stop following').command,'stop'))
test('gather written count',()=>assert.equal(interpretMessage('gather two oak logs').command,'mine 2 oak_log'))
test('gather plural count',()=>assert.equal(interpretMessage('Collect 3 cobblestone').command,'mine 3 cobblestone'))
test('avoid guessing count',()=>assert.match(interpretMessage('collect some oak logs').message,/How many/))
test('wall natural language',()=>assert.equal(interpretMessage('build a wall 2 by 2 with oak planks').command,'build wall 2 x 2 of oak_planks'))
test('reject giant job',()=>assert.equal(interpretMessage('mine 999 oak logs').command,null))
test('never accept unsupported castle request',()=>assert.equal(interpretMessage('build a castle').command,null))
test('negative instructions safe',()=>assert.equal(interpretMessage("don't mine 2 oak logs").command,null))
test('status',()=>assert.equal(interpretMessage('what are you doing?').command,'status'))
test('conversational response without unsupported world changes',()=>{const agent={send(){throw Error('should not call')}};assert.equal(chatDispatch('hi',agent).queued,false)})
test('accepted message only queued not success',()=>{const agent={send(){return {accepted:true,message:'Sent to server; execution unverified'}}};const r=chatDispatch('follow me',agent);assert.equal(r.queued,true);assert.match(r.message,/unverified/)})
test('bot offline correctly reported',()=>{const agent={send(){return {accepted:false,message:'Not spawned'}}};const r=chatDispatch('follow me',agent);assert.equal(r.accepted,false);assert.match(r.message,/Not spawned/)})
test('constant time token check equality',()=>{const t='a'.repeat(64); assert.equal(authorized(t,t),true);assert.equal(authorized('b'.repeat(64),t),false)})
test('HTTP chat + cursor: loopback only and auth',async()=>{
 const conn={events:[{id:1,source:'Realm',message:'Waiting'}],nextEventId:1,status(){return {spawned:true}},send(){return {accepted:true,message:'Queued; not yet executed'}}}
 const t='a'.repeat(64),api=createApi({localAPI:{token:t}},conn,()=>{}); await new Promise(ok=>api.listen(0,'127.0.0.1',ok))
 try{
 const base=`http://127.0.0.1:${api.address().port}`
 let r=await fetch(base+'/updates?after=0',{headers:{authorization:`Bearer ${t}`}});assert.equal(r.status,200);assert.equal((await r.json()).updates.length,1)
 r=await fetch(base+'/message',{method:'POST',headers:{authorization:`Bearer ${t}`,'content-type':'application/json'},body:JSON.stringify({message:'follow me'})});assert.equal(r.status,200);assert.equal((await r.json()).queued,true)
 r=await fetch(base+'/updates',{headers:{authorization:'Bearer nope'}});assert.equal(r.status,401)
 }finally{await new Promise(ok=>api.close(ok))}
})
