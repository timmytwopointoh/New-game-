import test from 'node:test'
import assert from 'node:assert/strict'
import {PlayerLocator,routeSearchWaypoint} from '../src/survival/player-locator.js'
test('named player locator receives server coordinates and resolves the correct owner',()=>{
 const p=new PlayerLocator()
 p.observeList({records:[{type:'add',entity_unique_id:'12001',username:'RealmOwner'},{type:'add',entity_unique_id:'12002',username:'OtherPlayer'}]},100)
 assert.equal(p.observeLocation({entity_unique_id:'12001',type:'coordinates',position:{x:75,y:67,z:35}},200),true)
 const match=p.locate('RealmOwner',new Map(),210)
 assert.equal(match.name,'RealmOwner')
 assert.equal(match.position.x,75)
 assert.equal(match.source,'locator-bar')
 assert.equal(p.locate('OtherPlayer',new Map(),210),null)
})
test('locator hides player when server hides location and expires stale hints',()=>{
 const p=new PlayerLocator()
 p.observeList({records:[{type:'add',entity_unique_id:'15',username:'Owner'}]},100)
 p.observeLocation({entity_unique_id:'15',position:{x:100,y:65,z:0}},200)
 assert.equal(p.locate('Owner',new Map(),91001),null)
 assert.ok(p.locate('Owner',new Map(),1000))
 p.observeLocation({entity_unique_id:'15',type:'hide'},1200)
 assert.equal(p.locate('Owner',new Map(),1201),null)
})
test('short search segments obey verified collision and never guess a missing path',()=>{
 const start={x:0,y:64,z:0},target={x:100,y:64,z:10}
 const safe={walkable:p=>p.y===64&&p.x<=8&&p.x>=0&&p.z===0}
 const a=routeSearchWaypoint(safe,start,target)
 assert.ok(a?.goal)
 assert.ok(a.goal.x<=8)
 assert.equal(a.goal.y,64)
 assert.equal(routeSearchWaypoint({walkable:()=>false},start,target),null)
 const safer={walkable:p=>p.y===64&&p.x>=0&&p.x<=12&&p.z>=0&&p.z<=2}
 const b=routeSearchWaypoint(safer,start,target)
 assert.ok(b?.goal)
 assert.ok(b.goal.x<=12)
 assert.equal(b.reached,false)
})
test('unknown player color does not authorize guessing a player identity',()=>{
 const p=new PlayerLocator()
 p.observeLocation({entity_unique_id:'998',position:{x:60,y:65,z:0}})
 assert.equal(p.locate('Owner'),null)
})
