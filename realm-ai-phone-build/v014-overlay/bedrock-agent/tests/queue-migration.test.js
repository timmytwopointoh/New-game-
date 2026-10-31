import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {CommandPlans,parseDescriptor,migrateSavedDescriptor} from '../src/survival/command-plans.js'

function workspace(name){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vf-migrate-'))
 const file=path.join(directory,crypto.createHash('sha256').update(name).digest('hex')+'.json')
 const actions=[]
 const controller={world:{players:new Map(),inventory:new Map()},connection:{spawned:true,config:{ownerPlayerNames:['Owner']}},navigation:{job:null,mining:{job:null}},handle:cmd=>{actions.push(cmd);return {accepted:true,message:cmd}}}
 return {directory,file,controller,actions,make:()=>new CommandPlans(controller,{directory,scope:name}),close:()=>fs.rmSync(directory,{recursive:true,force:true})}
}
const old=id=>({descriptor:{id,values:{}}})

test('recover v0.14.4 diagnostic cards from screenshot, preserve order, original bytes and do NOT execute',()=>{
 const e=workspace('realm-with-old-plans')
 try{
  const original=JSON.stringify({cards:[old('status'),old('player_identity'),old('combat_status'),old('inventory_status'),old('look')]})
  fs.writeFileSync(e.file,original)
  const p=e.make()
  assert.equal(p.readOnly,false)
  assert.equal(p.cards.length,5)
  assert.deepEqual(p.cards.map(c=>c.descriptor.id),['diagnostics','diagnostics','diagnostics','diagnostics','look'])
  assert.deepEqual(e.actions,[])
  assert.match(p.snapshot().migration,/Recovered 5 saved commands/)
  assert.equal(fs.readFileSync(e.file+'.pre-v0146.bak','utf8'),original)
  assert.deepEqual(JSON.parse(fs.readFileSync(e.file,'utf8')).cards.map(c=>c.descriptor.id),p.cards.map(c=>c.descriptor.id))
  assert.equal(p.startAll().accepted,true)
  p.interrupt()
 }finally{e.close()}
})
test('unsupported legacy entry is kept in backup, but does not disable other saved commands',()=>{
 const e=workspace('realm-with-unknown')
 try{
  const original=JSON.stringify({cards:[old('inventory'),old('unknown-old-command'),old('control_status')]})
  fs.writeFileSync(e.file,original)
  const p=e.make()
  assert.equal(p.readOnly,false)
  assert.deepEqual(p.cards.map(c=>c.descriptor.id),['inventory','diagnostics'])
  assert.match(p.migrationNote,/1 unsupported entries/)
  assert.equal(fs.readFileSync(e.file+'.pre-v0146.bak','utf8'),original)
  assert.equal(e.actions.length,0)
  assert.equal(p.prepare({id:'help',values:{}}).accepted,true)
 }finally{e.close()}
})
test('broken JSON is archived, user may create a new queue and original file remains recoverable',()=>{
 const e=workspace('realm-with-broken-json')
 try{
  const original='{ broken persisted cards, do not discard'
  fs.writeFileSync(e.file,original)
  const p=e.make()
  assert.equal(p.readOnly,false)
  assert.equal(p.cards.length,0)
  assert.match(p.migrationNote,/recovery archive/)
  const backups=fs.readdirSync(e.directory).filter(n=>n.includes('pre-v0146-unreadable'))
  assert.equal(backups.length,1)
  assert.equal(fs.readFileSync(path.join(e.directory,backups[0]),'utf8'),original)
  assert.equal(p.prepare({id:'diagnostics',values:{}}).accepted,true)
  assert(fs.existsSync(e.file))
 }finally{e.close()}
})
test('valid v0.14.5 queues keep order and are not rewritten',()=>{
 const e=workspace('realm-current')
 try{
  const json=JSON.stringify({cards:[old('inventory'),old('diagnostics')]})
  fs.writeFileSync(e.file,json)
  const p=e.make()
  assert.equal(p.cards.length,2)
  assert.equal(p.migrationNote,'')
  assert.equal(fs.readFileSync(e.file,'utf8'),json)
  assert.equal(fs.existsSync(e.file+'.pre-v0146.bak'),false)
 }finally{e.close()}
})
test('safety: ordinary non-Survival or unknown modes cannot be bypassed by queue migration',()=>{
 const e=workspace('realm-no-permissions')
 try{
  const p=e.make()
  const x=migrateSavedDescriptor(old('player_identity'))
  assert.deepEqual(x,{id:'diagnostics',values:{}})
  assert.throws(()=>migrateSavedDescriptor({descriptor:{id:'gamemode creative'}}),/Unsupported/)
  assert.equal(p.runActive,false)
  assert.equal(e.actions.length,0)
 }finally{e.close()}
})
