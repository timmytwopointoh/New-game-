// Private, Realm-scoped conversation style. This influences phrasing, never
// permits a world action. Danger and urgent failures always override jokes.
const strip=s=>String(s||'').trim().toLowerCase().replace(/[!?.]+$/,'').replace(/^(?:hey |hi |listen )/,'')
const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0.5))
export const seriousContext=(text='',world=null)=>{
 const m=strip(text)
 const health=world?.attributes?.['minecraft:health']
 return (Number.isFinite(health)&&health>0&&health<=8)||
  /\b(?:emergency|danger|dangerous|help me|we're dying|im dying|i'm dying|creeper|lava|fire|under attack|run away|dont die|don't die|serious situation|this is serious|stop joking|quit joking|be serious|no jokes|urgent|real danger|death)\b/i.test(m)
}
export function toneAdjustment(raw){
 const s=strip(raw)
 if(/^(?:be|act|sound|talk) (?:more |a little more |much more )?(?:funny|funnier|playful|silly|goofy|jokey|lighthearted)$|^(?:tell more jokes|joke around more|lighten up|be more fun|make it more fun|i want you to be funnier)$/.test(s))
  return {kind:'humor',delta:0.22,message:"Sure! I'll loosen up a little. I can still focus when things get dangerous."}
 if(/^(?:be|act|sound|talk) (?:more |a little more |much more )?(?:serious|focused|professional|calm|straightforward)$|^(?:less joking|less jokes|stop (?:being silly|joking)|no more jokes|this is serious|serious mode|focus now|quit joking)$/.test(s))
  return {kind:'serious',delta:0.28,message:"Understood. I'll focus on the task and keep jokes out of the way."}
 if(/^(?:be|act|sound|talk) (?:more |a little more |much more )?(?:friendly|chatty|talkative)$|^(?:talk to me more|say more when you work)$/.test(s))
  return {kind:'social',delta:0.2,message:"Got it. I'll share more of what I'm noticing without interrupting your tasks."}
 if(/^(?:be|act|sound|talk) (?:more |a little more |much more )?(?:quiet|reserved)|^(?:talk less|less chat|fewer messages|keep it short)$/.test(s))
  return {kind:'quiet',delta:0.22,message:"Got it. I'll keep updates short and speak up when something matters."}
 if(/^(?:reset (?:your )?(?:tone|personality|mood)|be yourself again|normal tone)$/.test(s))
  return {kind:'reset',message:"Back to my usual style. I'll adjust to the moment as we go."}
 if(/^(?:what(?:'s| is) your (?:mood|tone|personality)|how (?:playful|serious|funny) are you|your mood|your personality)$/.test(s))
  return {kind:'status'}
 return null
}
export class CompanionVoice {
 constructor(mind){this.mind=mind}
 get values(){
  const personality=this.mind?.state?.temperament||{}
  const defaults={humor:0.25+0.5*(personality.curiosity||0.4),serious:0.35,
   social:0.35+0.4*(personality.sociability||0.5)}
  return {...defaults,...this.mind?.state?.tone}
 }
 persist(values){
  if(!this.mind?.state)return
  this.mind.state.tone={humor:clamp(values.humor),serious:clamp(values.serious),social:clamp(values.social)}
  this.mind.state.updatedAt=Date.now()
  this.mind.persist()
 }
 handle(raw){
  const change=toneAdjustment(raw)
  if(!change)return null
  const current=this.values
  if(change.kind==='status')
   return {accepted:true,queued:false,message:"I like a bit of fun, but I switch to serious focus when it matters. You can ask me to be funnier, quieter, or more serious.",
    style:current}
  if(change.kind==='reset'){
   delete this.mind?.state?.tone
   this.mind?.persist?.()
  }else{
   if(change.kind==='humor'){current.humor=clamp(current.humor+change.delta);current.serious=clamp(current.serious-0.12)}
   if(change.kind==='serious'){current.serious=clamp(current.serious+change.delta);current.humor=clamp(current.humor-0.15)}
   if(change.kind==='social')current.social=clamp(current.social+change.delta)
   if(change.kind==='quiet')current.social=clamp(current.social-change.delta)
   this.persist(current)
  }
  return {accepted:true,queued:false,message:change.message,style:this.values}
 }
 // No added cheer or claims if the result is uncertain, blocked, urgent,
 // high-stakes, or references specific Minecraft observations/coordinates.
 frame(message,{input='',world=null,accepted=true,queued=false}={}){
  const s=String(message||'').trim()
  if(!s)return s
  const tone=this.values
  const serious=seriousContext(input,world)||tone.serious>0.72||/\b(?:failed|blocked|unsafe|not verified|not confirmed|permission|unknown|danger|error|cannot|could not|not yet)\b/i.test(s)
  if(serious||!accepted)return s
  if(tone.humor>0.8&&!queued&&/^(?:hey|hi|hello|thanks|you're welcome)/i.test(s))
   return s+(s.endsWith('!')?'':'')+' 😄'
  return s
 }
}
