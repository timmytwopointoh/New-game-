import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {RealmChat} from '../src/realm-chat.js'
function fixture(){
 const connection=new EventEmitter()
 connection.username='BotTag';connection.config={minecraft:{botPlayerName:'BotTag'}};connection.spawned=true
 connection.chatDiagnostics={textPackets:0,playerChatPackets:0,aiRequests:0,ownerRequests:0,nonOwnerRequests:0,ignoredSelf:0,replyAttempts:0,replyQueued:0,replyFailures:0,lastRejection:'none'}
 connection.sent=[];connection.say=message=>{connection.sent.push(message);return true}
 connection.status=()=>({spawned:true,username:'BotTag'})
 const planner=new EventEmitter();const calls=[];const controller={planner,message:input=>{calls.push(input);return {message:'Accepted '+input}}}
 const chat=new RealmChat(connection,controller,{ownerPlayerNames:['OwnerTag']},()=>{},{clock:(()=>{let now=1000;return()=>{now+=1000;return now}})()})
 return {connection,controller,chat,calls}
}
test('owner capitalization mismatch still permits exact owner ping',()=>{
 const {connection,chat}=fixture()
 connection.emit('player-chat',{source:'ownertag',message:'!ai ping'})
 assert.equal(connection.sent.length,1)
 assert.match(connection.sent[0],/in the Realm/)
 assert.equal(connection.chatDiagnostics.ownerRequests,1)
 chat.stop()
})
test('near name and unrelated player cannot execute or receive ping replies',()=>{
 const {connection,chat,calls}=fixture()
 connection.emit('player-chat',{source:'OwnerTag2',message:'!ai follow me'})
 connection.emit('player-chat',{source:'stranger',message:'!ai ping'})
 assert.deepEqual(calls,[])
 assert.deepEqual(connection.sent,[])
 assert.equal(connection.chatDiagnostics.nonOwnerRequests,2)
 chat.stop()
})
test('prefix accepted, ordinary chat ignored, exact owner commands dispatched',()=>{
 const {connection,chat,calls}=fixture()
 connection.emit('player-chat',{source:'OwnerTag',message:'hello all'})
 connection.emit('player-chat',{source:'OwnerTag',message:'!ai follow me'})
 assert.deepEqual(calls,['follow me'])
 assert.equal(connection.chatDiagnostics.aiRequests,1)
 assert.equal(connection.chatDiagnostics.ownerRequests,1)
 assert.match(connection.sent[0],/Accepted/)
 chat.stop()
})
