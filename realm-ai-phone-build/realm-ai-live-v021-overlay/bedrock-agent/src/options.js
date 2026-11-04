import path from 'node:path'
export function buildClientOptions(m,projectRoot,onMsaCode){
 // Restore the requested Nintendo Switch login identity. Keep its tokens separate
 // from the preserved Android cache; future Switch updates reuse this folder.
 const options={username:m.username,offline:m.offline===true,profilesFolder:path.join(projectRoot,'private','auth','switch'),onMsaCode,
  authTitle:'00000000441cc96b',deviceType:'Nintendo',deviceOS:12,flow:'live',
  skinData:{CurrentInputMode:2,DefaultInputMode:2},
  raknetBackend:'jsp-raknet'}
 if(m.mode==='realm'){
   // Realms lookup handles host/port and negotiated transport; never try direct IP here.
   if(m.realmId)options.realms={realmId:String(m.realmId)}
   else if(m.realmInvite && !String(m.realmInvite).startsWith('SET_'))options.realms={realmInvite:String(m.realmInvite)}
   else options.realms={pickRealm:realms=>selectJoinedRealm(realms,m.realmName)}
 }else{options.host=m.host;options.port=m.port}
 if(m.version)options.version=m.version
 return options
}

// Never silently select the first Realm when the same Xbox account belongs to many.
export function selectJoinedRealm(realms,name=''){
  if(!Array.isArray(realms)||realms.length===0)throw new Error('The bot account does not have any joined Realms. Sign in with the invited Xbox account.')
  const requested=String(name||'').trim().toLowerCase()
  if(requested){
    const matches=realms.filter(r=>String(r.name||'').trim().toLowerCase()===requested)
    if(matches.length===1)return matches[0]
    if(matches.length>1)throw new Error('Multiple joined Realms share that name. Specify a Realm ID.')
    throw new Error('No joined Realm named '+JSON.stringify(name)+'. Available: '+realms.map(r=>String(r.name||'(unnamed)')).slice(0,8).join(', '))
  }
  if(realms.length===1)return realms[0]
  throw new Error('More than one joined Realm is available: '+realms.map(r=>String(r.name||'(unnamed)')).slice(0,8).join(', ')+'. Set the exact Realm name or ID in the app.')
}

/**
 * Privacy-safe Realm discovery evidence. Counts only; no Realm names, join IDs,
 * account details or invites leave the Android application.
 * "My World" may be a world name inside a differently named Realm.
 */
export function summarizeJoinedRealmMatches(realms, requestedName=''){
 const list=Array.isArray(realms)?realms:[]
 const name=String(requestedName||'').trim().toLocaleLowerCase('en-US')
 const lower=r=>String(r?.name||'').trim().toLocaleLowerCase('en-US')
 const exact=name?list.filter(r=>lower(r)===name).length:0
 const petal=list.filter(r=>/petalwimds|petalwinds/.test(lower(r))).length
 return {
  joinedRealmsCount:Math.min(100,list.length),
  exactNameMatches:Math.min(100,exact),
  petalNameCandidates:Math.min(100,petal),
  configuredNamePresent:name.length>0
 }
}
