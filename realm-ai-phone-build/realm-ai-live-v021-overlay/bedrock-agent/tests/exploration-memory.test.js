import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {LandmarkMemory,noteworthy} from '../src/survival/landmark-memory.js'
import {ExplorationJobs,parseExploreCommand,cardinalFromYaw} from '../src/survival/exploration-jobs.js'
import {recognizeAutonomous,runAutonomous} from '../src/autonomous-intent.js'

test('roam/explore are bounded 30-block goals, no new button or Google key',()=>{
 assert.deepEqual(parseExploreCommand('roam'),{direction:null,distance:30})
 assert.deepEqual(parseExploreCommand('explore north'),{direction:'north',distance:30})
 assert.deepEqual(parseExploreCommand('roam west 30 blocks'),{direction:'west',distance:30})
 assert.equal(parseExploreCommand('roam 200 blocks'),null)
 assert.deepEqual(cardinalFromYaw(90),{x:-1,z:0})
 assert.equal(recognizeAutonomous('roam')?.special,'explore')
 assert.equal(recognizeAutonomous('please explore east')?.special,'explore')
 assert.equal(recognizeAutonomous('explore?'),null)
 let called='';const result=runAutonomous('explore west',{navigation:{yaw:0},world:{},commandPlans:{batch:null},handle:x=>{called=x;return {accepted:true,message:'started'}}})
 assert.equal(called,'explore west');assert.equal(result.autonomous,true)
})

test('memory only records line-of-sight scan results, persists per Realm and deduplicates trees',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-mem-'))
 try{
  const seen={position:{x:0,y:65,z:0},dimension:0,scan(_,{filter}){return {found:[{x:4,y:64,z:1,name:'oak_log'},{x:4,y:65,z:1,name:'oak_log'},{x:7,y:60,z:3,name:'diamond_ore'},{x:3,y:60,z:1,name:'dirt'}].filter(b=>filter(b.name))}}}
  const a=new LandmarkMemory({directory:dir,scope:'A'});assert.equal(a.observe(seen),2)
  assert.equal(a.snapshot().trees,1);assert.equal(a.snapshot().ores,1)
  const reloaded=new LandmarkMemory({directory:dir,scope:'A'});assert.equal(reloaded.treeCandidates(0,{x:0,y:64,z:0}).length,1)
  reloaded.setScope('B');assert.equal(reloaded.snapshot().locations,0)
  reloaded.setScope('A');assert.equal(reloaded.snapshot().locations,2)
  reloaded.forgetTree({x:4,y:64,z:1},0);assert.equal(reloaded.snapshot().trees,0)
  assert.equal(new LandmarkMemory({directory:dir,scope:'A'}).snapshot().ores,1)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('no remembered trees can be sourced from hidden/unconfirmed blocks',()=>{
 const memory=new LandmarkMemory({scope:'realm-1'})
 memory.observe({position:{x:0,y:65,z:0},dimension:0,scan(_,{filter}){return {found:[{x:2,y:64,z:1,name:'oak_log'}].filter(b=>filter(b.name))}}})
 assert.equal(memory.snapshot().trees,1)
 assert.equal(noteworthy('air'),false)
 assert.equal(noteworthy('oak_log'),true)
 assert.equal(memory.treeCandidates(1,{x:0,z:0}).length,0)
})

function fakeExplore({blocked=false}={}){
 const start={x:0,y:64,z:0}
 const world={enabled:true,movementVerified:true,attributes:{'minecraft:health':20},dimension:0,position:{x:.5,y:65.62,z:.5},serverPosition:{x:.5,y:65.62,z:.5},standPosition:()=>({...start}),walkable:()=>!blocked,requestNearby(){}}
 const n={yaw:0,job:null,survey:null,lastPoseAt:1,state:'idle',defense:{state:'idle'},movementBlock:()=>null,routeTo:(goal)=>({ok:!blocked,path:[start,goal]}),walk(goal){this.job={kind:'solo',goal};this.state='walking';return {accepted:true,queued:true}},stop(){this.job=null;this.state='stopped'},beginSurvey(){this.survey={step:0};return {accepted:true,queued:true}}}
 const memory=new LandmarkMemory({scope:'test-realm'});memory.observe=()=>0
 const controller={world,navigation:n,resources:{active:null},report:()=>{}}
 const x=new ExplorationJobs(controller,memory)
 return {x,n,world}
}
test('roam moves in short observed segments, requires server confirmations, then surveys',()=>{
 const {x,n,world}=fakeExplore();const started=x.start('explore south');assert.equal(started.accepted,true)
 let time=Date.now()+500
 for(let i=0;i<5;i++){
  assert.ok(n.job?.goal,`segment ${i} should have active physical route`)
  const goal=n.job.goal
  world.serverPosition={x:goal.x+.5,y:goal.y+1.62,z:goal.z+.5};n.lastPoseAt++
  x.tick(time+=300)
 }
 assert.equal(x.snapshot().progress,30)
 assert.equal(x.snapshot().state,'scanning')
 n.survey=null
 x.tick(time+400)
 assert.equal(x.snapshot().state,'completed')
})
test('roam refuses blind routes, never claims 30-block success, and Stop cancels',()=>{
 const {x,n}=fakeExplore({blocked:true});const now=Date.now()
 assert.equal(x.start('roam').accepted,true)
 x.tick(now+7000);assert.equal(x.snapshot().state,'partial');assert.equal(x.snapshot().progress,0)
 const b=fakeExplore();b.x.start('roam north');b.x.cancel('Stop');b.n.stop();assert.equal(b.x.snapshot().state,'interrupted')
})

test('wood task can navigate toward a saved tree but requires fresh observation before mining', async()=>{
 const {ResourceJobs}=await import('../src/survival/resource-jobs.js')
 const tree={x:20,y:64,z:0,name:'oak_log',kind:'tree',dimension:0}
 const w={position:{x:.5,y:65.62,z:.5},serverPosition:{x:.5,y:65.62,z:.5},dimension:0,
  inventoryKnown:true,enabled:true,movementVerified:true,attributes:{'minecraft:health':20},items:()=>({}),
  standPosition:()=>({x:0,y:64,z:0}),scan:()=>({found:[]}),walkable:()=>true,block:()=>({name:'oak_log'})}
 let walked=null,mined=false
 const nav={job:null,survey:null,defense:{state:'idle'},state:'idle',lastPoseAt:10,
  movementBlock:()=>null,isRespawning:()=>false,routeTo:()=>({ok:true,path:[{x:0,y:64,z:0},{x:17,y:64,z:0}]}),
  walk(goal){walked=goal;this.job={kind:'solo',goal};this.state='walking';return {accepted:true,queued:true}},
  mining:{job:null},mine(){mined=true;return {accepted:true}},stop(){this.job=null;this.state='stopped'}}
 const memory={scope:'A',treeCandidates:()=>[tree],observe:()=>0,forgetTree:()=>{}}
 const controller={world:w,navigation:nav,landmarks:memory,exploration:{active:null},report:()=>{}}
 const agent=new ResourceJobs(controller)
 const out=agent.start('go chop down wood')
 assert.equal(out.accepted,true)
 assert.equal(agent.active.state,'approaching-memory')
 assert.ok(walked)
 assert.equal(mined,false)
})
