import {commandCatalog,parseDescriptor,parseCommandRequest,renderDescriptor,formOptions} from './survival/command-plans.js'
import {suggestAction,suggestMaterial,resolveActionTarget} from './survival/command-vocabulary.js'
import {respondToConversation} from './conversation.js'
import http from 'node:http'
import crypto from 'node:crypto'
import {parseCommand} from '../pack-template/scripts/commands.js'
import {interpretMessage} from './chat.js'
import {Planner} from './planner.js'
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
 let pendingInterpretation=null
 const message=raw=>{
   if(/^(?:stop|stop everything|cancel|cancel job|cancel plan|abort|abort mission|stop following|stop mining|stop walking)$/i.test(String(raw).trim().replace(/^command\s+/i,''))){
     planner.cancel();const result=connection.survival?.handle('stop');return result?{...result,plans:connection.survival?.commandPlans?.snapshot()}: {accepted:true,queued:false,message:'Stopped.'}
   }
   let output
   if(connection.survival?.commandPlans){
    const plans=connection.survival.commandPlans
    const vocabulary=connection.survival.commandVocabulary
    try{
     const text=String(raw).trim();let m
     if(pendingInterpretation&&Date.now()-pendingInterpretation.createdAt>60000)pendingInterpretation=null
     const yes=/^(?:yes|yes that's right|yes that is right|correct|that's right|that is right)$/i.test(text),no=/^(?:no|nope|not that|wrong|cancel)$/i.test(text)
     const isChoice=pendingInterpretation?.choices&&( /^[1-4]$/.test(text)||pendingInterpretation.choices.some(x=>x.toLowerCase().replace(/_/g,' ')===text.toLowerCase().trim().replace(/_/g,' ')))
     if(pendingInterpretation&&!yes&&!no&&!/^command\s/i.test(text)&&!isChoice&&!(pendingInterpretation.kind==='unknown-action'&&resolveActionTarget(text)))pendingInterpretation=null
     if((m=text.match(/^command\s+teach\s+(action|material)\s+(.+?)\s*=\s*(.+)$/i))){pendingInterpretation=null;const unquote=x=>x.trim().replace(/^["“](.*)["”]$/,'$1');output=vocabulary.teach(m[1].toLowerCase(),unquote(m[2]),unquote(m[3]))}
     else if(/^command\s+vocabulary$/i.test(text)){const v=vocabulary.list();output={accepted:true,queued:false,message:`Learned action words: ${Object.keys(v.actions).join(', ')||'none'}. Learned material words: ${Object.keys(v.materials).join(', ')||'none'}. Teach one with “command teach action <word> = dig” or “command teach material <word> = stone”.`,vocabulary:v}}
     else if(pendingInterpretation?.kind==='unknown-action'){
      const target=resolveActionTarget(text)
      if(target){const pending=pendingInterpretation;pendingInterpretation=null;try{vocabulary.teach('action',pending.word,target);const intent=parseCommandRequest(vocabulary.expand(pending.input).text);output=intent.clarification?{accepted:false,queued:false,message:intent.clarification,plans:plans.snapshot()}:plans.prepare(intent.descriptor)}catch(e){output={accepted:false,queued:false,showCatalog:true,message:e.message+' The correction was learned; nothing was activated.',plans:plans.snapshot()}}}
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
     }else{
      const candidate=text.replace(/[.!?]+$/,'').trim();let descriptor=null
      try{descriptor=parseDescriptor(candidate)}catch{}
      const safeQuestion=descriptor&&['status','movement','look','inventory','help','plan_status','find','materials','about','recipe','route'].includes(descriptor.id)
      if(safeQuestion)output=connection.survival.handle(renderDescriptor(descriptor))
      else{const reply=respondToConversation(text);let conversational=null;try{conversational=parseDescriptor(reply)}catch{}if(conversational&&['status','movement','inventory','about','recipe'].includes(conversational.id))output=connection.survival.handle(renderDescriptor(conversational));else output={accepted:true,queued:false,message:reply,plans:plans.snapshot()}}
     }
    }catch(e){output={accepted:false,queued:false,message:e.message,plans:plans.snapshot()}}
   }else output=planner.handle(raw)||(planner.snapshot().state==='running'?{accepted:true,queued:false,message:'A plan is running; cancel it first.'}:chatDispatch(raw,connection))
   return output
 }
 const controller={planner,message}
 let stopEpoch=0
 const token=config.localAPI.token
 const server=http.createServer(async(req,res)=>{
   const send=(status,obj)=>{
     res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'})
     res.end(JSON.stringify(obj))
   }
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return send(403,{error:'local connections only'})
   const header=String(req.headers.authorization||'')
   if(!authorized(header.replace(/^Bearer\s+/i,''),token))return send(401,{error:'invalid token'})
   const pathname=new URL(req.url||'/','http://127.0.0.1').pathname
   if(req.method==='POST'&&pathname==='/stop'){const epoch=Number(new URL(req.url,'http://127.0.0.1').searchParams.get('epoch'));if(Number.isSafeInteger(epoch)&&epoch>stopEpoch)stopEpoch=epoch;return send(200,message('stop'))}
   if(req.method==='GET'&&pathname==='/status')return send(200,{...connection.status(),planner:planner.snapshot()})
   if(req.method==='GET'&&pathname==='/catalog')return send(200,{catalog:commandCatalog,options:connection.survival?{...formOptions(connection.survival.world,new URL(req.url,'http://127.0.0.1').searchParams.get('q')||''),owners:config.ownerPlayerNames||[]}:null})
   if(req.method==='GET'&&pathname==='/plans')return send(200,{plans:connection.survival?.commandPlans.snapshot()})
   if(req.method==='GET'&&pathname==='/planner')return send(200,{planner:planner.snapshot()})
   if(req.method==='GET'&&pathname==='/updates'){
     const n=Number(new URL(req.url,'http://127.0.0.1').searchParams.get('after')||0)
     if(!Number.isSafeInteger(n)||n<0)return send(400,{error:'invalid cursor'})
     return send(200,{...connection.status(),planner:planner.snapshot(),updates:(connection.events||[]).filter(e=>e.id>n).slice(-32),cursor:connection.nextEventId||0})
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
