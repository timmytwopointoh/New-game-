export const floorPos = p => ({x:Math.floor(p.x),y:Math.floor(p.y),z:Math.floor(p.z)})
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)
export const sameDimension = (a,b) => a?.dimension?.id===b?.dimension?.id
export const nearOwner = (bot, owner, radius) => sameDimension(bot,owner) && distance(bot.location,owner.location)<=radius
export function planWall(center, width, height) {
 const origin=floorPos(center), out=[]
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)out.push({x:origin.x+x+2,y:origin.y+y,z:origin.z+1})
 return out
}
export function planFloor(center,width,depth) {
 const o=floorPos(center),out=[]
 for(let z=0;z<depth;z++)for(let x=0;x<width;x++)out.push({x:o.x+x+2,y:o.y,z:o.z+1+z})
 return out
}
export function planPillar(center,height){const o=floorPos(center);return Array.from({length:height},(_,i)=>({x:o.x+2,y:o.y+i,z:o.z+1}))}
export function planBridge(center,length){const o=floorPos(center);return Array.from({length},(_,i)=>({x:o.x+i+2,y:o.y-1,z:o.z}))}
export function planMining(center, radius) {
 const origin=floorPos(center), positions=[]
 for(let dy=-1;dy<=2;dy++)for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
   if(dx*dx+dz*dz+dy*dy>radius*radius)continue
   positions.push({x:origin.x+dx,y:origin.y+dy,z:origin.z+dz,rank:dx*dx+dz*dz+dy*dy})
 }
 return positions.sort((a,b)=>a.rank-b.rank).map(({x,y,z})=>({x,y,z}))
}
export function materialId(name){return 'minecraft:'+name}
export function isReplaceable(block){return block?.typeId==='minecraft:air'||block?.typeId==='minecraft:cave_air'}
export function isGround(block){return Boolean(block) && !isReplaceable(block) && block.typeId!=='minecraft:water'&&block.typeId!=='minecraft:lava'}
