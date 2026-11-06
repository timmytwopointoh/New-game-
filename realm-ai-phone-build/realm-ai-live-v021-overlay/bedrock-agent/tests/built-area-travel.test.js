import test from 'node:test'
import assert from 'node:assert/strict'
import {WorldView} from '../src/survival/world.js'
import {vanillaBlockBehavior,vanillaPathRisk} from '../src/survival/vanilla-block-behavior.js'
import {constructionExposure,approvedEdit} from '../src/survival/construction-guard.js'
const solid=name=>({name,shapes:[[0,0,0,1,1,1]],hardness:2,diggable:true})
const air=()=>({name:'air',shapes:[]})
const coord=p=>p.x+','+p.y+','+p.z
function builtWorld({stairs=false}={}){
 const w=new WorldView()
 w.position={x:.5,y:65.62,z:.5}
 w.serverPosition={...w.position}
 w.block=(p,layer=0)=>{
  if(layer===1)return air()
  if(p.x===4&&p.y===64&&p.z===0)return solid('stone_bricks')
  if(p.x===5&&p.y===64&&p.z===0)return solid('oak_planks')
  if(p.x===6&&p.y===64&&p.z===0)return solid('chest')
  if(stairs&&p.x===1&&p.y===64&&p.z===0)return solid('stone_bricks')
  return p.y<=63?solid('stone_bricks'):air()
 }
 return w
}
test('walking through safe built floors does not require owner edit permission',()=>{
 const w=builtWorld()
 assert.equal(w.walkable({x:0,y:64,z:0}),true)
 assert.equal(w.walkable({x:3,y:64,z:0}),true)
 assert.equal(w.walkable({x:7,y:64,z:0}),true)
 assert.equal(vanillaPathRisk(w,{x:0,y:64,z:0}),0)
 assert.equal(w.editApproval,null)
 assert.equal(approvedEdit(w,'mine',[{x:0,y:63,z:0}]),false)
 assert.equal(approvedEdit(w,'build',[{x:0,y:64,z:0}]),false)
})
test('jumping up a normal one-block built step is ordinary traversal',()=>{
 const w=builtWorld({stairs:true})
 assert.equal(w.walkable({x:0,y:64,z:0}),true)
 assert.equal(w.walkable({x:1,y:65,z:0}),true)
 assert.equal(w.canJumpBetween({x:0,y:64,z:0},{x:1,y:65,z:0}),true)
 assert.equal(w.editApproval,null)
})
test('building protection still rejects mining near player-built stone and planks',()=>{
 const w=builtWorld()
 const p={x:0,y:63,z:0}
 const result=constructionExposure(w,[p])
 assert.equal(result.state,'protected')
 assert.equal(result.near.distance<=15,true)
 assert.equal(approvedEdit(w,'mine',[p]),false)
})
test('ordinary redstone pressure plates are soft path costs, not edit bans',()=>{
 const plate=vanillaBlockBehavior('oak_pressure_plate')
 assert.equal(plate.routeBlocked,false)
 assert.ok(plate.penalty>0)
 assert.equal(vanillaBlockBehavior('oak_planks').routeBlocked,false)
 assert.equal(vanillaBlockBehavior('stone_bricks').routeBlocked,false)
 assert.equal(vanillaBlockBehavior('turtle_egg').routeBlocked,true)
 assert.equal(vanillaBlockBehavior('lava').routeBlocked,true)
 assert.equal(vanillaBlockBehavior('myaddon:unknown').routeBlocked,true)
})
