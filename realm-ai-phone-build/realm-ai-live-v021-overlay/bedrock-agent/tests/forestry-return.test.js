import test from 'node:test'
import assert from 'node:assert/strict'
import {isForestryReturnCommand,makeForestryReturnPlan,homeChestLinePosition,nextForestryCargoAction,returnRouteHints} from '../src/survival/forestry-return.js'
const p=(x)=>({x,y:64,z:0})
const c=(tree,confirmed=false)=>({tree,position:p(tree),confirmed})
test('Only explicit lumber-return expressions trigger a managed trip; emergency Stop remains different',()=>{
 for(const phrase of ['stop chopping trees','return home','go home with wood','bring the wood home','stop gathering wood'])assert.equal(isForestryReturnCommand(phrase),true)
 for(const phrase of ['stop','stop everything','stop walking','chop down trees','where is home','make me a chest'])assert.equal(isForestryReturnCommand(phrase),false)
})
test('tree two is immutable home, others collected newest first and never mistaken for verified chests',()=>{
 const plan=makeForestryReturnPlan([c(5,true),c(2,true),c(8,false),c(11,true)])
 assert.deepEqual(plan.home,{tree:2,position:p(2),confirmed:true})
 assert.deepEqual(plan.pickups.map(x=>x.tree),[11,8,5]);assert.equal(plan.pickups[1].confirmed,false)
 assert.equal(plan.confirmedWithdrawals,0);assert.equal(plan.confirmedChestRecoveries,0)
 assert.ok(plan.awaiting.includes('item-stack request and response handling'))
})
test('an unconfirmed or absent home chest cannot be asserted or destroyed',()=>{
 assert.equal(makeForestryReturnPlan([c(5)]).home,null)
 assert.ok(makeForestryReturnPlan([c(2)]).awaiting.includes('server-confirmed tree-two chest'))
 assert.equal(nextForestryCargoAction({home:{confirmed:false},source:{confirmed:true}}).action,'wait')
})
test('chest transfer requires confirmations, revisits after full inventory, never breaks loaded chest',()=>{
 const home={confirmed:true},source={confirmed:true}
 assert.equal(nextForestryCargoAction({home,source}).action,'open-source')
 assert.equal(nextForestryCargoAction({home,source,serverVerifiedOpen:true}).action,'wait')
 assert.equal(nextForestryCargoAction({home,source,serverVerifiedOpen:true,contentsKnown:true,hasWood:true,freeInventorySlots:0}).action,'return-and-deposit')
 assert.equal(nextForestryCargoAction({home,source,serverVerifiedOpen:true,contentsKnown:true,hasWood:true,freeInventorySlots:2}).action,'withdraw')
 assert.equal(nextForestryCargoAction({home,source,serverVerifiedOpen:true,contentsKnown:true,hasWood:false}).action,'wait')
 assert.equal(nextForestryCargoAction({home,source,serverVerifiedOpen:true,contentsKnown:true,hasWood:false,serverVerifiedEmpty:true}).action,'recover-empty-chest')
 assert.equal(nextForestryCargoAction({home,source,serverVerifiedOpen:true,contentsKnown:true,serverVerifiedEmpty:true,confirmedPickup:true}).action,'return-and-deposit')
})
test('home chest line uses a one-block gap; route hints reverse the logging path',()=>{
 assert.deepEqual(homeChestLinePosition(p(2),1),p(4))
 assert.deepEqual(homeChestLinePosition(p(2),2),p(6))
 const route=returnRouteHints([p(2),p(5),p(5),p(8)],p(2))
 assert.deepEqual(route,[p(8),p(5),p(2)])
})

test('return command changes a live forestry worker into a homeward job and does not claim any chest moved',async()=>{
 const {ResourceJobs}=await import('../src/survival/resource-jobs.js')
 const position={x:21.5,y:65.62,z:0.5};let aborted=0,walkCalls=0
 const w={position,serverPosition:{...position},dimension:0,inventoryKnown:true,enabled:true,movementVerified:true,attributes:{'minecraft:health':20},
  standPosition:()=>({x:21,y:64,z:0}),walkable:()=>false,requestNearby:()=>{},items:()=>({})}
 const n={job:null,state:'idle',defense:{state:'idle'},isRespawning:()=>false,stop:()=>{aborted++},walk:()=>{walkCalls++;return {accepted:false}},routeTo:()=>({ok:false})}
 const reports=[],job=new ResourceJobs({world:w,navigation:n,report:x=>reports.push(x)})
 job.active={goal:{kind:'tree-harvest'},state:'search',lastAt:0,breaks:8,pickups:5,trunks:[p(1),p(2),p(5),p(8)],checkpoints:[c(2),c(5),c(8)],waitingCapabilities:[]}
 const result=job.requestReturnHome()
 assert.equal(result.accepted,true);assert.equal(aborted,1)
 assert.ok(['returning-home','return-walking','return-paused'].includes(job.active.state))
 assert.deepEqual(job.active.returnPlan.pickups.map(x=>x.tree),[8,5])
 assert.equal(job.active.returnPlan.home.confirmed,false)
 assert.equal(job.active.returnPlan.confirmedWithdrawals,0)
 assert.equal(job.active.returnPlan.confirmedDeposits,0)
 assert.equal(job.active.returnPlan.confirmedChestRecoveries,0)
 assert.equal(walkCalls,0)
 job.cancel('Emergency Stop')
 assert.equal(job.snapshot().state,'interrupted')
})
