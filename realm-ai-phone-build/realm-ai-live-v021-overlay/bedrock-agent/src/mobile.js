// Android phone-hosted entry point: everything runs locally in the APK's own process.
// No PC and no public API endpoint are required.
import {readConfig,validate} from '../tools/config.js'
import {Connection} from './connection.js'
import {createApi} from './api.js'
import {RealmChat} from './realm-chat.js'
import {RuntimeTrace} from './runtime-trace.js'
import {LiveFollowPatchStream} from './live-follow-patches.js'
import {createDiagnosticRecorder} from './diagnostic-store.js'
import {classifyConnectionFailure} from './connection-diagnostics.js'
import fs from 'node:fs'
import path from 'node:path'
import {root} from '../tools/config.js'
const log=(msg)=>console.log('[VEILFORGE Mobile] '+String(msg).replace(/[\r\n]/g,' ').slice(0,220))
let config
try{config=validate(readConfig())}catch(e){console.error('Setup required: '+e.message);process.exitCode=1;throw e}
if(config.minecraft.mode!=='realm'||config.minecraft.offline)throw new Error('Mobile Realm AI requires authenticated Bedrock Realms')
const bot=new Connection(config,log)
// Signed policy updates tune only the already-running navigation code.
// They never call reconnect, replace source modules, install APKs or upload logs.
const followPatchStream=new LiveFollowPatchStream(bot.survival.navigation,{
 file:path.join(root,'private','live-follow','signed-policy.json'),
 report:message=>bot.survival.report(message)
})
bot.liveFollowPatches=followPatchStream
followPatchStream.start()
bot.trace=new RuntimeTrace(path.join(root,'private','diagnostics','runtime.json'))
const saveDiagnostic=createDiagnosticRecorder(path.join(root,'private','diagnostics','connection.json'))
const save=()=>{saveDiagnostic({...bot.diagnostics(),processState:'running'});bot.trace.capture(bot)}
bot.on('connection-diagnostics',save)
bot.on('survival-update',()=>{bot.trace.capture(bot,true);bot.trace.flush()})
const diagnosticTimer=setInterval(save,1000);diagnosticTimer.unref()
process.on('exit',()=>{saveDiagnostic({...bot.diagnostics(),processState:'stopped'});bot.trace.record('process_exit');bot.trace.flush()})
process.on('uncaughtExceptionMonitor',error=>{saveDiagnostic({...bot.diagnostics(),processState:'crashed',failure:bot.lastFailure||classifyConnectionFailure(error,bot.lastPhase)});bot.trace.error(error)})
const app=createApi(config,bot,log)
const controller=new RealmChat(bot,app.controller,config,log)
app.on('error',e=>{saveDiagnostic({...bot.diagnostics(),failure:classifyConnectionFailure(e,bot.lastPhase)});log('Local server failed: '+e.message);bot.close()})
app.listen(config.localAPI.port,'127.0.0.1',()=>{
  log('Device-only controller started. The Microsoft sign-in code is shown inside the app if needed.')
  try{bot.start();save()}catch(e){bot.lastError=String(e.message||e);bot.lastFailure=classifyConnectionFailure(e,bot.lastPhase);save();log('Realm client start failed: '+bot.lastError)}
})
function shutdown(){followPatchStream.stop();clearInterval(diagnosticTimer);save();app.controller?.brain?.stop();controller.stop();bot.close();app.close()}
process.on('SIGTERM',shutdown)
process.on('SIGINT',shutdown)
