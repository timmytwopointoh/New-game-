import readline from 'node:readline'
import {readConfig,validate} from '../tools/config.js'
import {Connection} from './connection.js'
import {createApi,dispatch} from './api.js'
import {RealmChat} from './realm-chat.js'
const log=msg=>console.log(`[${new Date().toISOString()}] ${msg}`)
let config
try{config=validate(readConfig())}catch(err){console.error('Setup required: '+err.message);process.exit(1)}
if(config.minecraft.offline) log('WARNING: offline account names are spoofable. Only use with private/offline test servers.')
const client=new Connection(config,log)
const server=createApi(config,client,log)
const realmChat=new RealmChat(client,server.controller,config,log)
server.on('error',e=>{console.error('Local API failed:',e.message);process.exitCode=1;client.close()})
server.listen(config.localAPI.port,'127.0.0.1',()=>{
 log(`Loopback VEILFORGE API listening on 127.0.0.1:${config.localAPI.port} (bearer token required)`)
 log('No Minecraft cheats or world edits are sent unless you command them and the world pack permits them.')
 client.start()
})
if(process.stdin.isTTY){
 const rl=readline.createInterface({input:process.stdin,output:process.stdout})
 rl.on('line',s=>{if(s.trim().toLowerCase()==='exit'){shutdown();return} const result=dispatch(s,client);log(result.message)})
}
function shutdown(){realmChat.stop();client.close();server.close(()=>process.exit(0))}
process.on('SIGINT',shutdown)
process.on('SIGTERM',shutdown)
