import test from 'node:test'
import assert from 'node:assert/strict'
import {realm} from './helpers/realm.js'

test('off-center Follow aligns inside the current cell instead of cutting a cobblestone corner',()=>{
 const f=realm();try{f.set({x:1,y:64,z:1},'cobblestone');f.set({x:1,y:65,z:1},'cobblestone');f.w.position.z=.85;f.w.serverPosition={...f.w.position};assert(f.w.clearBody(f.w.position));f.w.players.set('owner',{name:'Owner',position:{x:4.5,y:65.62,z:.5}})
 assert(f.n.follow('Owner').accepted);const now=Date.now();for(let t=0;t<2500;t+=50){f.n.step(now+t);assert(f.w.clearBody(f.w.position));f.c.emit('correct_player_move_prediction',{position:{...f.w.position}})}
 assert(f.w.serverPosition.x>2,JSON.stringify(f.n.snapshot()));assert.equal(f.w.block({x:1,y:64,z:1}).name,'cobblestone');assert(!f.sent.some(([name,p])=>name==='inventory_transaction'||name==='player_auth_input'&&p.transaction))
 }finally{f.close()}
})
test('one-block jump fits beneath a three-block ceiling and a real head bump does not cancel landing',()=>{
 const f=realm();try{f.set({x:1,y:64,z:0},'stone');for(let x=-1;x<=2;x++)f.set({x,y:67,z:0},'stone');const target={x:1,y:65,z:0};assert(f.w.canJumpBetween({x:0,y:64,z:0},target));assert(f.n.walk(target).accepted);const now=Date.now();for(let t=0;t<1800;t+=50)f.n.step(now+t)
 assert(f.w.grounded());assert.equal(f.w.standPosition().y,65,JSON.stringify(f.n.snapshot()));assert(Math.abs(f.w.position.y-66.62)<.003);assert(f.sent.some(([name,p])=>name==='player_auth_input'&&p.input_data.includes('start_jumping')))
 }finally{f.close()}
})
test('unknown support, magma contact and solid collision remain distinct explicit failures',()=>{
 const f=realm();try{assert.equal(f.w.standingIssue(f.w.position),null);f.w.updates.delete('0,63,0,0');let issue=f.w.standingIssue(f.w.position);assert.equal(issue.kind,'unknown-support');assert.deepEqual(issue.position,{x:0,y:63,z:0});f.set({x:0,y:63,z:0},'stone')
 f.set({x:1,y:63,z:0},'magma');issue=f.w.standingIssue({x:.71,y:65.62,z:.5});assert.equal(issue.kind,'hazard');assert.equal(issue.name,'magma')
 f.set({x:1,y:64,z:0},'cobblestone');issue=f.w.bodyIssue({x:.71,y:65.62,z:.5});assert.equal(issue.kind,'solid');assert.equal(issue.name,'cobblestone');assert.match(f.n.clearanceMessage(issue),/cobblestone at 1,64,0/)
 }finally{f.close()}
})
