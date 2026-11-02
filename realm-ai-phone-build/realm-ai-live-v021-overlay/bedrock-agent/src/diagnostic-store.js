import fs from 'node:fs'
import {readPrivateJson,writePrivateJson} from './survival/private-json.js'
import {classifyConnectionFailure} from './connection-diagnostics.js'

const phases=new Set('starting realm-discovery minecraft-authentication microsoft-device-code microsoft-token-refresh microsoft-session xbox-authentication xbox-user-token xbox-device-token xbox-title-token xbox-security-token xbox-sisu-authentication sign-in-required realm-selecting realm-selected realm-join-retry authenticated transport-connected bedrock-login-accepted minecraft-login-ok world-started spawned error disconnected connecting closed not-started unavailable unknown not-reached negotiating-packs pack-request pack-storage pack-retry downloading-packs pack-cached packs-ready pack-error'.split(' '))
const phase=value=>phases.has(value)?value:'unknown'
const number=value=>Number.isSafeInteger(value)&&value>=0?value:0
function failure(value){
  if(!value||typeof value!=='object')return null
  const status=Number.isInteger(value.httpStatus)&&value.httpStatus>=400&&value.httpStatus<=599?value.httpStatus:null
  return {...classifyConnectionFailure({statusCode:status||0},phase(value.phase)),recordedAt:number(value.recordedAt)}
}

// Deliberately ignore raw errors, account names, URLs, device codes and tokens.
export function sanitizeDiagnosticReport(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))input={}
  const report={schema:1,phase:phase(input.phase),authState:phase(input.authState),recordedAt:number(input.recordedAt),savedAuthentication:'kept'}
  for(const name of ['connected','joined','spawned','deviceCodePending','titleTokenRecoveryAttempted'])report[name]=input[name]===true
  report.packStage=phase(input.packStage)
  report.packReason=['none','storage-low','storage-unknown','pack-size-limit','cdn-access-denied','cdn-missing','cdn-unavailable','network-interrupted','pack-integrity','pack-transfer-failed','server-no-pack-data','server-pack-stalled'].includes(input.packReason)?input.packReason:'none'
  report.packFreeMB=number(input.packFreeMB);report.packNeededMB=number(input.packNeededMB);report.packRetryable=input.packRetryable===true
  report.packCacheStatusIssued=input.packCacheStatusIssued===true;report.packDownloadRequestIssued=input.packDownloadRequestIssued===true
  for(const name of ['packResponseCount','packServerCount','packCdnCount'])report[name]=number(input[name])
  for(const name of ['packHeaders','packChunks'])report[name]=number(input[name])
  report.failure=failure(input.failure);report.lastFailure=failure(input.lastFailure)
  report.processState=['running','stopped','crashed'].includes(input.processState)?input.processState:'unknown'
  const identity=input.clientIdentity
  if(identity?.flow==='live'&&((identity.platform==='Android'&&identity.deviceOS===1)||(identity.platform==='Nintendo'&&identity.deviceOS===12)))report.clientIdentity={platform:identity.platform,deviceOS:identity.deviceOS,flow:'live',accessTokenExpiryUnits:'seconds'}
  return report
}

export function createDiagnosticRecorder(file,{clock=()=>Date.now()}={}){
  let previous=null,fingerprint=''
  if(fs.existsSync(file))try{previous=sanitizeDiagnosticReport(readPrivateJson(file,32768))}catch{}
  return input=>{
    const report=sanitizeDiagnosticReport(input),current=JSON.stringify(report)
    if(current===fingerprint)return true
    report.recordedAt=clock()
    report.lastFailure=report.failure?{...report.failure,recordedAt:report.recordedAt}:previous?.lastFailure||previous?.failure||null
    try{writePrivateJson(file,report);previous=report;fingerprint=current;return true}catch{return false}
  }
}
