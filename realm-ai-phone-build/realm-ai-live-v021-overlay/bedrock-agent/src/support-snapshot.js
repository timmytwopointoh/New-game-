// Fixed, bounded, read-only support snapshot for the Android one-ZIP exporter.
// Never include chat, account/profile identifiers, tokens, raw errors, URLs,
// saved command text, word definitions, pack IDs or Realm configuration.
import {sanitizeDiagnosticReport} from './diagnostic-store.js'
const int=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,1e9):0
const num=n=>typeof n==='number'&&Number.isFinite(n)?Math.round(n*100)/100:null
const choice=(v,list)=>list.includes(v)?v:'unknown'
const stageList=['starting','realm-discovery','minecraft-authentication','transport-connected','bedrock-login-accepted','negotiating-packs','pack-request','pack-storage','pack-retry','downloading-packs','pack-cached','packs-ready','pack-error','world-started','world-data','spawned','error','disconnected']
const phase=s=>choice(s,stageList)
const stateList=['idle','walking','following','waiting-for-player','waiting-for-terrain','waiting-for-position','blocked','jumping','stepping-down','mining','mining-obstacle','building','confirmed','cancelled','interrupted','approaching','stopped']
const jobList=['idle','solo','follow','mine','build','collect','craft','explore']
export function makeSupportSnapshot(connection,now=()=>Date.now()){
 const base=connection?.diagnostics?.()||{}
 const d=sanitizeDiagnosticReport(base)
 const survival=connection?.survival
 const plan=survival?.commandPlans
 const nav=survival?.navigation
 const learning=survival?.learning?.snapshot?.()||{}
 const lex=survival?.commandVocabulary?.list?.()||{}
 const physics=nav?.snapshot?.().physics||{}
 const world=survival?.world
 const work=survival?.miningJobs?.snapshot?.()||{}
 const q=plan?.snapshot?.()||{}
 const health=world?.attributes?.['minecraft:health']
 const position=world?.position
 const safePos=position&&['x','y','z'].every(k=>Number.isFinite(position[k])&&Math.abs(position[k])<30000000)
  ?Object.fromEntries(['x','y','z'].map(k=>[k,num(position[k])])):null
 return {
  schema:1,capturedAt:int(now()),source:'live',
  connection:{phase:phase(connection?.lastPhase),authState:phase(connection?.authState),connected:!!connection?.connected,joined:!!connection?.joined,spawned:!!connection?.spawned},
  pack:{stage:phase(base.packStage),reason:d.packReason,headers:int(base.packHeaders),chunks:int(base.packChunks),
    requested:int(survival?.connection?.packHandler?.snapshot?.().requested),verified:int(survival?.connection?.packHandler?.snapshot?.().verified),
    advertised:int(base.packAdvertisedCount),optionalSkipped:int(base.packSkippedOptional),
    resourceListEntries:int(base.packResourceInfoCount),textureListEntries:int(base.packTextureInfoCount),behaviorListEntries:int(base.packBehaviorInfoCount),duplicateListEntries:int(base.packDuplicateListEntries),
    serverPacks:int(base.packServerCount),cdnPacks:int(base.packCdnCount),downloadRequestIssued:base.packDownloadRequestIssued===true,
    resourcePacks:int(base.packResourceClassifiedCount),behaviorPacks:int(base.packBehaviorClassifiedCount),addonPacks:int(base.packAddonClassifiedCount),
    wireVerified:base.packWireVerified===true,wireCode:int(base.packWireCode),wireIds:int(base.packWireIds),transportConnectedAtRequest:base.packTransportConnectedAtRequest===true},
  loading:{stage:choice(base.loadingStage,stageList),elapsedSeconds:int(base.loadingElapsedSeconds),noProgressSeconds:int(base.loadingNoProgressSeconds),uniqueSignals:int(base.loadingUniqueSignals),repeatedSignals:int(base.loadingRepeatedSignals),receivedBytes:int(base.loadingReceivedBytes),recoveryAttempts:int(base.loadingRecoveryAttempts),recoveryScheduled:base.loadingRecoveryScheduled===true},
  world:{knownSections:int(world?.sections?.size),decodeErrors:int(world?.decodeErrors),gameMode:choice(world?.gameMode,['survival','creative','adventure','spectator']),health:num(health),position:safePos,terrainKnown:physics.terrainKnown===true,grounded:physics.grounded===true},
  task:{navigation:choice(nav?.state,stateList),kind:choice(nav?.job?.kind,jobList),remainingRoute:int(nav?.route?.length),queuePending:int(q.pending),queueTotal:int(q.batch?.total),queueRemaining:int(q.batch?.remaining),cards:int(q.cards?.length),miningActive:!!work?.active},
  learning:{confirmed:int(learning.confirmed),blocked:int(learning.blocked),interrupted:int(learning.interrupted),
    learnedMappings:int(lex.count),offlineWordCount:int(survival?.snapshot?.().language?.bundledWords)},
  diagnostic:{savedAuthentication:'kept',remoteAccess:false}
 }
}
