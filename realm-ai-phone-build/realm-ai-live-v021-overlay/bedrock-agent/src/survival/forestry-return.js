// Dedicated lumber-home workflow. A forestry return is NOT the emergency Stop.
// This is an auditable plan, never proof that any chest was opened or emptied.
// Container steps can only advance on authoritative Bedrock inventory responses.

export const RETURN_HOME_PATTERNS = /^(?:stop (?:chopping|cutting|harvesting|mining) (?:the )?trees|(?:stop|finish) (?:getting|gathering|chopping) wood|return home|go home(?: with (?:the )?wood)?|bring (?:the )?wood home|finish (?:the )?wood run)$/i
const valid=p=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
const same=(a,b)=>a.x===b.x&&a.y===b.y&&a.z===b.z
const clone=p=>({x:p.x,y:p.y,z:p.z})

export function isForestryReturnCommand(text){return RETURN_HOME_PATTERNS.test(String(text||'').trim().replace(/^command\s+/i,'').replace(/[.!?]+$/,''))}

/**
 * Home is the very FIRST verified chest (tree two), never an item to retrieve.
 * Additional checkpoints are revisited newest first, empty before mining.
 * Place recovered chests at home on a line with one block between single chests,
 * preventing inadvertent double-chest merging. Do not destroy player chests.
 */
export function makeForestryReturnPlan(checkpoints=[],{dimension=null}={}){
 const source=checkpoints.filter(c=>Number.isSafeInteger(c.tree)&&c.tree>=2&&valid(c.position)&&((c.tree-2)%3===0))
  .filter(c=>dimension===null||c.dimension===undefined||c.dimension===dimension)
  .sort((a,b)=>a.tree-b.tree)
 const home=source.find(c=>c.tree===2)||null
 const out={home:home?{tree:2,position:clone(home.position),confirmed:home.confirmed===true}:null,
  pickups:source.filter(c=>c.tree!==2).reverse().map(c=>({tree:c.tree,position:clone(c.position),confirmed:c.confirmed===true,phase:'pending'})),
  stage:'awaiting-home',confirmedWithdrawals:0,confirmedDeposits:0,confirmedChestRecoveries:0,awaiting:[]}
 if(!home)out.awaiting.push('tree-two home-base checkpoint')
 else if(!home.confirmed)out.awaiting.push('server-confirmed tree-two chest')
 out.awaiting.push('chest open acknowledgment','item-stack request and response handling','inventory capacity / transfer confirmation','empty-chest removal and pickup confirmation','return-route verification','safe chest placement and home deposit')
 return out
}

export function homeChestLinePosition(home,chestIndex){
 if(!valid(home)||!Number.isSafeInteger(chestIndex)||chestIndex<1||chestIndex>32)throw Error('Invalid home chest location or index')
 // One air cell between each chest prevents accidental double-chest formation.
 return {x:home.x+chestIndex*2,y:home.y,z:home.z}
}

/** Pure cargo decision helper. All fields must be observed, never predicted. */
export function nextForestryCargoAction({home,source,serverVerifiedOpen=false,contentsKnown=false,hasWood=false,freeInventorySlots=0,serverVerifiedEmpty=false,confirmedPickup=false}={}){
 if(!home?.confirmed)return {action:'wait',reason:'Home chest placement has not been confirmed by the server.'}
 if(!source?.confirmed)return {action:'wait',reason:'This storage chest has not been confirmed by the server.'}
 if(!serverVerifiedOpen)return {action:'open-source',requires:'container_open packet'}
 if(!contentsKnown)return {action:'wait',reason:'Awaiting authoritative chest inventory snapshot.'}
 if(hasWood){
  if(!Number.isInteger(freeInventorySlots)||freeInventorySlots<=0)return {action:'return-and-deposit',requires:'confirmed home container inventory and item-stack response'}
  return {action:'withdraw',requires:'successful stack response AND server-confirmed inventory transfer'}
 }
 if(!serverVerifiedEmpty)return {action:'wait',reason:'Do not break a chest before it is authoritatively confirmed empty.'}
 if(!confirmedPickup)return {action:'recover-empty-chest',requires:'server block removal AND player inventory gain'}
 return {action:'return-and-deposit',requires:'verified home chest deposit and recovered-chest line placement'}
}

export function returnRouteHints(trunks=[],home){
 if(!valid(home))return []
 const waypoints=trunks.filter(valid).map(clone)
 // Reverse harvest path, dedupe nearby logs that belong to the same tree.
 const seen=new Set(),back=[]
 for(const p of waypoints.reverse()){
  const k=`${p.x},${p.z}`
  if(seen.has(k))continue
  seen.add(k);back.push(p)
 }
 if(!back.length||!same(back.at(-1),home))back.push(clone(home))
 return back.slice(0,256)
}
