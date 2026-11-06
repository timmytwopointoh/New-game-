// Shared, owner-authorized CHAT -> LIVE ACTION handoff for phone and Realm.
// The phrase must express a direct request. Historical remarks, third-party
// references and online research never call this action path.
// A chat receipt is not proof of Minecraft server movement.
const trim=s=>String(s||'').trim().replace(/[.!?]+$/,'').replace(/\s+/g,' ')
const direct=/^(?:follow me|come (?:over )?(?:to me|here|her)|walk (?:over )?to me|head (?:over )?to me|find me|come find me|get over here|make your way (?:over )?to me|come (?:over )?toward(?:s)? me)$/i
const pref=/^(?:(?:please|hey|hi|hello)[, ]+|(?:can|could|will|would) you(?: please)?\s+|(?:i need|i want|i'd like|i would like) you to\s+|go ahead and\s+)+/i
const validPlayer=s=>/^[a-z0-9_][a-z0-9_ -]{1,30}[a-z0-9_]$/i.test(s)
const states=new Set(['following','walking','waiting-for-player','waiting-for-terrain','waiting-for-readiness','blocked','stopped','arrived-predicted'])
export function classifyOwnerChatAction(raw){
 if(typeof raw!=='string'||raw.length>190||/[\x00-\x1f\x7f]/.test(raw))return null
 const rawTrim=trim(raw)
 const s=trim(rawTrim.replace(pref,''))
 if(direct.test(s))return {type:'follow',normalized:'follow me',source:'explicit-owner-request'}
 const match=s.match(/^follow ([a-z0-9_ -]{3,32})$/i)
 if(match&&validPlayer(match[1]))return {type:'follow',normalized:'follow '+match[1].trim(),source:'explicit-owner-request'}
 return null
}
export function executeOwnerChatAction(raw,survival){
 const action=classifyOwnerChatAction(raw)
 if(!action)return null
 if(!survival||typeof survival.handle!=='function')return {accepted:false,queued:false,
  message:'I am not connected to a game session yet.',action:{type:action.type,state:'not-connected',verifiedMovement:false}}
 const result=survival.handle(action.normalized)||{accepted:false,queued:false,message:'The controller could not start that task.'}
 const nav=survival.navigation
 const state=nav?.pendingFollow?'waiting-for-readiness':
  nav?.job?.kind==='follow'&&states.has(nav.state)?nav.state:
  result.accepted===false?'rejected':'accepted-unverified'
 return {...result,queued:!!nav?.pendingFollow||!!result.queued,
  action:{type:action.type,state,queued:!!nav?.pendingFollow,
   verifiedMovement:false,reasonCode:result.accepted===false?'request-rejected':
    state==='waiting-for-readiness'?'waiting-for-readiness':
    state==='waiting-for-player'?'player-location-pending':
    state==='waiting-for-terrain'?'safe-route-pending':
    state==='walking'?'route-running':'unverified'}}
}
