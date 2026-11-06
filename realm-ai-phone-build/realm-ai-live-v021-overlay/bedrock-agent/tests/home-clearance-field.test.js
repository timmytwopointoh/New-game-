import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyHomeObstruction,nextHomeObstruction} from '../src/survival/home-clearance.js'
const plot={permission:'plan-only',dimension:0,center:{x:0,y:64,z:0},bounds:{min:{x:-24,y:40,z:-24},max:{x:25,y:89,z:25}},size:{x:50,y:50,z:50}}
const point={x:0,y:65,z:0},key=p=>[p.x,p.y,p.z].join(',')
const nameOf=(name)=>({name,diggable:true,hardness:0.5,shapes:name==='air'?[]:[[0,0,0,1,1,1]]})
function world(override={}){
 const map=new Map(Object.entries(override))
 return {dimension:0,ownedPlacements:new Map(),block(p,layer=0){
  if(layer===1)return nameOf('air')
  const name=map.get(key(p))??(p.y<=64?'stone':'air')
  return nameOf(name)
 }}
}
test('ordinary observed dirt can be cleared; empty targets are not mined',()=>{
 const w=world({[key(point)]:'dirt'})
 assert.equal(classifyHomeObstruction(w,plot,point).action,'auto-mine')
 assert.equal(nextHomeObstruction(w,plot,[point]).action,'auto-mine')
 w.block=(p,layer=0)=>nameOf('air')
 assert.equal(nextHomeObstruction(w,plot,[point]).action,'build')
})
test('dirt beside an existing building requires consent',()=>{
 const wall={x:10,y:65,z:0}
 const w=world({[key(point)]:'dirt',[key(wall)]:'stone_bricks'})
 const result=classifyHomeObstruction(w,plot,point)
 assert.equal(result.action,'ask')
 assert.match(result.reason,/15-block/)
})
test('a log with visible leaves is assessed separately from player-made timber',()=>{
 const leaf={x:0,y:68,z:0}
 const w=world({[key(point)]:'oak_log',[key(leaf)]:'oak_leaves'})
 assert.equal(classifyHomeObstruction(w,plot,point).action,'auto-mine')
 const noCanopy=world({[key(point)]:'oak_log'})
 assert.equal(classifyHomeObstruction(noCanopy,plot,point).action,'ask')
})
test('unobserved blocks, custom blocks, falling materials and out-of-plot areas never auto clear',()=>{
 const changed={x:26,y:65,z:0}
 assert.equal(classifyHomeObstruction(world(),plot,changed).action,'stop')
 assert.equal(classifyHomeObstruction(world({[key(point)]:'examplemod:crystal'}),plot,point).action,'ask')
 assert.equal(classifyHomeObstruction(world({[key(point)]:'sand'}),plot,point).action,'ask')
 const w=world();w.block=()=>null
 assert.equal(classifyHomeObstruction(w,plot,point).action,'observe')
})
