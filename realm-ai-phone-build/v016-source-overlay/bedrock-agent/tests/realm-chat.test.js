import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createApi} from '../src/api.js'
import {RealmChat} from '../src/realm-chat.js'
class FakeConnection extends EventEmitter {
 constructor(){super();this.sent=[];this.reply=[];this.nextEventId=0;this.events=[];this.spawned=true;this.username='BotTag';this.config={minecraft:{botPlayerName:'BotTag'}}}
 send(text){this.sent.push(text);return {accepted:true,message:'Submitted to Realm chat, not verified'}}
 say(text){this.reply.push(text);return true}
 status(){return {spawned:this.spawned,username:this.username,joined:true,connected:true}}
 report(text){const e={id:++this.nextEventId,message:text,source:'Realm'};this.events.push(e);this.emit('realm-report',e)}
}
const config={localAPI:{token:'e'.repeat(64)},ownerPlayerNames:['OwnerTag']}
function make(){const c=new FakeConnection(),srv=createApi(config,c,()=>{});const rc=new RealmChat(c,srv.controller,config,()=>{},{cooldownMs:900,clock:(()=>{let n=2000;return ()=>{n+=1000;return n}})()});return {c,srv,rc}}
test('in-Realm chat allows the exact owner and blocks guests, bot echoes and near-name impersonation',()=>{
 const {c,srv,rc}=make();
 c.emit('player-chat',{source:'Stranger',message:'!ai plan gather 2 oak logs'});
 c.emit('player-chat',{source:'OwnerTag2',message:'!ai gather 2 oak logs'});
 c.emit('player-chat',{source:'BotTag',message:'!ai follow me'});
 assert.equal(c.reply.length,0); assert.equal(c.sent.length,0);
 c.emit('player-chat',{source:'OwnerTag',message:'!ai hello'});
 assert.match(c.reply.at(-1),/in the Realm/);
 c.emit('player-chat',{source:'OwnerTag',message:'hi everyone'});assert.equal(c.reply.length,1);
 rc.stop();srv.close();
})
test('Realm chat and phone share the same plan, with approval and report-ordered execution',async()=>{
 const {c,srv,rc}=make(); await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${srv.address().port}`;
 const post=async(text)=>{const r=await fetch(url+'/message',{method:'POST',headers:{Authorization:'Bearer '+'e'.repeat(64),'Content-Type':'application/json'},body:JSON.stringify({message:text})});return r.json()};
 try{
  c.emit('player-chat',{source:'OwnerTag',message:'!ai plan find iron ore then gather 2 iron ore'});
  assert.equal(srv.controller.planner.snapshot().state,'preview');assert.equal(c.sent.length,0);
  const start=await post('start plan');assert.equal(start.queued,true);
  assert.deepEqual(c.sent,['find iron_ore']);
  c.report('Nearest scanned iron_ore: 1,2,3 (only nearby loaded blocks).');assert.deepEqual(c.sent,['find iron_ore','mine 2 iron_ore']);
  c.report('Finished mining iron_ore: 2/2 successful.');assert.equal(srv.controller.planner.snapshot().state,'completed');
  assert.ok(c.reply.at(0).includes('Plan #'));
 }finally{rc.stop();await new Promise(resolve=>srv.close(resolve))}
})
test('in-Realm messages report pending actions, never pretend they succeeded',()=>{
 const {c,srv,rc}=make();c.emit('player-chat',{source:'OwnerTag',message:'@veilforge follow me'});
 assert.deepEqual(c.sent,['follow me']);assert.match(c.reply.at(-1),/not verified/i);
 rc.stop();srv.close()
})
test('normal chat error replies arrive as HTTP 200 rather than fake network errors',async()=>{
 const {c,srv,rc}=make();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 try{const r=await fetch(`http://127.0.0.1:${srv.address().port}/message`,{method:'POST',headers:{Authorization:'Bearer '+'e'.repeat(64),'Content-Type':'application/json'},body:JSON.stringify({message:'start plan'})});assert.equal(r.status,200);const v=await r.json();assert.equal(v.accepted,false);assert.match(v.message,/No pending plan/i)}
 finally{rc.stop();await new Promise(resolve=>srv.close(resolve))}
})
