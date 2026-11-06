// Realm-scoped historical resource + biome recall for both PHONE chat and
// allowlisted Realm !ai chat. A remembered sighting is not an active block.
import {familyMatch,biomeAtBlock} from './landmark-memory.js'

const position=p=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
const normalized=s=>String(s||'').trim().toLowerCase().replace(/[!?.,]+$/,'').replace(/^(?:please |can you |could you )/,'').trim()
const name=s=>String(s||'').trim().toLowerCase().replace(/[ -]+/g,'_')
const posText=p=>[p.x,p.y,p.z].join(', ')
const answer=(message,extra={})=>({accepted:true,queued:false,message,...extra})
const block=(message,extra={})=>({accepted:false,queued:false,message,...extra})
const names=/^[a-z0-9_ -]{2,72}$/i

export class ResourceRecall {
 constructor(controller){this.c=controller}
 get memory(){return this.c.landmarks}
 get world(){return this.c.world}
 position(){return this.world.serverPosition||this.world.position||null}
 nearby(nameQuery){
  const w=this.world
  if(typeof w.scan!=='function')return []
  try{return w.scan(null,{range:8,maxFound:128,filter:n=>familyMatch(n,nameQuery)})?.found||[]}catch{return []}
 }
 remembered(nameQuery,biome=null){
  return this.memory.resourceCandidates(nameQuery,this.world.dimension,this.position(),{biome,limit:6})
 }
 findResource(nameQuery,biome=null){
  if(!names.test(nameQuery)||biome&&!names.test(biome))return block('Use a simple material or biome name.')
  const live=this.nearby(nameQuery).filter(p=>!biome||biomeAtBlock(this.world,p)?.includes(name(biome)))
  const past=this.remembered(nameQuery,biome)
  if(live.length){
   const p=live[0],b=biomeAtBlock(this.world,p)
   return answer('I can see '+p.name+' at '+posText(p)+(b?' in '+b:'; biome not confirmed')+
    '. '+(past.length?'I also remember '+past.length+' historical candidate(s).':'I have no older sightings for it.')+
    ' Say "mine remembered '+nameQuery+'" only when you want me to try a currently visible block.',{visible:p,remembered:past})
  }
  if(past.length){
   const p=past[0]
   return answer('I remember '+p.name+' near '+posText(p)+(p.biome?' in '+p.biome:' (biome unknown)')+
    '. That is an old observation: I must travel safely, scan, and verify before collecting it.',{remembered:past})
  }
  const biomeHints=biome?this.memory.biomeCandidates(biome,this.world.dimension,this.position()):[]
  return answer('I have no verified sighting of '+nameQuery+(biome?' in '+biome:'')+
   '. '+(biomeHints.length?'I remember the requested biome but not that block.':'I need to explore and observe it first.'),{remembered:[],biomes:biomeHints})
 }
 findBiome(biome){
  if(!names.test(biome))return block('Use a biome name such as forest, plains or desert.')
  const matches=this.memory.biomeCandidates(biome,this.world.dimension,this.position(),{limit:8})
  const current=this.world.biomeAt?.()?.name
  if(current&&name(current).includes(name(biome)))
   return answer('The server currently reports '+current+' here. '+(matches.length?'I also remember '+matches.length+' biome waypoint(s).':''),{current,remembered:matches})
  if(!matches.length)return answer('I have not personally observed '+biome+' in this Realm yet. I cannot guess a biome coordinate.')
  return answer('I remember '+matches[0].biome+' around '+posText(matches[0])+
   '. The server must confirm the biome when I arrive; no route is assumed safe.',{remembered:matches})
 }
 moveToward(target,{label='remembered location'}={}){
  const w=this.world,n=this.c.navigation
  if(!this.c.connection?.spawned||!w.movementVerified)return block('I must spawn and have server-verified movement before travelling.')
  if(n.job||n.survey||this.c.resources?.active||this.c.acquisition?.active||this.c.miningJobs?.active)
   return block('I am already doing another task. Say Stop before changing destinations.')
  const start=w.standPosition?.()
  if(!position(start)||!position(target))return block('The server has not confirmed my location or a remembered destination.')
  if(Math.hypot(start.x-target.x,start.z-target.z)>48)
   return block('I remember '+label+' at '+posText(target)+', but it is beyond a single safe 48-block trip. I will not guess a route through unloaded chunks.',{waypoint:target})
  const options=[]
  for(const radius of [2,3,5,7])for(const [dx,dz] of [[radius,0],[-radius,0],[0,radius],[0,-radius]])
   for(const dy of [0,1,-1,2,-2]){
    const p={x:target.x+dx,y:start.y+dy,z:target.z+dz}
    if(w.walkable?.(p)){const r=n.routeTo?.(p,start,{allowDirt:false,maxNodes:800});if(r?.ok)options.push({p,steps:r.path?.length||999})}
   }
  options.sort((a,b)=>a.steps-b.steps)
  if(!options.length){
   try{w.requestNearby?.(this.c.connection.client)}catch{}
   return block('I recall '+label+' near '+posText(target)+', but I do not have a confirmed dry, safe route. Scan more terrain first.',{waypoint:target})
  }
  const result=n.walk(options[0].p,{allowMining:false,maxDrop:1})
  return result?.accepted?{...result,message:'Moving toward '+label+' using a currently observed safe route. I will recheck the location on arrival.',waypoint:target}:
   block('Navigation refused the remembered waypoint: '+String(result?.message||'no route'),{waypoint:target})
 }
 mineRemembered(query){
  const w=this.world
  if(!this.c.connection?.spawned)return block('Join the Realm before mining.')
  const visible=this.nearby(query)
  if(!visible.length)return block('A remembered '+query+' is not currently visible. Find it or return to its biome first; I will not mine a stale coordinate.')
  const candidates=visible.filter(p=>position(p)&&this.memory.resourceCandidates(query,w.dimension,this.position(),{limit:12})
   .some(m=>m.x===p.x&&m.y===p.y&&m.z===p.z&&m.name===p.name))
  const target=candidates[0]||visible[0]
  return this.c.companion.mine({x:target.x,y:target.y,z:target.z},
   ()=>this.c.navigation.mine({x:target.x,y:target.y,z:target.z}))
 }
 handle(raw){
  const s=normalized(raw)
  if(/^(?:remembered (?:resources|blocks|locations)|resource memory|what (?:resources|blocks) (?:do you remember|have you seen)|memory status)$/.test(s)){
   const m=this.memory
   if(!m.scope)return block('I have not identified this Realm yet; I cannot use another Realm\'s memories.')
   const sample=[...m.materials,...m.entries].filter(p=>p.dimension===this.world.dimension).slice(0,12)
   return answer('I remember '+m.materials.length+' material samples, '+m.entries.length+
    ' special landmarks, and '+m.biomeSummary(this.world.dimension).length+
    ' observed biome types. Ask "where did you see oak log?" or "remembered biomes".',{memory:m.snapshot(),samples:sample})
  }
  if(/^(?:remembered biomes|known biomes|what biomes (?:have you seen|do you remember))$/.test(s)){
   const summary=this.memory.biomeSummary(this.world.dimension)
   return answer(summary.length?'I have observed: '+summary.map(b=>b.biome).join(', ')+'. Ask "find forest biome" or "return to remembered forest biome".':
    'I have not yet received reliable biome palette observations in this Realm.',{biomes:summary})
  }
  let m=s.match(/^(?:mine|dig|collect) (?:a |the )?remembered (?:block )?([\w -]+)$/)
  if(m)return this.mineRemembered(m[1])
  m=s.match(/^(?:return to|go to|visit|head to) (?:the )?(?:remembered |known )?([\w -]+?) biome$/)
  if(m){
   const b=this.memory.biomeCandidates(m[1],this.world.dimension,this.position())[0]
   return b?this.moveToward(b,{label:'remembered '+b.biome+' biome'}):answer('I have not observed '+m[1]+' biome yet.')
  }
  m=s.match(/^(?:return to|go to|walk to|visit) (?:the )?remembered (?:block |resource |location of )?([\w -]+)$/)
  if(m){
   const p=this.remembered(m[1])[0]
   return p?this.moveToward(p,{label:p.name}):answer('I have not recorded a sighting of '+m[1]+'.')
  }
  m=s.match(/^(?:find|locate|where is|where can i find|search for) (?:the |a )?(?:remembered |known )?([\w -]+?) biome$/)
  if(m)return this.findBiome(m[1])
  m=s.match(/^(?:where (?:did you|can we) (?:see|find)|where can i find|where is|locate|find|look for|remember where|search for) (?:a |an |the )?(?:remembered )?(?:block )?([\w -]+?)(?: in ([\w -]+?)(?: biome)?)?$/)
  if(m){
   // Exact word 'find' stays supported by the native catalog/visible scan.
   // The memory answer adds historical sightings as well.
   return this.findResource(m[1],m[2]||null)
  }
  return null
 }
}
