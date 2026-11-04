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
   else options.realms={pickRealm:realms=>selectJoinedRealm(realms,m.realmName,m.realmOwner||'')}
 }else{options.host=m.host;options.port=m.port}
 if(m.version)options.version=m.version
 return options
}

// Never choose a Realm owned by another account when duplicate display names occur.
export function selectJoinedRealm(realms,name='',owner=''){
  if(!Array.isArray(realms)||realms.length===0)throw new Error('No joined Realms returned by Minecraft; check saved Xbox session or invitation.')
  const wantedName=String(name||'').trim().toLowerCase()
  const wantedOwner=String(owner||'').trim().toLowerCase()
  if(realms.length===1){
    const only=realms[0]
    return only
  }
  const byOwner=wantedOwner?realms.filter(r=>String(r.owner||r.ownerName||r.ownerGamertag||'').trim().toLowerCase()===wantedOwner):[]
  // One owner match is conclusive for this single-owner bot even when a Realm was renamed.
  if(byOwner.length===1)return byOwner[0]
  const named=wantedName?realms.filter(r=>String(r.name||'').trim().toLowerCase()===wantedName):realms
  if(named.length===1){
    // Realm.owner is API metadata, not guaranteed to equal the owner's Xbox gamertag.
    return named[0]
  }
  const ownerNamed=byOwner.filter(r=>!wantedName||String(r.name||'').trim().toLowerCase()===wantedName)
  if(ownerNamed.length===1)return ownerNamed[0]
  const eligible=(ownerNamed.length?ownerNamed:named).filter(r=>
    String(r.state||'').toUpperCase()==='OPEN'&&r.expired!==true)
  if(eligible.length===1)return eligible[0]
  // Do not silently join an unrelated Realm: a bad selection might expose game activity.
  if(named.length>1)throw new Error(wantedName?'Duplicate Realm names; owner and open-state filters did not uniquely identify the requested Realm.':'More than one joined Realm is available; configure the owner or exact name.')
  throw new Error('No Realm matched the configured owner/name. Verify the invited bot account.')
}
