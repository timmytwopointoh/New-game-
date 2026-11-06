import test from 'node:test'
import assert from 'node:assert/strict'
import {CommandPlans} from '../src/survival/command-plans.js'

// This is the EXACT Save Plan -> Activate backend used by the Android command
// picker, independent of text-chat parsing. A successful receipt proves the
// movement controller was called, NOT that a server position changed.
test('test command picker prepares and activates a real Follow without using chat',()=>{
 const seen=[]
 const navigation={pendingFollow:null,job:null,state:'idle'}
 const controller={
  world:{players:new Map(),lastPoseAt:0},
  connection:{config:{ownerPlayerNames:['Owner']}},
  navigation,
  report:()=>{},
  learning:{guidance:()=>null,record:()=>{}},
  handle(command){
   seen.push(command)
   if(command==='follow Owner'){
    navigation.pendingFollow={name:'Owner'}
    navigation.state='waiting-for-readiness'
    return {accepted:true,queued:true,message:'Follow queued for terrain verification.'}
   }
   return {accepted:false,queued:false,message:'Unexpected command.'}
  }
 }
 const plans=new CommandPlans(controller,{scope:'realm-fixture'})
 try{
  const saved=plans.prepare({id:'follow',values:{player:'Owner'}})
  assert.equal(saved.accepted,true)
  assert.deepEqual(seen,[],'saving a card must never start movement')
  assert.equal(saved.plans.cards.length,1)
  const activated=plans.activateQueue()
  assert.equal(activated.accepted,true)
  assert.deepEqual(seen,['follow Owner'],'only one authorized Follow command starts')
  assert.equal(navigation.pendingFollow.name,'Owner')
  assert.equal(activated.plans.running,saved.plans.selected)
  assert.equal(activated.plans.cards[0].state,'running')
 }finally{plans.interrupt('Test finished.')}
})

test('picker refuses unobserved and unconfigured player names',()=>{
 const plans=new CommandPlans({
  world:{players:new Map()},
  connection:{config:{ownerPlayerNames:['Owner']}},
  navigation:{job:null}
 },{scope:'realm-fixture'})
 try{
  assert.throws(()=>plans.prepare({id:'follow',values:{player:'Stranger'}}),/Choose an observed player or configured owner/)
  assert.equal(plans.snapshot().cards.length,0)
 }finally{plans.interrupt('Test finished.')}
})
