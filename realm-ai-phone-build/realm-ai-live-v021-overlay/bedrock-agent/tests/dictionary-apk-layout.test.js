import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {gzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'

for(const compressed of [true,false])test(`dictionary loads in ${compressed?'reconstruction gzip':'AAPT expanded'} APK layout`,async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-dictionary-'))
 try{
  const source=new URL('../src/lexicon/lookup.js',import.meta.url)
  const catalog=new URL('../src/survival/catalog.js',import.meta.url).href
  fs.writeFileSync(path.join(dir,'lookup.mjs'),fs.readFileSync(source,'utf8').replace("'../survival/catalog.js'",JSON.stringify(catalog)))
  const dictionary=JSON.stringify({words:[{w:'hello',r:1,s:[{p:'interjection',d:'a greeting'}]}]})
  fs.writeFileSync(path.join(dir,'english-5000.json'+(compressed?'.gz':'')),compressed?gzipSync(dictionary):dictionary)
  fs.writeFileSync(path.join(dir,'minecraft-context.json'),'{}')
  const loaded=await import(pathToFileURL(path.join(dir,'lookup.mjs')).href)
  assert.equal(loaded.lookupEnglishWord('hello').senses[0].definition,'a greeting')
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
