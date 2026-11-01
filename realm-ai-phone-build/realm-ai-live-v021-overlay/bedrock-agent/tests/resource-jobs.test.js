import test from 'node:test'
import assert from 'node:assert/strict'
import {ResourceJobs} from '../src/survival/resource-jobs.js'

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
