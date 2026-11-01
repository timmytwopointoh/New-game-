const valid=p=>p&&[p.x,p.y,p.z].every(Number.isSafeInteger)
export const right=d=>({x:-d.z,z:d.x})
export function stripLayout(start,heading,{depth=-20,rows=8,length=30,spacing=4}={}){
 if(!valid(start)||!Number.isSafeInteger(depth)||depth< -54||depth>start.y||!Number.isSafeInteger(rows)||rows<1||rows>16||Math.abs(heading.x)+Math.abs(heading.z)!==1)throw Error('Choose a lower depth from -54 to the current feet level and 1–16 tunnel rows.')
 const points=[];let cell={...start};const side=right(heading)
 const advance=(d,y,stage,row)=>{cell={x:cell.x+d.x,y,z:cell.z+d.z};points.push({cell:{...cell},clear:stage==='descent'?[{...cell,y:y+2},{...cell,y:y+1},{...cell}]:[{...cell},{...cell,y:y+1}],stage,row})}
 while(cell.y>depth)advance(heading,cell.y-1,'descent',0)
 const tunnelOrigin={...cell}
 for(let row=0;row<rows;row++){
  const direction=row%2?{x:-heading.x,z:-heading.z}:heading
  for(let i=0;i<length;i++)advance(direction,depth,'tunnel',row+1)
  if(row<rows-1)for(let i=0;i<spacing;i++)advance(side,depth,'connector',row+1)
 }
 return {kind:'strip',points,tunnelOrigin,depth,rows,length,spacing,rule:'Alternate right/right and left/left turns to advance into fresh four-block-spaced lanes.'}
}
export function quarryLayout(start,heading,{width=15,length=15,depth=2,descend=true,lateral=null}={}){
 if(!valid(start)||Math.abs(heading.x)+Math.abs(heading.z)!==1||![width,length,depth].every(Number.isSafeInteger)||width<1||width>15||length<1||length>15||depth!==2)throw Error('Quarry dimensions are 1–15 by 1–15, two blocks deep.')
 let origin={...start};const points=[],side=lateral||right(heading)
 if(descend)for(let i=0;i<depth;i++){origin={x:origin.x+heading.x,y:origin.y-1,z:origin.z+heading.z};points.push({cell:{...origin},clear:[{...origin,y:origin.y+2},{...origin,y:origin.y+1},{...origin}],stage:'descent',row:0})}
 for(let row=0;row<width;row++)for(let i=0;i<length;i++){
  const offset=row%2?length-i-1:i,cell={x:origin.x+heading.x*offset+side.x*row,y:origin.y,z:origin.z+heading.z*offset+side.z*row}
  points.push({cell,clear:[{...cell},{...cell,y:cell.y+1}],stage:'quarry',row:row+1})
 }
 return {kind:'quarry',points,origin,width,length,depth,heading:{...heading},lateral:{...side}}
}
export function miningRequest(raw){
 const s=String(raw||'').trim().toLowerCase().replace(/[.!?]+$/,'')
 let m=s.match(/^strip min(?:e|ing)(?: (\d+) rows? at (-?\d+))?$/)
 if(m)return {kind:'strip',rows:m[1]?Number(m[1]):8,depth:m[2]?Number(m[2]):-20}
 m=s.match(/^(?:quarry|mine dirt)(?: (.+))?$/)
 if(s==='mine dirt')return {kind:'quarry',material:'dirt'}
 if(m&&s.startsWith('quarry '))return {kind:'quarry',material:m[1]}
 return null
}
