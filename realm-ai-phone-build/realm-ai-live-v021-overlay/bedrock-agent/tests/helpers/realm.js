import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import {WorldView} from '../../src/survival/world.js'
import {Navigation} from '../../src/survival/navigation.js'
const require=createRequire(import.meta.url),{createSerializer,createDeserializer}=require('bedrock-protocol/src/transforms/serializer')
export function realm(){
 const w=new WorldView();w.initialize({player_gamemode:'survival',server_authoritative_inventory:true,server_authoritative_block_breaking:true,entity_id:42n,runtime_entity_id:1n,player_position:{x:.5,y:65.62,z:.5},dimension:0});w.abilityState={known:true,loading:false,effective:{build:true,mine:true},active:[]};w.attributes['minecraft:health']=20
 const ids={};for(const [id,b] of Object.entries(w.registry.blocksByRuntimeId))if(b.stateId===w.registry.blocksByName[b.name]?.defaultState)ids[b.name]=Number(id)
 const set=(p,name)=>{for(const layer of [0,1])w.update({position:p,block_runtime_id:layer?ids.air:ids[name],layer})}
 for(let x=-3;x<=8;x++)for(let z=-3;z<=3;z++)for(let y=60;y<=73;y++)set({x,y,z},y===63?'stone':'air')
 const c=new EventEmitter(),sent=[],codec=createSerializer('1.26.60'),reader=createDeserializer('1.26.60');c.queue=(name,p)=>{const wire=reader.parsePacketBuffer(codec.createPacketBuffer({name,params:p})).data;sent.push([name,p,wire.params])};w.attach(c);const n=new Navigation(w);n.attach(c);n.spawned=true
 const item=(name,count=1,id=10)=>({network_id:w.registry.itemsByName[name].id,count,metadata:0,has_stack_id:true,stack_id:id,block_runtime_id:ids[name]||0,extra:{has_nbt:false,can_place_on:[],can_destroy:[]}})
 const receipt=(id,slots,container='hotbar_and_inventory')=>c.emit('item_stack_response',{responses:[{status:'ok',request_id:id,containers:[{slot_type:{container_id:container,dynamic_container_id:null},slots:slots.map(([slot,count,item_stack_id])=>({slot,hotbar_slot:slot,count,item_stack_id,custom_name:'',filtered_custom_name:'',durability_correction:0}))}]}]})
 return {w,n,c,sent,ids,set,item,receipt,close(){n.detach();w.detach()}}
}
