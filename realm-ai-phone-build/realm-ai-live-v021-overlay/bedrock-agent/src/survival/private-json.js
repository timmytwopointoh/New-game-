import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export function readPrivateJson(file, maxBytes=131072){
  if(fs.statSync(file).size>maxBytes)throw Error('Saved memory is too large.')
  return JSON.parse(fs.readFileSync(file,'utf8'))
}

// Rename a complete private file; failed writes leave the previous memory intact.
export function writePrivateJson(file, value){
  if(!file)return
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700})
  const temporary=file+'.'+crypto.randomUUID()+'.tmp'
  try{
    fs.writeFileSync(temporary,JSON.stringify(value),{mode:0o600,flag:'wx'})
    fs.renameSync(temporary,file)
  }finally{
    if(fs.existsSync(temporary))fs.unlinkSync(temporary)
  }
}
