import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {chooseMeaning,identifyReference,meaningOptions,exploreDefinition} from '../src/definition-comprehension.js'
import {CommandVocabulary} from '../src/survival/command-vocabulary.js'
import {parseCommandRequest,parseDescriptor} from '../src/survival/command-plans.js'
import {blueprint,buildSize} from '../src/survival/building.js'

const word={
 word:'bank',meanings:[
 {partOfSpeech:'noun',definitions:['The land beside a river'],synonyms:['shore']},
 {partOfSpeech:'noun',definitions:['A financial institution that stores money'],synonyms:['finance']}
 ]}
test('several meanings remain alternatives, no arbitrary first-sense choice',()=>{
 const result=chooseMeaning(word)
 assert.equal(result.ambiguous,true)
 assert.equal(result.chosen,null)
 assert.equal(result.choices.length,2)
 assert.match(identifyReference('number 2',result.choices).definition,/financial/)
 assert.match(identifyReference('shore near river',result.choices).definition,/river/)
 assert.equal(identifyReference('I have no reference',result.choices),null)
})
test('recursive definition explorer is bounded and cycle safe',async()=>{
 const glossary={
 river:{word:'river',meanings:[{partOfSpeech:'noun',definitions:['A stream of water flowing over land']}]},
 water:{word:'water',meanings:[{partOfSpeech:'noun',definitions:['A liquid in a river']}]},
 flowing:{word:'flowing',meanings:[{partOfSpeech:'verb',definitions:['Moving like a stream']}]}
 }
 let lookups=0
 const tree=await exploreDefinition('bank',word,{
  lookupOffline:term=>glossary[term]||null,
  lookupOnline:async term=>{lookups++;throw Error('404: '+term)},
  maxTerms:8,maxDepth:2,maxOnline:2
 })
 assert.equal(tree.ambiguous,true)
 assert.ok(tree.terms.some(t=>t.word==='river'))
 assert.ok(tree.terms.length<=8)
 assert.ok(lookups<=2)
})
test('definition graph is remembered without learning an executable command',t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'vf-semantic-memory-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const vocabulary=new CommandVocabulary({directory:dir,scope:'realm-alpha'})
 assert.equal(vocabulary.rememberDefinition('bank',{definition:'A financial institution',source:'dictionary',sourceCount:1,
  meanings:word.meanings,relatedTerms:[{word:'financial',source:'offline',senses:[{partOfSpeech:'adjective',definition:'Related to money'}]}]}),true)
 const restored=new CommandVocabulary({directory:dir,scope:'realm-alpha'})
 assert.equal(restored.definitionFor('bank').relatedTerms[0].word,'financial')
 assert.equal(restored.meaning('bank'),null)
 assert.equal(new CommandVocabulary({directory:dir,scope:'realm-beta'}).definitionFor('bank'),null)
})
test('real rectangular build parser handles 8×8 and 5×10',()=>{
 const a=parseCommandRequest('build an 8x8 floor with dirt at 10 64 20').descriptor
 assert.deepEqual({id:a.id,width:a.values.width,height:a.values.height,material:a.values.material},{id:'build_floor',width:8,height:8,material:'dirt'})
 const b=parseCommandRequest('build 5x10 wall of cobblestone at -8 72 40').descriptor
 assert.equal(b.id,'build_wall');assert.equal(b.values.width,5);assert.equal(b.values.height,10)
 const c=parseDescriptor('build floor 5 by 10 with dirt at 0 64 0')
 assert.equal(c.values.height,10)
})
test('unknown origin asks for it, oversized jobs ask for safe stages',()=>{
 assert.throws(()=>parseCommandRequest('build 8x8 floor with dirt'),/Where should/i)
 assert.throws(()=>parseCommandRequest('build a 20x20 floor with dirt at 0 64 0'),/split/i)
 assert.equal(buildSize({shape:'floor',width:16,height:16}),256)
 assert.throws(()=>buildSize({shape:'floor',width:17,height:16}),/split/i)
})
test('blueprint is proportional to user requested dimensions, not fixed templates',()=>{
 const origin={x:100,y:68,z:200}
 const floor=blueprint({shape:'floor',origin,width:8,height:8,material:'dirt'})
 const long=blueprint({shape:'floor',origin,width:5,height:10,material:'stone'})
 assert.equal(floor.positions.length,64)
 assert.equal(long.positions.length,50)
 assert.equal(Math.max(...long.positions.map(p=>p.z)),origin.z+9)
 assert.equal(Math.max(...long.positions.map(p=>p.x)),origin.x+4)
})
