import test from 'node:test'
import assert from 'node:assert/strict'
import {CompanionFieldTrial,OWNER_TEST_HOME_ANCHOR,verifiedArrival} from '../src/survival/companion-field-trial.js'
import {grantPlot} from '../src/survival/companion-plot.js'

const at=Date.parse('2026-11-06T12:00:00Z')
function fixture(owner={x:162.4,y:97.62,z:53.4}){
 const actions=[]
 const w={dimension:0,movementVerified:true,
  serverPosition:{x:162.2,y:97.62,z:53.2},
  players:new Map([['42',{name:'Owner',uniqueId:'42',position:owner}]]),
  locator:{known:new Map([['42',{position:{...owner},at:at-300,source:'nearby-entity'}]])}}
 const nav={job:{kind:'follow',name:'Owner'},pendingFollow:null,
  lastPoseAt:at-200,liveFollowPolicy:{maxApproachBlocks:4},
  follow(){actions.push('follow');return {accepted:true,queued:true}},
  stop(){actions.push('stop');this.job=null}}
 const c={connection:{spawned:true,config:{ownerPlayerNames:['Owner']}},
  world:w,navigation:nav,resources:{active:null},miningJobs:{active:null},
  acquisition:{active:null},exploration:{active:null},operations:{pending:null},
  report:m=>actions.push('report')}
 const companion={c,editScope:()=>({realm:'test-realm'}),
  homeProject:{state:'idle'},handle:()=>{actions.push('home-gift');return {accepted:true,project:{state:'running'},message:'Home assigned'}}}
 const trial=new CompanionFieldTrial(companion)
 return {trial,nav,c,w,actions}
}
test('user-supplied Minecraft XYZ is 162 96 53, not swapped axes',()=>{
 assert.deepEqual(OWNER_TEST_HOME_ANCHOR,{x:162,y:96,z:53})
})
test('command-button Follow can attach to existing Follow and gift only after live nearby confirmation',()=>{
 const {trial,nav,actions}=fixture()
 assert.equal(trial.start(at-1000).accepted,true)
 assert.equal(actions.includes('follow'),false,'reuses existing movement task')
 assert.deepEqual(nav.followTargetHint,{x:162,y:96,z:53})
 trial.tick(at)
 assert.equal(trial.state,'building')
 assert.deepEqual(actions.filter(x=>x==='home-gift'),['home-gift'])
 assert.equal(actions.includes('stop'),true,'ends Follow ONLY after verified arrival')
})
test('do not claim home just because the bot is near a different location',()=>{
 const {trial,actions}=fixture({x:172,y:97.62,z:53})
 assert.equal(trial.start(at-1000).accepted,true)
 trial.tick(at)
 assert.equal(trial.state,'awaiting-arrival')
 assert.equal(actions.includes('home-gift'),false)
 assert.equal(actions.includes('stop'),false)
})
test('cached locator without server-confirmed nearby actor is not proof of arrival',()=>{
 const {c}=fixture()
 c.world.locator.known.set('42',{position:{x:162.4,y:97.62,z:53.4},at:at-500,source:'locator-bar'})
 const result=verifiedArrival(c,'Owner',{now:at,started:at-1000,maxDistance:4})
 assert.equal(result.ok,false)
})
test('exact anchored plot refuses an owner who has moved away',()=>{
 const w={dimension:0,players:new Map([['42',{name:'Owner',position:{x:162.4,y:97.62,z:53.5}}]])}
 const plot=grantPlot(w,['Owner'],undefined,{centerOverride:OWNER_TEST_HOME_ANCHOR})
 assert.deepEqual(plot.center,{x:162,y:96,z:53})
 assert.equal(plot.permission,'plan-only')
 assert.equal(plot.source,'owner-verified-explicit-XYZ')
 w.players.get('42').position={x:220,y:97.62,z:53}
 assert.throws(()=>grantPlot(w,['Owner'],undefined,{centerOverride:OWNER_TEST_HOME_ANCHOR}),/Owner is not at/)
})
