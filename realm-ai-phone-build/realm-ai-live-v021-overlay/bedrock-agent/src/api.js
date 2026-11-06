import {resolveToolInstruction} from './tool-language.js'
import {interpretNameUtterance} from './name-intent.js'
import {isForestryReturnCommand} from './survival/forestry-return.js'
import {commandCatalog,parseDescriptor,parseCommandRequest,renderDescriptor,formOptions} from './survival/command-plans.js'
import {suggestAction,suggestMaterial,resolveActionTarget} from './survival/command-vocabulary.js'
import {respondToConversation,isConversationQuestion} from './conversation.js'
import {bundledEnglishWordCount} from './lexicon/lookup.js'
import http from 'node:http'
import crypto from 'node:crypto'
import {parseCommand} from '../pack-template/scripts/commands.js'
import {interpretMessage} from './chat.js'
import {Planner} from './planner.js'
import {runAutonomous} from './autonomous-intent.js'
import {makeSupportSnapshot} from './support-snapshot.js'
import {researchRouting,unsupportedResearchResponse} from './agent-lookup-router.js'
import {offlineMinecraftResponse,offlineKnowledgeStats} from './offline-minecraft-brain.js'
import {blockCatalog,entityCatalog,blockReference,blockAllTools,mobReference} from './knowledge/bedrock-reference.js'
import {OpenDictionaryResearch} from './web-dictionary.js'
import {exploreDefinition,identifyReference,explainChoices} from './definition-comprehension.js'
import {extractGooglePlan} from './research-action-plan.js'
import {AutomaticGoogleResearch,PrivateResearchKey,validateObservedPlan} from './automatic-google-research.js'
export function authorized(received,expected){
 const a=Buffer.from(String(received||'')),b=Buffer.from(String(expected||''))
 return a.length===b.length && a.length>0 && crypto.timingSafeEqual(a,b)
}
export function dispatch(raw,connection){
 const parsed=parseCommand(raw)
 if(parsed.action==='invalid')return {accepted:false,message:parsed.message}
 return connection.send(String(raw).replace(/^!vf\s*/i,'').trim())
}
export function chatDispatch(raw,connection){
 const plan=interpretMessage(raw)
 if(!plan.command)return {accepted:true,queued:false,message:plan.message}
 const result=dispatch(plan.command,connection)
 return {accepted:result.accepted,queued:result.accepted,message:result.accepted?`${plan.message} ${result.message}`:result.message,command:plan.command}
}
export function createApi(config,connection,log=console.log){
 const planner=new Planner(connection)
 planner.on('planner-update',u=>{
   if(typeof connection.nextEventId==='number'&&Array.isArray(connection.events)){
     connection.events.push({id:++connection.nextEventId,source:'Planner',message:u.message})
     if(connection.events.length>64)connection.events.shift()
   }
   log('Planner: '+u.message.slice(0,180))
 })
 // This handler is intentionally shared by the Android HTTPS API and owner-only Realm chat.
 let pendingInterpretation=null, researchEpoch=0, researching=false
 const dictionaryResearch=new OpenDictionaryResearch()
 const googleKeys=new PrivateResearchKey(),google=new AutomaticGoogleResearch({keyStore:googleKeys})
 let googleAbort=null
 function runVerifiedProposal(proposal){
   const survival=connection.survival,plans=survival?.commandPlans
   if(!plans)throw Error('Join the Realm before starting tasks.')
   if(!proposal.commands?.length)throw Error('Google did not produce any observed supported actions. No world action was started.')
   const before=plans.snapshot();if(before.batch||before.running!==null||survival.navigation?.job)throw Error('Another job is active; Stop it before starting researched commands.')
   if(proposal.commands.length>before.capacity-before.cards.length)throw Error('Five-card limit: clear finished cards first.')
   const ds=proposal.commands.map(step=>{const parsed=parseCommandRequest(step.text);if(parsed.clarification)throw Error(parsed.clarification);return parsed.descriptor})
   ds.forEach(d=>plans.validateChoices(d))
   const ids=[];for(const d of ds){const prepared=plans.prepare(d);ids.push(prepared.plans.selected)}
   return {...plans.activateSubset(ids),research:{planned:ids.length,warnings:proposal.warnings,grounded:proposal.grounded||false}}
 }
 function researchTask(task){
   if(!google.configured())return offlineMinecraftResponse(task,{world:connection.survival?.world})||{accepted:false,queued:false,message:'This task is not yet understood by the offline Minecraft knowledge engine. Try a specific block, material, mob, recipe, or action. Google AI is optional, never required for the built-in knowledge.'}
   if(googleAbort)return {accepted:false,queued:false,message:'Google is already researching an instruction. Use Stop to cancel.'}
   const survival=connection.survival,scope=survival?.commandVocabulary?.scope,epoch=researchEpoch
   if(!survival||!scope)return {accepted:false,queued:false,message:'Join your Realm first so Google cannot invent world coordinates.'}
   googleAbort=new AbortController();const abort=googleAbort
   google.plan(task,survival.world,{signal:abort.signal}).then(proposal=>{
     if(epoch!==researchEpoch||abort.signal.aborted||survival!==connection.survival||scope!==survival?.commandVocabulary?.scope)return
     try{const result=runVerifiedProposal(proposal);survival.report('Google AI instruction: '+result.message+' '+(proposal.summary||'').slice(0,180))}
     catch(e){survival.report('Google explained the task, but nothing ran: '+String(e.message||e).slice(0,190))}
   }).catch(e=>{if(epoch===researchEpoch&&!abort.signal.aborted)survival?.report('Automatic Google research blocked: '+String(e.message||e).slice(0,150))}).finally(()=>{if(googleAbort===abort)googleAbort=null})
   return {accepted:true,queued:true,message:'Researching with Google AI and validating the result against observed Realm terrain. Supported steps will launch automatically; no Activate tap. Stop cancels pending research.'}
 }
 function studyTerm(word,original=null){
  const survival=connection.survival,scope=survival?.commandVocabulary?.scope,epoch=researchEpoch
  const builtIn=offlineMinecraftResponse('what is '+word,{world:survival?.world})
  if(builtIn)return builtIn
  const remembered=survival?.commandVocabulary?.definitionFor?.(word)
  if(remembered)return {accepted:true,queued:false,message:`I remember “${word}”: ${remembered.definition} (${remembered.source}; ${remembered.sourceCount} source). This is a saved definition, not permission to execute an action. Tell me the Minecraft object or tool you mean.`}
  if(researching)return {accepted:false,queued:false,message:'A word lookup is already running.'}
  if(!dictionaryResearch.configured())return {accepted:false,queued:false,message:'The phone HTTPS dictionary lookup is unavailable; offline vocabulary still works.'}
  researching=true
  dictionaryResearch.study(word).then(async result=>{
   if(epoch!==researchEpoch||survival!==connection.survival||scope!==survival?.commandVocabulary?.scope)return
   const tree=await exploreDefinition(word,result,{lookupOnline:w=>dictionaryResearch.study(w),maxTerms:12,maxDepth:2,maxOnline:2})
   if(epoch!==researchEpoch||survival!==connection.survival||scope!==survival?.commandVocabulary?.scope)return
   let definitionSaved=false
   try{definitionSaved=survival.commandVocabulary.rememberDefinition?.(word,{...result,relatedTerms:tree.terms})===true}catch{}
   let info=`Online dictionary: ${word} means ${result.definition} (${result.source}). ${result.reason}`
   if(definitionSaved)info+=' Definitions saved for this Realm; a definition alone is not an executable action.'
   if(tree.terms.length)info+=' Explored '+tree.terms.length+' related definition words (maximum two layers), such as '+tree.terms.slice(0,5).map(x=>x.word).join(', ')+'.'
   const choices=tree.choices
   if(choices.length>1){
     pendingInterpretation={kind:'word-sense',word,choices,scope,createdAt:Date.now()}
     info+=' '+explainChoices(word,choices)
   }
   if(result.action&&result.verified&&result.sourceCount>=2&&choices.length<=1){
    try{
     survival.commandVocabulary.teach('action',word,result.action)
     info+=` Saved as ${result.action}.`
     if(original){const direct=runAutonomous(original,survival);info+=` ${direct?.message||'Instruction was not executable.'}`}
    }catch(e){info+=' Meaning not saved: '+String(e.message||e).slice(0,90)}
   }
   if(result.action&&result.sourceCount<2&&choices.length<=1){
    if(original){pendingInterpretation={kind:'action',word,input:original,scope,learn:true,target:result.action,createdAt:Date.now()};info+=` One source suggests ${result.action}. Did you mean that Minecraft action? Reply yes to remember it and prepare the request, or no. Nothing has started.`}
    else info+=' One external source is not enough to learn an executable action automatically.'
   }
   survival.report(info)
  }).catch(e=>{if(epoch===researchEpoch)survival?.report('Online dictionary lookup failed: '+String(e.message||e).slice(0,105))}).finally(()=>{researching=false})
  return {accepted:true,queued:true,message:`I am looking up “${word}” myself using the internet dictionary. I will reuse the meaning only if it matches a supported command and required in-game details are known.`}
 }
 const message=raw=>{
   if(typeof raw!=='string'||raw.length>190||/[\r\n\x00-\x1f\x7f]/.test(raw))return {accepted:false,queued:false,message:'Use one message of 190 characters or fewer.'}
   const addressed=interpretNameUtterance(raw,
    connection.username||connection.config?.minecraft?.botPlayerName,{phone:true})
   if(addressed.kind==='attention'){
    connection.survival?.companion?.hearName?.(raw)
    return {accepted:true,queued:false,message:"I'm listening. You can talk to me normally or ask me to do something."}
   }
   if(addressed.addressed&&(addressed.command||addressed.content))
    raw=addressed.command||addressed.content
   const companion=connection.survival?.companion?.handle(raw)
   if(companion)return companion
   // Both the phone chat bar and the owner-only Realm chat use this same
   // memory interpreter; a historical sighting alone never authorizes mining.
   const memoryReply=connection.survival?.resourceRecall?.handle(raw)
   if(memoryReply)return memoryReply
   // Recognized owner action, not a conversational ping, temporarily yields
   // the home task. Both phone API and owner-only Realm chat use this path.
   connection.survival?.companion?.beforeOwnerAction(raw)
   if(/^(?:try again|retry blocked|retry task)$/i.test(String(raw).trim())){
     const nav=connection.survival?.navigation
     if(nav?.job?.kind==='follow')return nav.retryBlockedFollow()
     return connection.survival?.commandPlans?.retryBlocked()||{accepted:false,message:'Join the Realm first.'}
   }
   if(/^(?:stop|stop everything|cancel|cancel job|cancel plan|abort|abort mission|stop following|stop mining|stop walking)$/i.test(String(raw).trim().replace(/^command\s+/i,''))){
     const finishingFollow=/^(?:stop following(?: me)?|finish task)$/i.test(String(raw).trim())
     researchEpoch++;googleAbort?.abort();googleAbort=null;pendingInterpretation=null;planner.cancel();connection.cancelAutoRecovery?.()
     const result=connection.survival?.handle('stop')
     if(finishingFollow)connection.survival?.companion?.social?.finishTask()
     return result?{...result,plans:connection.survival?.commandPlans?.snapshot()}: {accepted:true,queued:false,message:'Stopped.'}
   }
   let output
   if(connection.survival?.commandPlans){
    const plans=connection.survival.commandPlans
    const vocabulary=connection.survival.commandVocabulary
    try{
     const text=String(raw).trim();let m
     if(/^command(?:\s|$)/i.test(text))pendingInterpretation=null
     if(pendingInterpretation&&Date.now()-pendingInterpretation.createdAt>60000)pendingInterpretation=null
     const yes=/^(?:yes|yes that's right|yes that is right|correct|that's right|that is right)$/i.test(text),no=/^(?:no|nope|not that|wrong|cancel)$/i.test(text)
     const isChoice=pendingInterpretation?.kind==='word-sense'||(pendingInterpretation?.choices&&( /^[1-4]$/.test(text)||pendingInterpretation.choices.some(x=>typeof x==='string'&&x.toLowerCase().replace(/_/g,' ')===text.toLowerCase().trim().replace(/_/g,' '))))
     if(pendingInterpretation&&!yes&&!no&&!/^command\s/i.test(text)&&!isChoice&&!(pendingInterpretation.kind==='unknown-action'&&resolveActionTarget(text)))pendingInterpretation=null
     if(isForestryReturnCommand(text)){pendingInterpretation=null;output=connection.survival.handle(text.replace(/^command\s+/i,''))}
     else if(/^(?:offline knowledge|minecraft knowledge|knowledge status)$/i.test(text))output=offlineMinecraftResponse(text,{world:connection.survival?.world})
     else if((m=text.match(/^(?:research and (?:do|perform|execute)|ask google (?:how to|to)|do research on) (.{3,180})$/i)))output=researchTask(m[1])
     else if((m=text.match(/^(?:research|look up|learn word) ([a-z][a-z-]{1,29})[?.!]?$/i)))output=studyTerm(m[1].trim().toLowerCase())
     else if((m=text.match(/^command\s+teach\s+(action|material)\s+(.+?)\s*=\s*(.+)$/i))){pendingInterpretation=null;const unquote=x=>x.trim().replace(/^["“](.*)["”]$/,'$1');output=vocabulary.teach(m[1].toLowerCase(),unquote(m[2]),unquote(m[3]))}
     else if((m=text.match(/^command\s+forget\s+(action|material)\s+(.+)$/i))){pendingInterpretation=null;output=vocabulary.forget(m[1].toLowerCase(),m[2].trim().replace(/^["“](.*)["”]$/,'$1'))}
     else if(/^(?:command\s+)?(?:learning status|what have you learned|what do you remember|how do you learn|do you have a language model)[?!.]*$/i.test(text)){
      const v=vocabulary.list(),learned=connection.survival.learning?.snapshot()
      output={accepted:true,queued:false,message:`I use an offline ${bundledEnglishWordCount}-word English glossary PLUS Bedrock block/item/entity/biome/recipe data, supported command rules, and optional HTTPS lookups—not a neural language model. No Google key is necessary for Minecraft knowledge. I remember ${v.count} owner-confirmed word mappings for this Realm. ${learned?.confirmed||0} task successes were server-confirmed; ${learned?.blocked||0} attempts were blocked and ${learned?.interrupted||0} interrupted. I learn from your corrections and confirmed task outcomes; questions and jokes do not become actions. Use “command vocabulary” to review words or “command forget action <word>” to remove one.`+(v.error?' '+v.error:'')+(learned?.error?' '+learned.error:''),vocabulary:v,learning:learned,plans:plans.snapshot()}
     }
     else if((m=text.match(/^(?:by )?([a-z][a-z -]{1,35}?) (?:means|i mean|means to) (.{2,80})[.!]?$/i))&&resolveActionTarget(m[2])){pendingInterpretation=null;output=vocabulary.teach('action',m[1].trim(),resolveActionTarget(m[2]))}
     else if(/^command\s+vocabulary$/i.test(text)){const v=vocabulary.list();output={accepted:true,queued:false,message:`Learned action words: ${Object.keys(v.actions).join(', ')||'none'}. Learned material words: ${Object.keys(v.materials).join(', ')||'none'}. Forget one with “command forget action <word>” or “command forget material <word>”. Teach one with “command teach action <word> = dig” or “command teach material <word> = stone”.`,vocabulary:v}}
     else if(pendingInterpretation?.kind==='word-sense'){
       const pending=pendingInterpretation
       if(no){pendingInterpretation=null;output={accepted:true,queued:false,message:'Okay, no meaning was selected. Nothing executed.'}}
       else if(pending.scope!==vocabulary?.scope){pendingInterpretation=null;output={accepted:false,queued:false,message:'Realm changed; discarded the old definition question.'}}
       else {
         const sense=identifyReference(text,pending.choices)
         if(sense){
           pendingInterpretation=null
           const result={definition:sense.definition,source:'owner-selected dictionary sense',sourceCount:1,meanings:[{partOfSpeech:sense.partOfSpeech,definitions:[sense.definition]}]}
           let saved=false
           try{saved=vocabulary.rememberDefinition(pending.word,result)}catch{}
           output={accepted:true,queued:false,message:'I will use “'+pending.word+'” in the sense: '+sense.definition+(saved?' Saved for this Realm.':' I could not persist the definition.')+' I have not executed a command. Give me a complete instruction when ready.'}
         }else{
           output={accepted:false,queued:false,message:'I still cannot tell which definition your reference means. '+explainChoices(pending.word,pending.choices)}
           const ref=text.match(/^(?:it means |like |the one about |i mean )?([a-z][a-z-]{1,29})$/i)
           if(ref&&dictionaryResearch.configured())dictionaryResearch.study(ref[1].toLowerCase()).then(related=>{
             if(pendingInterpretation===pending)connection.survival?.report('Reference “'+ref[1]+'”: '+related.definition+'. Please choose the numbered sense. No task started.')
           }).catch(()=>{})
         }
       }
     }
     else if(pendingInterpretation?.kind==='unknown-action'&&pendingInterpretation.scope!==vocabulary?.scope){pendingInterpretation=null;output={accepted:false,queued:false,message:'Realm changed. Nothing was learned or queued.',plans:plans.snapshot()}}
     else if(pendingInterpretation?.kind==='unknown-action'){
      const target=resolveActionTarget(text)
      if(target){const pending=pendingInterpretation;pendingInterpretation=null;try{vocabulary.teach('action',pending.word,target);const intent=resolveToolInstruction(pending.input,connection.survival?.world)||parseCommandRequest(vocabulary.expand(pending.input).text);output=intent.clarification?{accepted:false,queued:false,message:intent.clarification,plans:plans.snapshot()}:plans.prepare(intent.descriptor)}catch(e){output={accepted:false,queued:false,showCatalog:true,message:e.message+' The correction was learned; nothing was activated.',plans:plans.snapshot()}}}
      else if(no){pendingInterpretation=null;output={accepted:true,queued:false,message:'Okay, cancelled. Nothing was learned or queued.',plans:plans.snapshot()}}
      else output={accepted:false,queued:false,message:'Tell me which supported action you meant, such as dig, walk, find, follow, look, or status. Or say no to cancel. Nothing is saved or queued yet.',plans:plans.snapshot()}
     }
     else if(yes&&pendingInterpretation&&!pendingInterpretation.choices){
      const pending=pendingInterpretation;pendingInterpretation=null
      if(pending.scope!==vocabulary?.scope)output={accepted:false,queued:false,message:'That question is no longer current. Nothing was saved or queued.',plans:plans.snapshot()}
      else try{if(pending.learn)vocabulary.teach(pending.kind,pending.word,pending.target);const expanded=vocabulary.expand(pending.input).text;const intent=parseCommandRequest(expanded);output=intent.clarification?{accepted:false,queued:false,message:intent.clarification,plans:plans.snapshot()}:plans.prepare(intent.descriptor)}catch(e){output={accepted:false,queued:false,showCatalog:true,message:e.message+' The word mapping was saved only after your confirmation; nothing was activated.',plans:plans.snapshot()}}
     }
     else if(pendingInterpretation?.choices&&!no&&isChoice){
      const pending=pendingInterpretation,choice=/^[1-4]$/.test(text)?pending.choices[Number(text)-1]:pending.choices.find(x=>x.toLowerCase().replace(/_/g,' ')===text.toLowerCase().trim().replace(/_/g,' '))
      if(choice){pendingInterpretation=null;if(pending.scope!==vocabulary?.scope)output={accepted:false,queued:false,message:'Realm changed. Nothing was learned or queued.',plans:plans.snapshot()};else try{vocabulary.teach('material',pending.word,choice);const intent=parseCommandRequest(vocabulary.expand(pending.input).text);output=plans.prepare(intent.descriptor)}catch(e){output={accepted:false,queued:false,message:e.message+' The material choice was remembered; nothing was activated.',plans:plans.snapshot()}}}
      else output={accepted:false,queued:false,message:'Choose one of the listed materials, or say no to cancel. Nothing was saved or queued.',plans:plans.snapshot()}
     }
     else if(no&&pendingInterpretation){pendingInterpretation=null;output={accepted:true,queued:false,message:'Okay. I did not save or queue that interpretation. You can rephrase it or teach the word explicitly.',plans:plans.snapshot()}}
     else if((m=text.match(/^select plan (\d+)$/i)))output={accepted:true,message:'Selected plan '+m[1]+'.',plans:plans.select(Number(m[1]))}
     else if(/^(activate selected plan|start plan|activate queue|run queue)$/i.test(text))output=plans.activateQueue()
     else if(text==='saved plans')output={accepted:true,message:'Saved plan cards.',plans:plans.snapshot()}
     else if(/^(?:command|commands)$/i.test(text))output={accepted:true,queued:false,showCatalog:true,message:'Supported commands: '+commandCatalog.map(d=>d.label).join('; '),catalog:commandCatalog.map(d=>({id:d.id,label:d.label,fields:d.fields,note:d.note})),plans:plans.snapshot()}
     else if(/^command\s+(?:roam|explore)\b/i.test(text)){pendingInterpretation=null;output=connection.survival.handle(text.replace(/^command\s+/i,''))}
     else if(/^command\s+/i.test(text)&&resolveToolInstruction(text,connection.survival?.world)){
      pendingInterpretation=null;const equipment=resolveToolInstruction(text,connection.survival?.world)
      output=equipment.error?{accepted:false,queued:false,message:equipment.error,plans:plans.snapshot()}:plans.prepare(equipment.descriptor)
     }
     else if(/^command\s+/i.test(text)){
      pendingInterpretation=null
      const request=text.slice(text.search(/\s/)+1),expanded=vocabulary.expand(request).text
      try{const intent=parseCommandRequest(expanded);output=intent.clarification?{accepted:false,queued:false,message:intent.clarification,plans:plans.snapshot()}:plans.prepare(intent.descriptor)}
      catch(e){
       const first=request.trim().split(/\s+/)[0].replace(/[.,!?]+$/,'')
       const suggestion=suggestAction(request,vocabulary)
       const materialError=/known material|known block material/i.test(e.message)
       const materialWord=request.trim().split(/\s+/).at(-1)?.replace(/[.,!?]+$/,'')
       const materialSuggestion=materialError&&materialWord?suggestMaterial(materialWord):null
       if(suggestion&&suggestion.word!==first.toLowerCase()){
        const target=suggestion.id;pendingInterpretation={input:request,scope:vocabulary?.scope,kind:'action',word:first,target,learn:true,createdAt:Date.now()}
        const label=commandCatalog.find(d=>d.id===target)?.label||target
        output={accepted:false,queued:false,message:`Did you mean “${label}” for “${first}”? Reply yes to save that word mapping and prepare the request, or no to leave it unchanged. Nothing has been saved or queued.` ,plans:plans.snapshot()}
       }else if(Array.isArray(materialSuggestion)){
        pendingInterpretation={input:request,scope:vocabulary?.scope,kind:'material',word:materialWord,choices:materialSuggestion,createdAt:Date.now()}
        output={accepted:false,queued:false,message:`“${materialWord}” is ambiguous. Which material did you mean? Reply with a number: ${materialSuggestion.map((x,i)=>`${i+1}) ${x}`).join(', ')}. Nothing has been saved or queued.`,plans:plans.snapshot()}
       }else if(materialSuggestion&&materialSuggestion!==materialWord){
        pendingInterpretation={input:request,scope:vocabulary?.scope,kind:'material',word:materialWord,target:materialSuggestion,learn:true,createdAt:Date.now()}
        output={accepted:false,queued:false,message:`Did you mean the Minecraft material “${materialSuggestion}” by “${materialWord}”? Reply yes to remember the spelling and prepare the request, or no. Nothing has been saved or queued.`,plans:plans.snapshot()}
       }else if(!vocabulary?.actions?.[first.toLowerCase()]&&!suggestion&&!commandCatalog.some(d=>d.id===first.toLowerCase()||d.template.split(/[ {]/)[0].toLowerCase()===first.toLowerCase())){
        pendingInterpretation={kind:'unknown-action',word:first,input:request,scope:vocabulary?.scope,createdAt:Date.now()}
        output={accepted:false,queued:false,showCatalog:true,message:`I don't recognize “${first}” as an action. What did you mean? Reply with a supported action such as dig, walk, find, follow or look. I’ll remember the correction for this Realm. Nothing has been saved or queued yet.`,plans:plans.snapshot()}
       }else output={accepted:false,queued:false,showCatalog:true,message:e.message+' Choose an option to open its required fields. Nothing was saved or queued.',plans:plans.snapshot()}
      }
     }else if(isConversationQuestion(text)){
      const reply=respondToConversation(text,{vocabulary,world:connection.survival?.world,navigation:connection.survival?.navigation})
      const offline=offlineMinecraftResponse(text,{world:connection.survival?.world})
      let descriptor=null;try{descriptor=parseDescriptor(reply)}catch{}
      output=offline||(descriptor&&['status','movement','inventory','about','recipe'].includes(descriptor.id)?connection.survival.handle(renderDescriptor(descriptor)):{accepted:true,queued:false,message:reply,plans:plans.snapshot()})
     }else{
      const candidate=vocabulary.expandMaterials(text.replace(/[.!?]+$/,'').trim()).text;let descriptor=null
      try{descriptor=parseDescriptor(candidate)}catch{}
      const safeQuestion=descriptor&&['status','movement','look','inventory','help','plan_status','find','materials','about','recipe','route'].includes(descriptor.id)
      if(safeQuestion)output=connection.survival.handle(renderDescriptor(descriptor))
      else {
       // Owner-only in-Game messages and the token-protected phone controller
       // share this dispatcher. Supported direct imperatives start immediately.
       const resource=connection.survival.resources.start(text)
       const direct=resource||runAutonomous(text,connection.survival)
       const route=researchRouting(text,{hasGoogle:google.configured()})
       // A grounded command is executed locally. When the parser cannot ground
       // an owner instruction, hand it to the BOT'S research tool instead of
       // showing the human an error and stopping at the owner-operated browser.
       const ungrounded=direct?.accepted===false&&/^I couldn't ground that instruction in a supported action:/i.test(direct.message||'')
       if(direct&&!ungrounded)output={...direct,plans:plans.snapshot()}
       else if(offlineMinecraftResponse(text,{world:connection.survival?.world}))output=offlineMinecraftResponse(text,{world:connection.survival?.world})
       else if(route?.kind==='google')output=researchTask(route.task)
       else if(route?.kind==='dictionary')output=studyTerm(route.word,route.original)
       else if(route?.kind==='needs-ai')output={accepted:false,queued:false,message:unsupportedResearchResponse(),plans:plans.snapshot()}
       else if(direct)output={...direct,plans:plans.snapshot()}
       else {const reply=respondToConversation(text,{vocabulary});let conversational=null;try{conversational=parseDescriptor(reply)}catch{}if(conversational&&['status','movement','inventory','about','recipe'].includes(conversational.id))output=connection.survival.handle(renderDescriptor(conversational));else output={accepted:true,queued:false,message:reply,plans:plans.snapshot()}}
      }
     }
    }catch(e){connection.trace?.error(e);output={accepted:false,queued:false,message:'An internal command error was recorded. Export Settings → Bug reports → Export ZIP. '+String(e.message||e).slice(0,100),plans:plans.snapshot()}}
   }else output=planner.handle(raw)||(planner.snapshot().state==='running'?{accepted:true,queued:false,message:'A plan is running; cancel it first.'}:chatDispatch(raw,connection))
   connection.survival?.companion?.afterOwnerAction(raw,output)
   return output
 }
 const controller={planner,message}
 let stopEpoch=0
 const token=config.localAPI.token
 const server=http.createServer(async(req,res)=>{
   const send=(status,obj)=>{
     if(req.method==='POST')connection.trace?.record(obj?.accepted===false?'api_rejected':'api_request')
     res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'})
     res.end(JSON.stringify(obj))
   }
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return send(403,{error:'local connections only'})
   const header=String(req.headers.authorization||'')
   if(!authorized(header.replace(/^Bearer\s+/i,''),token))return send(401,{error:'invalid token'})
   const pathname=new URL(req.url||'/','http://127.0.0.1').pathname
   if(req.method==='POST'&&pathname==='/navigation/retry'){const epoch=Number(new URL(req.url,'http://127.0.0.1').searchParams.get('epoch'));if(Number.isSafeInteger(epoch)&&epoch<stopEpoch)return send(200,{accepted:false,message:'Stop cancelled this retry.'});const nav=connection.survival?.navigation;return send(200,nav?nav.retryBlockedFollow():{accepted:false,message:'Join the Realm first.'})}
    if(req.method==='POST'&&pathname==='/stop'){const epoch=Number(new URL(req.url,'http://127.0.0.1').searchParams.get('epoch'));if(Number.isSafeInteger(epoch)&&epoch>stopEpoch)stopEpoch=epoch;return send(200,message('stop'))}
   if(req.method==='GET'&&(pathname==='/knowledge/blocks'||pathname==='/knowledge/entities')){
     const q=new URL(req.url,'http://127.0.0.1').searchParams
     const offset=Number(q.get('offset')||0),limit=Number(q.get('limit')||20)
     if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>30)return send(400,{error:'offset must be nonnegative and limit 1–30'})
     const all=pathname==='/knowledge/blocks'?blockCatalog():entityCatalog(),field=pathname==='/knowledge/blocks'?'blocks':'entities'
     return send(200,{version:offlineKnowledgeStats.version,offset,limit,total:all.length,[field]:all.slice(offset,offset+limit),nextOffset:offset+limit<all.length?offset+limit:null})
   }
   if(req.method==='GET'&&pathname==='/knowledge/block'){
     const q=new URL(req.url,'http://127.0.0.1').searchParams
     const conditions={tool:q.get('tool')||'hand',efficiency:Number(q.get('efficiency')||0),haste:Number(q.get('haste')||0),conduitPower:Number(q.get('conduitPower')||0),miningFatigue:Number(q.get('miningFatigue')||0),underwater:q.get('underwater')==='true',airborne:q.get('airborne')==='true',aquaAffinity:q.get('aquaAffinity')==='true',creative:q.get('creative')==='true',world:connection.survival?.world}
     const facts=q.get('allTools')==='true'?blockAllTools(q.get('name'),conditions):blockReference(q.get('name'),conditions)
     return facts?send(200,{block:facts}):send(404,{error:'Unknown Bedrock block'})
   }
   if(req.method==='GET'&&pathname==='/knowledge/mob'){const q=new URL(req.url,'http://127.0.0.1').searchParams,entity=mobReference(q.get('name'));return entity?send(200,{entity}):send(404,{error:'Unknown Bedrock entity'})}
   if(req.method==='GET'&&pathname==='/knowledge/offline')return send(200,{knowledge:offlineKnowledgeStats,requiresGoogleKey:false})
  if(req.method==='GET'&&pathname==='/research/google-status')return send(200,{configured:google.configured(),active:!!googleAbort})
   if(req.method==='POST'&&pathname==='/research/google-key'){
     let body='';try{for await(const chunk of req){body+=chunk.toString('utf8');if(body.length>500)return send(413,{accepted:false,message:'Key payload too long'})}
       const data=JSON.parse(body);if(data.clear===true){googleKeys.clear();return send(200,{accepted:true,configured:false,message:'Private Google research key cleared.'})}
       googleKeys.set(data.key);return send(200,{accepted:true,configured:true,message:'Google research configured in private phone storage.'})
     }catch(e){return send(400,{accepted:false,message:'Key not saved: '+String(e.message||e).slice(0,100)})}
   }
   if(req.method==='POST'&&pathname==='/research/automatic'){
     let body='';try{for await(const chunk of req){body+=chunk.toString('utf8');if(body.length>500)return send(413,{accepted:false,message:'Instruction too long'})}
       const data=JSON.parse(body);if(Number.isSafeInteger(data.epoch)&&data.epoch<stopEpoch)return send(200,{accepted:false,message:'Stop cancelled the older instruction.'})
       return send(200,researchTask(data.task))
     }catch(e){return send(400,{accepted:false,message:String(e.message||e).slice(0,120)})}
   }
   if(req.method==='GET'&&pathname==='/support')return send(200,{support:connection.trace?.summary()||null})
   if(req.method==='GET'&&pathname==='/support/snapshot')return send(200,makeSupportSnapshot(connection))
   if(req.method==='GET'&&pathname==='/diagnostics')return send(200,connection.diagnostics?.()||{phase:'unavailable',savedAuthentication:'kept'})
   if(req.method==='GET'&&pathname==='/status')return send(200,{...connection.status(),planner:planner.snapshot()})
   if(req.method==='GET'&&pathname==='/catalog')return send(200,{catalog:commandCatalog,options:connection.survival?{...formOptions(connection.survival.world,new URL(req.url,'http://127.0.0.1').searchParams.get('q')||''),owners:config.ownerPlayerNames||[]}:null})
   if(req.method==='GET'&&pathname==='/plans')return send(200,{plans:connection.survival?.commandPlans.snapshot()})
   if(req.method==='GET'&&pathname==='/planner')return send(200,{planner:planner.snapshot()})
   if(req.method==='GET'&&pathname==='/updates'){
     const n=Number(new URL(req.url,'http://127.0.0.1').searchParams.get('after')||0)
     if(!Number.isSafeInteger(n)||n<0)return send(400,{error:'invalid cursor'})
     return send(200,{...connection.status(),planner:planner.snapshot(),updates:(connection.events||[]).filter(e=>e.id>n).slice(-32),cursor:connection.nextEventId||0})
   }
   if(req.method==='POST'&&(pathname==='/research/preview'||pathname==='/research/run')){
     let body='';try{for await(const part of req){body+=part.toString('utf8');if(Buffer.byteLength(body)>12000)return send(413,{accepted:false,message:'Research answer exceeds size limit.'})}
       const data=JSON.parse(body);if(Number.isSafeInteger(data.epoch)&&data.epoch<stopEpoch)return send(200,{accepted:false,message:'Research request cancelled by Stop.'})
       const result=extractGooglePlan(data.task,data.answer),survival=connection.survival
       if(pathname==='/research/preview')return send(200,{accepted:true,preview:result,message:result.commands.length?`Found ${result.commands.length} supported step(s); these have not executed.`:'No executable steps. Google research is reference text only.'})
       if(!survival?.commandPlans)return send(409,{accepted:false,message:'Join the Realm before executing a researched plan.'})
       if(!result.commands.length)return send(400,{accepted:false,message:'No supported steps to run. Do not assume Google advice was executed.',preview:result})
       const plans=survival.commandPlans
       const before=plans.snapshot();if(before.batch||before.running!==null)return send(409,{accepted:false,message:'A job is active. Stop it before starting researched actions.'})
       if(result.commands.length>before.capacity-before.cards.length)return send(409,{accepted:false,message:'Clear old saved cards to make room for researched steps. Nothing was started.'})
       // Validate every descriptor before mutating cards or the world.
       const descriptors=result.commands.map(step=>{const parsed=parseCommandRequest(step.text);if(parsed.clarification)throw Error(parsed.clarification);return parsed.descriptor})
       for(const d of descriptors)plans.validateChoices(d)
       const ids=[];for(const d of descriptors){const prepared=plans.prepare(d);ids.push(prepared.plans.selected)}
       return send(200,{...plans.activateSubset(ids),research:{planned:result.commands.length,warnings:result.warnings}})
     }catch(e){return send(400,{accepted:false,message:'Research plan not executed: '+String(e.message||e).slice(0,220)})}
   }
   if(req.method==='POST'&&(pathname==='/command'||pathname==='/message'||pathname==='/mode'||pathname.startsWith('/plans/'))){
     let body=''
     try{
       for await(const part of req){body+=part.toString('utf8');if(Buffer.byteLength(body)>2048)return send(413,{error:'request too long'})}
       const data=JSON.parse(body)
       if(Number.isSafeInteger(data.epoch)&&data.epoch<stopEpoch)return send(200,{accepted:false,queued:false,message:'Discarded command queued before Stop.'})
       if(pathname==='/mode'){
        const verifier=connection.survival?.verification
        if(!verifier)return send(400,{accepted:false,queued:false,message:'Mode controls are unavailable until the Realm session is ready.'})
        if(!['survival','creative'].includes(data.mode))return send(400,{accepted:false,queued:false,message:'Choose Survival or Creative.'})
        config.requestedGameMode=data.mode
        return send(200,verifier.requestMode(data.mode))
       }
       if(pathname.startsWith('/plans/')){
        const p=connection.survival?.commandPlans;if(!p)return send(400,{error:'Plan service unavailable'})
        try{
         let result
         if(pathname==='/plans/prepare')result=p.prepare(data.descriptor)
         else if(pathname==='/plans/select')result={accepted:true,message:'Plan selected.',plans:p.select(data.id)}
         else if(pathname==='/plans/delete')result={accepted:true,message:'Plan deleted.',plans:p.delete(data.id)}
         else if(pathname==='/plans/activate')result=p.activate(data.id)
         else if(pathname==='/plans/activate-queue')result=p.activateQueue()
         else if(pathname==='/plans/retry')result=p.retryBlocked(Number.isSafeInteger(data.id)?data.id:null)
         else return send(404,{error:'Unknown plan action'})
         return send(200,result)
        }catch(e){return send(200,{accepted:false,queued:false,message:e.message,plans:p.snapshot()})}
       }
       if(pathname==='/message'){
         if(typeof data.message!=='string')return send(400,{error:'message must be text'})
         const output=message(data.message)
         log('Text chat: '+output.message.slice(0,120))
         // Valid chat text has been delivered, even if the bot rejects the goal.
         // A 422 used to make the phone mislabel this as a network failure.
         return send(200,output)
       }
       if(typeof data.command!=='string')return send(400,{error:'command must be text'})
       const output=message(data.command)
       log('Local command '+String(data.command).slice(0,100)+': '+output.message)
       return send(200,output)
     }catch{return send(400,{error:'invalid JSON'})}
   }
   send(404,{error:'not found'})
 })
 server.controller=controller
 return server
}
