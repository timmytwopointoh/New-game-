import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {CommandPlans} from '../src/survival/command-plans.js'

const fileName=scope=>crypto.createHash('sha256').update(scope).digest('hex')+'.json'
function fixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vf-saved-queues-'))
 const controller={connection:{spawned:true},world:{players:new Map(),inventory:new Map()},navigation:{job:null,mining:{job:null}},handle:command=>({accepted:true,message:command})}
 const plans=new CommandPlans(controller,{directory,scope:'active-Realm'})
 return {directory,plans,controller,close:()=>fs.rmSync(directory,{recursive:true,force:true})}
}
test('clears only current queue; preserves unrelated Realm queue and Microsoft data',()=>{
 const f=fixture()
 try{
  const x=path.join(f.directory,fileName('older-Realm'))
  fs.writeFileSync(x,JSON.stringify({cards:[{descriptor:{id:'inventory',values:{}}}]}))
  f.plans.prepare({id:'inventory',values:{}})
  f.plans.prepare({id:'diagnostics',values:{}})
  assert.equal(f.plans.cards.length,2)
  const result=f.plans.clearAll()
  assert.equal(result.accepted,true)
  assert.equal(f.plans.cards.length,0)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.plans.file,'utf8')).cards,[])
  assert.equal(JSON.parse(fs.readFileSync(x,'utf8')).cards.length,1)
 }finally{f.close()}
})
test('lists old queues by anonymous scope ID and removes only explicitly selected old queue',()=>{
 const f=fixture()
 try{
  const id=fileName('older-Realm').replace('.json','')
  const target=path.join(f.directory,id+'.json')
  const backup=target+'.pre-v0146.bak'
  fs.writeFileSync(target,JSON.stringify({cards:[{descriptor:{id:'look',values:{}}}]}))
  fs.writeFileSync(backup,'backup preserved until confirmed deletion')
  f.plans.prepare({id:'diagnostics',values:{}})
  const list=f.plans.otherSavedQueues()
  assert.equal(list.length,1)
  assert.equal(list[0].id,id)
  assert.equal(list[0].count,1)
  assert.equal(list[0].backups,1)
  assert.equal(f.plans.deleteSavedQueue(id).accepted,true)
  assert.equal(fs.existsSync(target),false)
  assert.equal(fs.existsSync(backup),false)
  assert.equal(f.plans.cards.length,1)
  assert.equal(fs.existsSync(f.plans.file),true)
 }finally{f.close()}
})
test('cannot delete active Realm by ID or accept path traversal or malformed input',()=>{
 const f=fixture()
 try{
  f.plans.prepare({id:'inventory',values:{}})
  assert.throws(()=>f.plans.deleteSavedQueue(fileName('active-Realm').replace('.json','')),/Clear Current/)
  assert.throws(()=>f.plans.deleteSavedQueue('../private/config'),/Invalid/)
  assert.throws(()=>f.plans.deleteSavedQueue('a'.repeat(65)),/Invalid/)
  assert.equal(f.plans.cards.length,1)
 }finally{f.close()}
})
test('running queue prevents clearing; STOP must be used first',()=>{
 const f=fixture()
 try{
  f.plans.prepare({id:'inventory',values:{}})
  f.plans.prepare({id:'diagnostics',values:{}})
  f.plans.startAll()
  assert.throws(()=>f.plans.clearAll(),/Stop the queue/)
  f.plans.interrupt()
  assert.equal(f.plans.clearAll().accepted,true)
 }finally{f.close()}
})
test('listing an unknown or corrupt old queue does not parse it as a command',()=>{
 const f=fixture()
 try{
  const file=path.join(f.directory,fileName('bad-Realm'))
  fs.writeFileSync(file,'{corrupt saved JSON')
  const result=f.plans.otherSavedQueues()
  assert.equal(result.length,1)
  assert.equal(result[0].count,null)
  assert.equal(result[0].hasQueue,true)
  assert.equal(f.plans.cards.length,0)
 }finally{f.close()}
})
