import test from 'node:test'
import assert from 'node:assert/strict'
import {bedAcquisition,findBedFootprint,physicalHomePlan,homeCompletion,inspectHomeCapacity,assessHomeObstacle} from '../src/survival/home-architecture.js'
import {planUniqueHome} from '../src/survival/companion-plot.js'
import {HomeProject} from '../src/survival/home-project.js'
import {HomeRoutine,tickPhase} from '../src/survival/home-routine.js'
import {blueprint} from '../src/survival/building.js'
const land=()=>({permission:'plan-only',dimension:0,center:{x:0,y:64,z:0},bounds:{min:{x:-24,y:40,z:-24},max:{x:25,y:89,z:25}},size:{x:50,y:50,z:50}})
const item=n=>({name:n,shapes:n==='air'?[]:[[0,0,0,1,1,1]]})
const world=()=>({dimension:0,position:{x:0.5,y:65.62,z:0.5},inventoryKnown:true,editModeVerified:true,movementVerified:true,
 items:()=>({white_wool:3,oak_planks:6}),block(p,layer=0){return layer===1?item('air'):item(p.y<=64?'stone':'air')},
 airAt(p){return this.block(p).name==='air'&&this.block(p,1).name==='air'},standPosition(){return {x:0,y:64,z:0}},
 attributes:{'minecraft:health':20},inventory:new Map(),ownedPlacements:new Map(),walkable(){return true}})
test('bed crafting requires three matching wool, three arbitrary planks and server recipe',()=>{
 const ready=bedAcquisition({white_wool:3,oak_planks:2,spruce_planks:1},{recipesReceived:true})
 assert.equal(ready.phase,'craft-ready');assert.equal(ready.item,'white_bed');assert.equal(ready.canCraft,true)
 const lacking=bedAcquisition({white_wool:2,red_wool:1,oak_planks:3},{recipesReceived:true})
 assert.equal(lacking.phase,'gather-materials');assert.equal(lacking.missing[0].count,1)
 assert.equal(bedAcquisition({red_bed:1},{recipesReceived:false}).phase,'bed-in-inventory')
 assert.equal(bedAcquisition({white_wool:3,oak_planks:3},{recipesReceived:false}).canCraft,false)
})
test('bed needs two observed supported cells, refuses other dimensions',()=>{
 const w=world(),p=land()
 assert.equal(findBedFootprint(w,p)?.foot.y,65)
 assert.equal(findBedFootprint(w,{...p,dimension:1}),null)
 w.block=(p,l=0)=>l===1?item('air'):item('air')
 assert.equal(findBedFootprint(w,p),null)
})
test('physical house has no missing roof, walls, floor or two-high front entrance',()=>{
 const plot=land(),d=planUniqueHome(plot,{pick:()=>0.18})
 const p=physicalHomePlan(plot,d,{stageLimit:32})
 assert.ok(p.stagesTotal>12)
 assert.ok(p.placementsPlanned>500)
 assert.equal(p.stages.every(s=>s.positions.length<=32),true)
 assert.equal(p.stages.every(s=>s.positions.every(q=>q.x>=plot.bounds.min.x&&q.x<=plot.bounds.max.x&&q.y>=plot.bounds.min.y&&q.y<=plot.bounds.max.y&&q.z>=plot.bounds.min.z&&q.z<=plot.bounds.max.z)),true)
 const doorX=d.footprint.origin.x+Math.floor(d.footprint.width/2),doorZ=d.footprint.origin.z
 const occupied=new Set(p.stages.flatMap(s=>s.positions.map(x=>x.x+','+x.y+','+x.z)))
 assert.equal(occupied.has(doorX+','+(d.footprint.origin.y+1)+','+doorZ),false)
 assert.equal(occupied.has(doorX+','+(d.footprint.origin.y+2)+','+doorZ),false)
 assert.ok(occupied.has(doorX+','+(d.footprint.origin.y+d.footprint.height-2)+','+doorZ))
 assert.equal(homeCompletion(p,{bedConfirmed:false,stations:{}}),false)
})
test('idle creativity proposes no edits without real space or storage pressure',()=>{
 const plot=land(),d=planUniqueHome(plot,{pick:()=>0.15})
 assert.equal(inspectHomeCapacity({plot,design:d,idleMs:600000,storage:null}).action,'observe')
 assert.equal(inspectHomeCapacity({plot,design:d,idleMs:1000,storage:{used:26,total:27}}).action,'none')
 const x=inspectHomeCapacity({plot,design:d,idleMs:600000,storage:{used:26,total:27},random:()=>0.9})
 assert.equal(x.action,'propose')
 assert.equal(x.status,'preview-only')
 assert.equal(x.destructiveMining,x.direction==='down')
})
test('unloaded, occupied and out-of-land targets cannot be assumed clear',()=>{
 const w=world(),p=land()
 assert.equal(assessHomeObstacle({world:w,plot:p,targets:[{x:0,y:65,z:0}]}).action,'build')
 assert.equal(assessHomeObstacle({world:w,plot:p,targets:[{x:0,y:64,z:0}]}).action,'reroute')
 assert.equal(assessHomeObstacle({world:w,plot:p,targets:[{x:30,y:65,z:0}]}).action,'stop')
 w.block=()=>null
 assert.equal(assessHomeObstacle({world:w,plot:p,targets:[{x:0,y:65,z:0}]}).action,'observe')
})
test('staged voxel builder rejects duplicate and oversized custom edit payloads',()=>{
 assert.equal(blueprint({shape:'custom',origin:{x:0,y:65,z:0},material:'oak_planks',positions:[{x:0,y:65,z:0},{x:1,y:65,z:0}]}).positions.length,2)
 assert.throws(()=>blueprint({shape:'custom',origin:{x:0,y:65,z:0},material:'oak_planks',positions:[{x:0,y:65,z:0},{x:0,y:65,z:0}]}),/twice/i)
 assert.throws(()=>blueprint({shape:'custom',origin:{x:0,y:65,z:0},material:'oak_planks',positions:[{x:33,y:65,z:0}]}),/smaller/i)
})
test('home execution needs matching owner confirmation, never starts from blueprint preview',()=>{
 const w=world(),c={world:w,connection:{spawned:true},navigation:{},report(){}},h=new HomeProject(c),p=land(),d=planUniqueHome(p,{pick:()=>0.1})
 h.preview(p,d)
 assert.equal(h.state,'preview')
 const a=h.requestAuthorization('my-realm',1000)
 assert.equal(a.confirmationRequired,true)
 assert.equal(h.confirm('confirm home 000000','my-realm',2000).accepted,false)
 assert.equal(h.confirm('confirm home '+h.pending.code,'not-my-realm',2000).accepted,false)
 assert.equal(h.confirm('confirm home '+h.pending.code,'my-realm',2000).accepted,true)
 assert.equal(h.state,'running')
})
test('day-night behavior uses server clock and ignores player-spoofed sleeping text',()=>{
 assert.equal(tickPhase(1000),'day')
 assert.equal(tickPhase(11500),'dusk')
 assert.equal(tickPhase(15000),'night')
 assert.equal(tickPhase(24000+15000),'night')
 const c={world:world(),connection:{spawned:true},report(){},crafting:{recipes:[]}}
 const h=new HomeRoutine(c)
 h.setPlot(land())
 h.onServerTime({time:15000},1000)
 assert.equal(h.phase,'night')
 h.onSystemText({type:'chat',source_name:'AnotherPlayer',message:'players sleeping'},1100)
 assert.equal(h.lastSleepNotice,0)
 h.onSystemText({type:'system',source_name:'',message:'2/3 players sleeping'},1200)
 assert.equal(h.lastSleepNotice,1200)
 h.onServerTime({time:7000},1500)
 assert.equal(h.phase,'day')
 assert.equal(h.spawnConfirmed,false)
})
