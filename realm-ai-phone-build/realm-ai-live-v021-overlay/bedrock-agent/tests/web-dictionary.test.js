import test from 'node:test'
import assert from 'node:assert/strict'
import {OpenDictionaryResearch} from '../src/web-dictionary.js'
const response=(entry,status=200)=>({ok:status===200,status,headers:{get:()=>null},text:async()=>JSON.stringify(entry)})
test('Key-free dictionary lookup reads only fixed HTTPS dictionary URL',async()=>{
 let url,opts
 const research=new OpenDictionaryResearch({fetcher:async(u,o)=>{url=u;opts=o;return response([{word:'march',meanings:[{partOfSpeech:'verb',definitions:[{definition:'To walk with measured steps.',synonyms:['walk']}]}]}])}})
 const result=await research.study('march')
 assert.equal(url,'https://api.dictionaryapi.dev/api/v2/entries/en/march')
 assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error')
 assert.equal(result.action,'walk');assert.equal(result.sourceCount,1)
})
test('No guessed action when dictionary has no supported synonym',async()=>{
 const research=new OpenDictionaryResearch({fetcher:async()=>response([{word:'do',meanings:[{partOfSpeech:'verb',definitions:[{definition:'To perform an action.',synonyms:[]}]}]}])})
 const r=await research.study('do');assert.equal(r.action,null);assert.match(r.reason,/unambiguous/)
})
test('Rejects URLs, shell symbols and giant remote replies',async()=>{
 const research=new OpenDictionaryResearch({fetcher:async()=>response([{word:'march',meanings:[]}])})
 await assert.rejects(()=>research.study('https://example.com'),/single ordinary/)
 await assert.rejects(()=>research.study('march;rm'),/single ordinary/)
 await assert.rejects(()=>research.study('march'),/usable definition/)
 const tooLarge=new OpenDictionaryResearch({fetcher:async()=>({ok:true,status:200,headers:{get:()=>String(100000)},text:async()=>''})})
 await assert.rejects(()=>tooLarge.study('march'),/safe size/)
})
