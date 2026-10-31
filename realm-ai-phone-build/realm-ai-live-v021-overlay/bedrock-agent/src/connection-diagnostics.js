export function classifyConnectionFailure(error,phase){
  const message=String(error?.message||'')
  const value=Number(error?.response?.status??error?.statusCode??error?.status??message.match(/\b(401|403|404|408|429|500|502|503|504)\b/)?.[1]??0)
  const httpStatus=Number.isInteger(value)&&value>=400&&value<=599?value:null
  let category='connection-error',advice='Check the reported stage and try a manual rejoin when ready. Saved authentication is kept.'
  if(httpStatus===403&&phase==='xbox-title-token'){category='access-denied';advice='Xbox rejected the app title-token request before any Realm connection. Saved authentication was kept. Retrying Minecraft movement or changing Realm game mode cannot repair this authorization failure.'}
  else if(httpStatus===403){category='access-denied';advice='The account service or Realms rejected this request. Confirm that the bot account can join this Realm in official Minecraft. This does not prove that a new login is needed; no cached session was deleted.'}
  else if(httpStatus===401){category='authentication-rejected';advice='Authentication was rejected. Use a Microsoft device code only if the service requests one. Saved authentication is kept.'}
  else if(httpStatus===429){category='rate-limited';advice='The service limited requests. Wait before a manual rejoin; no automatic sign-in loop is started.'}
  else if(httpStatus>=500){category='service-unavailable';advice='The remote service is unavailable. Retry later; saved authentication is kept.'}
  return {phase,httpStatus,category,advice}
}

// Observe existing calls on this session only. No token values, URLs, cache edits,
// changed authentication options, new requests, or automatic retries are introduced.
const failurePhases=new WeakMap()
export const authFailurePhase=error=>error&&typeof error==='object'?failurePhases.get(error):null

// The bundled LiveTokenManager adds OAuth expires_in (seconds) directly to
// obtainedOn (milliseconds). Correct only that read; keep the existing cache,
// refresh token, device-code callback and network flow untouched.
export function correctLiveTokenExpiry(flow,{clock=()=>Date.now()}={}){
  if(flow.options?.flow!=='live'||typeof flow.msa?.cache?.getCached!=='function')return flow
  flow.msa.getAccessToken=async function(){
    const {token}=(await this.cache.getCached())||{}
    if(!token||typeof token.access_token!=='string'||!token.access_token)return undefined
    const obtainedOn=Number(token.obtainedOn),seconds=Number(token.expires_in),now=clock()
    if(!Number.isFinite(obtainedOn)||obtainedOn<0||obtainedOn>now+300000||!Number.isFinite(seconds)||seconds<=0||seconds>7*86400)return undefined
    const until=obtainedOn+seconds*1000-now
    return {valid:until>1000,until,token:token.access_token}
  }
  return flow
}

export function instrumentAuthflow(flow,{getPhase,setPhase,onTitleRecovery=()=>{}}){
  correctLiveTokenExpiry(flow)
  const wrap=(owner,name,phase)=>{
    if(typeof owner?.[name]!=='function')return
    const original=owner[name]
    owner[name]=async function(...args){
      const previous=getPhase();setPhase(phase)
      try{const result=await original.apply(this,args);setPhase(previous);return result}
      catch(error){if(error&&typeof error==='object'&&!failurePhases.has(error))failurePhases.set(error,phase);throw error}
    }
  }
  for(const [name,phase] of [['getMsaToken','microsoft-session'],['getXboxToken','xbox-authentication'],['getMinecraftBedrockToken','minecraft-authentication']])wrap(flow,name,phase)
  for(const [name,phase] of [['getUserToken','xbox-user-token'],['getDeviceToken','xbox-device-token'],['getTitleToken','xbox-title-token'],['getXSTSToken','xbox-security-token'],['doSisuAuth','xbox-sisu-authentication']])wrap(flow.xbl,name,phase)
  wrap(flow.msa,'authDeviceCode','microsoft-device-code')
  wrap(flow.msa,'refreshTokens','microsoft-token-refresh')
  // Some mobile app titles reject the legacy title endpoint. Try the library's
  // supported Sisu exchange ONCE, only for that precise 403, with the current
  // valid MSA token and a device proof bound to this session's key. No re-login,
  // platform change, token-cache deletion, or catch-all retry is introduced.
  if(flow.options?.deviceType==='Android'&&flow.options?.authTitle==='0000000048183522'&&typeof flow.getXboxToken==='function'&&typeof flow.xbl?.doSisuAuth==='function'&&typeof flow.xbl?.getDeviceToken==='function'){
    const getXboxToken=flow.getXboxToken;let attempted=false
    flow.getXboxToken=async function(...args){
      const previous=getPhase()
      try{return await getXboxToken.apply(this,args)}catch(error){
        if(attempted||this.options?.flow!=='live'||this.options?.deviceType!=='Android'||this.options?.authTitle!=='0000000048183522'||authFailurePhase(error)!=='xbox-title-token'||classifyConnectionFailure(error,'xbox-title-token').httpStatus!==403)throw error
        let cached;try{cached=await this.msa?.getAccessToken()}catch{throw error}
        if(!cached?.valid||typeof cached.token!=='string'||!cached.token)throw error
        attempted=true;onTitleRecovery();setPhase('xbox-sisu-authentication')
        const options={...this.options,relyingParty:args[0]||this.options.relyingParty||'http://xboxlive.com'}
        const device=await this.xbl.getDeviceToken(options)
        const result=await this.xbl.doSisuAuth(cached.token,device,options)
        setPhase(previous);return result
      }
    }
  }
  return flow
}
