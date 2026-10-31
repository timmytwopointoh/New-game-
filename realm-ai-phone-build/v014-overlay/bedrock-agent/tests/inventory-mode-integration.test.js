import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {WorldView} from '../src/survival/world.js'
import {SurvivalController} from '../src/survival/controller.js'

function setup(){
 const client=new EventEmitter(),sent=[]
 client.queue=(name,data)=>sent.push({name,data})
 const world=new WorldView();world.registry={items:{301:{name:'iron_shovel'}}};world.entityId='11'
 world.attach(client)
 const connection={spawned:true,client,events:[],nextEventId:0,emit(){}}
 const controller=new SurvivalController(connection)
 controller.world=world;controller.verification.world=world
 return {world,controller,client,sent}
}
test('a shovel is counted only after a server player-inventory receipt, not an armor packet',()=>{
 const {world,client,controller}=setup()
 const shovel={network_id:301,count:1}
 client.emit('inventory_content',{window_id:'armor',input:[shovel]})
 assert.equal(world.inventoryKnown,false);assert.deepEqual(world.items(),{})
 client.emit('inventory_content',{window_id:'inventory',input:[shovel]})
 assert.deepEqual(world.items(),{iron_shovel:1})
 assert.match(controller.handle('inventory status').message,/iron_shovel/)
 client.emit('inventory_slot',{window_id:'inventory',slot:0,item:{network_id:0,count:0}})
 assert.deepEqual(world.items(),{})
 assert.equal(world.inventoryEvidence().serverChanges.at(-1).changes[0].before,'iron_shovel')
 assert.equal(world.inventoryEvidence().serverChanges.at(-1).changes[0].after,'empty')
 world.detach()
})
test('select slot sends only a held-equipment request and waits for server echo',()=>{
 const {world,client,controller,sent}=setup()
 const shovel={network_id:301,count:1}
 client.emit('inventory_content',{window_id:0,input:[shovel]})
 assert.match(controller.handle('select slot 1').message,/waiting for server confirmation/)
 assert.equal(sent.filter(p=>p.name==='mob_equipment').length,1)
 assert.equal(sent.some(p=>p.name==='player_hotbar'),false)
 assert.equal(world.selectedSlot,null)
 assert.equal(world.pendingSlot,0)
 assert.deepEqual(world.items(),{iron_shovel:1})
 client.emit('mob_equipment',{runtime_entity_id:11n,selected_slot:0,item:shovel})
 assert.equal(world.selectedSlot,0)
 assert.equal(world.pendingSlot,null)
 assert.match(controller.handle('inventory status').message,/Server confirmed hotbar slot 1/)
 world.detach()
})
test('when the server has not confirmed a pickup the bot does not pretend to have a shovel',()=>{
 const {world,controller,client}=setup()
 client.emit('inventory_content',{window_id:0,input:[{network_id:0,count:0}]})
 assert.match(controller.handle('inventory').message,/no items/)
 assert.equal(controller.handle('select slot 2').accepted,true)
 assert.match(controller.handle('select slot 2').message,/has not been reported/)
 assert.deepEqual(world.items(),{})
 world.detach()
})
test('damage status reports evidence without silently granting cheats or claiming PvP is enabled',()=>{
 const {world,controller}=setup()
 world.gameMode='creative';world.abilityState={known:true,effective:{invulnerable:true},active:['invulnerable'],loading:false}
 assert.match(controller.handle('combat status').message,/Own mode: creative; invulnerability: enabled/)
 world.gameMode='survival';world.abilityState={known:true,effective:{invulnerable:false},active:[],loading:false}
 assert.match(controller.handle('combat status').message,/invulnerability: disabled/)
 assert.match(controller.handle('combat status').message,/PvP permissions and spawn protection must be checked/)
 world.detach()
})
