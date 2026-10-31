import {miningAssessment} from './obstacles.js'
export class Mining{
 constructor(world,report=()=>{}){this.world=world;this.report=report;this.job=null;this.pending=[];this.result='idle'}
 begin(position,options={},now=Date.now()){
  if(this.job)return {accepted:false,queued:false,message:'Already mining a block.'}
  const assessment=miningAssessment(this.world,position,options)
  if(!assessment.ok)return {accepted:false,queued:false,message:assessment.reason}
  const eye=this.world.position,dx=eye.x-position.x-.5,dy=eye.y-position.y-.5,dz=eye.z-position.z-.5
  const face=Math.abs(dy)>=Math.max(Math.abs(dx),Math.abs(dz))?(dy>=0?1:0):Math.abs(dx)>=Math.abs(dz)?(dx>=0?5:4):(dz>=0?3:2)
  const click={x:face===4?0:face===5?1:.5,y:face===0?0:face===1?1:.5,z:face===2?0:face===3?1:.5}
  this.job={protocol:this.world.serverAuthoritativeBreaking?'server-authoritative':'legacy-player-actions',initialVersion:this.world.blockVersion(position),face,click,position:{...position},name:assessment.block.name,stateId:assessment.block.stateId,started:now,duration:assessment.durationMs,heldSlot:this.world.selectedSlot,heldStackId:assessment.held.stack_id,heldId:assessment.held.network_id,toolEffective:assessment.toolEffective,options,finishedRequest:false}
  this.pending.push({action:'start_break',position:{...position},face});this.result='mining'
  return {accepted:true,queued:true,message:`Mining request: ${assessment.block.name}, held item ${assessment.tool}${assessment.toolEffective?' (effective tool)':' (hand-speed mining)'}. Estimated ${(assessment.durationMs/1000).toFixed(2)}s, holding the mining input until the server confirms the break.`}
 }
 cancel(reason='Mining cancelled.'){
  if(this.job)this.pending.push({action:'abort_break',position:this.job.position,face:this.job.face})
  this.job=null;this.result='cancelled';this.reason=reason
 }
 tick(now=Date.now()){
  const job=this.job,actions=this.pending.splice(0),out={actions,transaction:null}
  if(!job)return out
  const block=this.world.block(job.position)
  if(block&&this.world.blockVersion(job.position)>job.initialVersion&&block.stateId!==job.stateId){
   if(['air','cave_air','void_air'].includes(block.name)){out.actions=[];this.job=null;this.result='confirmed';this.reason='Server confirms target is now air; item collection is not yet confirmed.';this.report(this.reason)}
   else{this.cancel('Target changed to another block; mining completion is not confirmed.');out.actions.push(...this.pending.splice(0));this.report(this.reason)}
   return out
  }
  const assessment=miningAssessment(this.world,job.position,job.options)
  if(!assessment.ok||this.world.selectedSlot!==job.heldSlot||(assessment.held?.network_id||0)!==(job.heldId||0)||(assessment.held?.stack_id||0)!==(job.heldStackId||0)){this.cancel(assessment.reason||'Held tool changed.');out.actions.push(...this.pending.splice(0));this.report(this.reason);return out}
  if(now-job.started>job.duration+4000){this.cancel(`No server-confirmed block break; mining stopped. Protocol: ${job.protocol}. Check mining permission, reach and Realm spawn protection.`);out.actions.push(...this.pending.splice(0));this.report(this.reason);return out}
  if(!job.finishedRequest&&now-job.started>=job.duration){
   job.finishedRequest=true
   out.actions.push({action:'predict_break',position:job.position,face:job.face})
   const p=job.position
   out.transaction={legacy:{legacy_request_id:0,legacy_transactions:null},actions:[],data:{action_type:'break_block',trigger_type:'player_input',block_position:p,face:job.face,hotbar_slot:this.world.selectedSlot,hand:'main_hand',held_item:assessment.held,player_pos:{...this.world.position,y:this.world.position.y-1.62},click_pos:job.click,block_runtime_id:this.world.runtimeIdAt(p)>>>0,client_prediction:'failure',client_cooldown_state:'off'}}
  }else if(now>job.started)out.actions.push({action:'continue_break',position:job.position,face:job.face})
  job.lastTick=now;return out
 }
 reset(){this.job=null;this.pending=[];this.result='idle';this.reason=''}
 snapshot(){return {state:this.result,target:this.job?.position||null,protocol:this.job?.protocol||null,holding:!!this.job,estimatedMs:this.job?.duration||null,elapsedMs:this.job?Math.max(0,Date.now()-this.job.started):0,toolEffective:this.job?.toolEffective??null,reason:this.reason||''}}
}
