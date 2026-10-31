// Bedrock first-person-aligned input vectors for a headless client.
// No rendered camera exists: never claim to have changed a GUI perspective.
const rad = Math.PI / 180
const finite = (...values) => values.every(Number.isFinite)
export function cameraForward(yaw, pitch) {
 if (!finite(yaw,pitch)) throw Error('Non-finite view rotation.')
 const x = yaw * rad, y = pitch * rad
 return {x:-Math.sin(x)*Math.cos(y), y:-Math.sin(y), z:Math.cos(x)*Math.cos(y)}
}
export function aimAtBlock(from, block) {
 if (!from || !block || !finite(from.x,from.y,from.z,block.x,block.y,block.z)) throw Error('Position is not known.')
 if (![block.x,block.y,block.z].every(Number.isSafeInteger)) throw Error('Choose whole-number block coordinates.')
 const dx=block.x+.5-from.x, dy=block.y+.5-from.y, dz=block.z+.5-from.z
 const horizontal=Math.hypot(dx,dz), distance=Math.hypot(horizontal,dy)
 if (distance<.01 || distance>16) throw Error('Choose a different block within 16 blocks of the bot.')
 const yaw=Math.atan2(-dx,dz)/rad
 const pitch=Math.max(-89.9,Math.min(89.9,-Math.atan2(dy,horizontal)/rad))
 return {yaw,pitch,distance}
}
export function describeControl(navigation, now=Date.now()) {
 const last= navigation.lastPacketAt || null, confirmed=navigation.lastServerPoseAt || null
 return {
  client:'headless Bedrock protocol player',
  view:'first-person-aligned aim; no rendered third-person camera or visual stream',
  inputMethod:'player_auth_input (mouse input mode, normal play mode)',
  connected:!!navigation.client,spawned:!!navigation.spawned,
  packetsSent:navigation.packetsSent||0,
  lastPacketAt:last,
  serverPoseSamples:navigation.serverPoseSamples||0,
  lastServerPoseAt:confirmed,
  serverPoseAgeMs:confirmed?Math.max(0,now-confirmed):null,
  lastConfirmedPosition:navigation.lastServerPosition||null,
  serverFeedback:confirmed&&now-confirmed<5000?'recent server position/correction received':'no recent server position/correction; actual movement unverified',
  lastInputError:navigation.lastInputError||null,
  yaw:Number.isFinite(navigation.yaw)?navigation.yaw:null,
  pitch:Number.isFinite(navigation.pitch)?navigation.pitch:null,
  cameraForward:Number.isFinite(navigation.yaw)&&Number.isFinite(navigation.pitch)?cameraForward(navigation.yaw,navigation.pitch):null
 }
}
