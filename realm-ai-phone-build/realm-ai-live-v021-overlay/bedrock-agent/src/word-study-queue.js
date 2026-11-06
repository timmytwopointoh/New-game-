// Explicit owner-requested batch English word study.
// Each lookup concerns one safe ordinary word, never raw chat/Realm identifiers.
// Definition learning is not permission to run a Minecraft command.
const VALID=/^[a-z][a-z-]{2,29}$/
const SENSITIVE=/^(?:password|secret|token|account|email|auth|login|address|telephone|keycode)$/
export function parseStudyWords(raw){
 if(typeof raw!=='string'||raw.length>180||/[@/:\\{}\x00-\x1f\x7f0-9]/.test(raw))
  throw Error('Use 1–8 ordinary English words, separated by commas, without numbers or personal information.')
 const rawWords=raw.toLowerCase().split(/[\s,;]+/).filter(Boolean)
 if(rawWords.length<1||rawWords.length>8)throw Error('Choose 1–8 valid English words, even when duplicates are included.')
 const words=[...new Set(rawWords)]
 if(words.length<1||words.length>8||words.some(w=>!VALID.test(w)||SENSITIVE.test(w)))
  throw Error('Choose 1–8 valid English words (3–30 letters), separated by commas.')
 return words
}
const cleanText=s=>String(s||'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,240)
export async function studyWordBatch(words,{
 lookupOffline=()=>null,lookupOnline=null,memory,isCurrent=()=>true
}={}){
 if(!Array.isArray(words)||words.length>8||words.length<1||words.some(w=>!VALID.test(w)||SENSITIVE.test(w)))
  throw Error('Invalid study list')
 if(!memory||typeof memory.learn!=='function'||typeof memory.recall!=='function')
  throw Error('No private language memory available')
 let stored=0,cached=0,unknown=0,failed=0,online=0
 const outcomes=[]
 for(const word of words){
  if(!isCurrent())return {stored,cached,unknown,failed,online,aborted:true,outcomes}
  if(memory.recall(word)?.senses?.length){cached++;outcomes.push({word,result:'remembered'});continue}
  const offline=lookupOffline(word)
  let result=null
  if(offline?.senses?.length){
   result={source:'offline English glossary',meanings:offline.senses.map(s=>({
    partOfSpeech:s.partOfSpeech,definitions:[s.definition]
   }))}
  }else if(typeof lookupOnline==='function'){
   try{result=await lookupOnline(word);online++}
   catch{failed++;outcomes.push({word,result:'lookup-unavailable'});continue}
  }
  if(!isCurrent())return {stored,cached,unknown,failed,online,aborted:true,outcomes}
  if(!result){unknown++;outcomes.push({word,result:'unknown'});continue}
  const senses=(Array.isArray(result.meanings)?result.meanings:[]).flatMap(m=>
   (Array.isArray(m.definitions)?m.definitions:[]).map(d=>({
    partOfSpeech:cleanText(m.partOfSpeech).slice(0,24),definition:cleanText(d)
   }))).filter(x=>x.definition).slice(0,4)
  if(!senses.length){unknown++;outcomes.push({word,result:'no-verifiable-definition'});continue}
  const ok=memory.learn(word,{meanings:senses,source:cleanText(result.source||'dictionary')})
  if(ok){stored++;outcomes.push({word,result:'learned'})}
  else{failed++;outcomes.push({word,result:'storage-unavailable'})}
 }
 return {stored,cached,unknown,failed,online,aborted:false,outcomes}
}
