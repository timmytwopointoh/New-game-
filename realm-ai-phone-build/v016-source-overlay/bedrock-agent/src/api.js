import {commandCatalog,parseDescriptor,formOptions} from './survival/command-plans.js'
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
   if(/^(?:stop|stop everything|cancel|cancel job|cancel plan|abort|abort mission|stop following|stop mining|stop walking)$/i.test(String(raw).trim())){
     planner.cancel();const result=connection.survival?.handle('stop');return result?{...result,plans:connection.survival?.commandPlans?.snapshot()}: {accepted:true,queued:false,message:'Stopped.'}
   }
   let output
   if(connection.survival?.commandPlans){
    const plans=connection.survival.commandPlans
    try{
     const text=String(raw).trim();let m
     if((m=text.match(/^select plan (\d+)$/i)))output={accepted:true,message:'Selected plan '+m[1]+'.',plans:plans.select(Number(m[1]))}
     else if(/^(activate selected plan|start plan)$/i.test(text))output=plans.activate(plans.selected)
     else if(text==='saved plans')output={accepted:true,message:'Saved plan cards.',plans:plans.snapshot()}
     else output=plans.prepare(parseDescriptor(raw))
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
