// Bounded definition-of-definitions learning. Dictionary pages are DATA ONLY:
// their text never becomes a game command or code. A sense must be selected by
// conversational context or the owner, not by taking the first definition.
import {lookupEnglishWord} from './lexicon/lookup.js'
const STOP=new Set('a an the and or of to in on at with from for by through as is are was were be been being it its this that which who whose when where how what why does do can could would should may might about into over under after before someone something somebody any one thing things person people act action state condition way means mean use used using make made having have has had usually often such so their they them you your he she his her we our these those other more than while during upon out up down not very also relating related including include without'.split(' '))
const TOKEN=/[a-z][a-z-]{2,27}/gi
const IGNORE=/https?:|www\.|[{}[\]<>]|[\x00-\x1f]/
const toWords=s=>[...new Set(String(s||'').toLowerCase().match(TOKEN)||[])].filter(x=>!STOP.has(x))
const key=s=>String(s||'').toLowerCase().trim()
const clean=s=>String(s||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240)
export function meaningOptions(result){
 const collected=[]
 for(const m of (result?.meanings||[]).slice(0,10)){
  for(const definition of (m.definitions||[]).slice(0,4)){
   const c=clean(definition)
   if(c&&!collected.some(v=>v.definition===c))collected.push({partOfSpeech:clean(m.partOfSpeech).slice(0,24),definition:c,synonyms:(m.synonyms||[]).slice(0,8).map(clean)})
  }
 }
 return collected.slice(0,4)
}
export function chooseMeaning(result,reference=''){
 const choices=meaningOptions(result)
 if(!choices.length)return {chosen:null,choices,ambiguous:false,reason:'no-definition'}
 if(choices.length===1)return {chosen:choices[0],choices,ambiguous:false,reason:'one-sense'}
 const context=new Set(toWords(reference))
 if(!context.size)return {chosen:null,choices,ambiguous:true,reason:'needs-context'}
 const ranked=choices.map((choice,index)=>{
  const words=new Set([...toWords(choice.definition),...choice.synonyms.flatMap(toWords)])
  const match=[...context].filter(w=>words.has(w)).length
  return {index,match,choice}
 }).sort((a,b)=>b.match-a.match)
 if(ranked[0].match===0||ranked[0].match===ranked[1].match)return {chosen:null,choices,ambiguous:true,reason:'ambiguous-reference'}
 return {chosen:ranked[0].choice,choices,ambiguous:false,reason:'context-match'}
}
export async function exploreDefinition(word,initial,{
 lookupOffline=lookupEnglishWord,
 lookupOnline=null,
 maxTerms=12,
 maxDepth=2,
 maxOnline=2
}={}){
 const root=key(word)
 const choices=meaningOptions(initial)
 const collected=[],seen=new Set([root]),queue=[]
 for(const c of choices.slice(0,3))for(const term of toWords(c.definition).slice(0,9))queue.push({term,depth:1})
 let onlineCalls=0
 while(queue.length&&collected.length<maxTerms){
  const {term,depth}=queue.shift()
  if(seen.has(term)||depth>maxDepth)continue
  seen.add(term)
  let result=lookupOffline(term)
  let source='offline'
  if(!result&&typeof lookupOnline==='function'&&onlineCalls<maxOnline){
   onlineCalls++
   try{result=await lookupOnline(term);source='dictionary'}catch{continue}
  }
  if(!result)continue
  const options=meaningOptions(result)
  if(!options.length&&Array.isArray(result.senses)){
   result={...result,meanings:result.senses.map(s=>({partOfSpeech:s.partOfSpeech,definitions:[s.definition]}))}
  }
  const meanings=meaningOptions(result)
  if(!meanings.length)continue
  collected.push({word:term,source,senses:meanings.slice(0,2).map(m=>({partOfSpeech:m.partOfSpeech,definition:m.definition}))})
  if(depth<maxDepth)for(const term2 of toWords(meanings[0].definition).slice(0,5))if(!seen.has(term2))queue.push({term:term2,depth:depth+1})
 }
 return {word:root,choices,terms:collected,onlineCalls,depthLimit:maxDepth,termLimit:maxTerms,ambiguous:choices.length>1}
}
export function explainChoices(word,choices){
 const list=choices.slice(0,4).map((x,i)=>String(i+1)+') '+(x.partOfSpeech?x.partOfSpeech+': ':'')+x.definition).join(' | ')
 return '“'+String(word).slice(0,30)+'” has '+choices.length+' possible meanings: '+list+
 '. Which one fits what you said? Reply with 1–'+choices.length+', or give a short reference like "I mean the one about walking." I will not guess or execute anything.'
}
export function identifyReference(reference,choices){
 const text=clean(reference)
 const n=text.match(/^(?:meaning |option |number |#)?([1-4])$/i)
 if(n){const i=Number(n[1])-1;return choices[i]||null}
 const sense=chooseMeaning({meanings:choices.map(c=>({partOfSpeech:c.partOfSpeech,definitions:[c.definition],synonyms:c.synonyms||[]}))},text)
 return sense.chosen
}
