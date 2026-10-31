import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {Planner,parseGoal,outcome} from '../src/planner.js'
class MockConnection extends EventEmitter{
  constructor(){super();this.spawned=true;this.nextEventId=0;this.sent=[];this.events=[]}
  send(command){this.sent.push(command);return {accepted:true,message:'Sent to Realm chat; unverified'}}
  report(message){const ev={id:++this.nextEventId,message,source:'Realm'};this.events.push(ev);this.emit('realm-report',ev)}
}
test('breaks a bounded natural-language goal into verified commands',()=>{
 const p=parseGoal('find iron ore and gather 2 iron ore')
 assert.deepEqual(p.steps.map(x=>x.command),['find iron_ore','mine 2 iron_ore'])
 assert.equal(p.needsApproval,true)
})
test('stages world-edit goals without sending anything',()=>{
 const c=new MockConnection(),p=new Planner(c)
 const r=p.handle('plan gather 3 oak logs then survey nearby')
 assert.equal(r.queued,false);assert.equal(c.sent.length,0);assert.equal(p.snapshot().total,2)
 assert.equal(p.snapshot().worldEdits,true)
})
test('runs one step only after prior Realm confirmation',()=>{
 const c=new MockConnection(),p=new Planner(c,{timeoutMs:2000})
 p.handle('plan find iron ore then gather 2 iron ore')
 assert.equal(p.handle('start plan').queued,true)
 assert.deepEqual(c.sent,['find iron_ore'])
 c.report('Nearest scanned iron_ore: 3, 67, 6 (only nearby loaded blocks).')
 assert.deepEqual(c.sent,['find iron_ore','mine 2 iron_ore'])
 c.report('Starting mining iron_ore (2 steps max).')
 assert.equal(p.snapshot().state,'running')
 c.report('Finished mining iron_ore: 2/2 successful.')
 assert.equal(p.snapshot().state,'completed');assert.equal(p.snapshot().current,2)
 p.clearTimer()
})
test('rejects incomplete or partial world modifications',()=>{
 const c=new MockConnection(),p=new Planner(c,{timeoutMs:2000})
 p.handle('plan gather 4 oak logs then inventory');p.start()
 c.report('Finished mining oak_log: 3/3 successful.')
 assert.equal(p.snapshot().state,'failed');assert.deepEqual(c.sent,['mine 4 oak_log'])
})
test('halts after missing or negative scan rather than mining',()=>{
 const c=new MockConnection(),p=new Planner(c,{timeoutMs:2000})
 p.handle('plan find iron ore then gather 2 iron ore');p.start()
 c.report('No iron_ore found in the immediate loaded area.')
 assert.equal(p.snapshot().state,'failed');assert.deepEqual(c.sent,['find iron_ore'])
})
test('blocks unsupported large vague goals',()=>{
 for(const phrase of ['build me a house','explore the whole Nether','craft a diamond sword','fight a creeper'])assert.ok(parseGoal(phrase).error)
})
test('does not accept more than four steps',()=>assert.ok(parseGoal('status then survey then inventory then position then players').error))
test('refuses running a plan before spawn',()=>{
 const c=new MockConnection();c.spawned=false;const p=new Planner(c);p.handle('plan where are you');assert.equal(p.start().queued,false);assert.equal(c.sent.length,0)
})
test('cancel sends stop once and never continues on stale replies',()=>{
 const c=new MockConnection(),p=new Planner(c,{timeoutMs:2000})
 p.handle('plan gather 2 oak logs then inventory');p.start()
 const r=p.cancel();assert.equal(r.accepted,true);assert.deepEqual(c.sent,['mine 2 oak_log','stop'])
 c.report('Finished mining oak_log: 2/2 successful.');assert.equal(p.snapshot().state,'cancelled')
})
test('disconnect suspends plan, does not auto retry',()=>{
 const c=new MockConnection(),p=new Planner(c,{timeoutMs:2000})
 p.handle('plan inventory then status');p.start();c.emit('session-end')
 assert.equal(p.snapshot().state,'failed');assert.deepEqual(c.sent,['inventory'])
})
test('invalid unrelated Realm reports cannot advance plan',()=>{
 const c=new MockConnection(),p=new Planner(c,{timeoutMs:2000})
 p.handle('plan inventory then status');p.start();c.report('Online (3): A, B, C');c.report('Starting mining dirt (2 steps max).')
 assert.deepEqual(c.sent,['inventory']);c.report('Inventory: oak_log x2');assert.deepEqual(c.sent,['inventory','status']);p.cancel()
})
test('duplicate older cursor does not advance plan',()=>{
 const c=new MockConnection(),p=new Planner(c,{timeoutMs:2000})
 p.handle('plan inventory then status');p.start()
 c.emit('realm-report',{id:0,message:'Inventory: oak_log x2'})
 assert.deepEqual(c.sent,['inventory']);p.cancel()
})
test('simple status report completes only its own step',()=>{
 const step=parseGoal('status').steps[0]
 assert.deepEqual(outcome(step,'Bot online at 3,64,7. Following=false.'),{done:true,ok:true,detail:'Bot online at 3,64,7. Following=false.'})
 assert.equal(outcome(step,'No nearby oak_log found.').ok,false)
})
test('time limit fails closed and prevents subsequent step',async()=>{
 const c=new MockConnection(),p=new Planner(c,{timeoutMs:25})
 p.handle('plan inventory then status');p.start()
 await new Promise(resolve=>setTimeout(resolve,45))
 assert.equal(p.snapshot().state,'failed');assert.deepEqual(c.sent,['inventory'])
})
