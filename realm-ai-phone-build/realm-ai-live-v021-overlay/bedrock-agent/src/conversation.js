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
 let m=s.match(/^(?:what is|what's|whats|tell me about|explain) (.+)$/);if(m)return {kind:'about',query:m[1].replace(/^(?:a|an|the) /,'')}
 m=s.match(/^(?:how do i|how to) (?:make|craft) (.+)$/);if(m)return {kind:'recipe',query:m[1].replace(/^(?:a|an|the) /,'')}
 if(hasQuestionMark||/^(?:who|what|when|where|why|how|is|are|can|could|would|do|does|did|will)\b/.test(s))return {kind:'question'}
 return {kind:'chat'}
}

export function respondToConversation(raw){
 const intent=classifyConversation(raw)
 switch(intent.kind){
  case 'greeting':return "Hey! I’m here. Ask me about the Realm or Minecraft, or start an action with “command …”."
  case 'thanks':return "You’re welcome! I’ll keep actions waiting for your command and Activate."
  case 'joke':return "Why did the Creeper bring a map? It kept losing its friends in a blast!"
  case 'teasing':return "I’m still here to help. Want a status check, a Minecraft lookup, or to prepare a command?"
  case 'identity':return 'I’m the Realm assistant running in this app. I can chat and answer Realm or Minecraft questions; I only prepare an action when you start with “command”, and nothing starts until Activate.'
  case 'capabilities':return "I can check Realm status, look at nearby blocks and inventory, answer Minecraft material or recipe questions, and prepare supported movement, mining, and building actions. Start an action with “command”; nothing runs until you press Activate."
  case 'movement':return 'movement status'
  case 'status':return 'survival status'
  case 'inventory':return 'inventory'
  case 'about':return `about ${intent.query}`
  case 'recipe':return `recipe ${intent.query}`
  case 'question':return "I’m not sure what you mean yet. I can answer Realm status and Minecraft material or recipe questions. If you want me to do something, start with “command”."
  default:return "Got it. I’ll treat that as chat, not an action. Ask me a question, or start an action with “command …”."
 }
}
