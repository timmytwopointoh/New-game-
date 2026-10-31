import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {CommandPlans,commandCatalog,parseDescriptor} from '../src/survival/command-plans.js'
import {understandCommand} from '../src/survival/language.js'
import {RealmChat} from '../src/realm-chat.js'

function clockFixture(){
 let now=1000,serial=0
 const jobs=new Map()
 const schedule=(fn,delay)=>{const id=++serial;jobs.set(id,{fn,at:now+delay});return id}
 const unschedule=id=>jobs.delete(id)
 const advance=ms=>{const end=now+ms
  while(true){const entries=[...jobs].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)
   if(!entries.length)break
   const [id,job]=entries[0];jobs.delete(id);now=job.at;job.fn()
  }
  now=end
 }
 const commands=[],nav={job:null,mining:{job:null},state:'idle',reason:''}
 const controller={connection:{spawned:true,config:{ownerPlayerNames:[]}},world:{players:new Map(),inventory:new Map()},navigation:nav,handle:command=>{commands.push([command,now]);return {accepted:true,message:command}}}
 const plans=new CommandPlans(controller,{clock:()=>now,schedule,unschedule})
 return {plans,commands,nav,advance,clock:()=>now,scheduled:()=>jobs.size,controller}
}
test('command catalog ends with one Diagnostics card and no separate diagnostics choices',()=>{
 const ids=commandCatalog.map(x=>x.id)
 assert.equal(ids.at(-1),'diagnostics')
 for(const old of ['status','movement','control_status','player_identity','inventory_status','combat_status'])assert(!ids.includes(old))
 assert.equal(parseDescriptor('survival status').id,'diagnostics')
 assert.equal(parseDescriptor('combat status').id,'diagnostics')
 assert.equal(parseDescriptor('diagnostics').id,'diagnostics')
})
test('ordered queue executes every card, with exactly 2000ms between successive activations',()=>{
 const {plans,commands,advance,clock}=clockFixture()
 for(const id of ['inventory','diagnostics','help'])plans.prepare({id,values:{}})
 assert.equal(commands.length,0)
 assert(plans.startAll().accepted)
 assert.deepEqual(commands.map(x=>x[0]),['inventory'])
 assert.equal(plans.snapshot().nextAt,clock()+2000)
 advance(1999);assert.equal(commands.length,1)
 advance(1);assert.deepEqual(commands.map(x=>x[0]),['inventory','diagnostics'])
 advance(2000);assert.deepEqual(commands.map(x=>x[0]),['inventory','diagnostics','help survival'])
 assert.equal(commands[1][1]-commands[0][1],2000)
 assert.equal(commands[2][1]-commands[1][1],2000)
 assert.equal(plans.runActive,false)
})
test('long movement must end BEFORE 2-second gap, and Stop prevents stale delayed instructions',()=>{
 const {plans,commands,advance,nav,scheduled}=clockFixture()
 plans.prepare({id:'look',values:{}});plans.prepare({id:'diagnostics',values:{}})
 const original=plans.controller.handle
 plans.controller.handle=(raw)=>{const r=original(raw);if(raw==='look around')nav.job={kind:'solo'};return r}
 plans.startAll();assert.equal(commands.length,1)
 advance(9000);assert.equal(commands.length,1)
 nav.job=null;nav.state='arrived-predicted'
 advance(250);assert.equal(commands.length,1)
 advance(1999);assert.equal(commands.length,1)
 advance(1);assert.equal(commands.length,2)
 assert.equal(plans.runActive,false)
 assert.equal(scheduled(),0)
})
test('queue stops on rejected item, never sends subsequent cards, and can be explicitly restarted',()=>{
 const {plans,commands,advance}=clockFixture()
 plans.prepare({id:'inventory',values:{}});plans.prepare({id:'diagnostics',values:{}})
 plans.controller.handle=raw=>{commands.push(raw);return {accepted:false,message:'Server denied action'}}
 const x=plans.startAll();assert.equal(x.accepted,true)
 assert.equal(plans.cards[0].state,'blocked')
 assert.equal(plans.runActive,false)
 advance(10000);assert.deepEqual(commands,['inventory'])
})
test('Stop and Realm change invalidate pending timer, never resume saved queue automatically',()=>{
 const {plans,commands,advance,scheduled}=clockFixture()
 plans.prepare({id:'inventory',values:{}});plans.prepare({id:'diagnostics',values:{}})
 plans.startAll();assert.equal(scheduled(),1);plans.interrupt()
 advance(3000);assert.equal(commands.length,1)
 assert.equal(plans.runActive,false)
 plans.startAll();plans.setScope('new-realm')
 advance(4000);assert.equal(commands.length,2);assert.equal(plans.cards.length,0)
})
test('users can reorder cards while stopped; no select card and no edits while active',()=>{
 const {plans}=clockFixture()
 plans.prepare({id:'inventory',values:{}});plans.prepare({id:'help',values:{}})
 assert.deepEqual(plans.cards.map(c=>c.descriptor.id),['inventory','help'])
 plans.move(2,-1)
 assert.deepEqual(plans.cards.map(c=>c.descriptor.id),['help','inventory'])
 assert.throws(()=>plans.select(2),/Selection was removed/)
 plans.startAll()
 assert.throws(()=>plans.move(2,1),/Stop/)
 assert.throws(()=>plans.delete(2),/Stop/)
 plans.interrupt()
})
test('offline language understanding recognizes practical commands without inventing unsupported mechanics',()=>{
 const pairs=[
 ['could you follow me','follow me'],
 ['come here','follow me'],
 ['please go to 3 64 -4','walk to 3 64 -4'],
 ['break the block at 2 65 1','dig 2 65 1'],
 ['look at 1 65 2','look at 1 65 2'],
 ['where is my shovel','inventory'],
 ['are you okay','diagnostics'],
 ['what can you do','help survival'],
 ['run the commands','run queue'],
 ['stop now','stop']
 ]
 for(const [raw,expected] of pairs)assert.equal(understandCommand(raw),expected,raw)
 assert.equal(understandCommand('build me a castle now'),null)
 assert.equal(understandCommand('delete my save data'),null)
 assert.equal(understandCommand('look at 0 60 0\nstop'),null)
})
test('in-game owner commands execute via bot as authenticated player and answer in Realm chat',()=>{
 const conn=new EventEmitter(),answers=[],actions=[],planner=new EventEmitter()
 Object.assign(conn,{username:'RealmAI',config:{minecraft:{botPlayerName:'RealmAI'}},spawned:true,say:message=>{answers.push(message);return true},events:[],nextEventId:0,
 survival:{handle:cmd=>{actions.push(cmd);return {accepted:true,message:'I will '+cmd}}}})
 const controller={planner,message:cmd=>{actions.push('queue:'+cmd);return {accepted:true,message:'Queue started',plans:{runActive:true}}}}
 const chat=new RealmChat(conn,controller,{ownerPlayerNames:['Owner']},()=>{},{clock:()=>5000,cooldownMs:900})
 conn.emit('player-chat',{source:'Visitor',message:'!ai dig 2 65 1'})
 assert.equal(actions.length,0)
 conn.emit('player-chat',{source:'Owner',message:'Hello all'})
 assert.equal(actions.length,0)
 conn.emit('player-chat',{source:'owner',message:'!ai come here'})
 assert.deepEqual(actions,['follow me'])
 assert.match(answers.at(-1),/follow me/)
 conn.emit('player-chat',{source:'Owner',message:'RealmAI, are you okay'})
 assert.equal(actions.length,1) // cooldown avoids rapid repeated commands from same owner after case normalization
 chat.stop()
})
