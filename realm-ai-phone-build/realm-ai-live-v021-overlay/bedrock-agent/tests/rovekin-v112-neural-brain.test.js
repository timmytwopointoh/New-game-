import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {EventEmitter} from 'node:events'
import {LocalBrain} from '../src/local-llm.js'
import {brainContext,ROVEKIN_SYSTEM} from '../src/brain-context.js'
function rig(t,{bytes=Buffer.from('gguf fake model content'),malicious=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-ai-test-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const exe=path.join(dir,'librovekin_llama_server.so')
 fs.writeFileSync(exe,'ELF test stub')
 fs.writeFileSync(path.join(dir,'native-runtime.json'),JSON.stringify({executable:exe}))
 const model={id:'tiny-test',license:'Apache-2.0',url:'https://huggingface.co/test-pinned',
  minBytes:4,maxBytes:1000,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}
 return {dir,exe,model,bytes}
}
const until=async(f)=>{for(let i=0;i<70;i++){if(f())return true;await new Promise(r=>setTimeout(r,15))}return false}
test('real model setup downloads exact bytes to private storage only after user opt-in',async t=>{
 const {dir,model,bytes}=rig(t)
 const requested=[]
 const brain=new LocalBrain({directory:dir,model,fetchImpl:async url=>{
  requested.push(url)
  return new Response(bytes,{status:200,headers:{'content-length':String(bytes.length)}})
 }})
 assert.equal(brain.status().installed,false)
 assert.equal(requested.length,0,'no invisible auto-download on app startup')
 const began=brain.install()
 assert.equal(began.accepted,true)
 assert.equal(await until(()=>brain.status().installed),true,brain.status().error)
 assert.equal(requested.length,1)
 assert.equal(fs.readFileSync(brain.modelFile).toString(),bytes.toString())
 assert.equal(fs.existsSync(brain.tempFile),false)
 assert.equal(brain.status().phase,'installed')
 brain.stop()
})
test('checksum mismatch never activates untrusted or partial GGUF bytes',async t=>{
 const {dir,model,bytes}=rig(t)
 const brain=new LocalBrain({directory:dir,model:{
  ...model,sha256:'0'.repeat(64)
 },fetchImpl:async()=>new Response(bytes,{status:200})})
 assert.equal(brain.install().accepted,true)
 assert.equal(await until(()=>brain.status().phase==='download-failed'),true)
 assert.match(brain.status().error,/SHA-256/i)
 assert.equal(fs.existsSync(brain.modelFile),false)
 assert.equal(brain.status().installed,false)
})
test('native library is required and model endpoint never sends prompts to external hosts',async t=>{
 const {dir,model,bytes}=rig(t)
 fs.unlinkSync(path.join(dir,'librovekin_llama_server.so'))
 const brain=new LocalBrain({directory:dir,model,fetchImpl:async()=>{throw Error('network must not be called')}})
 assert.equal(brain.install().accepted,false)
 assert.match(brain.install().message,/missing.*ARM64|runtime/i)
})
test('native Qwen runtime is localhost bearer-only and returns generated text, not commands',async t=>{
 const {dir,model,bytes}=rig(t)
 const requests=[],launched=[]
 const exe=path.join(dir,'librovekin_llama_server.so')
 fs.writeFileSync(path.join(dir,model.id+'.gguf'),bytes)
 const runner=new EventEmitter()
 runner.stderr=new EventEmitter();runner.exitCode=null
 runner.kill=()=>{runner.exitCode=0;runner.emit('exit',0);return true}
 const brain=new LocalBrain({directory:dir,model,spawnImpl:(cmd,args,opts)=>{
  launched.push({cmd,args,opts});return runner
 },fetchImpl:async(url,opts={})=>{
  requests.push({url,opts})
  if(url.endsWith('/health'))return new Response('{"status":"ok"}',{status:200})
  if(url.endsWith('/v1/chat/completions'))return new Response(JSON.stringify({
   choices:[{message:{content:'I could scout the forest, but I have not started walking.'}}]
  }),{status:200})
  throw Error('Unexpected URL '+url)
 }})
 assert.equal(await brain.verifyModel(),true)
 const result=await brain.answer('What could we try next?',{
  system:ROVEKIN_SYSTEM,context:'No active movement route',recent:[]})
 assert.equal(result.available,true,result.message)
 assert.match(result.message,/forest/)
 assert.equal(launched.length,1)
 assert.equal(launched[0].cmd,exe)
 assert(launched[0].args.includes('127.0.0.1'))
 assert(launched[0].args.includes('--api-key'))
 assert.equal(requests.length,2)
 assert(requests.every(x=>String(x.url).startsWith('http://127.0.0.1:')))
 assert(requests.every(x=>String(x.opts.headers.authorization||'').startsWith('Bearer ')))
 const payload=JSON.parse(requests[1].opts.body)
 assert.match(payload.messages[0].content,/NEVER operate the game/i)
 assert.match(payload.messages.at(-1).content,/What could we try next/)
 brain.stop()
 assert.equal(runner.exitCode,0)
})
test('retrieval includes relevant observed Realm facts and recent private dialog, never credentials or invented success',()=>{
 const world={gameMode:'survival',movementVerified:false,attributes:{'minecraft:health':14},
  inventoryKnown:true,items:()=>({oak_log:5,dirt:2})}
 const survival={world,navigation:{state:'waiting-for-readiness',reason:'abilities-unknown',job:null},
  companion:{homeMemory:{hasHome:true},homeProject:{state:'paused',reason:'Need actual materials'}},
  commandPlans:{running:1},commandVocabulary:{definitionFor:()=>null}}
 const connection={spawned:true,config:{localAPI:{token:'SECRET_PRIVATE_TOKEN'}}}
 const memory={recent:()=>[{role:'owner',text:'We were testing the first house'},
  {role:'rovekin',text:'I need server confirmation before I finish'}]}
 const ctx=brainContext('How is our house progressing?',{survival,connection,memory})
 assert.match(ctx.context,/oak_log x5/)
 assert.match(ctx.context,/Home work state: paused/)
 assert.match(ctx.context,/not confirmed/)
 assert.match(ctx.context,/abilities-unknown/)
 assert(!JSON.stringify(ctx).includes('SECRET_PRIVATE_TOKEN'))
 assert.equal(ctx.recent.length,2)
 assert.equal(ctx.recent[0].role,'user')
})
