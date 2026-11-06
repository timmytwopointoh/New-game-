// Resolve a child resource objective without discarding the parent home build.
// Verify actual server inventory; never credit predicted crafting or mining.
const quantity=(world,material)=>Math.max(0,Number(world?.items?.()?.[material]||0))
const interchangeable=(original,available,required)=>{
 const similar=/_planks$/.test(original)?n=>/_planks$/.test(n):
  /^(?:cobblestone|cobbled_deepslate|stone|stone_bricks|deepslate_bricks|bricks|tuff)$/.test(original)?
   n=>/^(?:cobblestone|cobbled_deepslate|stone|stone_bricks|deepslate_bricks|bricks|tuff)$/.test(n):null
 if(!similar)return null
 return Object.entries(available).filter(([name,count])=>name!==original&&similar(name)&&Number.isInteger(count)&&count>=required)
  .sort((a,b)=>b[1]-a[1])[0]?.[0]||null
}
export class HomeSupply {
 constructor(controller){this.c=controller;this.reset()}
 reset(){this.material=null;this.required=0;this.started=0;this.state='idle';this.reason='';this.lastCount=0;
  this.childStarted=false;this.failedAttempts=0;this.lastRetry=0;this.progressAt=0;this.substitution=null}
 begin(material,required,now=Date.now()){
  if(typeof material!=='string'||material.length>80||!Number.isSafeInteger(required)||required<1||required>256)
   return {state:'requires-owner',reason:'Invalid bounded supply stage.'}
  if(this.material!==material||this.required!==required){
   this.reset();this.material=material;this.required=required;this.started=now;this.progressAt=now
   this.lastCount=quantity(this.c.world,material)
  }
  return this.tick(now)
 }
 tick(now=Date.now()){
  const c=this.c,w=c.world
  if(!this.material)return {state:'idle',reason:'No material requested.'}
  if(w.gameMode==='creative'&&w.creativeEditsVerified&&c.crafting.creative.some(e=>w.registry?.items?.[e.item?.network_id]?.name===this.material)){
   const result=c.workshop.ensure(this.material,this.required,now)
   this.state=result.state==='ready'?'ready':'working';this.reason=result.reason||'Requesting real server-confirmed Creative inventory.'
   return {state:this.state,reason:this.reason}
  }
  const have=quantity(w,this.material)
  if(have>=this.required){this.state='ready';this.reason='Server inventory confirms '+have+' '+this.material+'.';return {state:'ready',reason:this.reason}}
  if(have>this.lastCount){this.progressAt=now;this.lastCount=have;this.failedAttempts=0}
  if(now-this.started>45*60*1000){
   this.state='requires-owner';this.reason='Material objective exceeded its 45-minute session budget; home blueprint and completed stages are preserved.'
   return {state:this.state,reason:this.reason}
  }
  if(c.acquisition?.active){
   if(!this.childStarted){this.state='waiting';this.reason='Another material-acquisition task is active.';return {state:this.state,reason:this.reason}}
   this.state='gathering';this.reason='Gathering '+this.material+': '+(c.acquisition.active.reason||'checking resource source and crafting dependencies.')
   return {state:this.state,reason:this.reason}
  }
  if(this.childStarted){
   this.childStarted=false
   if(quantity(w,this.material)>=this.required)return this.tick(now)
   this.failedAttempts++;this.lastRetry=now
   if(this.failedAttempts>=3){
    const replacement=interchangeable(this.material,w.items(),this.required)
    if(replacement){this.substitution=replacement;this.state='suggest-substitute';this.reason='Unable to gather '+this.material+' after three bounded attempts; '+replacement+' could substitute with owner approval.';return {state:this.state,reason:this.reason,substitution:replacement}}
    this.state='requires-owner';this.reason='No verified way to obtain '+this.material+' after three bounded attempts. Parent home task preserved; owner should review the source, tool, terrain or permission.'
    return {state:this.state,reason:this.reason}
   }
  }
  if(now-this.lastRetry<8000){this.state='waiting';this.reason='Rechecking the material source and route before a bounded retry.';return {state:this.state,reason:this.reason}}
  if(c.resources?.active||c.miningJobs?.active||c.operations?.pending||c.navigation?.job){
   this.state='waiting';this.reason='Finishing the current verified tool, mining, movement or inventory subtask.';return {state:this.state,reason:this.reason}
  }
  const available=w.items()
  const alternate=interchangeable(this.material,available,this.required)
  if(alternate&&this.failedAttempts>0){this.substitution=alternate;this.state='suggest-substitute';this.reason='Same-category alternative '+alternate+' available; confirmation required before changing the house design.';return {state:this.state,reason:this.reason,substitution:alternate}}
  const crafted=c.workshop?.ensure?.(this.material,this.required,now)
  if(crafted?.state==='ready')return this.tick(now)
  if(crafted?.state==='working'||crafted?.state==='approach'){
   this.state='crafting';this.reason=crafted.reason||'Crafting a prerequisite from server-confirmed inputs.';return {state:this.state,reason:this.reason}
  }
  const result=c.acquisition?.start?.('gather '+this.required+' '+this.material)
  if(result?.accepted){this.childStarted=true;this.state='gathering';this.reason='Acquiring '+this.required+' '+this.material+' as a child of the home objective.';return {state:this.state,reason:this.reason}}
  this.failedAttempts++;this.lastRetry=now
  if(this.failedAttempts>=3){this.state='requires-owner';this.reason='No executable material acquisition method available: '+String(result?.message||crafted?.reason||'source not observed').slice(0,130)}
  else{this.state='waiting';this.reason='Re-evaluating material recipe or source: '+String(result?.message||crafted?.reason||'unknown').slice(0,130)}
  return {state:this.state,reason:this.reason}
 }
 snapshot(){return {state:this.state,material:this.material,required:this.required,lastConfirmedCount:this.lastCount,
  reason:this.reason,attempts:this.failedAttempts,childStarted:this.childStarted,substitution:this.substitution}}
}
