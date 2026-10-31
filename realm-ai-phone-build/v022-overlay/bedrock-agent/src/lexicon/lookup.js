import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {resolveMaterial} from '../survival/catalog.js'

const payload=JSON.parse(gunzipSync(fs.readFileSync(new URL('./english-5000.json.gz',import.meta.url))).toString('utf8'))
const entries=new Map(payload.words.map(item=>[item.w,item]))
const minecraftTerms=JSON.parse(fs.readFileSync(new URL('./minecraft-context.json',import.meta.url),'utf8'))
for(const [word,senses] of Object.entries(minecraftTerms))if(!entries.has(word))entries.set(word,{w:word,r:null,s:senses})

export function lookupEnglishWord(input){
 const word=String(input||'').toLowerCase().trim().replace(/^[^a-z]+|[^a-z']+$/g,'')
 if(!/^[a-z]+(?:'[a-z]+)?$/.test(word))return null
 const entry=entries.get(word)
 if(!entry)return null
 return {word:entry.w,rank:entry.r,senses:entry.s.map(s=>({partOfSpeech:s.p,definition:s.d}))}
}

export function answerWordQuestion(input){
 const query=String(input||'').trim().replace(/^(?:a|an|the)\s+/i,'').replace(/\s+(?:in|within) minecraft$/i,'').trim()
 const material=resolveMaterial(query)
 if(material)return {kind:'material',material}
 const match=lookupEnglishWord(query)
 if(!match)return {kind:'unknown',query}
 const senses=match.senses.map((sense,i)=>`${i+1}. ${sense.partOfSpeech}: ${sense.definition}`).join('  ')
 const uncertainty=match.senses.length>1?' This word has more than one common sense; tell me which context you mean if these do not fit.':''
 const rank=match.rank?` (common English word #${match.rank} in the bundled frequency list)`:''
 const provenance=match.rank?'Offline glossary: Open English WordNet; word-frequency rank from wordfreq.':'Curated Realm/Minecraft context note.'
 return {kind:'definition',message:`“${match.word}”${rank}: ${senses}${uncertainty} ${provenance} This definition is not a multi-source check of a current factual claim.`}
}

export const bundledEnglishWordCount=payload.words.length
