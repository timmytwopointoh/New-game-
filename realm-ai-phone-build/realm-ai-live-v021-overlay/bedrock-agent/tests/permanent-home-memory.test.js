import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {PermanentHome,validPermanentHome} from '../src/survival/permanent-home.js'
import {planUniqueHome} from '../src/survival/companion-plot.js'
import {physicalHomePlan} from '../src/survival/home-architecture.js'
import {HomeProject} from '../src/survival/home-project.js'

function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-fixed-home-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const plot={schema:1,owner:'Owner',permission:'plan-only',dimension:0,
  source:'owner-observed-player-position',center:{x:134,y:104,z:37},
  bounds:{min:{x:110,y:80,z:13},max:{x:159,y:129,z:62}},
  size:{x:50,y:50,z:50},createdAt:1234}
 const design=planUniqueHome(plot,{pick:()=>.37})
 return {dir,plot,design}
}
test('home cannot move, even by repeated owner instruction, and Realm storage is isolated',t=>{
 const {dir,plot,design}=fixture(t)
 const home=new PermanentHome({directory:dir,scope:'realm-A'})
 assert.equal(home.saveFirst(plot,design).ok,true)
 assert.equal(validPermanentHome(home.record),true)
 const moved={...plot,center:{x:200,y:104,z:37}}
 assert.equal(home.saveFirst(moved,design).ok,false)
 assert.deepEqual(home.record.plot.center,plot.center)
 assert.deepEqual(new PermanentHome({directory:dir,scope:'realm-A'}).record.plot.center,plot.center)
 assert.equal(new PermanentHome({directory:dir,scope:'realm-B'}).hasHome,false)
})
test('progress can only increase; a manual STOP and resume preserve the identity',t=>{
 const {dir,plot,design}=fixture(t)
 const home=new PermanentHome({directory:dir,scope:'realm-A'})
 assert(home.saveFirst(plot,design).ok)
 assert.equal(home.saveProgress({verifiedStages:1}),true)
 assert.equal(home.saveProgress({verifiedStages:0}),false)
 assert.equal(home.record.verifiedStages,1)
 assert.equal(home.saveProgress({autoResume:false}),true)
 const reloaded=new PermanentHome({directory:dir,scope:'realm-A'})
 assert.equal(reloaded.record.verifiedStages,1)
 assert.equal(reloaded.record.autoResume,false)
 assert.equal(reloaded.saveProgress({autoResume:true}),true)
 assert.equal(new PermanentHome({directory:dir,scope:'realm-A'}).record.autoResume,true)
})
test('bad private record is preserved, never silently replaced',t=>{
 const {dir,plot,design}=fixture(t)
 const home=new PermanentHome({directory:dir,scope:'realm-A'})
 fs.mkdirSync(dir,{recursive:true})
 fs.writeFileSync(home.file,'{bad-file', {mode:0o600})
 const reloaded=new PermanentHome({directory:dir,scope:'realm-A'})
 assert.equal(reloaded.isBlocked,true)
 assert.equal(reloaded.saveFirst(plot,design).ok,false)
 assert.equal(fs.readFileSync(home.file,'utf8'),'{bad-file')
})
test('after reconnect, previously confirmed stages are re-observed before more edits',t=>{
 const {dir,plot,design}=fixture(t)
 const home=new PermanentHome({directory:dir,scope:'realm-A'})
 assert(home.saveFirst(plot,design).ok)
 assert(home.saveProgress({verifiedStages:1}))
 const planned=physicalHomePlan(plot,design)
 const first=planned.stages[0]
 const known=new Map(first.positions.map(p=>[[p.x,p.y,p.z].join(','),first.material]))
 const calls=[]
 const controller={
  connection:{spawned:true},
  world:{dimension:0,editModeVerified:true,position:{x:134.5,y:105.62,z:37.5},
   block:p=>({name:known.get([p.x,p.y,p.z].join(','))||'air'}),
   requestNearby(){calls.push('observe')}},
  navigation:{client:{}},
  report:reason=>calls.push(reason),
  companion:{homeMemory:home}
 }
 const project=new HomeProject(controller)
 project.restoreSaved(home.record,'realm-A')
 assert.equal(project.stage,0)
 assert.equal(project.state,'restoring')
 project.tick(1000000)
 assert.equal(project.state,'running')
 assert.equal(project.stage,1)
 assert.equal(project.plan.stages[0].serverConfirmed,first.positions.length)
 assert.equal(project.plan.placementsVerified,first.positions.length)
 assert.equal(calls.some(x=>String(x).includes('continuing')),false)
})
test('changed or missing prior construction never gets silently rebuilt',t=>{
 const {dir,plot,design}=fixture(t)
 const home=new PermanentHome({directory:dir,scope:'realm-A'})
 assert(home.saveFirst(plot,design).ok)
 assert(home.saveProgress({verifiedStages:1}))
 const project=new HomeProject({
  connection:{spawned:true},
  world:{dimension:0,editModeVerified:true,position:{x:134.5,y:105.62,z:37.5},
   block:()=>({name:'air'}),requestNearby(){}},
  navigation:{client:{}},
  report(){},
  companion:{homeMemory:home}
 })
 project.restoreSaved(home.record,'realm-A')
 project.tick(1000000)
 assert.equal(project.state,'paused')
 assert.match(project.reason,/does not match server blocks/)
 assert.equal(home.record.autoResume,false)
})
