import test from 'node:test'
import assert from 'node:assert/strict'
import registryFactory from 'prismarine-registry'
import {vanillaBlockBehavior,vanillaPathRisk} from '../src/survival/vanilla-block-behavior.js'
import {constructionExposure,approvedEdit,EditConfirmations} from '../src/survival/construction-guard.js'
import {grantPlot,insidePlot,planUniqueHome,validatePlotBlueprint} from '../src/survival/companion-plot.js'
import {CompanionCommands} from '../src/survival/companion-commands.js'

test('complete bundled Bedrock block registry is treated as vanilla; add-ons are not guessed',()=>{
 const names=Object.keys(registryFactory('bedrock_1.26.60').blocksByName)
 assert.ok(names.length>1000)
 for(const name of names)assert.equal(vanillaBlockBehavior(name).source,'vanilla',name)
 for(const name of ['myaddon:stone','anotherpack:fountain']){
  const b=vanillaBlockBehavior(name);assert.equal(b.source,'custom');assert.equal(b.routeBlocked,true)
 }
})
test('water, fire, powder snow, sculk trigger and portals cannot be route shortcuts',()=>{
 for(const name of ['water','lava','magma_block','fire','cactus','powder_snow','cobweb','end_portal','sculk_shrieker']){
  assert.equal(vanillaBlockBehavior(name).routeBlocked,true,name)
 }
 assert.equal(vanillaBlockBehavior('stone').penalty,0)
 assert.ok(vanillaBlockBehavior('ice').penalty>0)
})
function mockWorld({constructed=[]}={}){
 const positions=new Map(constructed.map(x=>[x.x+','+x.y+','+x.z,x.name]))
 const air={name:'air',shapes:[]},stone={name:'stone',shapes:[[0,0,0,1,1,1]]}
 return {dimension:0,ownedPlacements:new Map(),block(p,layer=0){
  if(layer===1)return air
  const name=positions.get(p.x+','+p.y+','+p.z)
  return name?{name,shapes:[[0,0,0,1,1,1]]}:p.y<64?stone:air
 }}
}
test('construction buffer checks all 15 blocks, but not sixteen',()=>{
 const built=mockWorld({constructed:[{x:15,y:64,z:0,name:'oak_planks'}]})
 assert.equal(constructionExposure(built,[{x:0,y:64,z:0}]).state,'protected')
 assert.equal(constructionExposure(built,[{x:-1,y:64,z:0}]).state,'clear')
 assert.equal(constructionExposure(mockWorld(),[{x:0,y:64,z:0}]).state,'clear')
})
test('unknown custom blocks do not get treated like empty harmless terrain',()=>{
 const w=mockWorld({constructed:[{x:3,y:64,z:0,name:'testaddon:mystery'}]})
 const x=constructionExposure(w,[{x:0,y:64,z:0}])
 assert.equal(x.state,'protected')
 assert.equal(x.near.name,'testaddon:mystery')
 const risky={block:(p,layer)=>p.x===0&&p.y===64&&layer===0?null:{name:'stone',shapes:[[0,0,0,1,1,1]]}}
 assert.equal(vanillaPathRisk(risky,{x:0,y:64,z:0}),Infinity)
})
test('owner grants only exact action and coordinates, with two-minute acknowledgement',()=>{
 const w=mockWorld(),e=new EditConfirmations(),point={x:1,y:64,z:0},scope={realm:'test-realm',dimension:0}
 let executed=0
 const confirm=e.request({kind:'build',positions:[point],description:'Support pillar',scope,execute:()=>{executed++;return {accepted:true,queued:true,message:'started'}},now:10000})
 assert.match(confirm.message,/within 15 blocks/i)
 assert.equal(executed,0)
 assert.equal(e.confirm('confirm edit 999999',scope,w,10001).accepted,false)
 assert.equal(e.confirm('confirm edit '+e.pending.code,scope,w,10002).accepted,true)
 assert.equal(executed,1)
 assert.equal(approvedEdit(w,'build',[point],10002),true)
 assert.equal(approvedEdit(w,'mine',[point],10002),false)
 assert.equal(approvedEdit(w,'build',[{x:2,y:64,z:0}],10002),false)
 assert.equal(approvedEdit(w,'build',[point],310003),false)
 assert.equal(e.confirm('yes',scope,w,10004).accepted,false)
})
test('land is anchored to visible configured owner, not to a chat claimed position',()=>{
 const w=mockWorld();w.players=new Map([['p',{name:'OwnerExample',position:{x:101.5,y:81.62,z:202.5}}]])
 assert.throws(()=>grantPlot(w,['SomeoneElse']),/configured owner/i)
 const p=grantPlot(w,['OwnerExample'])
 assert.equal(p.size.x,50)
 assert.equal(p.center.x,101)
 assert.equal(p.center.y,80)
 assert(insidePlot(p,{x:101,y:80,z:202}))
 assert.equal(insidePlot(p,{x:151,y:80,z:202}),false)
 const a=planUniqueHome(p,{pick:()=>0.12}),b=planUniqueHome(p,{previousStyle:a.style,pick:()=>0.12})
 assert.notEqual(a.style,b.style)
 assert(validatePlotBlueprint(p,a))
 assert(validatePlotBlueprint(p,b))
 assert.equal(a.executedBlocks,0)
})
test('companion command asks consent for player construction and supports plot design previews',()=>{
 const w=mockWorld({constructed:[{x:9,y:64,z:0,name:'stone_bricks'}]})
 w.players=new Map([['o',{name:'OwnerExample',position:{x:0.5,y:65.62,z:0.5}}]])
 const c={world:w,connection:{spawned:true,config:{ownerPlayerNames:['OwnerExample']}},commandPlans:{scope:'test-realm'}}
 const h=new CompanionCommands(c,'test-realm')
 const stage=h.mine({x:0,y:64,z:0},()=>({accepted:true}))
 assert.equal(stage.confirmationRequired,true)
 assert.equal(h.handle('yes').accepted,true)
 assert.equal(h.handle('this is your land').accepted,true)
 const design=h.handle('design your home')
 assert.equal(design.accepted,true)
 assert.equal(design.design.executedBlocks,0)
 assert.equal(h.handle('build your home').accepted,false)
})
