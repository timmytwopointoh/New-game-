import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {NEW_HOME_SPOT,daylightDeadline,decideFirstHome} from '../src/survival/home-instinct.js'
import {CompanionCommands} from '../src/survival/companion-commands.js'
import {grantPlot,validatePlotBlueprint,insidePlot} from '../src/survival/companion-plot.js'

function fixture({owner=true,mode='follow',materials=true}={}){
 const messages=[],reports=[],stops=[]
 const w={
  dimension:0,enabled:false,
  players:new Map(owner?[['owner',{name:'Owner',position:{x:40.5,y:65.62,z:40.5}}]]:[]),
  block(p,layer=0){
   if(layer===1)return {name:'air',shapes:[]}
   return p.y<=63?{name:'stone',shapes:[[0,0,0,1,1,1]]}:{name:'air',shapes:[]}
  },
  items(){return materials?{dirt:64,oak_planks:64}:{}},
  scan(){return {found:materials?[
   {x:42,y:63,z:42,name:'dirt'},
   {x:43,y:64,z:40,name:'oak_log'},
   {x:39,y:64,z:39,name:'oak_log'}]:[]}},
  requestNearby(){this.requested=true}
 }
 const navigation={job:mode?{kind:mode,name:'Owner'}:null,survey:false,
  stop(message){stops.push(message);this.job=null}}
 const connection={spawned:true,client:{},config:{ownerPlayerNames:['Owner']},
  say(message){messages.push(message);return true}}
 const controller={world:w,navigation,connection,commandPlans:{scope:'realm-1'},
  resources:{active:null},acquisition:{active:null},miningJobs:{active:null},operations:{pending:null},
  report(message){reports.push(message)}}
 const homeDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-home-fixture-'))
 const companion=new CompanionCommands(controller,'realm-1',{homeDirectory})
 controller.companion=companion
 return {w,controller,connection,companion,messages,reports,stops,homeDirectory}
}

test('recognized new-home phrase and equivalent invitations are exact imperatives',()=>{
 for(const s of ['this is your new home spot','this is your home','here is your new base','make this your new home spot',
  'welcome to your new home','you can build your home here'])
  assert(NEW_HOME_SPOT.test(s),s)
 for(const s of ['where is your home','show me home','this is your home? not sure','delete your old home'])
  assert.equal(NEW_HOME_SPOT.test(s),false,s)
})

test('daylight urgency is based only on fresh server time and never invented',()=>{
 const now=100000
 assert.equal(daylightDeadline(2500,{receivedAt:now,now}).urgent,false)
 assert.equal(daylightDeadline(11600,{receivedAt:now,now}).phase,'dusk')
 assert.equal(daylightDeadline(14000,{receivedAt:now,now}).ticksUntilNight,0)
 assert.equal(daylightDeadline(null,{receivedAt:0,now}).phase,'unknown')
 assert.equal(daylightDeadline(2500,{receivedAt:now-200000,now}).phase,'unknown')
})

test('the companion may improvise either real dirt or real timber using random preference',()=>{
 const f=fixture()
 const plot=grantPlot(f.w,['Owner'])
 const dusk=decideFirstHome(f.w,plot,{serverTime:11500,serverTimeAt:100000,now:100000,pick:()=>0.01})
 assert.equal(dusk.design.footprint.width,9)
 assert.equal(dusk.choice.foundation,'dirt')
 assert(validatePlotBlueprint(plot,dusk.design))
 assert(insidePlot(plot,dusk.design.footprint.origin))
 const timber=decideFirstHome(f.w,plot,{serverTime:2500,serverTimeAt:100000,now:100000,pick:()=>0.99})
 assert.equal(timber.choice.foundation,'oak_planks')
 assert(validatePlotBlueprint(plot,timber.design))
 assert(dusk.design.id!==timber.design.id)
})

test('new owner home gift starts work and queues one global thank-you, without double authorization',()=>{
 const f=fixture()
 f.companion.homeRoutine.serverTime=12000
 f.companion.homeRoutine.serverTimeAt=Date.now()
 const result=f.companion.handle('this is your new home spot')
 assert.equal(result.accepted,true,result.message)
 assert.equal(result.queued,true)
 assert.equal(result.globalChatQueued,true)
 assert.equal(f.companion.homeProject.state,'running')
 assert.equal(f.companion.homeProject.plan.approvalSource,'explicit-new-home-spot')
 assert.equal(f.messages.length,1)
 assert.match(f.messages[0],/thank you/i)
 assert.match(f.messages[0],/(dirt|planks)/)
 assert.equal(f.stops.length,1,'existing Follow gives way to home work')
 assert.equal(f.w.requested,true)
 assert.equal(f.companion.firstHomeDecision.daylight.phase,'dusk')
 const again=f.companion.handle('this is your new home spot')
 assert.equal(again.accepted,true)
 assert.equal(f.messages.length,1,'repeat command does not spam global chat')
})

test('unobserved/mismatched owner cannot silently claim land or send a thank-you',()=>{
 const f=fixture({owner:false})
 const result=f.companion.handle('this is your new home spot')
 assert.equal(result.accepted,false)
 assert.equal(f.messages.length,0)
 assert.equal(f.companion.plot,null)
})

test('cannot interrupt active mining to start new plot; legacy claim remains plan-only',()=>{
 const busy=fixture({mode:'mine'})
 const result=busy.companion.handle('here is your new base')
 assert.equal(result.accepted,false)
 assert.equal(busy.messages.length,0)
 const idle=fixture({mode:null})
 const claim=idle.companion.handle('this is your land')
 assert.equal(claim.accepted,true)
 assert.equal(idle.companion.homeProject.state,'idle')
 assert.equal(idle.messages.length,0)
})

test('first verified home survives socket reset and rejects future different locations',()=>{
 const f=fixture(),first=f.companion.handle('this is your new home spot')
 assert.equal(first.accepted,true,first.message)
 const center={...f.companion.plot.center}
 assert.equal(f.companion.homeMemory.summary().permanent,true)
 f.companion.reset()
 assert.deepEqual(f.companion.plot.center,center)
 assert.equal(f.companion.homeProject.state,'restoring')
 // The owner can move elsewhere, but their gift does not move the bot home.
 f.w.players.get('owner').position={x:130.5,y:72.62,z:-90.5}
 const again=f.companion.handle('this is your new home spot')
 assert.equal(again.accepted,true)
 assert.match(again.message,/permanent home/i)
 assert.deepEqual(f.companion.plot.center,center)
 assert.equal(f.companion.handle('this is your land').accepted,true)
 assert.deepEqual(f.companion.plot.center,center)
 const rejoined=new CompanionCommands(f.controller,'realm-1',{homeDirectory:f.homeDirectory})
 assert.deepEqual(rejoined.plot.center,center)
 assert.equal(rejoined.homeProject.state,'restoring')
 assert.equal(rejoined.homeMemory.summary().autoResume,true)
})

test('owner STOP pauses house without losing plot, while explicit resume restores intent',()=>{
 const f=fixture();assert.equal(f.companion.handle('this is your new home spot').accepted,true)
 f.companion.manualStop()
 assert.equal(f.companion.homeProject.state,'paused')
 assert.equal(f.companion.homeMemory.summary().autoResume,false)
 f.companion.reset()
 assert.deepEqual(f.companion.homeMemory.record.plot.center,f.companion.plot.center)
 assert.equal(f.companion.homeProject.state,'restoring')
 const r=f.companion.handle('resume home')
 assert.equal(r.accepted,true)
 assert.equal(f.companion.homeMemory.summary().autoResume,true)
})
