import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {parseStudyWords,studyWordBatch} from '../src/word-study-queue.js'
import {KnowledgeMemory} from '../src/survival/knowledge-memory.js'

function memory(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-study-'))
 t.after(()=>fs.rmSync(dir,{force:true,recursive:true}))
 return new KnowledgeMemory({directory:dir,scope:'owner-test-realm'})
}
test('owner can explicitly submit a batch of ordinary words without leaking a command',()=>{
 assert.deepEqual(parseStudyWords('tree, torch, spruce, tree'),['tree','torch','spruce'])
 for(const value of ['my email@example.com','home 162 96 53','password','abcdefghi, '.repeat(15),'quit; stop; token'])
  assert.throws(()=>parseStudyWords(value),/words|valid English|personal/)
})
test('offline glossary definitions are saved without network or Minecraft actions',async t=>{
 const m=memory(t),called=[]
 const result=await studyWordBatch(['tree','spruce'],{
  memory:m,
  lookupOffline:word=>({senses:[{partOfSpeech:'noun',definition:'An offline known meaning for '+word}]}),
  lookupOnline:async word=>{called.push(word);throw Error('No online call allowed')}
 })
 assert.equal(result.stored,2)
 assert.equal(result.online,0)
 assert.deepEqual(called,[])
 assert.equal(m.recall('tree').senses[0].definition,'An offline known meaning for tree')
 assert.equal(m.summary().words,2)
 const repeat=await studyWordBatch(['tree'],{memory:m,lookupOffline:()=>null})
 assert.equal(repeat.cached,1)
})
test('an unfamiliar word uses the dictionary only when explicitly requested',async t=>{
 const m=memory(t),lookups=[]
 const result=await studyWordBatch(['bramble','trestle'],{
  memory:m,lookupOffline:word=>word==='bramble'?{senses:[{partOfSpeech:'noun',definition:'A thorny plant.'}]}:null,
  lookupOnline:async word=>{
   lookups.push(word)
   return {source:'owner-requested dictionary',meanings:[{partOfSpeech:'noun',definitions:['A supporting framework.']}]}
  }
 })
 assert.equal(result.online,1)
 assert.equal(result.stored,2)
 assert.deepEqual(lookups,['trestle'])
 assert.equal(m.recall('trestle').senses[0].definition,'A supporting framework.')
})
test('STOP/Realm change during online lookup prevents stale memorization',async t=>{
 const m=memory(t)
 let current=true
 let release
 const waiting=new Promise(resolve=>release=resolve)
 const pending=studyWordBatch(['trestle'],{
  memory:m,lookupOffline:()=>null,lookupOnline:()=>waiting,isCurrent:()=>current
 })
 current=false
 release({meanings:[{partOfSpeech:'noun',definitions:['A supporting framework.']}]})
 const result=await pending
 assert.equal(result.aborted,true)
 assert.equal(m.recall('trestle'),null)
})
