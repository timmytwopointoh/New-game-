import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {EventEmitter} from 'node:events'
import {KnowledgeMemory} from '../src/survival/knowledge-memory.js'
import {CompanionMind} from '../src/survival/companion-mind.js'
import {CompanionVoice,seriousContext} from '../src/survival/companion-voice.js'
import {exploreDefinition} from '../src/definition-comprehension.js'
import {interpretNameUtterance} from '../src/name-intent.js'
import {LandmarkMemory} from '../src/survival/landmark-memory.js'
import {RealmChat} from '../src/realm-chat.js'

test('private phone knowledge grows beyond the old 50-word cap and survives a restart',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vf-knowledge-'))
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
 let m=new KnowledgeMemory({directory:root,scope:'realm-alpha'})
 for(let i=0;i<120;i++){
  const w='word'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26)
  assert.equal(m.learn(w,{meanings:[{partOfSpeech:'noun',definition:'A remembered meaning of '+w}]}),true)
 }
 assert.equal(m.summary().words,120)
 m=new KnowledgeMemory({directory:root,scope:'realm-alpha'})
 assert.equal(m.summary().words,120)
 assert.equal(m.recall('wordaa').senses[0].definition,'A remembered meaning of wordaa')
 assert.equal(new KnowledgeMemory({directory:root,scope:'realm-beta'}).recall('wordaa'),null)
})

test('a contextual word explanation follows multiple evidence hops without guessing intent',async()=>{
 const entries={
  navigate:{senses:[{partOfSpeech:'verb',definition:'Find a path to a location.'}]},
  path:{senses:[{partOfSpeech:'noun',definition:'A route connecting places through terrain.'}]},
  location:{senses:[{partOfSpeech:'noun',definition:'A point in a landscape.'}]},
  route:{senses:[{partOfSpeech:'noun',definition:'A course to travel through an area.'}]},
  terrain:{senses:[{partOfSpeech:'noun',definition:'Landforms such as forests and mountains.'}]}
 }
 const seed={meanings:[{partOfSpeech:'verb',definitions:['Navigate using an observed path and location.']}]}
 const result=await exploreDefinition('travel',seed,{lookupOffline:w=>entries[w]||null,
  context:'help me travel on a safe path',maxTerms:20,maxDepth:4,maxOnline:0})
 assert.equal(result.word,'travel')
 assert(result.concept.evidence>=2)
 assert(result.concept.score>0)
 assert(result.exploredDepth>=1)
 assert.equal(result.onlineCalls,0)
})

test('uncertain multiple word senses remain ambiguous instead of becoming commands',async()=>{
 const seed={meanings:[{partOfSpeech:'noun',definitions:['A raised river bank.']},
  {partOfSpeech:'noun',definitions:['A financial institution.']}]}
 const result=await exploreDefinition('bank',seed,{lookupOffline:()=>null,maxOnline:0,context:''})
 assert.equal(result.ambiguous,true)
 assert.equal(result.concept.nextStep,'ask-context')
 assert(result.concept.score<=.46)
})

test('an independent companion saves its private tone and can become serious for danger',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vf-personality-'))
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
 const a=new CompanionMind({directory:root,scope:'realm-a',random:()=>.2})
 const voice=new CompanionVoice(a)
 const before=voice.values.humor
 assert(voice.handle('be funnier').accepted)
 assert(voice.values.humor>before)
 const b=new CompanionMind({directory:root,scope:'realm-a',random:()=>.9})
 assert.equal(new CompanionVoice(b).values.humor,voice.values.humor)
 assert.equal(seriousContext('There is lava and a creeper here!'),true)
 assert(new CompanionVoice(b).handle('be more serious').accepted)
})

test('name reference is not a job; direct owner address is interpreted',()=>{
 const cases=[
  ['hey tirionomni come her','request'],
  ['tirionomni, what are you working on?','question'],
  ['dang u should have grabbed that while you were there tirionomni','reference'],
  ['the bot is tirionomni','reference'],
  ['tirionomni is a great builder','reference']
 ]
 for(const [input,kind] of cases)assert.equal(interpretNameUtterance(input,'tirionomni').kind,kind,input)
 assert.equal(interpretNameUtterance('hey tirionomni come her','tirionomni').command,'follow me')
})

test('only the configured owner can send real named chat requests and casual references are ignored',()=>{
 const connection=new EventEmitter()
 connection.username='tirionomni';connection.config={minecraft:{botPlayerName:'tirionomni'}}
 connection.spawned=true;connection.chatDiagnostics={}
 const calls=[],said=[]
 connection.say=s=>{said.push(s);return true}
 const planner=new EventEmitter()
 const controller={planner,message:(cmd)=>{calls.push(cmd);return {accepted:true,message:'Task received.'}}}
 const realmChat=new RealmChat(connection,controller,{ownerPlayerNames:['Owner']},()=>{},
  {cooldownMs:0,clock:(()=>{let t=0;return ()=>t+=1000})()})
 connection.emit('player-chat',{source:'Owner',message:'dang u should have grabbed that while you were there tirionomni'})
 connection.emit('player-chat',{source:'Stranger',message:'tirionomni come here'})
 connection.emit('player-chat',{source:'Owner',message:'hey tirionomni come her'})
 assert.deepEqual(calls,['follow me'])
 assert.equal(said.length,1)
 realmChat.stop()
})
