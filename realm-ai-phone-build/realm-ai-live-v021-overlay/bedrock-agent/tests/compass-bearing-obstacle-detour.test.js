import test from 'node:test'
import assert from 'node:assert/strict'
import {PlayerLocator,routeSearchCandidates,routeSearchWaypoint} from '../src/survival/player-locator.js'

test('owner is matched by server-received gamertag, not changing colored waypoint',()=>{
 const locator=new PlayerLocator()
 locator.observeList({records:[
  {type:'add',entity_unique_id:'7100',username:'Owner'},
  {type:'add',entity_unique_id:'7200',username:'Other'}]},100)
 locator.observeLocation({entity_unique_id:'7200',type:'coordinates',
  position:{x:3,y:65,z:3}},120)
 locator.observeLocation({entity_unique_id:'7100',type:'coordinates',
  position:{x:120,y:65,z:40}},130)
 assert.equal(locator.locate('Owner',new Map(),150).position.x,120)
 assert.equal(locator.locate('Other',new Map(),150).position.x,3)
 locator.observeLocation({entity_unique_id:'7100',type:'hide'},160)
 assert.equal(locator.locate('Owner',new Map(),170),null)
})

test('compass/locator bearing supplies alternate short, safe waypoint candidates',()=>{
 const start={x:0,y:64,z:0},target={x:100,y:64,z:0}
 // A tree row blocks the direct line. Dry, level ground remains to the
 // right of it, and a water strip must never be chosen as a waypoint.
 const world={walkable:p=>p.y===64&&p.x>=0&&p.x<=19&&
  p.z>=-4&&p.z<=4&&!(p.x>=4&&p.x<=13&&p.z===0)&&
  !(p.x>=8&&p.z<0)}
 const candidates=routeSearchCandidates(world,start,target,{limit:24})
 assert(candidates.length>1)
 assert(candidates.some(p=>p.lateralOffset!==0&&p.goal.z>0),
  'safe right-hand detour should be considered')
 assert(candidates.every(p=>world.walkable(p.goal)),'unknown, water or unsupported ground rejected')
 assert(candidates.every(p=>p.progress>0),'every move must improve bearing range')
 assert(candidates.some(p=>p.goal.x<=7),'must test a shorter waypoint when the long route is blocked')
 // The pathfinder may reject a walkable endpoint if a wall blocks the
 // intermediate cells. Try the NEXT candidate; do not teleport.
 const blockedPath=candidates[0]
 const usable=candidates.find(c=>c.lateralOffset!==0&&c.goal.z>0)
 assert(usable)
 assert.notDeepEqual(blockedPath.goal,usable.goal)
})

test('unknown terrain gives no made-up route and close target is already reached',()=>{
 const start={x:0,y:64,z:0},target={x:99,y:64,z:0}
 assert.deepEqual(routeSearchCandidates({walkable:()=>false},start,target),[])
 assert.equal(routeSearchWaypoint({walkable:()=>false},start,target),null)
 assert.deepEqual(routeSearchWaypoint({walkable:()=>false},start,{x:1,y:64,z:0}),
  {goal:null,reached:true})
})

test('route sampling rejects excessive lateral displacement and invalid target coordinates',()=>{
 const world={walkable:()=>true}
 const candidates=routeSearchCandidates(world,{x:0,y:64,z:0},{x:120,y:64,z:0})
 assert(candidates.length<=24)
 assert(candidates.every(c=>c.goal.x>=1&&Math.abs(c.goal.z)<=4))
 assert.deepEqual(routeSearchCandidates(world,{x:0,y:64,z:0},{x:NaN,y:64,z:0}),[])
})
