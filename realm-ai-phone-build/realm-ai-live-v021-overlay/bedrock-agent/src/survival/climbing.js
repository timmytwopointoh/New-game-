import {findPath} from './pathfinder.js'
import {Building} from './building.js'
import {placementEvidence} from './obstacles.js'
const key=p=>`${p.x},${p.y},${p.z}`
const full=b=>b?.shapes?.some(q=>q.every((v,i)=>v===(i<3?0:1)))

// Preview a small supported dirt staircase in a separate view. Never change
// the real world cache: only server block updates may do that.
export function dirtStaircase(world,start,goal,{excluded=()=>false,maxDrop=1}={}){
 if(!world.editModeVerified||world.inputLocks?.jump||world.abilityState?.effective.build===false||!world.inventoryKnown)return null
 const builder=new Building(world),stock=builder.inventory('dirt').reduce((n,[,v])=>n+v.count,0)
 if(!stock)return null
 const dirt=world.registry?.blocksByName.dirt
 if(!dirt)return null
 const bases=[]
 for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)if(Math.abs(dx)+Math.abs(dz)<=2){const p={x:start.x+dx,y:start.y,z:start.z+dz};if(world.walkable(p)&&!excluded(p))bases.push(p)}
 bases.sort((a,b)=>Math.hypot(a.x-goal.x,a.z-goal.z)-Math.hypot(b.x-goal.x,b.z-goal.z))
 let trials=0
 for(const base of bases){
  const prefix=findPath(world,start,base,{allowSteps:true,maxNodes:128,maxDistance:8});if(!prefix.ok||prefix.path.some(excluded))continue
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(let rise=2;rise<=4;rise++){
   const ledge={x:base.x+dx*rise,y:base.y+rise,z:base.z+dz*rise}
   if(excluded(ledge)||!world.walkable(ledge)||Math.abs(ledge.y-goal.y)>(maxDrop>1?maxDrop:Math.abs(start.y-goal.y)+1))continue
   if(++trials>24)return null
   const added=new Map(),view=Object.create(world),stairs=[],steps=[]
   view.block=(p,layer=0)=>!layer&&added.has(key(p))?world.Block.fromStateId(dirt.defaultState,0):world.block(p,layer)
   view.walkable=p=>!excluded(p)&&world.walkable.call(view,p)
   let previous=base,valid=true
   for(let i=1;i<rise&&valid;i++){
    const targets=[],cell={x:base.x+dx*i,y:base.y+i,z:base.z+dz*i}
    if(excluded(cell)){valid=false;break}
    if(!full(view.block({...cell,y:base.y-1}))||view.block({...cell,y:base.y-1},1)?.shapes?.length){valid=false;break}
    for(let y=base.y;y<cell.y;y++){
     const target={x:cell.x,y,z:cell.z},existing=view.block(target)
     if(full(existing)&&placementEvidence(view,target,existing).classification==='natural-looking')continue
     if(!view.airAt(target)){valid=false;break}
     // Reuse the same placement/protection validation as real construction.
     const check=new Building(view).begin({shape:'block',origin:target,material:'dirt'})
     if(!check.accepted){valid=false;break}
     targets.push(target);added.set(key(target),target)
    }
    if(!valid||!view.canJumpBetween(previous,cell)){valid=false;break}
    if(targets.length)stairs.push({cell,targets})
    steps.push(cell);previous=cell
   }
   if(!valid||!added.size||world.gameMode!=='creative'&&added.size>stock||!view.canJumpBetween(previous,ledge))continue
   const suffix=findPath(view,ledge,goal,{allowSteps:true,maxNodes:768,maxDrop})
   if(suffix.ok)return {ok:true,path:[...prefix.path,...steps,...suffix.path],stairs,dirtRequired:added.size,expanded:prefix.expanded+suffix.expanded}
  }
 }
 return null
}

export class Climbing{
 constructor(world,report=()=>{}){this.world=world;this.report=report;this.builder=new Building(world,report);this.reset()}
 reset(){this.steps=new Map();this.kinds=new Map();this.current=null;this.edge=null;this.placed=0;this.total=0;this.reason='';this.confirmedSupports=new Set();this.builder.reset()}
 prepare(stairs=[]){this.cancel();this.reset();this.gameMode=this.world.gameMode;for(const s of stairs){this.steps.set(key(s.cell),s.targets.map(p=>({...p})));this.kinds.set(key(s.cell),s.kind||'stair');this.total+=s.targets.length}}
 cancel(reason='Climbing stopped; confirmed dirt stays in the world.'){this.builder.cancel(reason);this.builder.trustedSupports=null;this.confirmedSupports?.clear();this.steps.clear();this.kinds.clear();this.current=null;this.edge=null}
 beforeStep(cell,now){
  const targets=this.steps.get(key(cell));if(!targets)return {waiting:false}
  if(this.gameMode!==this.world.gameMode||!this.world.movementVerified||!this.world.editModeVerified||this.world.inputLocks?.jump)return {waiting:true,error:'Climbing needs unchanged verified mode, build permission and unlocked jump controls.'}
  if(!this.world.grounded())return {waiting:true}
  if(this.current&&!this.builder.job){
   if(this.builder.state!=='confirmed')return {waiting:true,error:this.builder.reason||'Dirt step was not confirmed.'}
   // Trust the dirt block only after the server confirms placement and inventory.
   this.confirmedSupports.add(key(this.current));this.placed++;targets.shift();this.current=null
  }
  if(!targets.length){this.steps.delete(key(cell));this.kinds.delete(key(cell));return {waiting:false}}
  if(!this.current){
   this.builder.trustedSupports=this.confirmedSupports
   const result=this.builder.begin({shape:'block',origin:targets[0],material:'dirt'},now)
   if(!result.accepted)return {waiting:true,error:result.message}
   this.current=targets[0];this.report(`${this.kinds.get(key(cell))==='bridge'?'Bridging':'Climbing'}: placing dirt support ${this.placed+1}/${this.total}; waiting for the server before ${this.kinds.get(key(cell))==='bridge'?'crossing':'jumping'}.`)
  }
  if(this.kinds.get(key(cell))==='bridge'&&!this.builder.job?.pending&&!this.builder.anchor(targets[0])){
   // A bridge side face cannot be clicked from the centre of the bank. Creep
   // just beyond its edge, with part of the body still on confirmed support.
   const w=this.world,p=w.position,target=targets[0],source={x:Math.floor(p.x),y:cell.y,z:Math.floor(p.z)}
   if(!this.edge){
    if(Math.abs(source.x-cell.x)+Math.abs(source.z-cell.z)!==1||!w.walkable(source))return {waiting:true,error:'No supported bridge edge to approach.'}
    const dx=cell.x-source.x,dz=cell.z-source.z
    this.edge={x:source.x+.5+dx*.52,z:source.z+.5+dz*.52,y:p.y,started:now}
   }
   if(now-this.edge.started>5000)return {waiting:true,error:'Bridge edge movement was not confirmed; stopped.'}
   if(Math.hypot(this.edge.x-p.x,this.edge.z-p.z)<.005)return {waiting:true,error:'Bridge face is not visible from the supported edge.'}
   return {waiting:true,sneak:true,edgeApproach:this.edge}
  }
  this.edge=null
  return {...this.builder.tick(now),waiting:true,sneak:this.kinds.get(key(cell))==='bridge'}
 }
 snapshot(){return {active:this.steps.size>0,placed:this.placed,total:this.total,placement:this.builder.snapshot()}}
}
