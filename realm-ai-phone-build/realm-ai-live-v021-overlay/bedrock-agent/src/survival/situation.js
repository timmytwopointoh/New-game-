const pos=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]))
export function mediumAt(world,position=world.serverPosition||world.position){
 if(!pos(position))return {kind:'unknown',feet:null,head:null}
 const feet={x:Math.floor(position.x),y:Math.floor(position.y-1.62+.001),z:Math.floor(position.z)},head={...feet,y:Math.floor(position.y)}
 const blocks=[world.block(feet),world.block(feet,1),world.block(head),world.block(head,1)]
 const names=blocks.map(b=>b?.name);const kind=names.some(n=>/^(?:flowing_)?lava$/.test(n))?'lava':names.includes('powder_snow')?'powder_snow':names.some(n=>/^(?:flowing_)?water$/.test(n))?'water':blocks.some(b=>!b)?'unknown':names.includes('snow_layer')||names.includes('snow')?'snow':'clear'
 return {kind,feet:blocks[0]?.name||null,head:blocks[2]?.name||null,submerged:blocks.slice(2).some(b=>/^(?:flowing_)?water$/.test(b?.name))}
}
export class Situation{
 constructor(controller){this.controller=controller;this.lastAt=0;this.value={healthState:'unknown',position:null,biome:null,nearbyMobs:[],nearbyBlocks:[],medium:{kind:'unknown'}}}
 tick(now=Date.now()){
  if(now-this.lastAt<1000)return;this.lastAt=now
  const w=this.controller.world,pose=w.serverPosition,h=w.attributes['minecraft:health'],dead=!['alive','respawned'].includes(this.controller.respawn.state)
  const nearbyMobs=pos(pose)?[...w.entities.values()].filter(e=>pos(e.position)).map(e=>({type:e.type,dx:+(e.position.x-pose.x).toFixed(1),dy:+(e.position.y-(pose.y-1.62)).toFixed(1),dz:+(e.position.z-pose.z).toFixed(1),distance:+Math.hypot(e.position.x-pose.x,e.position.y-(pose.y-1.62),e.position.z-pose.z).toFixed(1)})).filter(e=>e.distance<=16).sort((a,b)=>a.distance-b.distance).slice(0,12):[]
  const blocks=w.enabled&&w.position?w.scan(null,{range:4,maxFound:12})?.found||[]:[]
  this.value={healthState:dead||h===0?'dead':!Number.isFinite(h)?'unknown':h<20||now-(w.lastHurtAt||0)<5000?'hurt':'healthy',health:Number.isFinite(h)?h:null,position:pos(pose)?{x:pose.x,y:pose.y-1.62,z:pose.z}:null,biome:w.biomeAt(),medium:mediumAt(w),nearbyMobs,nearbyBlocks:blocks.map(b=>({name:b.name,x:b.x,y:b.y,z:b.z,distance:b.distance}))}
 }
 snapshot(){return this.value}
}
