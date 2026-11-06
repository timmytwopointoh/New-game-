// Conservative vanilla Bedrock block effects for on-device navigation.
// Geometry, hardness, mining tools and recipes still come from the matching
// prismarine-registry/block version data and SERVER-RECEIVED block states.
// This module never tries to infer undocumented add-on block behavior.
const air = new Set(['air','cave_air','void_air'])
const water = /^(?:flowing_)?water$/
const lava = /^(?:flowing_)?lava$/
const damage = /^(?:fire|soul_fire|campfire|soul_campfire|cactus|magma_block|sweet_berry_bush|wither_rose|pointed_dripstone|lava_cauldron)$/
const trapping = /^(?:cobweb|web|powder_snow|bubble_column)$/
const portal = /^(?:portal|nether_portal|end_portal|end_gateway)$/
const protect = /(?:^|_)(?:farmland|turtle_egg|sniffer_egg|dragon_egg|sculk_sensor|sculk_shrieker|tripwire|tripwire_hook|pressure_plate)$/
const gravity = /^(?:sand|red_sand|gravel|anvil|chipped_anvil|damaged_anvil|.*_concrete_powder)$/
const slippery = /^(?:ice|packed_ice|blue_ice|frosted_ice)$/
const slow = /^(?:soul_sand|honey_block|mud)$/
const climb = /^(?:ladder|vine|cave_vines|cave_vines_body_with_berries|cave_vines_head_with_berries|weeping_vines|weeping_vines_plant|twisting_vines|twisting_vines_plant|scaffolding)$/
const protectedInteraction = /(?:^|_)(?:chest|barrel|shulker_box|beehive|bee_nest|spawner|trial_spawner|vault|command_block|structure_block|tnt)$/

export function vanillaBlockBehavior(input) {
  const raw=typeof input==='string'?input:input?.name
  if(typeof raw!=='string'||raw.length<1||raw.length>128)
    return {source:'unknown',kind:'unknown',routeBlocked:true,penalty:Infinity,reason:'Block type not available from server.'}
  // A colon other than the canonical minecraft: namespace means an add-on.
  const split=raw.indexOf(':')
  if(split>=0&&!raw.startsWith('minecraft:'))
    return {source:'custom',kind:'custom-unknown',routeBlocked:true,penalty:Infinity,reason:'Add-on block: identity known; physical and damage effects unverified.'}
  const name=raw.startsWith('minecraft:')?raw.slice(10):raw
  const result=(kind,routeBlocked=false,penalty=0,reason='Vanilla block. Server collision data still decides whether the cell is walkable.')=>
    ({source:'vanilla',kind,routeBlocked,penalty,reason,name})
  if(air.has(name))return result('air')
  if(water.test(name))return result('water',true,Infinity,'Water avoided; no automatic swimming or wading.')
  if(lava.test(name))return result('lava',true,Infinity,'Lava causes damage; never choose this route.')
  if(damage.test(name))return result('damaging',true,Infinity,'Damaging block; avoid contact.')
  if(trapping.test(name))return result('trapping',true,Infinity,'Traps, suffocation or upward/downward fluid movement possible.')
  if(portal.test(name))return result('portal',true,Infinity,'Dimension transition must be an explicit owner-approved action.')
  if(protect.test(name))return result('protected-trigger',true,Infinity,'Avoid crop/egg damage and triggering dangerous redstone or sculk.')
  if(protectedInteraction.test(name))return result('protected-interaction',false,6,'Do not mine or activate this block automatically.')
  if(gravity.test(name))return result('gravity-affected',false,2,'Can fall when supporting blocks change; do not mine from underneath.')
  if(slippery.test(name))return result('slippery',false,4,'Slippery surface; prefer ordinary stone or soil when possible.')
  if(slow.test(name))return result('slow',false,3,'Movement may slow; account for delayed server position feedback.')
  if(climb.test(name))return result('climbable',false,2,'Climbable surface; do not assume a supported climbing input without a live test.')
  if(name==='slime_block')return result('bouncy',false,2,'Bounce can change landing height; avoid uncontrolled drops.')
  return result('ordinary')
}

export function vanillaPathRisk(world,position) {
  // Only SERVER-RECEIVED cells. No optimistic assumptions about unobserved
  // modded or vanilla chunks, fluid overlays, or standing surfaces.
  if(!world?.block||!position||![position.x,position.y,position.z].every(Number.isSafeInteger))return Infinity
  const near=[
    world.block(position),world.block(position,1),
    world.block({...position,y:position.y+1}),world.block({...position,y:position.y+1},1),
    world.block({...position,y:position.y-1}),world.block({...position,y:position.y-1},1)
  ]
  if(near.some(b=>!b))return Infinity
  const effects=near.map(vanillaBlockBehavior)
  if(effects.some(b=>b.routeBlocked))return Infinity
  return effects.reduce((n,e)=>n+e.penalty,0)
}
