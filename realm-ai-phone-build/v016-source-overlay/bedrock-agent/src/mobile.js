// Android phone-hosted entry point: everything runs locally in the APK's own process.
// No PC and no public API endpoint are required.
import {readConfig,validate} from '../tools/config.js'
import {Connection} from './connection.js'
import {createApi} from './api.js'
import {RealmChat} from './realm-chat.js'
import fs from 'node:fs'
import path from 'node:path'
import {root} from '../tools/config.js'
const log=(msg)=>console.log('[VEILFORGE Mobile] '+String(msg).replace(/[\r\n]/g,' ').slice(0,220))
let config
try{config=validate(readConfig())}catch(e){console.error('Setup required: '+e.message);process.exitCode=1;throw e}
if(config.minecraft.mode!=='realm'||config.minecraft.offline)throw new Error('Mobile Realm AI requires authenticated Bedrock Realms')
const bot=new Connection(config,log)
const app=createApi(config,bot,log)
const controller=new RealmChat(bot,app.controller,config,log)
app.on('error',e=>{log('Local server failed: '+e.message);bot.close()})
app.listen(config.localAPI.port,'127.0.0.1',()=>{
  log('Device-only controller started. The Microsoft sign-in code is shown inside the app if needed.')
  try{bot.start()}catch(e){bot.lastError=String(e.message||e);log('Realm client start failed: '+bot.lastError)}
})
function shutdown(){controller.stop();bot.close();app.close()}
process.on('SIGTERM',shutdown)
process.on('SIGINT',shutdown)
