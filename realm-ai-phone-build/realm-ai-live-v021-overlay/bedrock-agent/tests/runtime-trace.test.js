import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {EventEmitter} from 'node:events'
import {RuntimeTrace,cleanTrace} from '../src/runtime-trace.js'
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-trace-'));let now=10000;const file=path.join(dir,'runtime.json'),trace=new RuntimeTrace(file,{clock:()=>now});return {trace,file,advance:n=>now+=n,close:()=>fs.rmSync(dir,{recursive:true,force:true})}}
test('runtime trace retains bounded private history and grouped throttled symptoms across restart',()=>{
 const f=fixture();try{for(let i=0;i<600;i++){f.trace.record('sample',{state:{mode:'survival',grounded:true,token:'PRIVATE-TOKEN'}});f.trace.issue('server_stuck');f.advance(100)}f.trace.flush();const data=JSON.parse(fs.readFileSync(f.file));assert.equal(data.events.length,240);assert.equal(data.issues.length,1);assert(data.issues[0].count<=6);assert.equal(fs.statSync(f.file).mode&0o077,0);assert(!JSON.stringify(data).includes('PRIVATE'));const restored=new RuntimeTrace(f.file);assert.equal(restored.summary().issueTypes,1);assert.equal(restored.summary().remoteAccess,false)}finally{f.close()}
})
test('packet instrumentation preserves this, return values and errors without logging packet contents',()=>{
 const f=fixture(),c=new EventEmitter();try{c.marker=7;const original=function(name,p){assert.equal(this,c);if(name==='fail')throw Object.assign(new TypeError('PRIVATE-ERROR'),{stack:'TypeError: PRIVATE-ERROR\n at file:///app/src/survival/navigation.js:12:4'});return this.marker+p.value};c.queue=original;f.trace.attachClient(c);assert.equal(c.queue('request_ability',{value:2,token:'PRIVATE-TOKEN'}),9);c.emit('update_abilities',{token:'PRIVATE-UPDATE'});assert.throws(()=>c.queue('fail',{value:1}),/PRIVATE-ERROR/);f.trace.flush();const text=fs.readFileSync(f.file,'utf8');assert(!text.includes('PRIVATE'));assert(text.includes('src/survival/navigation.js'));assert.equal(f.trace.data.packets.request_ability,1);f.trace.detachClient();assert.equal(c.queue,original)}finally{f.close()}
})
test('sampled state detects prolonged flight/loading/terrain symptoms without copying arbitrary status fields',()=>{
 const f=fixture();try{
 const w={abilityState:{effective:{flying:true,invulnerable:true},loading:true},gameMode:'creative',inputLocks:{},attributes:{'minecraft:health':20},position:{x:1,y:70,z:2},sections:new Map(),decodeErrors:0},n={snapshot:()=>({physics:{grounded:false,terrainKnown:false,bodyClear:false,verticalVelocity:-.1}}),state:'blocked',progress:{feedback:'unconfirmed',stalled:()=>false}},v={desiredMode:'creative',flightRecovery:{state:'unconfirmed',attempts:5},pending:false}
 const bot={lastPhase:'spawned',spawned:true,survival:{world:w,navigation:n,verification:v},authChallenge:{userCode:'PRIVATE-CODE'},lastError:'PRIVATE-ERROR'}
 for(let i=0;i<8;i++){f.trace.capture(bot);f.advance(1000)}f.trace.flush();assert(f.trace.data.issues.some(i=>i.code==='loading_wait'));assert(f.trace.data.issues.some(i=>i.code==='unknown_terrain'));assert(f.trace.data.issues.some(i=>i.code==='flight_unconfirmed'));assert(!fs.readFileSync(f.file,'utf8').includes('PRIVATE'))
 }finally{f.close()}
})
test('whitelist strips injected messages, account data and packet fields from restored reports',()=>{
 const text=JSON.stringify(cleanTrace({token:'PRIVATE-TOKEN',events:[{kind:'sample',message:'PRIVATE-MESSAGE',state:{mode:'PRIVATE-MODE',username:'PRIVATE-NAME',password:'PRIVATE-PASSWORD'}}],packets:{'PRIVATE-CODE':1,player_auth_input:4},issues:[{code:'PRIVATE-ISSUE',count:10}]}));assert(!text.includes('PRIVATE'));assert(text.includes('player_auth_input'))
})
test('malformed persisted history is bounded and cannot prevent a clean recording session',()=>{
 assert.doesNotThrow(()=>cleanTrace({events:[null,{frames:[null]}],issues:[null],packets:null}))
 assert.doesNotThrow(()=>cleanTrace(null));assert.equal(cleanTrace({events:{bad:true},issues:'invalid'}).events.length,0)
 const f=fixture();try{fs.writeFileSync(f.file,'{broken');const restored=new RuntimeTrace(f.file);assert(restored.flush());assert.equal(JSON.parse(fs.readFileSync(f.file)).events[0].kind,'session_start')}finally{f.close()}
})

test('inventory evidence and placement counters survive report sanitizing without exposing item payloads',()=>{
 const data=cleanTrace({events:[{kind:'sample',state:{inventoryRevision:12,selectedHotbar:2,heldCount:8,placementConfirmed:1,placementTotal:4,held_item:{token:'PRIVATE'}}}],packets:{inventory_content:2,item_stack_response:3}})
 const state=data.events[0].state;assert.equal(state.inventoryRevision,12);assert.equal(state.selectedHotbar,2);assert.equal(state.placementConfirmed,1);assert.equal(data.packets.item_stack_response,3);assert(!JSON.stringify(data).includes('PRIVATE'))
})
