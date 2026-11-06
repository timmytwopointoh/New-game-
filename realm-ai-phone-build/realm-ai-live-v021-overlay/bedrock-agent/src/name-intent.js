// Shared for the phone chat bar and the owner-allowlisted in-game text chat.
// Name presence alone NEVER proves that a sentence is an instruction.
// This is conservative speech-act parsing, not a claim of arbitrary-language
// neural comprehension. Unknown instructions are sent to the normal interpreter.
const norm=v=>String(v||'').trim()
const escapeRegex=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const ACTION=/^(?:(?:please\s+)?(?:follow|come|walk|go|head|move|travel|bring|collect|gather|harvest|chop|mine|dig|break|find|locate|search|build|make|craft|place|set|mark|remember|show|check|look|scan|survey|explore|roam|return|stop|wait|stay|help|join|respawn|clear|visit|pick|grab|use|sleep|equip|select|put|turn|start|finish|continue|pause|resume|tell|say|explain|think|give|fetch|teach)\b)/i
const LEADING_MODAL=/^(?:can|could|would|will) you\b|^(?:i (?:want|need|would like) you to|i'd like you to|please)\b/i
const QUESTION=/^(?:who|what|where|when|why|how|do you|are you|is it|can you|could you|would you|will you|should we|what if|tell me about|do we)\b/i
const REPORT=/\b(?:should(?:n't)? have|could have|would have|wish (?:you|we) (?:had|could)|if only|last time|yesterday you|while you were|you (?:were|was|used to)|you already|i think|he said|she said|they said|someone said|heard that|remember when)\b/i
const REFERENCE_START=/^(?:dang|wow|ugh|oh man|i |we |they |he |she |everyone |somebody |someone |that |this |the |our |your |you should have|you could have|you would have)/i
const NON_ADDRESS=/^(?:is|was|were|looks|seems|has|had|said|went|did|does|can|could|would|might|should)\b/i
const EXPLICIT_PHONE_MESSAGE=/^(?:!ai|@veilforge)\s+/i

export function interpretNameUtterance(raw,botName,{phone=false}={}){
 const input=norm(raw),bot=norm(botName)
 if(!input||input.length>190||/[\x00-\x1f\x7f]/.test(input)||bot.length<3||bot.length>32||!/^[a-z0-9_-]+(?: [a-z0-9_-]+)*$/i.test(bot))
  return {kind:'none',addressed:false,command:null,reason:'no valid name or message'}
 // Legacy explicit owner !ai commands remain explicit independent of names.
 if(EXPLICIT_PHONE_MESSAGE.test(input))return {kind:'explicit',addressed:true,
  command:input.replace(EXPLICIT_PHONE_MESSAGE,'').trim(),reason:'explicit control prefix'}
 const escaped=escapeRegex(bot),name=new RegExp('(?:^|[^a-z0-9_])@?'+escaped+'(?=$|[^a-z0-9_])','i')
 if(!name.test(input))return {kind:'none',addressed:false,command:null,reason:'no bot name'}
 const start=new RegExp('^(?:(?:hey|hi|hello|yo|oi|okay|ok|excuse me|listen|please)[,!: ]+)?@?'+escaped+'(?=$|[\\s,:!?])','i')
 const end=new RegExp('(?:[,;!]+\\s*|\\s+)@?'+escaped+'[.!?]*$','i')
 const isStart=start.test(input),isEnd=!isStart&&end.test(input)
 if(!isStart&&!isEnd)return {kind:'reference',addressed:false,command:null,reason:'name appears inside a conversation'}
 let statement=isStart?input.replace(start,'').replace(/^[,:!\s]+/,'').trim():input.replace(end,'').trim()
 statement=statement.replace(/^[,:!\s]+/,'').trim()
 if(!statement)return {kind:'attention',addressed:true,command:null,reason:'direct name call'}
 // A trailing name by itself in casual/retrospective talk is a reference.
 // A leading name may also introduce feedback rather than a new task.
 if(REPORT.test(statement)||NON_ADDRESS.test(statement)&&isStart)
  return {kind:isStart?'statement':'reference',addressed:isStart,command:null,reason:'descriptive or retrospective speech'}
 if(isEnd&&REFERENCE_START.test(statement)&&!LEADING_MODAL.test(statement))
  return {kind:'reference',addressed:false,command:null,reason:'trailing name in ordinary speech'}
 let candidate=statement
 // Don't extract "grabbed" or "should have" as a future mining request.
 const request=LEADING_MODAL.test(candidate)||ACTION.test(candidate)
 if(request){
  candidate=candidate.replace(/^(?:can|could|would|will) you(?: please)?\s+/i,'')
   .replace(/^(?:i want you to|i need you to|i would like you to|i'd like you to|please|go ahead and)\s+/i,'')
   .replace(/\s+(?:please|for me|now)$/i,'').trim()
  candidate=candidate.replace(/^come (?:over )?her(?:e)?\b/i,'follow me')
   .replace(/^come (?:over )?here\b/i,'follow me')
  // A question can be an instruction or a genuine inquiry; both go through
  // the same downstream language handler, with no automatic mining permission.
  return {kind:'request',addressed:true,command:candidate||statement,reason:'directed action or request'}
 }
 if(QUESTION.test(statement)||/[?]\s*$/.test(statement))
  return {kind:'question',addressed:true,command:statement,reason:'direct conversational question'}
 return {kind:'statement',addressed:isStart,command:null,reason:'no actionable intent established'}
}
