import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
export function readConfig(){
 const p=path.join(root,'config.json')
 if(!fs.existsSync(p)) throw new Error('Run npm run setup first and edit config.json')
 return JSON.parse(fs.readFileSync(p,'utf8'))
}
export function validate(c){
 const m=c.minecraft||{}, a=c.localAPI||{}
 if(!['realm','server'].includes(m.mode))throw new Error('minecraft.mode must be realm or server')
 if(m.mode==='server'&&(!m.host||m.host.includes('SET_')||!Number.isInteger(m.port)||m.port<1||m.port>65535))throw new Error('Set minecraft.host and a valid Bedrock port (usually 19132)')
 if(m.mode==='realm'){
   if(m.offline)throw new Error('Realms require online Microsoft/Xbox sign-in')
   const invite=String(m.realmInvite||'').trim(),id=String(m.realmId||'').trim(),name=String(m.realmName||'').trim()
   // An already-invited account can discover its joined Realms without an invite code.
   // Reject ambiguity later rather than joining a random user's Realm.
   if(invite.length>200||id.length>100||name.length>100)throw new Error('Realm selector is unexpectedly long')
 }
 if(!m.username||m.username.length>100)throw new Error('Set minecraft.username (the Microsoft account cache name)')
 if(!m.botPlayerName||m.botPlayerName.startsWith('SET_'))throw new Error('Set minecraft.botPlayerName to exact signed-in Xbox gamertag')
 if(!Array.isArray(c.ownerPlayerNames)||!c.ownerPlayerNames.length||c.ownerPlayerNames.some(x=>!x||x.startsWith('SET_')||x.length>60)) throw new Error('Set exact ownerPlayerNames in config.json')
 if(c.ownerPlayerNames.some(x=>x.toLowerCase()===m.botPlayerName.toLowerCase()))throw new Error('Bot account and owner must be different players')
 if(!Number.isInteger(a.port)||a.port<1024||a.port>65535||!(/^[0-9a-f]{64}$/).test(a.token||''))throw new Error('Invalid local API port/token: regenerate with setup')
 if(c.worldBridge?.allowWorldEdits!==true&&c.worldBridge?.allowWorldEdits!==false)throw new Error('worldBridge.allowWorldEdits must be true or false')
 return c
}
