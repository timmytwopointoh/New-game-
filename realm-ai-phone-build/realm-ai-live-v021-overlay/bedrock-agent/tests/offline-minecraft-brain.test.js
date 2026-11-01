import test from 'node:test'
import assert from 'node:assert/strict'
import {offlineMinecraftResponse,offlineKnowledgeStats} from '../src/offline-minecraft-brain.js'

test('data is packaged and offline, with versioned knowledge counts',()=>{assert.ok(offlineKnowledgeStats.blocks>1000);assert.ok(offlineKnowledgeStats.items>1000);assert.ok(offlineKnowledgeStats.entities>100);assert.equal(offlineKnowledgeStats.networkRequired,false)})
test('it answers Bedrock block facts and recipes offline',()=>{assert.match(offlineMinecraftResponse('what is cobblestone?').message,/cobblestone/i);assert.match(offlineMinecraftResponse('how to craft a stone pickaxe').message,/ingredients|recipe|from/i)})
test('mobs are recognized as entities, not target players',()=>{const r=offlineMinecraftResponse('what is a zombie?');assert.equal(r.knowledge.kind,'entity');assert.match(r.message,/hostile/i)})
test('an unknown task does not become an executable action',()=>{assert.equal(offlineMinecraftResponse('do something weird'),null)})
test('wood-gathering goal produces safe preview, no fake collection',()=>{const r=offlineMinecraftResponse('go get some wood');assert.equal(r.queued,false);assert.match(r.message,/not verified|not been mined/i);assert.match(r.message,/oak log/i)})
test('inventory confirmed satisfies task without mining',()=>{const world={inventoryKnown:true,items:()=>({oak_log:6})};const r=offlineMinecraftResponse('get 4 wood',{world});assert.match(r.message,/already reports/i)})
test('visible-only scans never invent a target',()=>{const world={standPosition:()=>({x:1,y:65,z:2}),scan:()=>({found:[]})};const r=offlineMinecraftResponse('where can i find diamonds',{world});assert.match(r.message,/No visible/i)})
test('building and crafting are honest about unimplemented capabilities',()=>{assert.match(offlineMinecraftResponse('build a shelter').message,/no blocks were placed/i);assert.match(offlineMinecraftResponse('craft a chest').message,/no item was created/i)})
test('data status works without internet or Google key',()=>{assert.match(offlineMinecraftResponse('minecraft knowledge').message,/No Google key or network required/i)})
