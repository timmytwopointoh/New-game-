import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {InventoryProtocol} from '../src/survival/inventory-protocol.js'
import {Pickup,nearestDrop} from '../src/survival/pickup.js'
import {expectedResourceDrops} from '../src/survival/resource-jobs.js'
const require=createRequire(import.meta.url),{createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer')
const item=(count=4,id=3)=>({network_id:id,count})
const rig=()=>{const w={inventory:new Map(),inventoryKnown:false};return {w,p:new InventoryProtocol(w)}}
test('inventory evidence isolates chest windows and requires a server snapshot after container-open',()=>{
 const {w,p}=rig();p.content({window_id:'inventory',input:[item()]});const before=p.baseline(0)
 p.opened({window_id:7,window_type:'container'});assert.equal(p.snapshot().knownContainers,0)
 p.content({window_id:7,input:[item(20)]});p.slot({window_id:7,slot:0,item:item(2)})
 assert.equal(w.inventory.get(0).count,4);assert(!p.consumed(0,before));assert.equal(p.snapshot().knownContainers,1)
 p.closed({window_id:7});assert.equal(p.snapshot().knownContainers,0);assert.equal(p.openWindow,null)
})
test('placement consumption requires a newer own-slot packet, not local mutation or another slot',()=>{
 const {w,p}=rig();p.content({window_id:0,input:[item()]});const before=p.baseline(0)
 w.inventory.set(0,item(3));assert(!p.consumed(0,before));p.slot({window_id:0,slot:1,item:item(2)});assert(!p.consumed(0,before))
 p.slot({window_id:0,slot:0,item:item(3)});assert(p.consumed(0,before))
})
test('fresh full snapshots can confirm final-item consumption but reject item changes and ambiguous counts',()=>{
 const {p}=rig();p.content({window_id:0,input:[item(1)]});const last=p.baseline(0);p.content({window_id:0,input:[]});assert(p.consumed(0,last))
 p.content({window_id:0,input:[item(5)]});const before=p.baseline(0);p.slot({window_id:0,slot:0,item:item(4,9)});assert(!p.consumed(0,before));p.slot({window_id:0,slot:0,item:item(2)});assert(!p.consumed(0,before))
})
test('actual Bedrock stack responses retain request IDs/status without fabricating crafted inventory',()=>{
 const {w,p}=rig(),writer=createSerializer('1.26.60'),reader=createDeserializer('1.26.60')
 for(const status of ['ok','error']){const data={responses:[{status,request_id:-12,containers:status==='ok'?[]:null}]};const wire=reader.parsePacketBuffer(writer.createPacketBuffer({name:'item_stack_response',params:data})).data.params;p.stackResponse(wire);assert.equal(p.responses.get(-12).status,status)}
 assert.equal(w.inventory.size,0);assert(!w.inventoryKnown)
})
test('pickup never sends a server-only packet and predicted proximity cannot start confirmation',()=>{
 let contents={oak_log:0};const w={position:{x:.5,y:65.62,z:.5},serverPosition:{x:5.5,y:65.62,z:.5},entityId:'1',inventoryKnown:true,movementVerified:true,grounded:()=>true,items:()=>contents,drops:new Map()}
 const pick=new Pickup(w),drop={id:'10',name:'oak_log',position:{x:.5,y:64.2,z:.5}};pick.begin(drop,0)
 const writer=createSerializer('1.26.60'),sent=[],client={queue:(name,params)=>{writer.createPacketBuffer({name,params});sent.push(name)}}
 pick.tick(100,client);assert.equal(pick.state,'approaching')
 w.serverPosition={...w.position};pick.tick(200,client);assert.equal(pick.state,'waiting-for-server-inventory');assert.deepEqual(sent,[])
 contents={oak_log:1};pick.tick(300,client);assert.equal(pick.state,'confirmed')
})
test('pickup handles moving/invalid drops and requires the expected item rather than unrelated growth',()=>{
 let contents={dirt:0};const w={position:{x:0,y:65.62,z:0},serverPosition:{x:0,y:65.62,z:0},drops:new Map([['bad',{}],['2',{name:'oak_log',position:{x:1,y:64.2,z:0}}]]),inventoryKnown:true,items:()=>contents,grounded:()=>true,movementVerified:true}
 assert.equal(nearestDrop(w,{names:['oak_log']}).id,'2');assert.equal(nearestDrop(w,{names:['diamond']}),null)
 const p=new Pickup(w);p.begin(nearestDrop(w),0);p.tick(100);contents={dirt:3};p.tick(200);assert.notEqual(p.state,'confirmed');p.tick(4000);assert.equal(p.state,'unverified')
})
test('resource pickup names come from the real block drops table including ore outputs',()=>{
 const registry=require('prismarine-registry')('bedrock_1.26.60')
 assert(expectedResourceDrops({registry},{name:'iron_ore'}).includes('raw_iron'));assert(expectedResourceDrops({registry},{name:'stone'}).includes('cobblestone'));assert(!expectedResourceDrops({registry},{name:'oak_log'}).includes('dirt'))
})
