import test from 'node:test'
import assert from 'node:assert/strict'
import {interpretMessage} from '../src/chat.js'
import {parseCommand,ALLOWED_MINE,ALLOWED_BUILD} from '../pack-template/scripts/commands.js'
import {planWall,planFloor,planPillar,planBridge} from '../pack-template/scripts/logic.js'
const examples=new Map([
 ['hello',null], ['show jobs',null],['help building',null],
 ['how is the job going','task'],['check your inventory','inventory'],['who is playing','players'],
 ['what is nearby','survey'],['where are you','position'],
 ['remember this place','mark'],['return to waypoint','return'],['forget waypoint','forget'],
 ['follow behind me','follow'],['tag along','follow'],['meet me here','come'],
 ['hold position','stay'],['cancel job','stop'],['move to 1 62 -3','go'],
 ['gather 4 oak logs','mine'],['collect two dirt','mine'],['harvest a cherry log','mine'],
 ['mine 2 iron ore','mine'],['find iron ore','find'],['where is coal ore','find'],['count oak logs','count'],
 ['build a wall 3 by 2 with cobblestone','wall'],['make a floor 3 by 3 using oak planks','floor'],
 ['build a platform 3 x 2 of stone','floor'],['construct a pillar 4 out of stone','pillar'],
 ['build bridge 5 of oak planks','bridge']
])
for(const [prompt,action] of examples){test('chat job: '+prompt,()=>{
 const res=interpretMessage(prompt)
 if(!action){assert.equal(res.command,null)}
 else {assert.ok(res.command,JSON.stringify(res));assert.equal(parseCommand(res.command).action,action)}
})}
for(const prompt of ['build a castle','mine 200 stone','fight creepers','make a diamond pickaxe','go to 999999999 80 0','build bridge 999 of stone','please raid a village']){
 test('unsafe or unsupported: '+prompt,()=>assert.equal(interpretMessage(prompt).command,null))
}
test('canonical invalid action never runs',()=>assert.equal(parseCommand('build floor 99 x 99 of stone').action,'invalid'))
test('material limits for build and mine',()=>{assert.ok(ALLOWED_BUILD.includes('oak_planks'));assert.ok(ALLOWED_MINE.includes('iron_ore'));assert.equal(parseCommand('mine 9 diamond_ore').action,'invalid')})
test('plan geometries count exactly',()=>{const p={x:20.2,y:70,z:20.1};assert.equal(planWall(p,3,2).length,6);assert.equal(planFloor(p,3,3).length,9);assert.equal(planPillar(p,4).length,4);assert.equal(planBridge(p,5).length,5)})
test('No destructive job on negative instructions',()=>assert.equal(interpretMessage("don't mine two oak logs").command,null))
