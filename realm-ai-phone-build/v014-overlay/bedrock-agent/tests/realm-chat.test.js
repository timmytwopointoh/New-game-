import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {RealmChat} from '../src/realm-chat.js'
import {createApi} from '../src/api.js'
import {SurvivalController} from '../src/survival/controller.js'

function setup({clock=()=>5000}={}){
 const conn=new EventEmitter(),sent=[],responses=[],planner=new EventEmitter()
 Object.assign(conn,{config:{minecraft:{botPlayerName:'RealmAI'},ownerPlayerNames:['Owner']},username:'RealmAI',
  spawned:true,connected:true,events:[],nextEventId:0,say:x=>{responses.push(x);return true}})
 const survival={handle:cmd=>{sent.push(cmd);return {accepted:true,message:'Action requested: '+cmd}}}
 conn.survival=survival
 const commands=[]
 const controller={planner,message:cmd=>{commands.push(cmd);return {accepted:true,message:'Queue accepted',plans:{runActive:true}}}}
 const chat=new RealmChat(conn,controller,{ownerPlayerNames:['Owner']},()=>{},{clock})
 return {conn,sent,responses,commands,chat,planner}
}
test('Realm bot answers only explicit owner-addressed messages, ignoring bystanders and its own echo',()=>{
 const x=setup()
 x.conn.emit('player-chat',{source:'Visitor',message:'!ai dig 4 64 1'})
 x.conn.emit('player-chat',{source:'Ownerr',message:'!ai follow me'})
 x.conn.emit('player-chat',{source:'RealmAI',message:'!ai follow me'})
 x.conn.emit('player-chat',{source:'Owner',message:'Is anybody here?'})
 assert.deepEqual(x.sent,[]);assert.deepEqual(x.responses,[])
 x.conn.emit('player-chat',{source:'Owner',message:'!ai hello'})
 assert.match(x.responses.at(-1),/in the Realm/)
 assert.deepEqual(x.sent,[])
 x.chat.stop()
})
test('owner uses natural instructions; real gameplay action is requested and acknowledged in world chat',()=>{
 const x=setup()
 x.conn.emit('player-chat',{source:'owner',message:'!ai come here'})
 assert.deepEqual(x.sent,['follow me'])
 assert.match(x.responses.at(-1),/Action requested: follow me/)
 x.chat.stop()
})
test('only exact bot gamertag mention or !ai prefix is accepted, no global chat interception',()=>{
 const x=setup()
 x.conn.emit('player-chat',{source:'Owner',message:'Somebody move over there'})
 assert.equal(x.sent.length,0)
 x.conn.emit('player-chat',{source:'Owner',message:'RealmAI, please go to 3 64 -1'})
 assert.deepEqual(x.sent,['walk to 3 64 -1'])
 x.chat.stop()
})
test('unsupported language cannot invent gameplay and is reported accurately',()=>{
 const x=setup()
 x.conn.emit('player-chat',{source:'Owner',message:'!ai spawn 300 diamonds'})
 assert.deepEqual(x.sent,[])
 assert.match(x.responses.at(-1),/did not understand/)
 x.chat.stop()
})
test('owner rate limit is case-insensitive and Stop bypasses it',()=>{
 let now=5000
 const x=setup({clock:()=>now})
 x.conn.emit('player-chat',{source:'OWNER',message:'!ai follow me'})
 x.conn.emit('player-chat',{source:'owner',message:'!ai look around'})
 assert.deepEqual(x.sent,['follow me'])
 x.conn.emit('player-chat',{source:'Owner',message:'!ai stop'})
 assert.deepEqual(x.commands,['stop'])
 now+=1000
 x.conn.emit('player-chat',{source:'owner',message:'!ai diagnostics'})
 assert.deepEqual(x.sent,['follow me','diagnostics'])
 x.chat.stop()
})
test('chat and phone share one ordered queue, not a separate plan runner',()=>{
 const x=setup()
 x.conn.emit('player-chat',{source:'Owner',message:'!ai run queue'})
 assert.deepEqual(x.commands,['run queue'])
 assert.equal(x.chat.observingPlan,true)
 assert.match(x.responses.at(-1),/Queue accepted/)
 x.chat.stop()
})
test('stop disconnects listener and prevents further AI actions',()=>{
 const x=setup();x.chat.stop()
 x.conn.emit('player-chat',{source:'Owner',message:'!ai dig 1 64 2'})
 assert.deepEqual(x.sent,[])
 assert.equal(x.responses.length,0)
})
