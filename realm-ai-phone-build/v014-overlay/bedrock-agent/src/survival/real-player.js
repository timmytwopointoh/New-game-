// Minecraft Bedrock player identity and gamemode evidence. No custom mob is spawned.
// Prismarine's GameMode enum decodes value 5 as "fallback": inherit world_gamemode.
// Never infer Survival if the server omits a world mode or reports non-Survival.
const own = (obj,key) => Object.prototype.hasOwnProperty.call(obj||{},key)
export function readGameMode(value) {
 if (value===null||value===undefined)return null
 if (typeof value==='number'&&Number.isInteger(value))return ({0:'survival',1:'creative',2:'adventure',3:'spectator',4:'spectator',6:'spectator'})[value]||null
 if (typeof value!=='string')return null
 const normalized=value.trim().toLowerCase().replace(/[\s-]+/g,'_')
 if (/^-?\d+$/.test(normalized))return readGameMode(Number(normalized))
 if (['survival','creative','adventure','spectator'].includes(normalized))return normalized
 if (normalized==='survival_spectator'||normalized==='creative_spectator')return 'spectator'
 return null
}
export function defaultGameMode(value) {
 return value===5 || value==='5' || (typeof value==='string'&&['default','fallback','world_default','worlddefault','world_fallback'].includes(value.trim().toLowerCase().replace(/[\s-]+/g,'_')))
}
function shown(value) {
 if (value===null||value===undefined)return 'not sent'
 if (typeof value==='number'||typeof value==='boolean')return String(value)
 if (typeof value==='string')return value.slice(0,50)
 return typeof value
}
export function gameModeFromStart(packet) {
 const player=packet?.player_gamemode??packet?.player_game_mode??packet?.player_game_type
 const world=packet?.world_gamemode??packet?.world_game_mode
 const inherited=defaultGameMode(player)
 const resolved=readGameMode(inherited?world:player)
 return {mode:resolved,source:inherited?'start_game world default':'start_game player',playerRaw:shown(player),worldRaw:shown(world),inherited}
}
export function gameModeFromUpdate(packet) {
 const raw=packet?.gamemode??packet?.player_gamemode??packet?.game_type??packet?.player_game_type
 return {mode:readGameMode(raw),source:'own server game-type update',playerRaw:shown(raw),worldRaw:null,inherited:defaultGameMode(raw)}
}
export function realPlayerEvidence(world, connection=null) {
 const actor=!!world.startGameReceived&&world.entityId!==null&&world.uniqueId!==null
 return {
  connectionType:'authenticated Minecraft Bedrock protocol client (not a spawned custom mob)',
  gamertag:connection?.username||null,
  authenticatedSession:!!connection?.connected,
  startGameReceived:!!world.startGameReceived,
  spawned:!!connection?.spawned,
  ownRuntimeIdReceived:world.entityId!==null,
  ownUniqueIdReceived:world.uniqueId!==null,
  playerActorIdentified:actor,
  ownMode:world.gameMode||'unknown',
  modeEvidence:world.modeEvidence||null,
  abilitiesReceived:!!world.abilityState?.known,
  healthReceived:Number.isFinite(world.attributes?.['minecraft:health']),
  hungerReceived:Number.isFinite(world.attributes?.['minecraft:player.hunger']),
  inventorySnapshotReceived:!!world.inventoryKnown,
  survivalVerified:!!world.survivalVerified,
  disclaimer:actor?'Minecraft supplied a local PLAYER actor identity; a separate mob is not required.':'No complete player start-game identity yet.',
  whyPaused:world.survivalVerified?null:world.gameMode===null?'Own game mode not resolved from server packet. Check playerRaw/worldRaw fields.':!world.abilityState?.known?'Own abilities layer not received; waiting for server state.':'Own mode/abilities do not verify ordinary Survival.'
 }
}
