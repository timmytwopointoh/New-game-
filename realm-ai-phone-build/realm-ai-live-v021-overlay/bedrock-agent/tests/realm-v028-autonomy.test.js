import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {AutomaticGoogleResearch,PrivateResearchKey,validateObservedPlan} from '../src/automatic-google-research.js'
import {meleeTarget,meleePacket} from '../src/survival/combat.js'
import {Pickup,nearestDrop,withinPickupReach} from '../src/survival/pickup.js'
import {extractGooglePlan} from '../src/research-action-plan.js'
const fakeWorld=()=>({
 position:{x:0.5,y:65.62,z:0.5},serverPosition:{x:0.5,y:65.62,z:0.5},standPosition(){return {x:0,y:64,z:0}},gameMode:'survival',survivalVerified:true,grounded:()=>true,movementVerified:true,
 items:()=>({dirt:5}),inventoryKnown:true,inventory:new Map([[0,{network_id:1,count:1}]]),selectedSlot:0,entityId:'99',entities:new Map(),players:new Map(),drops:new Map(),attributes:{'minecraft:health':20},
 scan:()=>({found:[{x:2,y:64,z:1,name:'dirt'}]}),walkable:p=>p.x<=6&&p.x>=-6&&p.y===64,block:p=>({name:p.x===2?'dirt':'air'}),visible:p=>p.x<7,airAt:p=>p.x!==2
})
test('store Google credentials privately; never return key in status',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vf-key-')),file=path.join(dir,'secret.json');try{
 const store=new PrivateResearchKey(file);assert.equal(store.configured(),false)
 assert.throws(()=>store.set('short'))
 store.set('TEST_ONLY_123456789012345');assert.equal(store.configured(),true)
 assert.equal(fs.statSync(file).mode&0o777,0o600)
 store.clear();assert.equal(store.configured(),false)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('Google action is based on received terrain, not fabricated coordinates',()=>{
 const w=fakeWorld(),text='COMMAND: walk to 4 64 0\nCOMMAND: walk to 25 64 0\nCOMMAND: dig 2 64 1\nCOMMAND: dig 6 64 1'
 const p=validateObservedPlan('walk to the dirt and dig it',text,w)
 assert.deepEqual(p.commands.map(x=>x.text),['walk to 4 64 0','dig 2 64 1'])
})
test('Google response is researched and plans are proposed without executing them',async()=>{
 let calls=0
 const keyStore={get:()=> 'fakeApiKeyForTests01234',configured:()=>true}
 const research=new AutomaticGoogleResearch({keyStore,fetcher:async(url,options)=>{
  calls++;assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'))
  assert.equal(options.headers['x-goog-api-key'],'fakeApiKeyForTests01234')
  return {ok:true,text:async()=>JSON.stringify({candidates:[{content:{parts:[{text:'A clear dirt block can be mined.\nCOMMAND: dig 2 64 1'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://example.org'}}]}}]})}
 }})
 const p=await research.plan('dig some dirt',fakeWorld());assert.equal(calls,1);assert.equal(p.commands.length,1)
 assert.equal(p.grounded,true)
})
test('Google cannot add shell commands or arbitrary non-requested world edits',()=>{
 const p=extractGooglePlan('look around','COMMAND: /op me\nCOMMAND: dig 2 64 1\nCOMMAND: look around')
 assert.deepEqual(p.commands.map(x=>x.text),['look around'])
})
test('combat strictly targets observed hostiles; never players, creepers or unseen',()=>{
 const w=fakeWorld();w.entities.set('5',{type:'minecraft:zombie',position:{x:1,y:65,z:1}})
 w.entities.set('6',{type:'minecraft:creeper',position:{x:1,y:65,z:1}})
 w.players.set('5',{name:'owner'})
 assert.equal(meleeTarget(w),null)
 w.players.delete('5');let enemy=meleeTarget(w)
 assert.equal(enemy.id,'5');assert.equal(meleePacket(w,enemy).transaction.transaction_data.action_type,'attack')
 w.gameMode='creative';assert.equal(meleeTarget(w),null)
})
test('pickup claims success only after observed inventory increase',()=>{
 const w=fakeWorld();w.drops.set('10',{position:{x:.8,y:65.4,z:.5},name:'dirt',count:1})
 const drop=nearestDrop(w);assert.equal(drop.id,'10');assert(withinPickupReach(w,drop))
 const pick=new Pickup(w);assert.equal(pick.begin(drop).accepted,true)
 const output=[];pick.tick(10,{queue:(packet,data)=>output.push([packet,data])});assert.equal(pick.state,'waiting-for-server-inventory')
 pick.tick(20,{queue:()=>{}});assert.equal(pick.state,'waiting-for-server-inventory')
 w.items=()=>({dirt:6});pick.tick(40,{queue:()=>{}});assert.equal(pick.state,'confirmed')
 assert.equal(output.length,0,'Pickup never sends a server-only packet')
})
test('pickup times out as unverified rather than falsely collected',()=>{
 const w=fakeWorld(),p=new Pickup(w),drop={id:'12',position:{x:.8,y:65.4,z:.5},name:'dirt'}
 p.begin(drop);p.tick(100,{queue:()=>{}});p.tick(4000,{queue:()=>{}});assert.equal(p.state,'unverified')
})
test('gather task never grants Google permission to construct buildings',()=>{
 const w=fakeWorld()
 const p=validateObservedPlan('get me some dirt','COMMAND: place dirt at 3 64 1\nCOMMAND: dig 2 64 1\nCOMMAND: collect drops',w)
 assert.deepEqual(p.commands.map(x=>x.text),['dig 2 64 1','collect drops'])
})
