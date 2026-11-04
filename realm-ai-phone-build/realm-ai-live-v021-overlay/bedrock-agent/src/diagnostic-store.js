import fs from 'node:fs'
import {readPrivateJson,writePrivateJson} from './survival/private-json.js'
import {classifyConnectionFailure} from './connection-diagnostics.js'

const phases=new Set('starting realm-discovery minecraft-authentication microsoft-device-code microsoft-token-refresh microsoft-session xbox-authentication xbox-user-token xbox-device-token xbox-title-token xbox-security-token xbox-sisu-authentication sign-in-required realm-selecting realm-selected realm-join-retry authenticated transport-connected bedrock-login-accepted minecraft-login-ok world-started spawned error disconnected connecting closed not-started unavailable unknown not-reached negotiating-packs pack-request packs-none pack-storage pack-retry downloading-packs pack-cached packs-ready pack-error'.split(' '))
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
  report.packCacheStatusIssued=input.packCacheStatusIssued===true;report.packDownloadRequestIssued=input.packDownloadRequestIssued===true;report.packInfoReceived=input.packInfoReceived===true;report.packStackReceived=input.packStackReceived===true;report.packNoPackDirectStack=input.packNoPackDirectStack===true
  for(const name of ['packResponseCount','packServerCount','packCdnCount','packAdvertisedCount','packVerifiedCacheCount','packMissingCount','packSkippedOptional','packLegacyBehaviorCount','packWireCode','packWireBytes','packWireIds','packResourceClassifiedCount','packBehaviorClassifiedCount','packAddonClassifiedCount','packHeadersSeenByHandler','packChunksSeenByHandler'])report[name]=number(input[name])
  report.packWireEncoded=input.packWireEncoded===true;report.packWireVerified=input.packWireVerified===true;report.packTransportConnectedAtRequest=input.packTransportConnectedAtRequest===true
  for(const name of ['transportReliableWrites','transportReliableWritesOpen','transportReliableWritesClosed','transportReliableAfterPackRequest','transportPackReliableSubmissions','transportPackReliableErrors','transportClosedAfterRequestSeconds','packServerWaitSeconds'])report[name]=number(input[name])
  for(const name of ['transportJoinObserved','transportObservedPackRequest','transportPackRequestOpen','transportClosed'])report[name]=input[name]===true
  report.transportCloseKind=['none','server-disconnect','protocol-error','transport-close','transport-end'].includes(input.transportCloseKind)?input.transportCloseKind:'unknown'
  report.transportCloseCode=number(input.transportCloseCode)
  report.transportCloseOrigin=['unknown','remote-transport','server-kick','client-disconnect','local-client-close','network-error','app-stop'].includes(input.transportCloseOrigin)?input.transportCloseOrigin:'unknown'
  report.transportCloseLabel=['unobserved','remote-disconnect-notice','raknet-connection-lost','connection-banned','protocol-incompatible','unknown-code'].includes(input.transportCloseLabel)?input.transportCloseLabel:'unknown-code'
  report.transportAckObservable=input.transportAckObservable===true;report.packWaitingForServer=input.packWaitingForServer===true
  report.packWireVersion=['1.26.60','1.26.51','1.26.50'].includes(input.packWireVersion)?input.packWireVersion:'unknown'
  report.packWireMode=['original-working','modern-1-to-4','unchanged-version'].includes(input.packWireMode)?input.packWireMode:'unknown'
  report.packWireText=['cancel','downloading','downloadingfinished','resourcepackstackfinished','Cancel','Downloading','DownloadingFinished','ResourcePackStackFinished'].includes(input.packWireText)?input.packWireText:'unknown'
  report.packSelectionPolicy=['all-advertised','addon-required','server-required-fallback'].includes(input.packSelectionPolicy)?input.packSelectionPolicy:'unknown'
  report.packHandshakeMode=['original-working','native-queue','no-cache-status','cache-first'].includes(input.packHandshakeMode)?input.packHandshakeMode:'unknown'
  for(const name of ['packHeaders','packChunks'])report[name]=number(input[name])
  for(const name of ['loadingElapsedSeconds','loadingNoProgressSeconds','loadingUniqueSignals','loadingRepeatedSignals','loadingReceivedBytes','loadingGraceSeconds','loadingRecoveryAttempts','loadingNextRetrySeconds'])report[name]=number(input[name])
  report.loadingActive=input.loadingActive===true;report.loadingRecoveryScheduled=input.loadingRecoveryScheduled===true
  report.loadingStage=['connecting','pack-request','pack-storage','pack-retry','downloading-packs','pack-cached','packs-ready','world-started','world-data','bedrock-login-accepted'].includes(input.loadingStage)?input.loadingStage:'unknown'
  report.loadingLastSignal=['none','resource_packs_info','resource_pack_data_info','resource_pack_chunk_data','resource_pack_stack','start_game','level_chunk','sub_chunk','play_status'].includes(input.loadingLastSignal)?input.loadingLastSignal:'none'
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
