import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {resolveToolInstruction} from '../src/tool-language.js'
import {recognizeAutonomous} from '../src/autonomous-intent.js'
import {CommandVocabulary} from '../src/survival/command-vocabulary.js'
const world={inventoryKnown:true,inventory:new Map([[2,{network_id:8,count:1}],[5,{network_id:9,count:1}]]),registry:{items:{8:{name:'stone_pickaxe'},9:{name:'iron_pickaxe'}}}}
test('switch is resolved from Minecraft tool context without needing a dictionary meaning',()=>{
 for(const text of ['switch to the pickaxe','switch to there pickaxe so the could get stone','equip your pickaxe','hold the iron pickaxe']){
  assert.deepEqual(resolveToolInstruction(text,world)?.descriptor,{id:'hotbar',values:{slot:6}})
  assert.equal(recognizeAutonomous(text,{world}).command,'select slot 6')
 }
 assert.equal(resolveToolInstruction('command switch to the stone pickaxe',world).descriptor.values.slot,3)
})
test('questions, other switch senses and absent equipment never become guessed tool actions',()=>{
 assert.equal(resolveToolInstruction('what is a switch',world),null)
 assert.equal(resolveToolInstruction('switch to creative',world),null)
 assert.equal(recognizeAutonomous('what does switch mean?',{world}),null)
 assert.match(resolveToolInstruction('switch',world).error,/which tool/)
 assert.match(resolveToolInstruction('switch to a shovel',world).error,/No shovel/)
 assert.match(resolveToolInstruction('switch to the pickaxe',{...world,inventoryKnown:false}).error,/Waiting/)
 const inventory=new Map([[12,{network_id:8,count:1}]])
 assert.match(resolveToolInstruction('switch to the pickaxe',{...world,inventory}).error,/not in the hotbar/)
})
test('ambiguous dictionary definitions persist across restarts without becoming action aliases',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'realm-meaning-'))
 try{
  let vocabulary=new CommandVocabulary({directory,scope:'one'})
  assert(vocabulary.rememberDefinition('switch',{definition:'to change',source:'dictionary',sourceCount:1,meanings:[{partOfSpeech:'verb',definitions:['to change']},{partOfSpeech:'noun',definitions:['an electrical control']}]}))
  vocabulary.teach('action','march','walk')
  vocabulary=new CommandVocabulary({directory,scope:'one'})
  assert.equal(vocabulary.definitionFor('switch').meanings.length,2)
  assert.equal(vocabulary.definitionFor('switch').sourceCount,1)
  assert.equal(vocabulary.actions.switch,undefined)
  assert.equal(vocabulary.expand('march to 1 64 2').text,'walk to 1 64 2')
  assert.equal(new CommandVocabulary({directory,scope:'two'}).definitionFor('switch'),null)
 }finally{fs.rmSync(directory,{recursive:true,force:true})}
})
