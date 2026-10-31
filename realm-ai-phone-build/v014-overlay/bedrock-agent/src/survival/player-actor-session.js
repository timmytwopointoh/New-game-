// Alternative self-actor identity layer. The game SERVER issues both IDs at start_game.
// This is an authenticated player session, not a separately spawned NPC or custom mob.
// player_auth_input has NO actor-ID field: Minecraft ties controls to this login session.
export function actorId(value){
 if(typeof value==='bigint')return value.toString(10)
 if(typeof value==='number'){if(!Number.isSafeInteger(value))return null;return BigInt(value).toString()}
 if(typeof value==='string'&&/^-?\\d+$/.test(value))return BigInt(value).toString()
 return null
}
export class PlayerActorSession{
 constructor(){this.reset()}
 reset(){this.runtimeId=null;this.uniqueId=null;this.startReceived=false;this.matches={runtime:0,unique:0,rejected:0};this.lastMismatch=null}
 start(packet){
  this.runtimeId=actorId(packet?.runtime_entity_id)
  this.uniqueId=actorId(packet?.entity_id)
  this.startReceived=true
  this.matches={runtime:0,unique:0,rejected:0};this.lastMismatch=null
  return this.ready
 }
 get ready(){return this.startReceived&&this.runtimeId!==null&&this.uniqueId!==null}
 checkRuntime(id,source='packet'){
  const candidate=actorId(id),match=this.ready&&candidate!==null&&candidate===this.runtimeId
  if(match)this.matches.runtime++
  else if(candidate!==null&&this.ready){this.matches.rejected++;this.lastMismatch=source+' was for another runtime actor'}
  return match
 }
 checkUnique(id,source='packet'){
  const candidate=actorId(id),match=this.ready&&candidate!==null&&candidate===this.uniqueId
  if(match)this.matches.unique++
  else if(candidate!==null&&this.ready){this.matches.rejected++;this.lastMismatch=source+' was for another unique actor'}
  return match
 }
 runtimeForPacket(){
  if(!this.ready)throw Error('Minecraft has not issued both player actor IDs in start_game.')
  return BigInt(this.runtimeId)
 }
 uniqueForPacket(){
  if(!this.ready)throw Error('Minecraft has not issued both player actor IDs in start_game.')
  return BigInt(this.uniqueId)
 }
 snapshot(){return {kind:'authenticated Bedrock player session',startReceived:this.startReceived,ready:this.ready,runtimeIdPresent:this.runtimeId!==null,uniqueIdPresent:this.uniqueId!==null,
  runtimeId:this.runtimeId,uniqueId:this.uniqueId,matchedRuntimePackets:this.matches.runtime,matchedUniquePackets:this.matches.unique,rejectedForeignActorPackets:this.matches.rejected,lastMismatch:this.lastMismatch,
  controlBinding:'player_auth_input is bound to authenticated connection; no actor id can be injected into its packet'}}
}
