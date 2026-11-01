// Key-free, read-only dictionary fetch for the phone-hosted agent.
// The lookup URL and hostname are fixed here; neither the owner nor a webpage
// can specify a network destination, code, game packet or command payload.
// Keep this module dependency-free for the Android Node runtime and offline tests.
const ACTION_WORDS={
 dig:new Set(['dig','mine','excavate','break']),
 walk:new Set(['walk','move','go','head','travel','navigate','march']),
 find:new Set(['find','locate','search','seek','discover']),
 follow:new Set(['follow','trail','accompany','track']),
 look:new Set(['look','observe','scan','survey','inspect','view'])
}
function resolveActionTarget(value){const w=String(value||'').trim().toLowerCase();return Object.entries(ACTION_WORDS).find(([,words])=>words.has(w))?.[0]||null}

const WORD=/^[a-z][a-z-]{1,29}$/i
const MAX_RESPONSE=64000
const SUPPORTED=new Set(['dig','walk','find','follow','look'])
const DEFINITION_HINTS={
 dig:/\b(?:dig|mine|excavat\w*|break up|remove earth|extract (?:ore|mineral))\b/i,
 walk:/\b(?:walk|move on foot|travel on foot|go on foot|march|stride)\b/i,
 find:/\b(?:find|locate|discover|search for|seek)\b/i,
 follow:/\b(?:follow|trail|move behind|go after|accompany)\b/i,
 look:/\b(?:look|observe|scan|survey|inspect|view)\b/i
}
function safeText(value,max=260){return typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''}
function guessSupportedAction(word,meanings){
 // A page cannot name arbitrary actions. Match a verb definition AND at least
 // one independently supplied synonym, or the word's exact built-in action.
 const first=resolveActionTarget(word)
 if(first&&SUPPORTED.has(first))return first
 const verbs=meanings.filter(x=>x.partOfSpeech==='verb')
 const scores=new Map()
 for(const meaning of verbs){
  const synonyms=meaning.synonyms.filter(s=>typeof s==='string').map(s=>s.toLowerCase())
  for(const id of SUPPORTED){
   const synonymEvidence=synonyms.some(s=>resolveActionTarget(s)===id)
   const definitionEvidence=meaning.definitions.some(d=>DEFINITION_HINTS[id].test(d))
   if(synonymEvidence&&definitionEvidence)scores.set(id,(scores.get(id)||0)+1)
  }
 }
 return scores.size===1?[...scores.keys()][0]:null
}
export class OpenDictionaryResearch {
 constructor({fetcher=globalThis.fetch,timeoutMs=7000}={}){this.fetcher=fetcher;this.timeoutMs=timeoutMs}
 configured(){return typeof this.fetcher==='function'}
 async study(input){
  const word=String(input||'').trim().toLowerCase()
  if(!WORD.test(word))throw Error('Look up a single ordinary English word (2–30 letters).')
  if(!this.configured())throw Error('The phone runtime does not provide HTTPS fetch.')
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),this.timeoutMs)
  try{
   const response=await this.fetcher('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(word),{method:'GET',headers:{accept:'application/json'},redirect:'error',signal:abort.signal})
   if(!response?.ok)throw Error(response?.status===404?'No dictionary entry found for that word.':'Dictionary service unavailable (HTTP '+String(response?.status||'unknown')+').')
   const length=Number(response.headers?.get?.('content-length')||0)
   if(length>MAX_RESPONSE)throw Error('Dictionary result exceeds the safe size limit.')
   const raw=await response.text()
   if(raw.length>MAX_RESPONSE)throw Error('Dictionary result exceeds the safe size limit.')
   const entries=JSON.parse(raw)
   if(!Array.isArray(entries))throw Error('Dictionary returned an unexpected entry.')
   const meanings=[]
   for(const entry of entries.slice(0,4))for(const m of (entry?.meanings||[]).slice(0,9)){
    const partOfSpeech=safeText(m?.partOfSpeech,24).toLowerCase()
    const definitions=(m?.definitions||[]).slice(0,5).map(d=>safeText(d?.definition)).filter(Boolean)
    const synonyms=[...(m?.synonyms||[]),...(m?.definitions||[]).flatMap(d=>d?.synonyms||[])].slice(0,24).map(s=>safeText(s,30)).filter(Boolean)
    if(definitions.length)meanings.push({partOfSpeech,definitions,synonyms})
   }
   if(!meanings.length)throw Error('Dictionary did not return a usable definition.')
   const best=meanings.find(m=>m.partOfSpeech==='verb')||meanings[0]
   const action=guessSupportedAction(word,meanings)
   return {word,definition:best.definitions[0],partOfSpeech:best.partOfSpeech,category:action||'other',action,verified:!!action,sourceCount:1,source:'Free Dictionary API',sourceUrl:'https://dictionaryapi.dev/',reason:action?'The dictionary meaning and a matching supported-action synonym agree.':'Definition found. It does not identify one unambiguous, currently executable Minecraft action.'}
  }finally{clearTimeout(timeout)}
 }
}
