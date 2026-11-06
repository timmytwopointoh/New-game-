import test from 'node:test'
import assert from 'node:assert/strict'
import {Navigation} from '../src/survival/navigation.js'
import {CompanionFieldTrial} from '../src/survival/companion-field-trial.js'

function fixture(){
 const records=[]
 const world={attributes:{'minecraft:health':20},enabled:true,terrainKnown:()=>false,
  requestNearby:()=>records.push('terrain-request')}
 const navigation=new Navigation(world,x=>records.push(x))
 navigation.client={queue:()=>{}};navigation.spawned=true
 navigation.movementBlock=()=> 'Nearby terrain is unknown; requesting it before walking.'
 navigation.updateFollow=()=>{navigation.state='waiting-for-player';navigation.reason='Waiting for a named owner locator packet.'}
 return {world,navigation,records}
}

test('follow request remains pending while server movement readiness is unknown, without moving',()=>{
 const {navigation,records}=fixture()
 const result=navigation.follow('Owner')
 assert.equal(result.accepted,true)
 assert.equal(result.queued,true)
 assert.equal(result.pendingMovement,true)
 assert.equal(navigation.job,null)
 assert.equal(navigation.pendingFollow.name,'Owner')
 assert.equal(navigation.state,'waiting-for-readiness')
 assert(records.includes('terrain-request'))
 const before=Date.now()
 navigation.resumePendingFollow(before+1000)
 assert.equal(navigation.job,null,'no route or motion before verification')
 assert.equal(navigation.pendingFollow.name,'Owner')
})

test('queued follow activates only after movement readiness is fully verified',()=>{
 const {navigation}=fixture()
 assert.equal(navigation.follow('Owner').accepted,true)
 navigation.movementBlock=()=>null
 navigation.resumePendingFollow(Date.now()+1000)
 assert.equal(navigation.pendingFollow,null)
 assert.equal(navigation.job?.kind,'follow')
 assert.equal(navigation.job?.name,'Owner')
 assert.equal(navigation.state,'waiting-for-player')
})

test('manual Stop or session detach cancels queued follow',()=>{
 const {navigation}=fixture()
 navigation.follow('Owner')
 navigation.stop('Owner pressed Stop',false)
 assert.equal(navigation.pendingFollow,null)
 navigation.resumePendingFollow()
 assert.equal(navigation.job,null)
 const another=fixture().navigation
 another.follow('Owner')
 another.detach()
 assert.equal(another.pendingFollow,null)
})

test('an unverified movement state never becomes a route just because the owner is far away',()=>{
 const {navigation}=fixture()
 navigation.follow('Owner')
 navigation.resumePendingFollow(Date.now()+7000)
 assert.equal(navigation.job,null)
 assert.equal(navigation.route,null)
 assert.equal(navigation.pendingFollow?.name,'Owner')
})

test('the owner home trial keeps waiting for pending Follow and does not claim home',()=>{
 const {navigation,world}=fixture()
 const calls=[]
 const c={navigation,world:{...world,dimension:0},connection:{spawned:true,config:{ownerPlayerNames:['Owner']}},
  report:x=>calls.push(x)}
 const companion={c,homeProject:{state:'idle'},editScope:()=>({realm:'realm-1'}),
  handle:s=>{calls.push(s);return {accepted:true,project:{state:'running'}}}}
 const trial=new CompanionFieldTrial(companion)
 const started=trial.start()
 assert.equal(started.accepted,true)
 trial.tick(Date.now()+1000)
 assert.equal(trial.state,'awaiting-arrival')
 assert.equal(calls.includes('this is your new home spot'),false)
})
