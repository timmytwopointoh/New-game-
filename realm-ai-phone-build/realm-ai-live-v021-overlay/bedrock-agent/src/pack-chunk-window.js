// VEILFORGE's bounded adaptation of Gophertunnel PR #537's windowed
// resource-pack transfer strategy. Own implementation; no Go runtime or
// auth/transport replacement. Only used after the server sends PackDataInfo.
//
// Request up to 100 chunks per pack immediately, replenish the window as
// unique chunks arrive, handle out-of-order packets/duplicates, and use
// authoritative server offsets. The caller verifies full-file SHA-256.
const MAX_WINDOW = 100

function safeInt(n,label){
 if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid '+label)
 return n
}

export function createPackChunkWindow({chunkSize,chunkCount,size,request,write,windowSize=MAX_WINDOW}){
 safeInt(chunkSize,'chunk size');safeInt(chunkCount,'chunk count')
 safeInt(size,'resource pack size');safeInt(windowSize,'request window')
 if(chunkSize<1||chunkCount<1||size<1||windowSize<1||windowSize>MAX_WINDOW)
  throw Error('Invalid resource pack transfer window')
 const actualCount=Math.ceil(size/chunkSize)
 if(chunkCount!==actualCount)throw Error('Inconsistent server pack chunk count')
 if(typeof request!=='function'||typeof write!=='function')
  throw Error('Pack window requires request and write callbacks')

 const received=new Uint8Array(chunkCount)
 let issued=0,got=0,duplicates=0
 const pump=()=>{
  if(got===chunkCount)return 0
  const start=issued
  while(issued<chunkCount && issued-got<windowSize){
   const index=issued++
   request(index)
  }
  return issued-start
 }
 const accept=({index,offset,payload})=>{
  safeInt(index,'chunk index')
  if(index>=chunkCount||index>=issued)throw Error('Unrequested resource pack chunk')
  const expectedOffset=index*chunkSize
  const expectedLength=Math.min(chunkSize,size-expectedOffset)
  const data=Buffer.isBuffer(payload)?payload:Buffer.from(payload||[])
  if(offset!==undefined && offset!==null && BigInt(offset)!==BigInt(expectedOffset))
    throw Error('Realm pack offset mismatch')
  if(data.length!==expectedLength)throw Error('Invalid Realm pack chunk size')
  if(received[index]){
    duplicates++
    return {duplicate:true,complete:got===chunkCount,received:got,requested:issued,duplicates}
  }
  // Mark a chunk received only AFTER its bounded write succeeds.
  write(data,expectedOffset,index)
  received[index]=1;got++
  pump()
  return {duplicate:false,complete:got===chunkCount,received:got,requested:issued,duplicates}
 }
 return {
  pump,accept,
  snapshot:()=>({received:got,requested:issued,total:chunkCount,
   outstanding:issued-got,duplicates,complete:got===chunkCount})
 }
}
