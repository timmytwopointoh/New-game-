// Small, opt-in Realms join REST compatibility shim.
//
// bedrock-protocol@3.61.0 reads Realms via RealmAPI.from() but does not call
// onRealmJoinRetry. prismarine-realms performs internal bounded 5xx retries;
// this adds only ONE further attempt for HTTP 503 *after* those are exhausted.
// It never retries login, Xbox token acquisition, /worlds list, 401/403, or
// any resource-pack request. Existing API clients remain unchanged.
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const bedrockRequire=createRequire(require.resolve('bedrock-protocol/src/client/auth.js'))
const {RealmAPI}=bedrockRequire('prismarine-realms')
const registered=new WeakMap()
let patched=false

export function isRealmJoin503(e) {
  const status=Number(e?.status??e?.statusCode??e?.response?.status)
  return status===503 || (Number.isNaN(status) && /^503(?:\s|$)/.test(String(e?.message||'')))
}

export function wrapRealmJoinRest(rest,{onRetry=()=>{},isActive=()=>true,delayMs=15000,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(!rest||typeof rest.get!=='function')throw Error('Realms REST get unavailable')
 if(!Number.isSafeInteger(delayMs)||delayMs<0||delayMs>60000)throw Error('Invalid bounded Realm retry delay')
 const original=rest.get
 rest.get=async function(route,...args){
  if(typeof route!=='string'||!/^\/worlds\/[0-9]+\/join$/.test(route))
    return original.call(this,route,...args)
  try{return await original.call(this,route,...args)}
  catch(error){
    if(!isRealmJoin503(error)||!isActive())throw error
    onRetry({attempt:1,totalAttempts:2,delayMs})
    await sleep(delayMs)
    if(!isActive())throw error
    return original.call(this,route,...args)
  }
 }
 return rest
}

export function installRealmJoinRetryCompat(authflow,{onRetry,isActive,delayMs=15000}={}){
 if(!authflow||typeof authflow!=='object')throw Error('Missing authenticated Realm session object')
 registered.set(authflow,{onRetry,isActive,delayMs})
 if(patched)return
 const from=RealmAPI.from
 if(typeof from!=='function')throw Error('Realms API factory missing')
 RealmAPI.from=function(auth,platform,...args){
  const api=from.call(this,auth,platform,...args)
  const config=registered.get(auth)
  if(config&&platform==='bedrock'&&api?.rest)
    wrapRealmJoinRest(api.rest,config)
  return api
 }
 patched=true
}
