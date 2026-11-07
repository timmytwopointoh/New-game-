// Bedrock mob behavior reference for natural-language planning, NOT a combat
// executor. Entity positions are live only when the Realm actually reports them.
const templates={
 creeper:['hostile','Approaches and explodes when close; backing away, placing solid cover and maintaining distance are safer than face-tanking.','Never assume an explosion is harmless near an owner build.'],
 zombie:['hostile','Ordinary zombies use close melee attacks. Many burn in daylight if exposed; some variants and equipped zombies can survive.','Do not walk blindly into groups.'],
 skeleton:['hostile','Skeletons shoot arrows from range. Break line of sight using solid cover; a properly equipped shield can help.','Consider cliffs and crossfire.'],
 spider:['conditional','Spiders can climb walls; ordinary spiders are generally hostile in darkness and neutral in bright light unless provoked.','Avoid relying on a vertical wall alone.'],
 cave_spider:['hostile','Cave spiders are smaller and can inflict poison; narrow cave spaces are dangerous.','Avoid abandoned mineshaft webs and small passages.'],
 enderman:['conditional','Endermen are usually neutral until provoked by direct eye contact or attacks. Avoid staring at the face.','Their teleporting makes melee planning unreliable.'],
 witch:['hostile','Witches use harmful splash potions and can heal themselves; maintaining cover and distance is important.','Potion effects and health must be observed.'],
 drowned:['hostile','Drowned are underwater zombie variants; some can attack with tridents at a distance.','RoveKin should remain on dry land and detour water.'],
 blaze:['hostile','Blazes fly and shoot bursts of fireballs in Nether fortresses. Ranged cover and fire protection help.','Never assume the way back from the Nether is safe.'],
 ghast:['hostile','Ghasts float in the Nether and shoot explosive fireballs. Seek solid cover.','Lava and long falls are major dangers.'],
 piglin:['conditional','Ordinary piglins are less likely to attack a player wearing gold armor, but piglin brutes are hostile regardless.','Opening containers or mining gold can anger piglins even with gold armor.'],
 piglin_brute:['hostile','Piglin brutes aggressively defend bastions and are not made neutral by gold armor.','Avoid bastions without a prepared escape route.'],
 warden:['high-danger','Wardens respond to vibrations and other sensory cues and are extremely dangerous. Quiet withdrawal is safer than combat.','Never try to farm a Warden with basic equipment.'],
 ender_dragon:['boss','The Ender Dragon is a multi-phase boss with healing crystals and dangerous attacks; destroying crystals can reduce healing.','No automated boss strategy is implemented.'],
 wither:['boss','The Wither flies, fires explosive skulls and can damage terrain. Contain the fight away from protected builds.','Summoning is never an implicit safe task.'],
 villager:['passive','Villagers use professions and workstations to offer trades; the actual offers must be read from the server.','Do not touch other players\' villagers or stations.'],
 iron_golem:['conditional','Iron golems defend villages and may retaliate against players who harm villagers or golems.','Avoid accidental aggression.'],
 sheep:['passive','Sheep provide wool through shearing and can be bred with wheat.','Shearing and feeding need server-confirmed entity interactions.'],
 cow:['passive','Cows can be bred with wheat and provide food and leather when killed.','Choose breeding and humane resource collection before killing owned animals.'],
 chicken:['passive','Chickens lay eggs and can be bred with seeds.','Preserve a breeding pair.'],
 wolf:['conditional','Untamed wolves may become aggressive when attacked; tamed wolves can follow and defend their owner.','Do not hit other players\' pets.'],
 bee:['conditional','Bees pollinate crops and may attack if provoked, particularly around hives and nests.','Honey collection requires safe smoke and interaction.']
}
const aliases={'creepers':'creeper','zombies':'zombie','skeletons':'skeleton','spiders':'spider','endermen':'enderman','witches':'witch','piglins':'piglin','brutes':'piglin_brute','wardens':'warden','the dragon':'ender_dragon','dragon':'ender_dragon','ender dragon':'ender_dragon','wither boss':'wither','villagers':'villager','golems':'iron_golem','iron golem':'iron_golem','sheep':'sheep','cows':'cow','chickens':'chicken','wolves':'wolf','bees':'bee','cave spiders':'cave_spider','cave spider':'cave_spider'}
const mobName=s=>{
 let name=String(s||'').toLowerCase().replace(/^(?:a|an|the)\s+/,'').replace(/\s+mob$/,'').trim().replace(/ /g,'_')
 name=aliases[name]||aliases[name.replace(/_/g,' ')]||name
 return Object.hasOwn(templates,name)?name:null
}
export function minecraftMobExplanation(raw,{world=null,realmSpawned=false}={}){
 const q=String(raw||'').toLowerCase().trim().replace(/[.!?]+$/,'').replace(/\s+/g,' ')
 if(q.length>190)return null
 let m=q.match(/^(?:what is|tell me about|what do you know about|explain) (.+)$/)
 if(!m)m=q.match(/^how (?:do|can|should) (?:i|we|you) (?:avoid|fight|defeat|survive|escape|handle|approach) (.+)$/)
 if(!m)m=q.match(/^what (?:does|do|can) (.+) do$/)
 if(!m)m=q.match(/^is (.+) (?:dangerous|hostile|safe|friendly)$/)
 if(!m)return null
 const name=mobName(m[1]);if(!name)return null
 const [behavior,knowledge,safety]=templates[name]
 const observed=[]
 if(realmSpawned&&world?.position&&world?.entities?.values){
  for(const entity of world.entities.values()){
   if(String(entity?.type||'').replace(/^minecraft:/,'')!==name||!entity?.position)continue
   const d=Math.hypot(world.position.x-entity.position.x,world.position.y-entity.position.y,world.position.z-entity.position.z)
   if(Number.isFinite(d))observed.push({distanceBlocks:Math.round(d*10)/10})
  }
 }
 return {kind:'minecraft-mob-knowledge',name,behavior,knowledge,safety,
  liveEvidence:observed.length?{seen:true,count:observed.length,nearestBlocks:Math.min(...observed.map(x=>x.distanceBlocks))}:{seen:false},
  planningOnly:true,combatStarted:false,message:name.replace(/_/g,' ')+': '+knowledge+' '+safety+
   (observed.length?' Server currently shows '+observed.length+' nearby; nearest around '+Math.min(...observed.map(x=>x.distanceBlocks))+' blocks.':' No nearby entity position has been confirmed by this query.')}
}
