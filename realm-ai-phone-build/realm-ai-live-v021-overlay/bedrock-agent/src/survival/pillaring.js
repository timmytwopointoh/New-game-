// Jump-place a dirt support only after the server reports the body above it.
// No floor is invented, and Stop still lets ordinary gravity continue.
export class Pillaring{
 constructor(navigation,rise){this.n=navigation;this.rise=rise;this.done=0;this.origin=null;this.started=Date.now();this.phase='prepare'}
 control(now){
  const n=this.n,w=n.world,b=n.building
  if(now-this.started>30000||!w.editModeVerified||w.inputLocks?.jump)return {error:'Dirt pillar was not safely confirmed; stopped.'}
  if(this.phase==='jumping'){
   if(b.state==='confirmed'&&w.grounded()&&w.standPosition().y===this.origin.y+1){this.done++;this.phase='prepare';this.origin=null;if(this.done>=this.rise){n.pillar=null;n.lastFollowPlan=0;return {waiting:false}}}
   else if(!n.flight&&w.grounded()&&(!b.job||w.standPosition().y!==this.origin.y+1))return {error:'Jump landed without a confirmed dirt support; stopped.'}
   return {waiting:true}
  }
  if(!w.grounded())return {waiting:true}
  if(!this.origin){this.origin={...w.standPosition()};const r=b.begin({shape:'block',origin:this.origin,material:'dirt',allowAirborne:true},now);if(!r.accepted)return {error:r.message}}
  const slot=b.inventory('dirt')[0]?.[0];if(slot===undefined)return {error:'No real dirt remains for jump-place climbing.'}
  if(slot!==w.selectedSlot)return {waiting:true,selectSlot:slot}
  if(now<(b.job?.equipWaitUntil||0))return {waiting:true}
  n.flight={target:{...this.origin,y:this.origin.y+1},kind:'pillar',vy:.42,started:now,first:true};this.phase='jumping';n.state='jumping';n.report(`Jump-placing dirt support ${this.done+1}/${this.rise}; waiting for server height and placement.`)
  return {waiting:true}
 }
 afterPhysics(now){
  const w=this.n.world,b=this.n.building
  if(this.phase!=='jumping'||!b.job)return {}
  if(!b.job.pending&&(w.serverPosition?.y-1.62<=this.origin.y+1.005||w.position.y-1.62<=this.origin.y+1.005))return {}
  return b.tick(now)
 }
}
