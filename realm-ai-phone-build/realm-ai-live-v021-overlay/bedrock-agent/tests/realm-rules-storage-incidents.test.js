import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {RealmRules,keepInventoryFromPacket} from '../src/survival/realm-rules.js'
import {StorageIncidents} from '../src/survival/storage-incidents.js'

test('Keep Inventory distinguishes owner report, server observation, and another Realm',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-realm-rules-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const rules=new RealmRules({directory:dir,scope:'realm-A'})
 assert.equal(rules.snapshot().keepInventory,null)
 assert.equal(rules.rememberKeepInventory(true),true)
 assert.equal(rules.snapshot().source,'owner-reported')
 assert.equal(rules.snapshot().chestContentsProtected,false)
 const reread=new RealmRules({directory:dir,scope:'realm-A'})
 assert.equal(reread.snapshot().keepInventory,true)
 assert.equal(new RealmRules({directory:dir,scope:'realm-B'}).snapshot().keepInventory,null)
 assert.equal(rules.observeServer({game_rules:[{name:'keepinventory',value:true}]}),true)
 assert.equal(rules.snapshot().source,'server-reported')
 assert.equal(rules.observeServer({game_rules:[{name:'keepinventory',value:false}]}),true)
 assert.equal(rules.snapshot().keepInventory,false,'fresh server observation wins')
 assert.equal(rules.snapshot().chestContentsProtected,false)
 assert.equal(new RealmRules({directory:dir,scope:'realm-A'}).snapshot().keepInventory,true,'saved owner preference stays separate from ephemeral server updates')
})
test('parse Bedrock gamerule packets without treating absent/malformed claims as fact',()=>{
 assert.equal(keepInventoryFromPacket({game_rules:[{name:'keepinventory',value:true}]}),true)
 assert.equal(keepInventoryFromPacket({gamerules:[{name:'keepinventory',value:{value:false}}]}),false)
 assert.equal(keepInventoryFromPacket({rules:[{name:'keep_inventory',value:'true'}]}),true)
 assert.equal(keepInventoryFromPacket({game_rules:[{name:'randomtickspeed',value:3}]}),null)
 assert.equal(keepInventoryFromPacket({game_rules:[{name:'keepinventory',value:'junk'}]}),null)
 assert.equal(keepInventoryFromPacket({}),null)
})
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-chest-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const blocks=new Map(),known=[],reports=[],drops=new Map(),revisions=new Map()
 const pos={x:10,y:64,z:20,dimension:0,name:'chest'}
 const w={enabled:true,registry:{},dimension:0,block(p){return blocks.get([p.x,p.y,p.z].join(','))??null},
  blockRevisions:revisions,drops}
 const c={world:w,workshop:{records:known},report:m=>reports.push(m)}
 const observer=new StorageIncidents(c,{directory:dir,scope:'realm-A'})
 return {dir,w,c,observer,pos,blocks,known,reports,drops,revisions}
}
test('a remembered chest in unloaded terrain does not cause a fake break report',t=>{
 const f=fixture(t)
 f.known.push(f.pos)
 f.observer.observe(1000)
 assert.equal(f.observer.snapshot().incidentCount,0)
 assert.equal(f.reports.length,0)
 f.blocks.set('10,64,20',{name:'chest'})
 f.observer.observe(1050)
 assert.equal(f.observer.snapshot().incidentCount,0)
})
test('server block removal raises a single incident and observes but never owns nearby items',t=>{
 const f=fixture(t)
 f.known.push(f.pos)
 f.blocks.set('10,64,20',{name:'air'})
 f.revisions.set('10,64,20,0',3)
 f.drops.set('17',{name:'diamond',count:5,position:{x:11,y:65,z:20}})
 f.drops.set('18',{name:'dirt',count:1,position:{x:300,y:65,z:20}})
 f.observer.observe(1200)
 const first=f.observer.snapshot()
 assert.equal(first.incidentCount,1)
 assert.equal(first.latest.status,'removed-server-update')
 assert.deepEqual(first.latest.nearbyDrops,[{name:'diamond',count:5}])
 assert.equal(first.automaticContainerLoot,false)
 assert.equal(first.chestContentsKnown,false)
 f.observer.observe(1300)
 assert.equal(f.reports.length,1,'one loss should not spam global chat')
 const reboot=new StorageIncidents(f.c,{directory:f.dir,scope:'realm-A'})
 assert.equal(reboot.snapshot().incidentCount,1)
 assert.equal(reboot.snapshot().latest.status,'removed-server-update')
 assert.equal(new StorageIncidents(f.c,{directory:f.dir,scope:'realm-B'}).snapshot().incidentCount,0)
})
test('observed absence after reconnect is not proof of who broke the chest',t=>{
 const f=fixture(t);f.known.push(f.pos)
 f.blocks.set('10,64,20',{name:'air'})
 f.observer.observe(1400)
 assert.equal(f.observer.latest().status,'missing-observed')
 assert.match(f.reports[0],/newly observed terrain/)
 assert.equal(f.observer.latest().nearbyDrops.length,0)
 f.blocks.set('10,64,20',{name:'chest'})
 f.observer.observe(1600)
 assert.equal(f.observer.latest().status,'reappeared-observed')
 assert.match(f.observer.latest().note,/NOT been verified/)
})
