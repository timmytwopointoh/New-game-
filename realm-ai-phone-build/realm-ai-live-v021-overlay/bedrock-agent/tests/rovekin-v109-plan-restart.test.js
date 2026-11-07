import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {CommandPlans} from '../src/survival/command-plans.js'
const dig={id:'dig',values:{x:4,y:65,z:2}}
const walk={id:'walk',values:{x:4,y:65,z:2}}
const fileFor=(dir,scope)=>path.join(dir,crypto.createHash('sha256').update(scope).digest('hex')+'.json')
const fixture=t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-queue-audit-'))
 t.after(()=>fs.rmSync(dir,{force:true,recursive:true}))
 const scope='realm-one'
 const file=fileFor(dir,scope)
 const controller={world:{},navigation:{job:null},connection:{},handle:()=>{throw Error('No command should be sent')}}
 return {dir,scope,file,controller}
}
test('legacy command cards cannot silently return as unattempted build or dig actions',t=>{
 const {dir,scope,file,controller}=fixture(t)
 fs.writeFileSync(file,JSON.stringify({cards:[{descriptor:dig}],selected:1}))
 const p=new CommandPlans(controller,{directory:dir,scope})
 assert.equal(p.cards.length,1)
 assert.equal(p.cards[0].state,'interrupted')
 assert.equal(p.cards[0].activationLocked,true)
 assert.match(p.cards[0].result,/older saved plan/i)
 assert.throws(()=>p.activate(1),/world-edit card was already attempted/i)
 p.select(1)
 assert.equal(p.cards[0].state,'interrupted','selection cannot rearm a historical world edit')
 assert.equal(p.cards[0].activationLocked,true)
 assert.throws(()=>p.activateQueue(),/world-edit card was already attempted/i)
})
test('v2 pending cards remain runnable, but a running card is interrupted on process restart',t=>{
 const {dir,scope,file,controller}=fixture(t)
 fs.writeFileSync(file,JSON.stringify({schema:2,cards:[
  {descriptor:walk,state:'waiting',activationLocked:false},
  {descriptor:dig,state:'running',activationLocked:true}],selected:1}))
 const p=new CommandPlans(controller,{directory:dir,scope})
 assert.equal(p.cards[0].state,'waiting')
 assert.equal(p.cards[1].state,'interrupted')
 assert.equal(p.cards[1].activationLocked,true)
 p.select(2)
 assert.equal(p.cards[1].state,'interrupted')
 assert.throws(()=>p.activate(2),/world-edit card was already attempted/i)
})
test('v2 confirmed world edits stay completed after restart and refuse one-tap replay',t=>{
 const {dir,scope,file,controller}=fixture(t)
 fs.writeFileSync(file,JSON.stringify({schema:2,cards:[
  {descriptor:dig,state:'completed',activationLocked:true}],selected:1}))
 const p=new CommandPlans(controller,{directory:dir,scope})
 assert.equal(p.cards[0].state,'completed')
 assert.throws(()=>p.activate(1),/world-edit card was already attempted/i)
})
test('newly started job writes running status before any Minecraft action is dispatched',t=>{
 const {dir,scope,file}=fixture(t)
 const events=[]
 const controller={
  navigation:{job:null},world:{lastPoseAt:0},connection:{config:{ownerPlayerNames:[]}},
  report:m=>events.push('report:'+m),
  handle:raw=>{
   events.push('dispatch:'+raw)
   const saved=JSON.parse(fs.readFileSync(file,'utf8'))
   assert.equal(saved.schema,2)
   assert.equal(saved.cards[0].state,'running')
   assert.equal(saved.cards[0].activationLocked,true)
   return {accepted:true,queued:true,message:'Action submitted; not yet server verified.'}
  }
 }
 const x=Object.create(CommandPlans.prototype)
 Object.assign(x,{controller,directory:dir,scope,file,
  cards:[{id:1,descriptor:dig,state:'waiting',result:'',activationLocked:false}],
  selected:1,running:null,sequence:1,batch:{ids:[1],index:0},
  validateChoices:()=>{},startPoll:()=>{events.push('poll')},
  finishBatch:()=>{events.push('batch-finished')}})
 const result=x.launchBatchItem()
 assert.equal(result.accepted,true)
 assert(events.includes('dispatch:dig 4 65 2'))
 const reloaded=new CommandPlans({world:{},navigation:{job:null}}, {directory:dir,scope})
 assert.equal(reloaded.cards[0].state,'interrupted')
 assert.match(reloaded.cards[0].result,/process restarted/)
})
test('failed private persistence prevents dispatch of any new world edit',t=>{
 const {dir,scope,file}=fixture(t)
 let called=false
 const x=Object.create(CommandPlans.prototype)
 const controller={world:{lastPoseAt:0},connection:{config:{ownerPlayerNames:[]}},
  handle:()=>{called=true;return {accepted:true,queued:true}}}
 Object.assign(x,{controller,directory:dir,scope,file,
  cards:[{id:1,descriptor:dig,state:'waiting',result:'',activationLocked:false}],
  selected:1,running:null,batch:{ids:[1],index:0},
  validateChoices:()=>{},persist:()=>{throw Error('storage unavailable')},
  finishBatch:()=>{},startPoll:()=>{}})
 const result=x.launchBatchItem()
 assert.equal(called,false)
 assert.equal(result.accepted,false)
 assert.match(result.message,/storage unavailable/i)
})
