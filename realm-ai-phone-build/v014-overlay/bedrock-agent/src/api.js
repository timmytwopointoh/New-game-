import {commandCatalog,parseDescriptor,formOptions} from './survival/command-plans.js'
import {understandCommand} from './survival/language.js'
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
 const message=raw=>{
   const command=understandCommand(raw)||String(raw||'').trim()
   if(/^(?:stop|stop everything|cancel|cancel job|cancel plan|abort|abort mission|stop following|stop mining|stop walking)$/i.test(command)){
     planner.cancel();connection.survival?.commandPlans?.interrupt('Stopped by owner.')
     const result=connection.survival?.handle('stop')
     return result?{...result,plans:connection.survival?.commandPlans?.snapshot()}:{accepted:true,queued:false,message:'Stopped.'}
   }
   if(command==='hello')return {accepted:true,queued:false,message:'Hello! I am your Realm AI player. Use Commands, or say a safe instruction.'}
   const plans=connection.survival?.commandPlans
   // Keep the original standalone planner / optional world-bridge behavior available
   // for older clients that have not attached the authenticated survival controller.
   if(!plans)return planner.handle(raw)||(planner.snapshot().state==='running'?{accepted:true,queued:false,message:'A plan is running; cancel it first.'}:chatDispatch(raw,connection))
   try{
    if(/^(?:run queue|start plan|start queue|run all plans)$/i.test(command))return plans.startAll()
    if(/^(?:saved plans|show queue|queue status)$/i.test(command))return {accepted:true,queued:false,message:'Saved command queue (first to last).',plans:plans.snapshot()}
    const descriptor=parseDescriptor(command)
    return plans.prepare(descriptor)
   }catch(e){return {accepted:false,queued:false,message:e.message,plans:plans.snapshot()}}
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
   if(req.method==='GET'&&pathname==='/plans/saved-queues'){
     try{return send(200,{queues:connection.survival?.commandPlans.otherSavedQueues()||[]})}
     catch(e){return send(200,{queues:[],error:String(e.message||e)})}
   }
   if(req.method==='GET'&&pathname==='/planner')return send(200,{planner:planner.snapshot()})
   if(req.method==='GET'&&pathname==='/updates'){
     const n=Number(new URL(req.url,'http://127.0.0.1').searchParams.get('after')||0)
     if(!Number.isSafeInteger(n)||n<0)return send(400,{error:'invalid cursor'})
     return send(200,{...connection.status(),planner:planner.snapshot(),updates:(connection.events||[]).filter(e=>e.id>n).slice(-32),cursor:connection.nextEventId||0})
   }
   if(req.method==='POST'&&(pathname==='/command'||pathname==='/message'||pathname.startsWith('/plans/'))){
     let body=''
     try{
       for await(const part of req){body+=part.toString('utf8');if(Buffer.byteLength(body)>2048)return send(413,{error:'request too long'})}
       const data=JSON.parse(body)
       if(Number.isSafeInteger(data.epoch)&&data.epoch<stopEpoch)return send(200,{accepted:false,queued:false,message:'Discarded command queued before Stop.'})
       if(pathname.startsWith('/plans/')){
        const p=connection.survival?.commandPlans;if(!p)return send(400,{error:'Plan service unavailable'})
        try{
         let result
         if(pathname==='/plans/prepare')result=p.prepare(data.descriptor)
         else if(pathname==='/plans/move')result={accepted:true,message:'Command moved.',plans:p.move(data.id,data.direction)}
         else if(pathname==='/plans/delete')result={accepted:true,message:'Command deleted.',plans:p.delete(data.id)}
         else if(pathname==='/plans/clear')result=p.clearAll()
         else if(pathname==='/plans/delete-saved-queue')result=p.deleteSavedQueue(data.id)
         else if(pathname==='/plans/run-all'||pathname==='/plans/activate')result=p.startAll()
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
