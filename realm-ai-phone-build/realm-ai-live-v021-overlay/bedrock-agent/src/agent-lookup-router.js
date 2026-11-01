// Decide when the owner is asking the agent to RESEARCH an instruction.
// This does not interpret network content as commands and never launches actions.
// The caller may ask Google AI (when privately configured) or a key-free
// dictionary. All actual actions go through the survival controller.
const PREFIX=/^(?:(?:please|hey bot|bot)[, ]+|(?:can|could|would|will) you\s+|i (?:want|need) you to\s+|i'd like you to\s+|i would like you to\s+|go ahead and\s+)+/i
const TASK=/^(?:gather|collect|harvest|fetch|retrieve|acquire|obtain|get|go get|find|get me|make|make me|craft|craft me|build|build me|construct|create|create me|place|dig|mine|fight|defend|attack|kill|escape|avoid|run away|explore|search|track|follow|walk|move|go|head|travel|navigate|jump|climb|use|open|interact|repair|equip|eat|chop|cut|plant|farm|smelt|cook|learn how to|figure out how to)\b/i
const KNOWN_FIRST=new Set(['go','get','find','make','build','construct','create','place','dig','mine','fight','defend','attack','kill','escape','avoid','run','explore','search','track','follow','walk','move','head','travel','navigate','jump','climb','use','open','interact','repair','equip','eat','chop','cut','plant','farm','smelt','cook','collect','gather','harvest','fetch','retrieve','acquire','obtain','check','show','inspect','look','scan','select','stop','cancel','please'])
const DIRECT=/^(?:stop|cancel|abort|activate|delete|clear saved plans|command|commands|saved plans|select plan|help|survival status|movement status|inventory|plan status|rejoin realm|ensure survival|respawn|learning status|thanks|thank you|hello|hi|hey|yo)\b/i
export function researchRouting(raw,{hasGoogle=false}={}){
 if(typeof raw!=='string'||raw.length>190||/[\x00-\x1f\x7f]/.test(raw))return null
 const original=raw.trim();if(!original||/[?]\s*$/.test(original)||/\b(?:https?:\/\/|www\.|javascript:|file:|data:)\S*/i.test(original))return null
 const normalized=original.replace(PREFIX,'').trim().replace(/[.!]+$/,'')
 if(DIRECT.test(normalized))return null
 if(!TASK.test(normalized)){
  // A new verb followed by concrete coordinates is safe to look up, but never
  // act on from the web until it matches a local typed command and game state.
  const coords=normalized.match(/^([a-z][a-z-]{2,29})\s+(?:(?:to|at)\s+)?-?\d+[ ,]+-?\d+[ ,]+-?\d+$/i)
  const word=coords?.[1]?.toLowerCase()
  if(word&&!KNOWN_FIRST.has(word))return {kind:'dictionary',word,original}
  const target=normalized.match(/^([a-z][a-z-]{2,29})\s+(?:(?:the|this|that|these|those|my|some|to)\s+)(?:[a-z][a-z -]{2,60})$/i)
  const unknown=target?.[1]?.toLowerCase()
  return unknown&&!KNOWN_FIRST.has(unknown)?(hasGoogle?{kind:'google',task:original}:{kind:'dictionary',word:unknown,original}):null
 }
 if(hasGoogle)return {kind:'google',task:original}
 // Google is optional; still let the BOT inspect the unfamiliar leading word
 // itself through the fixed HTTPS dictionary without opening the owner browser.
 const word=normalized.match(/^([a-z][a-z-]{2,29})\b/i)?.[1]?.toLowerCase()
 if(!word||KNOWN_FIRST.has(word))return {kind:'needs-ai',task:original}
 return {kind:'dictionary',word,original}
}
export function unsupportedResearchResponse(){
 return 'I can interpret many Minecraft materials, mobs, and recipes offline without a Google key. This particular action does not have a verified executor yet. Try a specific material, item, coordinate, or supported command; I will not pretend I completed an unsupported task.'
}
