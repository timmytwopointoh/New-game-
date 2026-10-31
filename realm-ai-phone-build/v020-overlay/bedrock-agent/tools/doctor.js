// Safe local preflight. Never contacts a Realm, modifies a world, or prints secrets.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {validate,readConfig,root} from './config.js'
const require=createRequire(import.meta.url)
let failures=0
function check(ok,label,next=''){
 console.log((ok?'PASS':'NOT READY')+'  '+label+(ok?'':(' — '+next)))
 if(!ok)failures++
}
const major=Number(process.versions.node.split('.')[0]);check(major>=22,'Node.js 22+', 'Install current Node.js LTS')
for(const dep of ['bedrock-protocol','adm-zip']){
 let installed=false
 try{require.resolve(dep);installed=true}catch{}
 check(installed,dep+' dependency','Run Install-Dependencies.bat or npm install')
}
let config=null
try{config=validate(readConfig())}catch(e){check(false,'config.json valid',String(e.message).slice(0,170))}
if(config){
 const m=config.minecraft
 check(m.offline!==true,'Microsoft/Xbox online sign-in mode','A paid Realm requires online auth')
 check(m.mode==='realm','Realm connection selected','Select realm mode in config')
 check(Boolean(m.realmId||m.realmInvite),'Realm reference set','Add a valid invited Realm ID or code')
 check(config.worldBridge.allowWorldEdits===false,'World edits OFF for first join','Turn off edits until after first Realm backup and test')
 console.log('Owner gamertag(s) configured:',config.ownerPlayerNames.length)
 console.log('API uses local loopback port:',config.localAPI.port)
 console.log('Auth cache exists:',fs.existsSync(path.join(root,'private','auth'))?'yes (not verified)':'not yet (sign in once)')
}
console.log('No network access or Minecraft connection attempted. No invite/token displayed.')
if(failures)process.exitCode=1
