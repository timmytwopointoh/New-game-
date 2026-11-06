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
// Build a finite concept graph from definitions and definitions of their
// terms. Each hop uses observed dictionary meanings, not invented semantics.
// A context score helps prioritize relevant senses and stop early; a weak
// score produces clarification instead of silently guessing an intent.
export async function exploreDefinition(word,initial,{
 lookupOffline=lookupEnglishWord,
 lookupOnline=null,
 context='',
 maxTerms=40,
 maxDepth=4,
 maxOnline=6,
 maxWallMs=16000
}={}){
 const root=key(word),choices=meaningOptions(initial)
 const selected=chooseMeaning(initial,context),ambiguous=selected.ambiguous
 const contextWords=new Set(toWords(context))
 const starting=selected.chosen?[selected.chosen]:choices.slice(0,Math.min(3,choices.length))
 const terms=[],seen=new Set([root]),queued=new Set(),queue=[],start=Date.now()
 let onlineCalls=0,edgeCount=0,sharedCount=0
 const seed=new Set([...starting.flatMap(s=>toWords(s.definition)),...toWords(root)])
 function add(term,depth,parent,priority){
  if(!/^[a-z][a-z-]{2,27}$/.test(term)||seen.has(term)||queued.has(term)||depth>maxDepth||queue.length>=256)return
  queued.add(term);queue.push({term,depth,parent,priority})
 }
 for(const s of starting)for(const term of toWords(s.definition).slice(0,12))
  add(term,1,root,contextWords.has(term)?3:seed.has(term)?2:1)
 while(queue.length&&terms.length<maxTerms&&Date.now()-start<maxWallMs){
  // Prefer words that help explain the current sentence, not obscure
  // digressions deep in the dictionary.
  queue.sort((a,b)=>b.priority-a.priority||a.depth-b.depth)
  const {term,depth,parent}=queue.shift()
  queued.delete(term);if(seen.has(term))continue;seen.add(term)
  let item=lookupOffline(term),source='offline'
  if(!item&&typeof lookupOnline==='function'&&onlineCalls<maxOnline&&Date.now()-start<maxWallMs-1500){
   onlineCalls++
   try{item=await lookupOnline(term);source='dictionary'}catch{continue}
  }
  if(!item)continue
  if(!meaningOptions(item).length&&Array.isArray(item.senses))
   item={...item,meanings:item.senses.map(s=>({
    partOfSpeech:s.partOfSpeech,definitions:[s.definition],synonyms:s.synonyms||[]}))}
  const senses=meaningOptions(item)
  if(!senses.length)continue
  const picked=chooseMeaning(item,context+' '+starting.map(x=>x.definition).join(' '))
  const selectedSenses=picked.chosen?[picked.chosen]:senses.slice(0,2)
  const words=[...new Set(selectedSenses.flatMap(s=>toWords(s.definition)))].slice(0,24)
  const overlap=words.filter(w=>seed.has(w)||contextWords.has(w)).length
  if(overlap)sharedCount+=Math.min(3,overlap)
  edgeCount+=words.length
  terms.push({word:term,source,depth,parent,senses:selectedSenses.slice(0,2).map(s=>({
   partOfSpeech:s.partOfSpeech,definition:s.definition})),
   related:words.filter(w=>w!==root).slice(0,12)})
  if(depth<maxDepth)for(const next of words.slice(0,9)){
   const priority=(contextWords.has(next)?6:0)+(seed.has(next)?3:0)+
    Math.max(0,4-depth)+(next.includes(root)?2:0)
   add(next,depth+1,term,priority)
  }
  const evidence=terms.length,links=sharedCount/Math.max(1,evidence*3),
   contextMatches=contextWords.size?Math.min(1,[...contextWords].filter(w=>
    seed.has(w)||terms.some(t=>t.related.includes(w))).length/contextWords.size):0
  const potential=.16+Math.min(.45,evidence/28)+Math.min(.22,links*.25)+contextMatches*.15
  if(evidence>=8&&contextWords.size>=2&&!ambiguous&&potential>=.78)break
 }
 const evidence=terms.length,
  contextMatches=contextWords.size?[...contextWords].filter(w=>
    seed.has(w)||terms.some(t=>t.related.includes(w))).length/contextWords.size:0,
  support=sharedCount/Math.max(1,evidence*3),
  score=Number(Math.max(0,Math.min(ambiguous?.46:1,
   .15+Math.min(.38,evidence/24)+Math.min(.2,support*.3)+Math.min(.22,contextMatches*.22))).toFixed(2))
 const concept={score,evidence,ambiguous:!!ambiguous,
  summary:selected.chosen?.definition||choices[0]?.definition||'Meaning not yet established.',
  contextMatched:Number(contextMatches.toFixed(2)),
  nextStep:ambiguous?'ask-context':score<.55?'seek-more-evidence':'use-conservative-meaning'}
 return {word:root,choices,terms,concept,onlineCalls,depthLimit:maxDepth,termLimit:maxTerms,
  ambiguous:!!ambiguous,exploredDepth:Math.max(0,...terms.map(t=>t.depth)),
  stoppedForTime:Date.now()-start>=maxWallMs}
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
