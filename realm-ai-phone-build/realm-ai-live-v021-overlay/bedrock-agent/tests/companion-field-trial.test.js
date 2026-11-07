import test from 'node:test'
import assert from 'node:assert/strict'
import {CompanionFieldTrial,verifiedArrival,isHomeFieldTestCommand} from '../src/survival/companion-field-trial.js'

function fixture(){
 const calls=[],owner={name:'Owner',position:{x:40,y:65.62,z:40},uniqueId:'17'}
 const w={dimension:0,movementVerified:true,serverPosition:{x:16,y:65.62,z:40},
  locator:{known:new Map()},players:new Map([['17',owner]])}
 const navigation={job:null,lastPoseAt:0,
  follow(name){this.job={kind:'follow',name};calls.push(['follow',name]);return {accepted:true,queued:true}},
  stop(reason){this.job=null;calls.push(['stop',reason])}}
 const c={world:w,navigation,connection:{spawned:true,config:{ownerPlayerNames:['Owner']}},
  report:message=>calls.push(['report',message])}
 let scope='realm-1'
 const companion={c,homeProject:{state:'idle'},editScope:()=>({realm:scope}),
  handle(message){calls.push(['home',message]);return {accepted:true,project:{state:'running'},message:'Home build started.'}}}
 const field=new CompanionFieldTrial(companion)
 return {field,c,calls,w,navigation,owner,companion,setScope:value=>{scope=value}}
}
function observation(f,now,x,y=65.62,z=40){
 f.w.serverPosition={x,y,z};f.navigation.lastPoseAt=now
 f.w.locator.known.set('17',{position:{...f.owner.position},at:now,source:'nearby-entity'})
}

test('ordinary chat home-test invitation and exact test phrase both work',()=>{
 for(const phrase of [
  'start home field test','run the home field trial','find me then make your home here',
  'find me and start building','find me and make this your home spot when you\'re within 10 blocks',
  'follow me and make this your home spot when you\'re within ten blocks'])
  assert.equal(isHomeFieldTestCommand(phrase),true,phrase)
 for(const phrase of ['dang you should have built your home while you were there','stop','follow me','set your home somewhere else'])
  assert.equal(isHomeFieldTestCommand(phrase),false,phrase)
})

test('follows the owner first, refuses to assign home at a distance, then assigns exactly once at 10 blocks',()=>{
 const f=fixture();let now=100000
 const response=f.field.start(now);assert.equal(response.accepted,true)
 assert.equal(f.field.state,'following')
 assert.deepEqual(f.calls[0],['follow','Owner'])
 observation(f,now+1000,20)
 f.field.tick(now+1000)
 assert.equal(f.field.state,'awaiting-arrival')
 assert.equal(f.calls.filter(x=>x[0]==='home').length,0)
 observation(f,now+2500,30)
 f.field.tick(now+2500)
 assert.equal(f.field.state,'building')
 assert.equal(f.calls.filter(x=>x[0]==='home').length,1)
 assert.equal(f.calls.find(x=>x[0]==='home')[1],'this is your new home spot')
 f.field.tick(now+4000)
 assert.equal(f.calls.filter(x=>x[0]==='home').length,1)
})

test('historic locator coordinates, predicted position, different height and stale own position cannot claim land',()=>{
 const f=fixture();const now=90000;f.field.start(now)
 observation(f,now+1200,35)
 const fresh=verifiedArrival(f.c,'Owner',{now:now+1200,started:now,maxDistance:10})
 assert.equal(fresh.ok,true)
 f.w.locator.known.get('17').at=now-30000
 assert.equal(verifiedArrival(f.c,'Owner',{now:now+1200,started:now}).ok,false)
 observation(f,now+2500,35)
 f.navigation.lastPoseAt=now-20000
 assert.equal(verifiedArrival(f.c,'Owner',{now:now+2500,started:now}).ok,false)
 observation(f,now+3500,35,75)
 assert.equal(verifiedArrival(f.c,'Owner',{now:now+3500,started:now}).ok,false)
 f.owner.position={x:40,y:65.62,z:40}
 f.w.locator.known.set('17',{position:{x:40,y:65.62,z:40},at:now+4000,source:'locator-bar'})
 observation(f,now+4500,35)
 f.w.locator.known.get('17').source='locator-bar'
 assert.equal(verifiedArrival(f.c,'Owner',{now:now+4500,started:now}).ok,false)
})

test('a changed Realm or stopped follow cannot grant a home plot',()=>{
 const f=fixture();const now=100000;f.field.start(now)
 f.setScope('another-realm')
 observation(f,now+2000,35);f.field.tick(now+2000)
 assert.equal(f.field.state,'paused')
 assert.equal(f.calls.some(x=>x[0]==='home'),false)
 const g=fixture();g.field.start(now);g.navigation.job=null
 observation(g,now+2000,35);g.field.tick(now+2000)
 assert.equal(g.field.state,'paused')
 assert.equal(g.calls.some(x=>x[0]==='home'),false)
})

test('unconfigured owner, unsafe active tasks and unspawned Realm reject the field test',()=>{
 const a=fixture();a.c.connection.config.ownerPlayerNames=[]
 assert.equal(a.field.start(100000).accepted,false)
 const b=fixture();b.c.connection.spawned=false
 assert.equal(b.field.start(100000).accepted,false)
 const c=fixture();c.navigation.job={kind:'mine'}
 assert.equal(c.field.start(100000).accepted,false)
})

// Natural phrases such as "find me then make your home here" cannot use
// the historical 162/96/53 QA anchor. They require actual owner proximity.
test('natural follow-and-home request uses live owner feet, not prior test XYZ',()=>{
 const f=fixture(),now=100000
 const started=f.field.start(now,{ownerPositionHome:true})
 assert.equal(started.accepted,true)
 assert.equal(f.navigation.followTargetHint,null)
 assert.equal(f.field.snapshot().targetXYZ,null)
 observation(f,now+1000,38)
 f.field.tick(now+1000)
 assert.equal(f.field.state,'building',f.field.reason)
 assert.deepEqual(f.field.snapshot().targetXYZ,{x:40,y:64,z:40})
 assert.equal(f.calls.filter(x=>x[0]==='home').length,1)
})
