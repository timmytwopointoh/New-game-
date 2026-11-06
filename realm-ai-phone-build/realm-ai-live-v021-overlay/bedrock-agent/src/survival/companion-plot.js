import crypto from 'node:crypto'

const PLOT_SIDE=50
const styles=['timber-lodge','stone-keep','courtyard-cottage','tiered-workshop','garden-manor','watchtower-home','split-wing-cabin']
const materials={
 'timber-lodge':['oak_planks','cobblestone','spruce_planks'],
 'stone-keep':['stone_bricks','cobblestone','oak_planks'],
 'courtyard-cottage':['birch_planks','stone_bricks','oak_planks'],
 'tiered-workshop':['spruce_planks','stone_bricks','glass'],
 'garden-manor':['oak_planks','bricks','birch_planks'],
 'watchtower-home':['cobblestone','stone_bricks','spruce_planks'],
 'split-wing-cabin':['dark_oak_planks','cobblestone','oak_planks']
}
const optional=['smelting-room','enchanting-library','altar-room','greenhouse','map-room','watchtower','crafting-workshop','guest-room','armory','kitchen','brewing-room']
const basics=['entrance','bedroom','chest-storage','crafting-workshop']
const whole=(n)=>Number.isSafeInteger(n)
const block=(p)=>p&&[p.x,p.y,p.z].every(whole)
const boundsFor=(center)=>{
 if(!block(center))throw Error('Owner position has not been received as whole block coordinates.')
 if(Math.abs(center.x)>29999900||Math.abs(center.z)>29999900||center.y< -38||center.y>294)throw Error('Select a location within safe vanilla world coordinate bounds.')
 const min={x:center.x-24,y:center.y-24,z:center.z-24}
 return {min,max:{x:min.x+49,y:min.y+49,z:min.z+49}}
}
const within=(p,point)=>block(point)&&['x','y','z'].every(a=>point[a]>=p.min[a]&&point[a]<=p.max[a])
const intersect=(a,b)=>a.x<=b.x+b.width-1&&b.x<=a.x+a.width-1&&a.z<=b.z+b.length-1&&b.z<=a.z+a.length-1
const shuffle=(list,pick)=>list.map(x=>({x,k:pick()})).sort((a,b)=>a.k-b.k).map(v=>v.x)
const choose=(list,pick)=>list[Math.floor(pick()*list.length)]
// Owner's observed position is authoritative; NEVER accept a player name or
// claimed ownership purely because untrusted Realm chat text says "me".
export function grantPlot(world,ownerNames,side=PLOT_SIDE){
 if(side!==PLOT_SIDE)throw Error('Companion home area must be exactly 50×50×50 for this test.')
 if(!world||!Array.isArray(ownerNames)||!ownerNames.length)throw Error('Configure the actual Realm owner account before granting land.')
 const names=new Set(ownerNames.map(n=>String(n).toLowerCase()))
 const visible=[...(world.players?.values?.()||[])].filter(p=>names.has(String(p.name).toLowerCase())&&p.position&&[p.position.x,p.position.y,p.position.z].every(Number.isFinite))
 if(visible.length!==1)throw Error('One configured owner must be visible in the same Realm. Stand on the plot center and try again.')
 if(!whole(world.dimension))throw Error('Server dimension is unknown.')
 const center={x:Math.floor(visible[0].position.x),y:Math.floor(visible[0].position.y-1.62),z:Math.floor(visible[0].position.z)}
 const bounds=boundsFor(center)
 return {schema:1,source:'owner-observed-player-position',owner:visible[0].name,dimension:world.dimension,center,size:{x:50,y:50,z:50},bounds,permission:'plan-only',createdAt:Date.now()}
}
export function insidePlot(plot,position,dimension=plot?.dimension){
 return !!plot&&plot.dimension===dimension&&within(plot.bounds,position)
}
export function planUniqueHome(plot,{previousStyle=null,pick=Math.random}={}){
 if(!plot||plot.permission!=='plan-only'||plot.size.x!==50||plot.size.y!==50||plot.size.z!==50)throw Error('Grant an owner-observed 50×50×50 plot first.')
 if(!within(plot.bounds,plot.center))throw Error('Invalid land bounds.')
 const available=styles.filter(x=>x!==previousStyle)
 const style=choose(available.length?available:styles,pick)
 const components=shuffle(optional.filter(x=>!basics.includes(x)),pick).slice(0,3+Math.floor(pick()*3))
 const rooms=[...basics,...components]
 const width=15+2*Math.floor(pick()*4),length=15+2*Math.floor(pick()*4),levels=1+Math.floor(pick()*2)
 const floorY=plot.center.y
 const origin={x:plot.center.x-Math.floor(width/2),y:floorY,z:plot.center.z-Math.floor(length/2)}
 // Reserve 3 blocks of empty border around the building inside the plot.
 if(!insidePlot(plot,{x:origin.x-3,y:floorY-2,z:origin.z-3})||!insidePlot(plot,{x:origin.x+width+2,y:floorY+levels*6+3,z:origin.z+length+2}))
   throw Error('House does not fit inside the agreed land boundary.')
 const roomList=[]
 const zones=[
  {x:1,z:1},{x:Math.floor(width/2)+1,z:1},
  {x:1,z:Math.floor(length/2)+1},{x:Math.floor(width/2)+1,z:Math.floor(length/2)+1}
 ]
 // Fill up to four main rooms per floor, then place additional rooms
 // upstairs. Rooms are abstract interior zones, not physical placements.
 const roomW=Math.floor((width-3)/2),roomL=Math.floor((length-3)/2)
 rooms.forEach((name,i)=>{
   const level=Math.floor(i/4),q=zones[i%4]
   roomList.push({name,level,origin:{x:origin.x+q.x,y:floorY+level*5+1,z:origin.z+q.z},width:roomW,length:roomL})
 })
 const actualLevels=Math.max(levels,Math.ceil(roomList.length/4))
 const totalHeight=actualLevels*5+2
 if(!insidePlot(plot,{x:origin.x+width-1,y:floorY+totalHeight,z:origin.z+length-1}))throw Error('House height exceeds the authorized plot.')
 const footprint={origin,width,length,height:totalHeight}
 // Broad estimates. Never claim exact crafting bill, nor that blocks were placed.
 const estimate={foundation:width*length,wallShell:2*(width+length-2)*actualLevels*4,roof:width*length,
   furniture:'inventory and recipe inspection required',knownExact:false}
 return {schema:1,kind:'home-blueprint-preview',id:crypto.randomBytes(5).toString('hex'),style,plotCenter:{...plot.center},
   dimension:plot.dimension,footprint,rooms:roomList,materials:materials[style],estimatedBlocks:estimate,
   approval:'not-requested',stage:'preview-only',executedBlocks:0,terrainChecked:false,inventoryChecked:false,
   note:'Blueprint idea only. No mining, chest access, block placement, teleport, land protection or autonomous execution occurred.'}
}
export function validatePlotBlueprint(plot,design){
 if(!plot||!design||plot.dimension!==design.dimension)return false
 const {origin,width,length,height}=design.footprint||{}
 if(!block(origin)||![width,length,height].every(n=>whole(n)&&n>0&&n<=50))return false
 if(!within(plot.bounds,origin)||!within(plot.bounds,{x:origin.x+width-1,y:origin.y+height-1,z:origin.z+length-1}))return false
 if(!Array.isArray(design.rooms)||design.rooms.length<4||design.rooms.length>12)return false
 return design.rooms.every(r=>block(r.origin)&&whole(r.width)&&whole(r.length)&&r.width>0&&r.length>0&&
   within(plot.bounds,r.origin)&&within(plot.bounds,{x:r.origin.x+r.width-1,y:r.origin.y+3,z:r.origin.z+r.length-1}))
}
