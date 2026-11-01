import test from 'node:test'
import assert from 'node:assert/strict'
import {researchRouting,unsupportedResearchResponse} from '../src/agent-lookup-router.js'
test('Bot researches open-ended Minecraft tasks automatically when Google is connected',()=>{
 for(const msg of ['Go get wood','Please build me a shelter','I want you to gather cobblestone','Can you fight the zombie','Chop down a tree']){
  assert.deepEqual(researchRouting(msg,{hasGoogle:true}),{kind:'google',task:msg})
 }
})
test('Bot detects unsupported tasks without falsely requiring a Google key',()=>{
 assert.deepEqual(researchRouting('gather some wood',{hasGoogle:false}),{kind:'needs-ai',task:'gather some wood'})
 assert.match(unsupportedResearchResponse(),/without a Google key/)
})
test('Bot looks up unknown concrete action verbs without exposing a browser',()=>{
 assert.deepEqual(researchRouting('march to 3 64 6'),{kind:'dictionary',word:'march',original:'march to 3 64 6'})
 assert.deepEqual(researchRouting('dredge at 3 64 6',{hasGoogle:true}),{kind:'dictionary',word:'dredge',original:'dredge at 3 64 6'})
})
test('Never researches questions, Stop, settings, status, banter or network payloads',()=>{
 for(const msg of ['stop','cancel job','command dig 1 2 3','hello','how are you?','can you get wood?','survival status','inventory','select plan 3','please make me a house?','open https://example.com','hello\nattack']){
  assert.equal(researchRouting(msg,{hasGoogle:true}),null,msg)
 }
})
test('Rejects unsupported long commands and only bounded task instructions',()=>{
 assert.equal(researchRouting('a'.repeat(191),{hasGoogle:true}),null)
 assert.equal(researchRouting('Please fight the zombie',{hasGoogle:true})?.kind,'google')
 assert.equal(researchRouting('Go to 1 64 2',{hasGoogle:true})?.kind,'google')
})
