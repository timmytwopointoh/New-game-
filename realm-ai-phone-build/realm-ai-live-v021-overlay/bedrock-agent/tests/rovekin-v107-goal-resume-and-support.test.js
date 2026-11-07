import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {CompanionGoalJournal} from '../src/survival/companion-goal-journal.js'
import {makeSupportSnapshot} from '../src/support-snapshot.js'
const accepted={accepted:true,queued:true,message:'Task started; not confirmed complete.'}
function journal(t,scope='realm-one'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-v107-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 return {j:new CompanionGoalJournal({directory:dir,scope}),dir}
}
test('Android process restart never leaves stale task marked running or secretly resumes',t=>{
 const {j,dir}=journal(t)
 j.recordRequest('follow me',accepted)
 j.transition('working','Currently following observed player')
 const loaded=new CompanionGoalJournal({directory:dir,scope:'realm-one'})
 assert.equal(loaded.latest().status,'interrupted')
 assert.match(loaded.latest().detail,/phone service restarted/i)
 const restartedAgain=new CompanionGoalJournal({directory:dir,scope:'realm-one'})
 assert.equal(restartedAgain.latest().status,'interrupted')
 assert.deepEqual(restartedAgain.latest(),loaded.latest())
})
test('stale awaiting owner permission also expires on process restart',t=>{
 const {j,dir}=journal(t)
 j.recordRequest('build your home',{accepted:true,queued:false,confirmationRequired:true})
 assert.equal(j.latest().status,'waiting-owner')
 const reloaded=new CompanionGoalJournal({directory:dir,scope:'realm-one'})
 assert.equal(reloaded.latest().status,'interrupted')
 assert.match(reloaded.answer('what were you doing').message,/interrupted/)
})
test('verified shell and cancelled work remain terminal after process restart',t=>{
 const {j,dir}=journal(t)
 j.recordRequest('build your home',accepted)
 j.transition('shell-verified','The home shell is confirmed but not furnished.')
 const reload=new CompanionGoalJournal({directory:dir,scope:'realm-one'})
 assert.equal(reload.latest().status,'shell-verified')
 reload.recordRequest('follow me',accepted)
 reload.transition('cancelled','Owner requested Stop')
 const done=new CompanionGoalJournal({directory:dir,scope:'realm-one'})
 assert.equal(done.latest().status,'cancelled')
 done.observe({spawned:true,survival:{navigation:{job:{kind:'follow'},reason:'bad stale job'}}})
 assert.equal(done.latest().status,'cancelled')
})
test('new accepted active goal interrupts previous task instead of reporting two jobs working',t=>{
 const {j}=journal(t)
 j.recordRequest('follow me',accepted)
 j.transition('working','Following')
 j.recordRequest('mine 10 oak logs',accepted,Date.now()+2000)
 assert.equal(j.goals.length,2)
 assert.equal(j.goals[0].status,'interrupted')
 assert.equal(j.goals[1].status,'requested')
})
test('new rejected action never interrupts the last running goal',t=>{
 const {j}=journal(t)
 j.recordRequest('follow me',accepted)
 j.transition('working','Following')
 j.recordRequest('mine 10 oak logs',{accepted:false,queued:false,message:'Cannot mine now.'})
 assert.equal(j.goals.length,1)
 assert.equal(j.latest().status,'working')
})
test('owner explanation survives and appears as contextual task memory without granting edits',t=>{
 const {j}=journal(t)
 j.recordRequest('follow me',accepted)
 j.transition('blocked','Ground not safe.')
 const card=j.helpPrompt({spawned:true},Date.now()+10)
 assert(card)
 const note=j.respondToHelp(card.id,'explain','Wait for the chunk to finish loading.',Date.now()+20)
 assert.equal(note.accepted,true)
 assert.match(j.answer('what were you doing').message,/Wait for the chunk/)
 assert.equal(j.latest().status,'blocked')
})
test('diagnostic snapshot includes only goal category/state and safe network timing, never owner chat',()=>{
 const secret='do-not-copy-private-owner-chat'
 const now=Date.now()
 const bot={
  lastPhase:'spawned',authState:'spawned',connected:true,joined:true,spawned:true,
  transportCloseKind:'transport-close',transportCloseOrigin:'remote-transport',
  companionGoalJournal:{latest:()=>({category:'home',status:'interrupted',intent:secret}),
   goals:[{intent:secret}]},
  diagnostics:()=>({}),survival:{
   world:{sections:new Map(),decodeErrors:0,gameMode:'survival',attributes:{'minecraft:health':20}},
   navigation:{state:'blocked',pendingServerLanding:{started:now-1200},lastJumpAt:now-1800,lastPoseAt:now-400,
    snapshot:()=>({physics:{terrainKnown:true,grounded:true}})},
   commandPlans:{snapshot:()=>({pending:0,cards:[]})},
   learning:{snapshot:()=>({confirmed:0,blocked:0,interrupted:0})},
   commandVocabulary:{list:()=>({count:0})},
   miningJobs:{snapshot:()=>({active:null})},
   snapshot:()=>({language:{bundledWords:5000}}),connection:{}
  }}
 const v=makeSupportSnapshot(bot,()=>now)
 assert.equal(v.diagnostic.goalStatus,'interrupted')
 assert.equal(v.diagnostic.goalCategory,'home')
 assert.equal(v.diagnostic.landingAwaitingServer,true)
 assert.equal(v.diagnostic.previousTransportCloseOrigin,'remote-transport')
 assert.equal(v.diagnostic.lastJumpAgeMs,1800)
 assert(!JSON.stringify(v).includes(secret))
})
