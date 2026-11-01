import {mediumAt} from './situation.js'
// Emergency escape uses ordinary movement/jump/swim input and collision checks.
// It never enables flight, changes mode, destroys terrain or assumes immunity.
export class HazardRecovery{
 constructor(navigation){this.n=navigation;this.state='idle';this.started=null;this.kind=null;this.reason='';this.exit=null}
 control(now){
  const n=this.n,w=n.world,m=mediumAt(w,w.position),danger=['water','lava','powder_snow'].includes(m.kind)
  if(!danger){if(this.state==='escaping'){n.pendingFlags.push('stop_swimming');this.reason='Reached observed space outside the hazard.'}this.state='idle';this.started=null;this.kind=null;this.exit=null;return null}
  if(!w.movementVerified||w.attributes['minecraft:health']===0)return null
  if(this.kind!==m.kind){this.kind=m.kind;this.started=now;this.state='escaping';this.reason=`In ${m.kind}; interrupting work and trying normal escape controls.`;n.onThreat?.(this.reason);n.stop(this.reason);n.report(this.reason);this.exit=null}
  if(now-this.started>10000){if(this.state!=='blocked'){this.state='blocked';this.reason=`Could not verify an exit from ${m.kind}; work remains stopped. No flight or immunity enabled.`;n.report(this.reason)}return null}
  const p=w.position,feet=p.y-1.62,allow={allowWater:true,allowLava:m.kind==='lava',allowPowder:m.kind==='powder_snow'}
  if(!this.exit||now-(this.lastSearch||0)>1000){
   this.lastSearch=now;const candidates=[]
   for(let dx=-6;dx<=6;dx++)for(let dz=-6;dz<=6;dz++)for(let dy=-1;dy<=3;dy++){
    const c={x:Math.floor(p.x)+dx,y:Math.floor(feet)+dy,z:Math.floor(p.z)+dz},h=w.supportHeight(c)
    if(h===null||!w.walkable(c)||h>feet+2.1)continue
    const e={x:c.x+.5,y:h+1.62,z:c.z+.5},distance=Math.hypot(e.x-p.x,e.z-p.z)
    if(distance>8)continue
    let clear=true
    // Check at the exit's body height before committing to a shore direction.
    const steps=Math.max(1,Math.ceil(distance*3))
    for(let i=1;i<=steps;i++){const t=i/steps,q={x:p.x+(e.x-p.x)*t,y:Math.max(p.y,e.y),z:p.z+(e.z-p.z)*t};if(!w.clearBody(q,allow)){clear=false;break}}
    if(clear)candidates.push({...e,cost:distance+Math.max(0,e.y-p.y)*2})
   }
   candidates.sort((a,b)=>a.cost-b.cost);this.exit=candidates[0]||null
  }
  const e=this.exit,dx=e?e.x-p.x:0,dz=e?e.z-p.z:0,d=Math.hypot(dx,dz),speed=Math.min(m.kind==='lava'?.025:.055,d),up=m.kind==='lava'?.04:.12
  let next={x:p.x+(d?dx/d*speed:0),y:p.y+(e&&p.y>e.y+.12?0:up),z:p.z+(d?dz/d*speed:0)}
  if(!w.clearBody(next,allow))next={...p,y:p.y+up}
  if(!w.clearBody(next,allow))return {delta:{x:0,y:0,z:0},move:{x:0,z:0},flags:['jump_down','jumping'],active:true}
  n.vy=0;w.position=next;if(e)n.lookAt(e)
  return {delta:{x:next.x-p.x,y:next.y-p.y,z:next.z-p.z},move:{x:0,z:d?1:0},flags:['jump_down','jumping','want_up',...(m.kind==='water'?['auto_jumping_in_water',...(now===this.started?['start_swimming']:[])]:[])],active:true}
 }
 snapshot(){return {state:this.state,kind:this.kind,reason:this.reason,exit:this.exit?{x:this.exit.x,y:this.exit.y-1.62,z:this.exit.z}:null}}
}
