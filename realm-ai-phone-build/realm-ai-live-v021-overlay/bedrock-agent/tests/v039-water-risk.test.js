import test from 'node:test'
import assert from 'node:assert/strict'
import {findPath} from '../src/survival/pathfinder.js'
const key=p=>`${p.x},${p.y},${p.z}`
const world=({wet=[],blocked=[],allowWet=true}={})=>{
 const water=new Set(wet),walls=new Set(blocked)
 return {shallowWater:p=>water.has(key(p)),
  walkable:p=>p.y===64&&Math.abs(p.z)<=1&&p.x>=0&&p.x<=5&&!walls.has(key(p))&&(!water.has(key(p))||allowWet),
  canJumpBetween:()=>false,canDropBetween:()=>false}
}
const start={x:0,y:64,z:0},goal={x:5,y:64,z:0}
const wet=[1,2,3,4].map(x=>`${x},64,0`)
const sides=Array.from({length:6},(_,i)=>[`${i},64,-1`,`${i},64,1`]).flat()
test('dry route does not cross water',()=>assert.equal(findPath(world({wet,blocked:sides,allowWet:false}),start,goal,{waterBudget:0}).ok,false))
test('wading route is possible only with sufficient risk budget',()=>{const w=world({wet,blocked:sides});assert.equal(findPath(w,start,goal,{waterBudget:0}).ok,false);const p=findPath(w,start,goal,{waterBudget:4});assert.equal(p.ok,true);assert.equal(p.waterCrossing,true)})
test('longer water crossing refuses to exceed exposure budget',()=>{const w=world({wet:[...wet,'5,64,0'],blocked:sides});assert.equal(findPath(w,start,goal,{waterBudget:4}).ok,false);assert.equal(findPath(w,start,goal,{waterBudget:5}).ok,true)})
test('unknown route cells cannot be made safe by allowing water',()=>assert.equal(findPath(world({wet,blocked:[...sides,'3,64,0']}),start,goal,{waterBudget:8}).ok,false))
test('penalty chooses a known dry detour over water',()=>{const p=findPath(world({wet:['2,64,0']}),start,goal,{waterBudget:4,waterPenalty:12});assert.equal(p.ok,true);assert.equal(p.waterCrossing,false)})
