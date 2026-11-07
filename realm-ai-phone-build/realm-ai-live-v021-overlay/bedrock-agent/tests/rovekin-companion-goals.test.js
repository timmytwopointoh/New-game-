import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {CompanionGoalJournal,classifyCompanionGoal} from '../src/survival/companion-goal-journal.js'
import {companionPriorities} from '../src/survival/companion-priorities.js'
import {OwnerInbox} from '../src/survival/owner-inbox.js'
import {Navigation} from '../src/survival/navigation.js'
const now=Date.now()
const requested={accepted:true,queued:true,message:'Working when safe, not yet completed.'}
function goal(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-goals-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 return {j:new CompanionGoalJournal({directory:dir,scope:'a'}),dir}
}
test('owner home, follow and resources are classified; unrelated speech and credential-bearing talk never become goals',()=>{
 assert.equal(classifyCompanionGoal('this is your new home spot'),'home')
 assert.equal(classifyCompanionGoal('follow me'),'follow')
 assert.equal(classifyCompanionGoal('mine dirt'),'materials')
 assert.equal(classifyCompanionGoal('return home'),'movement')
 assert.equal(classifyCompanionGoal('tell me a joke'),null)
 assert.equal(classifyCompanionGoal('password secret'),null)
})
test('accepted instructions become durable intentions but never fake completion; other Realm stays isolated',t=>{
 const {j,dir}=goal(t)
 j.recordRequest('follow me',requested,now)
 assert.equal(j.latest().status,'requested')
 assert.equal(j.latest().category,'follow')
 assert.match(j.answer('what were you doing').message,/follow me/)
 const later=new CompanionGoalJournal({directory:dir,scope:'a'})
 assert.equal(later.latest().intent,'follow me')
 later.setScope('b')
 assert.equal(later.latest(),null)
 assert.equal(j.recordRequest('password: fake',requested),null)
})
test('a rejected command never silently becomes a queued goal; duplicate deduplicated',t=>{
 const {j}=goal(t)
 assert.equal(j.recordRequest('build your home',{accepted:false,queued:false,message:'not yet'}),null)
 assert(j.recordRequest('build your home',requested,now))
 assert(j.recordRequest('build your home',requested,now+100))
 assert.equal(j.goals.length,1)
})
test('home progress follows server-verified stage counts, asks for exact owner permission and never claims home is complete',t=>{
 const {j}=goal(t)
 j.recordRequest('build your home',requested,now)
 const home={state:'running',stage:2,plan:{stagesTotal:5,placementsVerified:12},reason:'Step two verified',proximityReview:null,review:null,pending:null}
 const survival={world:{attributes:{}},companion:{homeProject:home,homeMemory:{record:{autoResume:true}}}}
 j.observe({survival,spawned:true},now+1500)
 assert.equal(j.latest().status,'working');assert.equal(j.latest().progress,12)
 assert.notEqual(j.latest().status,'completed')
 home.proximityReview={code:'654321'}
 j.observe({survival,spawned:true},now+1800)
 assert.equal(j.latest().status,'waiting-owner')
 home.proximityReview=null;home.state='furnishing'
 j.observe({survival,spawned:true},now+2100)
 assert.equal(j.latest().status,'shell-verified')
 assert.match(j.latest().detail,/separate/)
})
test('help inbox acknowledges a blocked task and preserves explanation but never resumes actions',t=>{
 const {j}=goal(t)
 j.recordRequest('follow me',requested,now)
 j.transition('blocked','Observed route blocked by uneven terrain.',now+50)
 const card=j.helpPrompt({spawned:true},now+100)
 assert(card);assert.equal(card.kind,'guidance')
 const info=j.respondToHelp(card.id,'explain','Please avoid water and wait for solid ground',now+150)
 assert.equal(info.accepted,true);assert.equal(j.latest().status,'blocked')
 const reply=j.respondToHelp(card.id,'approve',null,now+200)
 assert.equal(reply.accepted,true)
 assert.equal(j.helpPrompt({spawned:true},now+250),null)
})
test('owner inbox routes help card to guidance handler without granting any world permission',t=>{
 const {j}=goal(t)
 j.recordRequest('follow me',requested,now)
 j.transition('blocked','Navigation blocked',now)
 const companion={editScope:()=>({realm:'a'}),homeProject:{stage:0},edits:{pending:null},handle(){throw Error('no edits permitted')}}
 const conn={survival:{companion,commandVocabulary:{scope:'a'},world:{dimension:0}}}
 const inbox=new OwnerInbox(conn,{guidance:()=>j.helpPrompt({spawned:true},now+80),
  respondGuidance:(...args)=>j.respondToHelp(...args)})
 const card=inbox.pending(now+80)[0]
 assert.equal(card.kind,'guidance')
 assert.equal(inbox.respond({id:card.id,decision:'deny'},now+80).accepted,true)
 assert.equal(j.latest().status,'blocked')
})
test('next helpful action uses observed danger/needs, with no invented autonomy',()=>{
 const s={world:{attributes:{'minecraft:health':5},inventoryKnown:true,items:()=>({})},
  companion:{homeMemory:{hasHome:true},homeProject:{state:'paused'}},
  navigation:{state:'blocked',reason:'No path through dry land'}}
 const p=companionPriorities({survival:s,spawned:true})
 assert.equal(p[0].title,'Recover safely')
 assert(p.every(x=>x.automatic===false))
 assert(p.some(x=>x.title==='Repair the walking route'))
 const offline=companionPriorities({survival:s,spawned:false})
 assert.equal(offline[0].title,'Reconnect RoveKin')
})
test('jump landing holds ALL new recovery until a fresh server pose verifies stable support',()=>{
 const nav=Object.create(Navigation.prototype)
 nav.pendingServerLanding={target:{x:4,y:65,z:5},goal:{x:8,y:65,z:5},started:now,stableSince:0}
 nav.lastPoseAt=now-50
 nav.world={serverPosition:{x:4.5,y:66.62,z:5.5},serverGrounded:true,
  movementVerified:true,supportHeight:()=>65,grounded:()=>true,standPosition:()=>({x:4,y:65,z:5})}
 nav.job={kind:'solo',allowMining:true,goal:{x:8,y:65,z:5}}
 nav.state='landing-for-server';nav.route=null;nav.report=()=>{}
 nav.progress={reset(){}}
 let planned=0,mined=0
 nav.routeTo=()=>{planned++;return {ok:true,path:[{x:4,y:65,z:5},{x:8,y:65,z:5}]}}
 nav.assignRoute=()=>{}
 nav.mining={job:null,begin(){mined++;return {accepted:true}}}
 assert.equal(nav.recover('obstacle',now+20),false)
 assert.equal(mined,0)
 nav.resumeServerLanding(now+100)
 assert.equal(nav.pendingServerLanding.stableSince,0,'old server pose is not accepted')
 nav.lastPoseAt=now+200
 nav.resumeServerLanding(now+200)
 nav.resumeServerLanding(now+400)
 assert.equal(planned,0,'hold until stable for at least 350ms')
 nav.resumeServerLanding(now+600)
 assert.equal(planned,1)
 assert.equal(mined,0)
 assert.equal(nav.pendingServerLanding,null)
})
test('unverified jump landing times out into safe blocked state without disconnect or speculative mining',()=>{
 const nav=Object.create(Navigation.prototype)
 nav.pendingServerLanding={target:{x:1,y:65,z:1},goal:{x:2,y:65,z:1},started:now,stableSince:0}
 nav.lastPoseAt=now-20
 nav.world={serverPosition:{x:1.5,y:66.62,z:1.5},serverGrounded:false,
  movementVerified:true,supportHeight:()=>65,standPosition:()=>({x:1,y:65,z:1})}
 nav.job={kind:'solo',allowMining:true};nav.report=()=>{}
 nav.resumeServerLanding(now+5000)
 assert.equal(nav.pendingServerLanding,null)
 assert.equal(nav.job,null)
 assert.equal(nav.state,'blocked')
 assert.match(nav.reason,/connection remains open/)
})
