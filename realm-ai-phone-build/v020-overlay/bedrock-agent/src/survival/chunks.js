// Bedrock v8/v9 network subchunks. Bounds-check all lengths; unknown data stays unknown.
export class Reader{
 constructor(buffer){if(!Buffer.isBuffer(buffer)||buffer.length>4*1024*1024)throw Error('Invalid chunk payload');this.b=buffer;this.i=0}
 byte(){if(this.i>=this.b.length)throw Error('Truncated subchunk');return this.b[this.i++]}
 u32(){if(this.i+4>this.b.length)throw Error('Truncated palette words');const v=this.b.readUInt32LE(this.i);this.i+=4;return v}
 varint(){let n=0;for(let j=0;j<5;j++){const v=this.byte();if(j===4&&v>15)throw Error('Invalid varint');n+=(v&127)*2**(7*j);if(!(v&128))return n>>>0}throw Error('Invalid varint')}
 signed(){const n=this.varint();return (n>>>1)^-(n&1)}
}
export function decodeSection(reader,fallbackY){
 const r=reader instanceof Reader?reader:new Reader(reader),version=r.byte()
 if(version!==8&&version!==9)throw Error('Unsupported subchunk version '+version)
 const count=r.byte();if(count>2)throw Error('Unsupported block layer count')
 const rawY=version===9?r.byte():fallbackY,y=version===9?(rawY>127?rawY-256:rawY):rawY
 const layers=[]
 for(let l=0;l<count;l++){
  const header=r.byte(),bits=header>>>1
  if(!(header&1)||![0,1,2,3,4,5,6,8,16].includes(bits))throw Error('Unsupported network palette')
  const data=new Int32Array(4096)
  if(bits===0){data.fill(r.signed());layers.push(data);continue}
  const perWord=Math.floor(32/bits),n=Math.ceil(4096/perWord),words=new Uint32Array(n)
  for(let i=0;i<n;i++)words[i]=r.u32()
  const size=r.signed();if(size<1||size>4096)throw Error('Invalid palette size')
  const palette=[];for(let i=0;i<size;i++)palette.push(r.signed())
  const mask=(1<<bits)-1
  for(let i=0;i<4096;i++){const index=(words[Math.floor(i/perWord)]>>>((i%perWord)*bits))&mask;if(index>=size)throw Error('Palette index out of range');data[i]=palette[index]}
  layers.push(data)
 }
 return {y,layers}
}
export const blockIndex=(x,y,z)=>((x&15)<<8)|((z&15)<<4)|(y&15)
