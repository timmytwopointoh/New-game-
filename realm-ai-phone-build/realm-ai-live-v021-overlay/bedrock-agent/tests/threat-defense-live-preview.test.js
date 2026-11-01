import test from 'node:test'
import assert from 'node:assert/strict'
import {nearbyHostiles,safestEscape} from '../src/survival/threat-defense.js'
test('Threat detector ignores players and harmless animals',()=>{
 const world={position:{x:0,y:64,z:0},entities:new Map([
  ['z',{type:'minecraft:zombie',position:{x:2,y:64,z:0}}],
  ['p',{type:'minecraft:player',position:{x:1,y:64,z:0}}],
  ['s',{type:'minecraft:sheep',position:{x:1,y:64,z:2}}]
 ])}
 const result=nearbyHostiles(world,4)
 assert.equal(result.length,1);assert.equal(result[0].type,'minecraft:zombie')
})
test('Escape plan refuses blind terrain and never teleports',()=>{
 const w={position:{x:0,y:64,z:0},standPosition:()=>({x:0,y:63,z:0}),walkable:()=>false}
 const nav={world:w,routeTo:()=>{throw Error('unreachable cells should never be planned')}}
 const danger=[{type:'minecraft:creeper',position:{x:1,y:64,z:0},distance:1}]
 assert.equal(safestEscape(nav,danger),null)
})
