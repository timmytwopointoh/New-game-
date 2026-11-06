import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {EventEmitter} from 'node:events'
import {AdaptiveIntentModel} from '../src/survival/adaptive-intent-model.js'
import {CommandVocabulary,suggestAction} from '../src/survival/command-vocabulary.js'
import {SurvivalController} from '../src/survival/controller.js'
import {createApi} from '../src/api.js'

const temp=t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-learn-'))
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
 return root
}
test('offline trainable classifier persists owner examples per Realm and generalizes spelling',t=>{
 const dir=temp(t)
 let model=new AdaptiveIntentModel({directory:dir,scope:'realm-A'})
 assert.equal(model.snapshot().ownerExamples,0)
 assert.equal(model.suggest('cleave'),null)
 assert.equal(model.train('cleave','dig').accepted,true)
 assert.equal(model.suggest('cleave')?.id,'dig')
 assert.equal(model.suggest('cleaves')?.id,'dig','trained word should generalize to a related spelling')
 assert.equal(model.snapshot().ownerExamples,1)
 assert.equal(fs.statSync(model.file).mode&0o077,0,'learning is private on disk')
 model=new AdaptiveIntentModel({directory:dir,scope:'realm-A'})
 assert.equal(model.suggest('cleave')?.id,'dig','restarted model must load training')
 assert.equal(model.snapshot().ownerExamples,1)
 assert.equal(new AdaptiveIntentModel({directory:dir,scope:'realm-B'}).snapshot().ownerExamples,0)
 model.forget('cleave')
 assert.equal(new AdaptiveIntentModel({directory:dir,scope:'realm-A'}).snapshot().ownerExamples,0)
})
test('training never accepts controls, credentials, unsupported actions or large chat',()=>{
 const model=new AdaptiveIntentModel({scope:'realm-A'})
 for(const text of ['stop','cancel','password','Bearer token','my email address','123 64 12',
  'a'.repeat(49),'use the super secret code'])
  assert.throws(()=>model.train(text,'dig'),/short English word|credentials|commands/i,text)
 assert.throws(()=>model.train('charge','teleport'),/supported action/)
 assert.equal(model.suggest('can you mine the coordinates 123 64 12'),null)
})
test('direct owner vocabulary corrections train classifier but never execute Minecraft',t=>{
 const dir=temp(t)
 const model=new AdaptiveIntentModel({directory:dir,scope:'realm-alpha'})
 const vocab=new CommandVocabulary({directory:dir,scope:'realm-alpha',intentModel:model})
 assert(vocab.teach('action','cleave','dig').accepted)
 assert.equal(model.suggest('cleave')?.id,'dig')
 assert.equal(vocab.expand('cleave 2 64 -2').text,'dig 2 64 -2')
 assert.equal(model.snapshot().ownerExamples,1)
 const fallback=suggestAction('cleaves 2 64 -2',vocab)
 assert.equal(fallback?.id,'dig')
 assert.equal(fallback?.source,'trained')
 assert(vocab.forget('action','cleave').accepted)
 assert.equal(model.snapshot().ownerExamples,0)
})
test('phone chat can train a word without starting tasks or connecting to a Realm',t=>{
 const root=temp(t)
 const connection=new EventEmitter()
 Object.assign(connection,{
  config:{ownerPlayerNames:[]},events:[],nextEventId:0,spawned:false,
  send(){throw Error('No Minecraft transmission allowed')},
  say(){throw Error('No Minecraft chat allowed')}
 })
 const survival=new SurvivalController(connection,{plansDirectory:path.join(root,'plans'),scope:'realm-A'})
 connection.survival=survival
 const calls=[]
 survival.handle=raw=>{calls.push(raw);return {accepted:true,message:raw}}
 const api=createApi({localAPI:{token:'test-token'}},connection,()=>{})
 const result=api.controller.message('command train word cleave = dig')
 assert.equal(result.accepted,true)
 assert.equal(result.queued,false)
 assert.match(result.message,/No Minecraft action was started/)
 assert.equal(survival.intentModel.snapshot().ownerExamples,1)
 assert.deepEqual(calls,[])
 assert.equal(api.controller.message('command forget example cleave').accepted,true)
 assert.equal(survival.intentModel.snapshot().ownerExamples,0)
 assert.deepEqual(calls,[])
})
