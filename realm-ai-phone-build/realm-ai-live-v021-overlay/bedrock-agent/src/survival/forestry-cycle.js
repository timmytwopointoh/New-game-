// Forestry policy is internal bot knowledge; never infer that a server inventory,
// crafting or container change happened simply because a milestone is scheduled.
import nbt from 'prismarine-nbt'

export const AXE_SLOTS=Object.freeze([0,1,2,3,4,5])
export const AXE_NAMES=/^(?:wooden|stone|iron|golden|diamond|netherite)_axe$/
export function chestCheckpoint(treeNumber){
 return Number.isSafeInteger(treeNumber)&&treeNumber>=2&&(treeNumber-2)%3===0
}
export function storageForTree(treeNumber){
 return Number.isSafeInteger(treeNumber)&&treeNumber>=2?2+3*Math.floor((treeNumber-2)/3):null
}
export function trunkIdentity(position,known=[]){
 // Nearby vertical logs are most likely the same tree. These are tentative
 // landmarks: the full tree isn't certified felled until *all* observed logs
 // belonging to that tree are server-confirmed removed.
 const match=known.find(p=>Math.hypot(p.x-position.x,p.z-position.z)<=1.5 && Math.abs(p.y-position.y)<=12)
 return match||{x:position.x,y:position.y,z:position.z}
}
export function axeDurability(item,registry){
 const type=registry?.items?.[item?.network_id]
 if(!AXE_NAMES.test(type?.name||'')||!item?.count)return null
 const max=Number(type.maxDurability??type.max_durability??0)
 let damage=null
 try{
  const raw=item.extra?.nbt
  const tag=raw?.type?nbt.simplify(raw):raw
  damage=Number(tag?.Damage??tag?.damage)
  if(!Number.isFinite(damage)||damage<0)damage=null
 }catch{}
 return {name:type.name,max:max>0?max:null,remaining:max>0&&damage!==null?Math.max(0,max-damage):null}
}
export function bestAxeSlot(world){
 if(!world?.inventoryKnown)return null
 const viable=[]
 for(const slot of AXE_SLOTS){
  const tool=axeDurability(world.inventory?.get(slot),world.registry)
  if(tool&&tool.remaining!==0)viable.push({slot,tool})
 }
 viable.sort((a,b)=>Number(b.tool.remaining??1)-Number(a.tool.remaining??1)||a.slot-b.slot)
 const selected=viable.find(x=>x.slot===world.selectedSlot)
 // Continue using an already selected usable axe; don't waste ticks swapping.
 return selected?.slot??viable[0]?.slot??null
}
export function provisioningPlan(items={},axeCount=0,{needChest=false,hasTable=false}={}){
 const logs=Object.entries(items).filter(([name])=>/(?:_log|_wood|_stem|_hyphae)$/.test(name)&&!name.startsWith('stripped_')).reduce((sum,[,n])=>sum+n,0)
 const planks=Object.entries(items).filter(([name])=>name.endsWith('_planks')).reduce((sum,[,n])=>sum+n,0)
 const sticks=items.stick||0
 const missingAxes=Math.max(0,6-axeCount)
 const neededSticks=Math.max(0,missingAxes*2-sticks)
 const planksForSticks=2*Math.ceil(neededSticks/4)
 const neededPlanks=missingAxes*3+planksForSticks+(hasTable?0:4)+(needChest?8:0)
 return {missingAxes,neededSticks,planksForSticks,neededPlanks,needLogs:Math.max(0,Math.ceil((neededPlanks-planks)/4)-logs),hasSupplies:planks+logs*4>=neededPlanks,
  // Craft only the necessary number of sticks; turning half of all wood into
  // sticks would waste most of the valuable planks.
  operations:['convert confirmed logs to matching planks','craft enough sticks','craft or place crafting table','craft wooden axes to six hotbar slots','craft chest when scheduled','deposit only after container-open and server inventory updates']}
}
