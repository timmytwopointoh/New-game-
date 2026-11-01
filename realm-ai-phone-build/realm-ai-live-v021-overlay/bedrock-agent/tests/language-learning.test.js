import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {EventEmitter} from 'node:events'
import {CommandVocabulary} from '../src/survival/command-vocabulary.js'
import {LearningMemory} from '../src/survival/learning-memory.js'
import {SurvivalController} from '../src/survival/controller.js'
import {createApi} from '../src/api.js'
function temporary(run){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-learning-'));try{return run(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function fixture(directory=null,scope='realm-A'){
 const c=new EventEmitter();Object.assign(c,{config:{ownerPlayerNames:[]},events:[],nextEventId:0,spawned:true,send(){throw Error('No legacy world command allowed')}})
 const s=new SurvivalController(c,{plansDirectory:directory?path.join(directory,'plans'):null,scope});c.survival=s;c.status=()=>({survival:s.snapshot()})
 const calls=[];s.handle=raw=>{calls.push(raw);return {accepted:true,queued:false,message:raw}}
 const api=createApi({localAPI:{token:'local-test'}},c,()=>{})
 return {c,s,calls,api,message:api.controller.message}
}
test('merged Live answers glossary questions and learned meanings without executing actions',()=>{
 const {s,calls,message}=fixture()
 assert.match(message('What does troll mean?').message,/noun|verb/)
 assert.match(message('define language').message,/Offline glossary/)
 assert(message('command teach material rubble = cobblestone').accepted)
 assert.equal(message('what is rubble?').message,'about cobblestone')
 assert(message('command teach action dredge = dig').accepted)
 assert.match(message('what does dredge mean?').message,/You taught me.*Dig one block/)
 assert(message('command travel to -3 64 -8').accepted)
 assert.equal(s.commandPlans.snapshot().cards[0].command,'walk to -3 64 -8')
 for(const text of ['lol','just kidding','you are stupid','I want you to dig 1 64 2'])message(text)
 assert.deepEqual(calls,['about cobblestone','dig 1 64 2']);assert.equal(s.commandPlans.cards.length,1)
 assert.equal(s.snapshot().language.bundledWords,5000);assert.equal(s.snapshot().language.neuralModel,false)
})
test('clarified unfamiliar actions persist across restarts and wait for Activate',()=>temporary(dir=>{
 const first=fixture(dir),reply=first.message('command dredge 1 64 -2')
 assert.match(reply.message,/What did you mean/);assert.equal(first.s.commandVocabulary.list().count,0)
 assert(first.message('dig').accepted);assert.equal(first.s.commandVocabulary.list().count,1)
 assert.equal(first.s.commandPlans.snapshot().cards[0].command,'dig 1 64 -2');assert.equal(first.calls.length,0)
 const restored=fixture(dir);assert.equal(restored.s.commandVocabulary.expand('dredge 1 64 -2').text,'dig 1 64 -2')
 assert.equal(restored.s.commandPlans.running,null);assert.equal(restored.calls.length,0)
 assert.equal(fixture(dir,'realm-B').s.commandVocabulary.list().count,0)
 assert(restored.message('command forget action dredge').accepted)
 assert.equal(fixture(dir).s.commandVocabulary.list().count,0)
 assert.equal(fs.statSync(first.s.commandVocabulary.file).mode&0o077,0)
}))
test('Realm changes, Stop and new commands invalidate a pending clarification',()=>{
 for(const how of ['realm','stop','new-command']){
  const {s,message}=fixture();message('command dredge 1 64 -2')
  if(how==='realm'){s.commandPlans.setScope('realm-B');s.commandVocabulary.setScope('realm-B');s.learning.setScope('realm-B')}
  if(how==='stop')message('stop')
  if(how==='new-command')assert(message('command inventory').accepted)
  message('dig');assert.equal(s.commandVocabulary.list().count,0)
  assert.equal(s.commandPlans.cards.length,how==='new-command'?1:0)
 }
})
test('vocabulary cannot redefine controls or known meanings; phrases preserve negative coordinates',()=>{
 const v=new CommandVocabulary()
 for(const [kind,word,target] of [['action','stop','dig'],['action','mine','walk'],['action','walk','dig'],['material','stone','diamond']])assert.throws(()=>v.teach(kind,word,target),/built-in|control word/)
 assert.throws(()=>v.teach('action','dredge','teleport'),/supported action/)
 v.teach('action','tunnel run','walk');assert.equal(v.expand('TUNNEL-RUN -3 64 -8').text,'walk to -3 64 -8')
 v.teach('material','rough rock','cobblestone');assert.equal(v.expand('find rough_rock').text,'find cobblestone')
 assert.equal(v.expand('find rough_rock_wall').text,'find rough_rock_wall')
})
test('capacity is enforced and failed disk writes never change active word meanings',()=>temporary(dir=>{
 const v=new CommandVocabulary({directory:dir,scope:'a'});v.teach('action','dredge','dig');const original=v.file,bytes=fs.readFileSync(original)
 const blocking=path.join(dir,'not-a-directory');fs.writeFileSync(blocking,'block');v.file=path.join(blocking,'word.json')
 assert.throws(()=>v.teach('action','dredge','walk'));assert.equal(v.actions.dredge,'dig');assert.deepEqual(fs.readFileSync(original),bytes)
 const bounded=new CommandVocabulary();for(let i=0;i<200;i++)bounded.teach('action','word'+i,'dig')
 assert.throws(()=>bounded.teach('action','overflow','walk'),/200 mappings/);assert.equal(bounded.list().count,200)
 bounded.forget('action','word1');assert(bounded.teach('action','overflow','walk').accepted)
}))
test('unsafe or malformed vocabulary is preserved and never partially loaded',()=>temporary(dir=>{
 const original=new CommandVocabulary({directory:dir,scope:'a'});original.teach('action','dredge','dig')
 for(const payload of [{actions:{dredge:'dig',stop:'dig'},materials:{}},{actions:{dredge:'dig'},materials:[]},{actions:{dredge:'dig'},materials:{stone:'diamond'}}]){
  const text=JSON.stringify(payload);fs.writeFileSync(original.file,text)
  const v=new CommandVocabulary({directory:dir,scope:'a'});assert(v.readOnly);assert.equal(v.list().count,0);assert.throws(()=>v.teach('action','nick','dig'));assert.equal(fs.readFileSync(original.file,'utf8'),text)
 }
}))
test('automatic outcome learning distinguishes predictions, server success, failure and Stop',()=>temporary(dir=>{
 const {s,message}=fixture(dir),p=s.commandPlans,n=s.navigation
 s.handle=()=>{n.job={kind:'mine'};n.mining.result=null;n.state='mining';return {accepted:true,queued:true,message:'Waiting for server block removal.'}}
 p.prepare({id:'dig',values:{x:1,y:64,z:2}});p.activate(1)
 n.state='arrived-predicted';p.pollBatch();assert.equal(s.learning.snapshot().confirmed,0)
 n.job=null;n.state='interrupted';n.reason='Server did not confirm block removal';n.mining.result='cancelled';p.pollBatch()
 assert.equal(s.learning.snapshot().blocked,1);assert.equal(s.learning.snapshot().confirmed,0)
 const other=p.prepare({id:'dig',values:{x:2,y:64,z:2}});assert.match(other.message,/Learned from the previous attempt.*server feedback/)
 p.select(1);p.activate(1);n.job=null;n.mining.result='confirmed';n.state='confirmed';p.pollBatch();p.pollBatch()
 assert.equal(s.learning.snapshot().confirmed,1);assert.equal(s.learning.guidance({id:'dig',values:{}}),'')
 p.select(1);p.activate(1);p.interrupt();p.interrupt();assert.equal(s.learning.snapshot().interrupted,1)
 s.learning.record({id:'inventory',values:{}},'confirmed');assert.equal(s.learning.snapshot().confirmed,1)
 const restored=fixture(dir);assert.equal(restored.s.learning.snapshot().confirmed,1);assert.equal(restored.s.learning.snapshot().interrupted,1)
 assert.equal(fixture(dir,'realm-B').s.learning.snapshot().patterns,0)
 assert.match(message('what have you learned?').message,/1 task successes were server-confirmed/)
 assert.equal(fs.statSync(s.learning.file).mode&0o077,0)
}))
test('outcome memory excludes raw messages, credentials and coordinates; write failure retains previous state',()=>temporary(dir=>{
 const m=new LearningMemory({directory:dir,scope:'a'}),descriptor={id:'dig',values:{x:987,y:64,z:-100}}
 assert(m.record(descriptor,'blocked','No tool; Bearer SECRET-TOKEN, code ABC123'))
 const text=fs.readFileSync(m.file,'utf8');for(const secret of ['SECRET-TOKEN','ABC123','987','-100'])assert(!text.includes(secret))
 assert.equal(m.snapshot().recent[0].lastCause,'tool')
 const saved=m.file,block=path.join(dir,'block');fs.writeFileSync(block,'block');m.file=path.join(block,'memory.json')
 assert.equal(m.record(descriptor,'confirmed'),false);assert.equal(m.snapshot().confirmed,0);assert(m.snapshot().error)
 m.file=saved;fs.writeFileSync(saved,'{broken')
 const restored=new LearningMemory({directory:dir,scope:'a'});assert(restored.readOnly);assert.equal(restored.record(descriptor,'confirmed'),false);assert.equal(fs.readFileSync(saved,'utf8'),'{broken')
}))
test('authenticated status polling exposes learning without queuing a task',async()=>{
 const {api}=fixture();await new Promise(r=>api.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+api.address().port
 try{
  assert.equal((await fetch(url+'/status')).status,401)
  const r=await fetch(url+'/status',{headers:{Authorization:'Bearer local-test'}}),data=await r.json()
  assert.equal(data.survival.language.bundledWords,5000);assert.equal(data.survival.language.neuralModel,false);assert.equal(data.survival.learning.confirmed,0);assert.equal(data.survival.plans.pending,0)
 }finally{await new Promise(r=>api.close(r))}
})
