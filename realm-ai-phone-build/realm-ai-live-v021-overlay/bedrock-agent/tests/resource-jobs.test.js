import test from 'node:test'
import assert from 'node:assert/strict'
import {ResourceJobs} from '../src/survival/resource-jobs.js'
import {parseResourceGoal} from '../src/survival/internal-skills.js'

function rig(){
 const logs=[]
 let breakResult='idle'
 const world={position:{x:.5,y:65.62,z:.5},abilityState:{effective:{}},serverAuthoritativeBreaking:true,survivalVerified:true,gameMode:'survival',inventory:new Map([[0,{network_id:0,count:0}]]),selectedSlot:0,effects:new Map(),grounded:()=>true,visible:()=>true,block:()=>({name:'oak_log',diggable:true,hardness:2,canHarvest:()=>true,digTime:()=>3000}),serverPosition:{x:.5,y:65.62,z:.5},lastPoseAt:0,inventoryKnown:true,enabled:true,movementVerified:true,attributes:{'minecraft:health':20},items:()=>({}),standPosition:()=>({x:0,y:64,z:0}),
  scan(name){return name==='oak_log'?{found:[{x:1,y:64,z:0,name,distance:1}]}:{found:[]}},drops:new Map(),walkable:()=>true}
 const nav={job:null,state:'idle',survey:null,defense:{state:'idle'},mining:{get result(){return breakResult},job:null,reason:''},pickup:{target:null,state:'idle'},isRespawning:()=>false,movementBlock:()=>null,
   mine(p){logs.push({action:'mine',p});this.job={kind:'mine'};this.mining.job={position:p};breakResult='mining';return {accepted:true,queued:true}},
   collectNearby(){return {accepted:false}},stop(){this.job=null},routeTo(){return {ok:false}}}
 const c={world,navigation:nav,report:x=>logs.push({action:'report',text:x})}
 const agent=new ResourceJobs(c)
 return {agent,world,nav,logs,complete(){nav.job=null;nav.mining.job=null;breakResult='confirmed'},cancel(){nav.job=null;nav.mining.job=null;breakResult='cancelled'}}
}
test('resource command starts internal mining, never fabricates a world break or item pickup',()=>{
 const x=rig(),t=Date.now();const r=x.agent.start('go get wood')
 assert.equal(r.accepted,true);assert.equal(x.logs.filter(z=>z.action==='mine').length,1)
 assert.equal(x.agent.snapshot().confirmedBreaks,0)
 x.complete();x.agent.tick(t+400)
 assert.equal(x.agent.snapshot().confirmedBreaks,1)
 assert.equal(x.agent.snapshot().confirmedPickups,0)
})
test('resource task refuses to report a break after mining rejection',()=>{
 const x=rig(),t=Date.now();x.agent.start('go get wood');x.cancel();x.agent.tick(t+500)
 assert.equal(x.agent.snapshot().state,'blocked')
 assert.equal(x.agent.snapshot().confirmedBreaks,0)
})
test('Stop cancels internal resource tasks independently of old saved plan cards',()=>{
 const x=rig();x.agent.start('find and mine oak log');x.agent.cancel('Stop commanded')
 assert.equal(x.agent.snapshot().state,'interrupted');assert.equal(x.agent.active,null)
})

test('unrelated inventory gains never count as collected logs',()=>{
 const x=rig(),now=Date.now();let inventory={};x.world.items=()=>inventory;x.agent.start('get wood');x.complete();x.agent.tick(now+400);inventory={dirt:5};x.agent.tick(now+1100);assert.equal(x.agent.snapshot().confirmedPickups,0);inventory={dirt:5,oak_log:1};x.agent.tick(now+1400);assert.equal(x.agent.snapshot().confirmedPickups,1)
})
test('resource approaches retain their goal after the navigation job is cleared',()=>{
 const x=rig(),now=Date.now();x.agent.start('get wood');x.nav.job=null;x.nav.mining.job=null;x.nav.state='arrived-predicted';x.nav.lastPoseAt=20;x.world.serverPosition={x:6.5,y:65.62,z:.5};Object.assign(x.agent.active,{state:'approaching',movementGoal:{x:6,y:64,z:0},movementStartedAt:now,movementObservedAt:10,lastAt:0});delete x.world.lastPoseAt;x.agent.tick(now+500);assert.equal(x.agent.active.state,'search')
})
test('homeward legs use navigation authoritative timestamps, not an absent world timestamp',()=>{
 const x=rig(),now=Date.now();x.agent.start('get wood');x.nav.job=null;x.nav.mining.job=null;x.nav.lastPoseAt=20;x.world.serverPosition={x:10.5,y:65.62,z:.5};Object.assign(x.agent.active,{state:'return-walking',returnPlan:{home:{position:{x:0,y:64,z:0}}},returnLeg:{x:10,y:64,z:0},returnLegPoseAt:10,returnLegStartedAt:now,returnIndex:0});delete x.world.lastPoseAt;x.agent.tickHomeward(now+500);assert.equal(x.agent.active.state,'returning-home');assert.equal(x.agent.active.returnIndex,1)
})
test('stopped or unconfirmed resource approaches cannot hang indefinitely or resume work',()=>{
 const x=rig(),now=Date.now();x.agent.start('get wood');x.nav.job=null;x.nav.mining.job=null;x.nav.state='stopped';Object.assign(x.agent.active,{state:'approaching',movementGoal:{x:6,y:64,z:0},movementStartedAt:now,lastAt:0});x.agent.tick(now+500);assert.equal(x.agent.snapshot().state,'blocked')
 const y=rig();y.agent.start('get wood');y.nav.job=null;y.nav.mining.job=null;y.nav.state='arrived-predicted';Object.assign(y.agent.active,{state:'approaching-memory',movementGoal:{x:6,y:64,z:0},movementStartedAt:now,lastAt:0});y.agent.tick(now+22000);assert.equal(y.agent.snapshot().state,'blocked')
})
test('discovered trunks are not reported as fully felled trees or physically placed chests',()=>{
 const x=rig();x.agent.start('get wood');x.agent.noteTree({x:1,y:64,z:0},Date.now());assert.equal(x.agent.snapshot().trees,0);assert.equal(x.agent.snapshot().registeredTrunks,1);assert.equal(x.agent.snapshot().checkpointAt.length,0)
})

test('quantity-first and quantity-last phrases start the same observed resource goal',()=>{
 const front=parseResourceGoal('mine 200 oak logs')
 const back=parseResourceGoal('mine oak logs 200')
 assert.equal(front?.kind,'mine-material')
 assert.equal(back?.kind,'mine-material')
 assert.equal(front.target,'oak_log')
 assert.equal(back.target,'oak_log')
 assert.equal(front.quantity,200)
 assert.equal(back.quantity,200)
 assert.equal(parseResourceGoal('collect dirt 30').quantity,30)
 assert.equal(parseResourceGoal('mine oak logs 99999'),null,'a five-digit unknown command is not dispatched as a job')
 assert.match(parseResourceGoal('mine oak logs 3000').error,/1–2304/)
})
