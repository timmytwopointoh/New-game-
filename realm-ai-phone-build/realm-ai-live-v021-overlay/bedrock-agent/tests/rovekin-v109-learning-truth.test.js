import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {visibleResourceCandidates,selectKnownResource} from '../src/survival/internal-skills.js'
import {ResourceJobs} from '../src/survival/resource-jobs.js'
import {CompanionMind} from '../src/survival/companion-mind.js'
import {CommandPlans} from '../src/survival/command-plans.js'

const now=Date.now()
function resourceRig(){
 let outcome='idle',stock={}
 const events=[]
 const world={
  position:{x:0.5,y:65.62,z:0.5},serverPosition:{x:0.5,y:65.62,z:0.5},
  abilityState:{effective:{}},serverAuthoritativeBreaking:true,survivalVerified:true,
  inventory:new Map([[0,{network_id:0,count:0}]]),selectedSlot:0,effects:new Map(),
  gameMode:'survival',inventoryKnown:true,enabled:true,movementVerified:true,
  attributes:{'minecraft:health':20},grounded:()=>true,visible:()=>true,
  block:()=>({name:'oak_log',diggable:true,hardness:2,canHarvest:()=>true,digTime:()=>3000}),
  items:()=>stock,standPosition:()=>({x:0,y:64,z:0}),
  scan:name=>name==='oak_log'?{found:[{x:1,y:64,z:0,name,distance:1}]}:{found:[]},
  walkable:()=>true,drops:new Map()
 }
 const navigation={
  job:null,survey:null,defense:{state:'idle'},state:'idle',
  mining:{job:null,get result(){return outcome},reason:'server confirmation'},
  pickup:{target:null,state:'idle'},isRespawning:()=>false,movementBlock:()=>null,
  mine(p){events.push({event:'mine',position:p});this.job={kind:'mine'};this.mining.job={position:p};outcome='mining';return {accepted:true,queued:true}},
  collectNearby(){return {accepted:false}},stop(){this.job=null},routeTo(){return {ok:false}}
 }
 const mind={
  record:(...args)=>{events.push({event:'learn',args});return true},
  choose:(kind,candidates)=>{events.push({event:'choose',kind,candidates});return candidates.at(-1)}
 }
 const c={world,navigation,mind,report:x=>events.push({event:'report',text:x}),
  workshop:{rememberTree(){},close(){}}}
 const agent=new ResourceJobs(c)
 return {agent,c,world,navigation,mind,events,setStock:v=>stock=v,
  serverBreakConfirmed:()=>{navigation.job=null;navigation.mining.job=null;outcome='confirmed'},
  serverBreakRejected:()=>{navigation.job=null;navigation.mining.job=null;outcome='cancelled'}}
}
test('candidate helper still matches established nearest-resource behavior and excludes floor under bot',()=>{
 const world={position:{x:.5,y:65.62,z:.5},standPosition:()=>({x:0,y:64,z:0}),
  scan:name=>name==='oak_log'?{found:[{name,x:1,y:65,z:0,distance:1},{name,x:0,y:63,z:0,distance:.2},{name,x:3,y:65,z:0,distance:3}]}:{found:[]}}
 const g={kind:'tree-harvest',maxDistance:8}
 const c=visibleResourceCandidates(world,g,new Set(['3,65,0']))
 assert.equal(c.length,1)
 assert.equal(c[0].x,1)
 assert.deepEqual(selectKnownResource(world,g,new Set(['3,65,0'])),c[0])
})
test('learner may choose among observed nearby logs, never inject an unseen target',()=>{
 const r=resourceRig()
 r.world.scan=name=>name==='oak_log'?{found:[{x:1,y:64,z:0,name,distance:1}]}:
  name==='spruce_log'?{found:[{x:2,y:64,z:0,name,distance:2}]}:{found:[]}
 const started=r.agent.start('get wood')
 assert.equal(started.accepted,true)
 assert.equal(r.agent.active.target.name,'spruce_log')
 assert(r.events.some(x=>x.event==='choose'))
 assert.equal(r.events.find(x=>x.event==='mine').position.x,2)
})
test('learner cannot redirect mining to an unobserved target even if a candidate chooser returns it',()=>{
 const r=resourceRig()
 r.world.scan=name=>name==='oak_log'?{found:[{x:1,y:64,z:0,name,distance:1},{x:2,y:64,z:0,name,distance:2}]}:{found:[]}
 r.mind.choose=()=>({target:{x:500,y:64,z:500,name:'diamond_ore',distance:1}})
 r.agent.start('get wood')
 assert.equal(r.agent.active.target.x,1)
 assert.equal(r.events.find(x=>x.event==='mine').position.x,1)
})
test('only Minecraft-confirmed block break and later inventory gain train adaptive mine/collect experience',()=>{
 const r=resourceRig()
 r.agent.start('get wood')
 assert.equal(r.events.filter(x=>x.event==='learn').length,0)
 r.serverBreakRejected()
 r.agent.tick(now+450)
 assert.equal(r.events.filter(x=>x.event==='learn').length,0)
 const s=resourceRig()
 s.agent.start('get wood')
 s.serverBreakConfirmed();s.agent.tick(now+450)
 assert.deepEqual(s.events.find(x=>x.event==='learn')?.args.slice(0,2),['mine','oak_log'])
 assert.equal(s.events.find(x=>x.event==='learn')?.args[2].evidence,'server-block-update')
 assert.equal(s.agent.snapshot().confirmedPickups,0)
 s.setStock({oak_log:2});s.agent.tick(now+1250)
 assert.equal(s.agent.snapshot().confirmedPickups,1)
 assert(s.events.some(x=>x.event==='learn'&&x.args[0]==='collect'&&x.args[2].evidence==='server-inventory-increase'))
})
test('two discovered tree sites without pickups are not falsely labeled as collected trees',()=>{
 const r=resourceRig()
 r.agent.start('gather 2 trees')
 Object.assign(r.agent.active,{state:'search',trunks:[{x:1,y:64,z:0},{x:3,y:64,z:0}],pickups:0})
 r.navigation.job=null;r.navigation.mining.job=null
 r.agent.tick(now+900)
 assert.notEqual(r.agent.snapshot().state,'completed')
})
test('repeated harvest of one trunk does not count as multiple tree checkpoints',()=>{
 const r=resourceRig()
 r.agent.start('go get wood')
 r.agent.noteTree({x:1,y:64,z:0},now)
 r.agent.noteTree({x:1,y:65,z:0},now+5)
 assert.equal(r.agent.snapshot().registeredTrunks,1)
 r.agent.noteTree({x:4,y:64,z:0},now+5)
 assert.equal(r.agent.snapshot().registeredTrunks,2)
 assert.equal(r.agent.snapshot().checkpointAt.length,1)
 assert.equal(r.agent.snapshot().checkpointAt[0].confirmed,false)
})
test('new Realm persona survives reconnect even before the first trained action',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-new-persona-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const first=new CompanionMind({directory:dir,scope:'my-realm'})
 const persona=first.snapshot().independentPersona
 assert.equal(first.snapshot().decisions,0)
 assert(fs.readdirSync(dir).length>0,'new Realm profile is saved immediately')
 const second=new CompanionMind({directory:dir,scope:'my-realm'})
 assert.equal(second.snapshot().independentPersona,persona)
 first.setScope('my-realm')
 assert.equal(first.snapshot().independentPersona,persona)
})

test('adaptive experience persists privately per Realm after actual evidence, and helps choose later',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-v109-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const m=new CompanionMind({directory:dir,scope:'R1',random:()=>.1})
 assert.equal(m.snapshot().verifiedSuccesses,0)
 assert.equal(m.record('mine','oak_log',{outcome:'confirmed',evidence:'server-block-update'}),true)
 assert.equal(m.record('mine','spruce_log',{outcome:'confirmed',evidence:'speculative'}),false)
 const r=new CompanionMind({directory:dir,scope:'R1',random:()=>.1})
 assert.equal(r.snapshot().verifiedSuccesses,1)
 assert.equal(r.snapshot().learnedContexts,1)
 assert.equal(r.snapshot().decisions,0)
 const selected=r.choose('mine',[{material:'oak_log'},{material:'spruce_log'}],{pick:()=>.1})
 assert(selected)
 assert.equal(r.snapshot().decisions,1)
 const other=new CompanionMind({directory:dir,scope:'R2'})
 assert.equal(other.snapshot().verifiedSuccesses,0)
})
function fakePlans(id,context={}){
 const calls=[],card={id:1,state:'running',descriptor:{id,values:{material:'oak_log'}},result:''}
 const controller={navigation:{job:null,survey:null,mining:{result:'idle'},...context},
  world:{lastPoseAt:now,serverPosition:{x:1.5,y:65.62,z:1.5}},
  mind:{record:(...args)=>{calls.push(['mind',...args]);return true}},
  learning:{record:(...args)=>{calls.push(['learning',...args]);return true}},
  report:msg=>calls.push(['report',msg])}
 const x=Object.create(CommandPlans.prototype)
 Object.assign(x,{cards:[card],running:1,batch:{ids:[1],index:0},activeStartedAt:now,
  activeServerPoseAt:now-100,activeGoal:{x:1,y:64,z:1},controller,
  persist:()=>{},scheduleNext:()=>{calls.push(['next'])},finishBatch:(msg)=>{calls.push(['stop',msg]);x.running=null;x.batch=null}})
 return {x,calls,card,controller}
}
test('confirmed dig trains the mind; generic navigation confirmation alone never does',()=>{
 const ok=fakePlans('dig')
 ok.controller.navigation.mining.result='confirmed'
 ok.x.pollBatch()
 assert.equal(ok.card.state,'completed')
 assert(ok.calls.some(x=>x[0]==='mind'&&x[1]==='mine'&&x[3].evidence==='server-block-update'))
 const stale=fakePlans('dig')
 stale.controller.navigation.state='confirmed';stale.controller.navigation.mining.result='idle'
 stale.x.pollBatch()
 assert.equal(stale.card.state,'running')
 assert.equal(stale.calls.filter(x=>x[0]==='mind').length,0)
})
test('cancelled 360 scan cannot be marked confirmed; a full new scan can',()=>{
 const a=fakePlans('look')
 a.controller.navigation.lastSurveyConfirmedAt=0
 a.x.pollBatch()
 assert.equal(a.card.state,'finished-unverified')
 assert.equal(a.calls.filter(x=>x[0]==='mind').length,0)
 const b=fakePlans('look')
 b.controller.navigation.lastSurveyConfirmedAt=now+1
 b.x.pollBatch()
 assert.equal(b.card.state,'completed')
})
test('generic ended job cannot become a verified completion or influence learned preferences',()=>{
 const a=fakePlans('respawn')
 a.x.pollBatch()
 assert.equal(a.card.state,'finished-unverified')
 assert.equal(a.calls.filter(x=>x[0]==='mind').length,0)
 assert(a.calls.some(x=>x[0]==='learning'&&x[2]==='unverified'))
})
