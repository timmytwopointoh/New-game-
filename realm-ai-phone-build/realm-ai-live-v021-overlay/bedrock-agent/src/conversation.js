import {answerWordQuestion} from './lexicon/lookup.js'

const clean=s=>String(s||'').trim().replace(/[.!?]+$/,'').toLowerCase().replace(/\s+/g,' ')

export function classifyConversation(raw){
 const hasQuestionMark=/\?\s*$/.test(String(raw||''))
 const s=clean(raw)
 if(!s)return {kind:'empty'}
 if(/^(?:hi|hello|hey|hiya|yo|good morning|good afternoon|good evening|how are you|how's it going|hows it going)(?:\b|$)/.test(s))return {kind:'greeting'}
 if(/^(?:thanks|thank you|thx|ty|appreciate it)(?:\b|$)/.test(s))return {kind:'thanks'}
 if(/^(?:tell me a joke|say something funny|make me laugh|joke)$/.test(s))return {kind:'joke'}
 if(/\b(?:idiot|stupid|dumb|useless|trash|moron|you suck|you're bad|you are bad|shut up|shut it)\b/.test(s)||/^(?:lol|lmao|haha+|hehe+|you're just a bot|you are just a bot|just kidding|i'm kidding|im kidding)$/.test(s))return {kind:'teasing'}
 if(/^(?:what is your name|what's your name|whats your name|are you a bot|are you real)$/.test(s))return {kind:'identity'}
 if(/^(?:what can you do|help|what commands do you know)$/.test(s))return {kind:'capabilities'}
 if(/^(?:what are you doing|what's happening|whats happening|progress|how is it going)$/.test(s))return {kind:'movement'}
 if(/^(?:where are you|what is your position|what's your position|whats your position|are you in the realm|are you connected)$/.test(s))return {kind:'status'}
 if(/^(?:what do you have|what's in your inventory|whats in your inventory|check your inventory)$/.test(s))return {kind:'inventory'}
 let m=s.match(/^(?:what is|what's|whats|tell me about|explain|about) (.+)$/);if(m)return {kind:'about',query:m[1].replace(/^(?:a|an|the) /,'')}
 m=s.match(/^(?:what does|what do) (.+?) mean$/);if(m)return {kind:'about',query:m[1].replace(/^(?:a|an|the) /,'')}
 m=s.match(/^(?:define|definition of|meaning of) (.+)$/);if(m)return {kind:'about',query:m[1].replace(/^(?:a|an|the) /,'')}
 m=s.match(/^(?:how do i|how to) (?:make|craft) (.+)$/);if(m)return {kind:'recipe',query:m[1].replace(/^(?:a|an|the) /,'')}
 if(hasQuestionMark||/^(?:who|what|when|where|why|how|is|are|can|could|would|do|does|did|will)\b/.test(s))return {kind:'question'}
 return {kind:'chat'}
}

export function respondToConversation(raw,{vocabulary=null}={}){
 const intent=classifyConversation(raw)
 switch(intent.kind){
  case 'greeting':return "Hey! I’m here. Ask me about the Realm or Minecraft, or tell me a supported action directly."
  case 'thanks':return "You’re welcome! I can execute supported direct instructions; the saved-plan queue still has its own Activate control."
  case 'joke':return "Why did the Creeper bring a map? It kept losing its friends in a blast!"
  case 'teasing':return "I’m still here to help. Want a status check, a Minecraft lookup, or to prepare a command?"
  case 'identity':return 'I’m the Realm assistant running in this app. I can chat and answer Realm or Minecraft questions; I can start recognized, supported instructions directly. Saved command cards still wait for Activate.'
  case 'capabilities':return "I can check Realm status, look at nearby blocks and inventory, answer Minecraft material or recipe questions, and prepare supported movement, mining, and building actions. Tell me a recognized action directly, or use command cards and Activate for a manual queue."
  case 'movement':return 'movement status'
  case 'status':return 'survival status'
  case 'inventory':return 'inventory'
  case 'about':{
   const learned=vocabulary?.meaning(intent.query)
   if(learned?.kind==='material')return `about ${learned.target}`
   if(learned?.kind==='action')return `You taught me that “${intent.query}” means ${learned.label||learned.target} in this Realm. You can give a complete direct instruction, or prepare a saved command card.`
   const answer=answerWordQuestion(intent.query)
   if(answer.kind==='material')return `about ${answer.material}`
   if(answer.kind==='definition')return answer.message
   return `I don't have a reliable offline definition for “${answer.query}”. What context did you see it in? Try “look up ${answer.query}” to check an online dictionary. I will not guess or start an unsupported action.`
  }
  case 'recipe':return `recipe ${intent.query}`
  case 'question':return "I’m not sure what you mean yet. I can answer Realm status and Minecraft material or recipe questions. Try a supported direct instruction such as “walk to 3 64 2”."
  default:return "Got it. I’ll treat that as chat, not an action. Ask me a question, or tell me a supported action directly."
 }
}
