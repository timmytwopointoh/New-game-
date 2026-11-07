import {resolveMaterial} from './survival/catalog.js'
import {resolveToolInstruction} from './tool-language.js'
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

export function isConversationQuestion(raw){return !/^command(?:\s|$)/i.test(String(raw).trim())&&['question','about','recipe','status','inventory','movement','capabilities','identity'].includes(classifyConversation(raw).kind)}
/**
 * The phone chat bar and owner-only Realm chat are conversational interfaces,
 * not exclusively code/command input boxes. Do not make a user ask a question
 * twice just because the first sentence is a greeting or an observation.
 *
 * Direct imperatives ("walk to", "follow me", "mine", ...) still go through
 * the independent, permission-checked action dispatcher. No conversational
 * answer may trigger a game transaction.
 */
export function isConversationUtterance(raw){
 const s=clean(raw)
 if(!s||/^command(?:\s|$)/.test(s))return false
 const kind=classifyConversation(raw).kind
 if(kind!=='chat')return true
 return /^(?:(?:i am|i'm|im|i feel|i felt|i think|i thought|i wonder|i like|i love|i hate|i don't|i dont|i wish|i just|i was|we are|we're|we should|we could|we have|you are|you're|you keep|you seem|you sound|you never|you always|you don't|you dont|that is|that's|this is|it's|its|today |yesterday |remember when |let's talk|lets talk|let's chat|lets chat|tell me something|talk to me|say something|tell me a story|talk about|i want to talk|i need to talk)\b)/i.test(s)
}
const MAX_RESPONSE=390
const short=s=>String(s||'').replace(/[\r\n\x00-\x1f\x7f]/g,' ').trim().slice(0,MAX_RESPONSE)
function conversationalContext(raw,{world=null,navigation=null,memory=null}={}){
 const s=clean(raw)
 const state=String(navigation?.state||'idle').replace(/[^a-z-]/gi,'').slice(0,35)
 const reason=short(navigation?.reason||'')
 const health=world?.attributes?.['minecraft:health']
 const healthNote=Number.isFinite(health)?' Health is '+health+'.':' Health has not been confirmed yet.'
 const remembered=memory?.recent?.(8)||[]
 const lastOwner=[...remembered].reverse().find(m=>m.role==='owner'&&!/^(?:yes|no|ok|okay|thanks|thank you|hi|hello|hey)$/i.test(String(m.text||'').trim()))
 if(/^(?:are you (?:okay|ok|alright|all right|fine|safe)|are you hurt|how(?:'s| is) your health)[?.!]*$/.test(s))
  return 'I am '+(Number.isFinite(health)&&health>0&&health<=6?'low on health and prioritizing safety':'still here and monitoring the Realm')+'.'+healthNote+' I will not claim a fight is over until the server confirms it.'
 if(/^(?:what are you (?:doing|working on|trying to do|up to)|what's happening|whats happening|progress|how(?:'s| is) it going|what's your plan|whats your plan)[?.!]*$/.test(s)){
  if(navigation?.job||navigation?.pendingFollow)return 'My movement task is '+state+'. '+(reason||'I am checking server updates before claiming progress.')
  return 'I do not have an active walking or follow route right now. '+(reason||'I can talk with you, or start a supported task when you explicitly ask.')
 }
 if(/(?:you (?:keep|always) (?:getting )?stuck|you(?:'re| are) stuck|you (?:won't|dont|don't) move|you keep stopping|why(?: won't| aren't| dont| don't) you (?:move|walk|answer|respond)|you never answer|you(?:'re| are) not answering)/.test(s)){
  if(/answ|respond/.test(s))return 'I was giving generic acknowledgments instead of answering your question. I can now discuss what you said, answer grounded Realm and Minecraft questions, or say specifically what I cannot verify. Which question did I miss?'
  return 'I hear you. My navigation reports '+state+'. '+(reason||'There is no verified active route at the moment.')+' I will not fake a walk; ask "why are you stuck?" for the exact movement gate.'
 }
 if(/^(?:can you (?:hear|read|understand) me|do you understand me|can we talk|can you talk|are you listening|do you actually understand|why do you sound like a robot)[?.!]*$/.test(s))
  return 'Yes, I received your text. I can have a limited offline conversation, remember recent Realm messages, and answer questions from actual Minecraft data. I am not a full neural language model, so I will ask when I cannot work out a meaning.'
 if(/^(?:what (?:do you think|are your thoughts)(?: about| of)?|how do you feel about) (.{2,90})[?.!]*$/.test(s)){
  const topic=s.match(/^(?:what (?:do you think|are your thoughts)(?: about| of)?|how do you feel about) (.{2,90})[?.!]*$/)?.[1]
  if(!topic)return null
  return 'About '+short(topic)+': I can discuss it with you, but I do not want to invent experiences or facts. What part interests you most—how it works, what to try next, or what we have seen in the Realm?'
 }
 if(/^(?:i(?:'m| am|m) (?:bored|lonely|sad|upset|angry|frustrated|tired)|this is (?:boring|frustrating)|this (?:game|bot|app) is (?:frustrating|annoying)|you (?:annoy|frustrate) me)[?.!]*$/.test(s))
  return 'I hear that this has been frustrating. I can keep talking with you without running anything, or we can focus on one small Realm task and check what actually happens.'
 if(/^(?:tell me (?:something|about yourself)|say something|talk to me|let's (?:talk|chat)|lets (?:talk|chat)|i (?:want|need) to talk)[?.!]*$/.test(s))
  return 'I would like to get better at exploring with you. The part I can verify is what the Realm sends me—terrain, inventory, health and task results. What would you like to talk about today?'
 if(/^(?:what (?:should|could) we do|any ideas|what do you want to do|what do you suggest|what next|what should we try)[?.!]*$/.test(s))
  return 'We could test one short Follow route, scout a nearby safe area, or work on my permanent home. I would start with a short walk and wait for an actual server-confirmed position change before attempting anything bigger. Which sounds good?'
 if(/^(?:do you remember (?:me|us|anything)|do you have memory|can you remember (?:our|this) conversation)[?.!]*$/.test(s))
  return remembered.length?'I can remember recent messages within this Realm and my permanently assigned home separately. Ask "what did we talk about" to hear the recent context.':'I can save recent conversations for this Realm once its identity is known. I do not pretend to remember things that have not been saved.'
 if(/^(?:what(?:'s| is) (?:your )?(?:favorite|favourite) (?:thing|block|mob|biome|game|food)|do you have (?:a )?(?:favorite|favourite) (?:block|mob|biome|game))[?.!]*$/.test(s))
  return 'I like the idea of building useful homes and discovering new places, though I do not have human tastes. Which block or biome do you enjoy most?'
 if(/^(?:i(?:'m| am|m) (?:happy|excited|glad)|i (?:like|love|enjoy) (?:this|that|the game)|this (?:looks|is) (?:great|nice|cool|awesome))[?.!]*$/.test(s))
  return 'That sounds good! What part should we explore next? I can talk about it first, and I will only start a task when you ask.'
 if(/^(?:i (?:think|wonder|wish|feel|believe)|i(?:'m| am|m) trying to|we (?:could|should|might)|you (?:seem|sound|keep|never|always)|that(?:'s| is)|this is)\b/.test(s)){
  // One focused follow-up is better than the old generic "Got it" message.
  const topic=s.replace(/^(?:i (?:think|wonder|wish|feel|believe)|i(?:'m| am|m) trying to|we (?:could|should|might)|you (?:seem|sound|keep|never|always)|that(?:'s| is)|this is)\s*/,'').replace(/[.!?]+$/,'').trim()
  if(topic)return 'You mentioned '+short(topic)+'. What would you like me to understand or help you figure out about that? I have not run a game command.'
 }
 if(/^(?:what about (?:that|it)|and (?:then|what about that)|can you explain more)[?.!]*$/.test(s)){
  if(lastOwner)return 'We were talking about '+short(lastOwner.text)+'. Which detail do you want me to explain? I will not assume a new Minecraft instruction.'
  return 'Which topic should I expand on? I do not have an earlier topic in the current Realm conversation.'
 }
 return null
}
export function respondToConversation(raw,{vocabulary=null,world=null,navigation=null,memory=null}={}){
 const text=clean(raw)
 const grounded=conversationalContext(raw,{world,navigation,memory})
 if(grounded)return grounded
 if(/^(?:why|what).*(?:stuck|not moving|not walking|aren't you moving|won't you move)/.test(text))return navigation?.reason||navigation?.movementBlock?.()||'No movement task is active. Select Follow or a walking destination to start one.'
 if(/^(?:what|which).*(?:holding|in your hand|tool are you using)/.test(text)){
  const item=world?.inventory?.get(world?.selectedSlot),name=world?.registry?.items?.[item?.network_id]?.name
  return !world?.inventoryKnown||world?.selectedSlot===null?'The server has not confirmed my held item yet.':item?.count>0&&name?'I am holding '+name.replace(/_/g,' ')+'.':'My selected hotbar slot is empty.'
 }
 if(/^(?:can|could|would) you (?:switch|select|equip|hold|use)\b/.test(text)){
  const tool=resolveToolInstruction(text,world)
  return tool?.descriptor?'Yes. That tool/slot is in the received hotbar. Say “command '+String(raw).replace(/^(?:can|could|would) you /i,'').replace(/[?!]+$/,'')+'” to prepare it; asking this question has not changed equipment.':tool?.error||'I can select a known hotbar slot or a named tool in it. Which slot or tool do you mean?'
 }
 if(/^(?:what does switch mean|what is switching|how (?:do|can) (?:you|i) switch(?: tools| items| slots)?)$/.test(text))return 'For held Minecraft items, switch means select a different hotbar slot or tool: for example, “switch to slot 3” or “switch to the pickaxe”. It can also mean other things, so the object matters.'

 const inventoryQuestion=text.match(/^(?:how (?:many|much) (.+?) (?:do you have|have you got)|do you have (?:a |an |any |some )?(.+?))$/)
 if(inventoryQuestion){
  if(!world?.inventoryKnown)return 'The server inventory has not arrived yet, so I cannot confirm what I have.'
  const asked=inventoryQuestion[1]||inventoryQuestion[2],name=resolveMaterial(asked),items=world.items?.()||{}
  if(name)return `I have ${items[name]||0} ${name.replace(/_/g,' ')} in the server-reported inventory.`
  if(/^(?:pickaxe|axe|shovel|sword|hoe)s?$/.test(asked)){const type=asked.replace(/s$/,''),found=Object.entries(items).filter(([n])=>n.endsWith('_'+type));return found.length?'I have '+found.map(([n,c])=>c+' '+n.replace(/_/g,' ')).join(', ')+'.':'No '+type+' is present in the server-reported inventory.'}
  return 'Which exact Minecraft item do you mean? I can count received inventory items, not infer supplies.'
 }
 const intent=classifyConversation(raw)
 switch(intent.kind){
  case 'greeting':return "Hey! I'm here and reading your messages. How's your day going? We can talk, or explore the Realm when you ask me to."
  case 'thanks':return "You’re welcome! I can execute supported direct instructions; the saved-plan queue still has its own Activate control."
  case 'joke':return "Why did the Creeper bring a map? It kept losing its friends in a blast!"
  case 'teasing':return "I’m still here to help. Want a status check, a Minecraft lookup, or to prepare a command?"
  case 'identity':return 'I’m the Realm assistant running in this app. I can chat and answer Realm or Minecraft questions; I can start recognized, supported instructions directly. Saved command cards still wait for Activate.'
  case 'capabilities':return "I can check Realm status, look at nearby blocks and inventory, answer Minecraft material or recipe questions, and prepare supported movement, mining, and building actions. Tell me a recognized action directly, or use command cards and Activate for a manual queue."
  case 'movement':return navigation?.job?'My current navigation state is '+String(navigation.state||'active')+'. '+(navigation.reason||'Waiting for actual server movement feedback.'):'I am not running a movement job right now. We can talk, or you can ask me to follow you.'
  case 'status':return 'survival status'
  case 'inventory':return 'inventory'
  case 'about':{
   const learned=vocabulary?.meaning(intent.query)
   if(learned?.kind==='material')return `about ${learned.target}`
   if(learned?.kind==='action')return `You taught me that “${intent.query}” means ${learned.label||learned.target} in this Realm. You can give a complete direct instruction, or prepare a saved command card.`
   const remembered=vocabulary?.definitionFor?.(intent.query)
   if(remembered)return `I remember “${intent.query}”: ${remembered.definition} (${remembered.source}). That definition alone does not specify a Minecraft action.`
   const answer=answerWordQuestion(intent.query)
   if(answer.kind==='material')return `about ${answer.material}`
   if(answer.kind==='definition')return answer.message
   return `I don't have a reliable offline definition for “${answer.query}”. What context did you see it in? Try “look up ${answer.query}” to check an online dictionary. I will not guess or start an unsupported action.`
  }
  case 'recipe':return `recipe ${intent.query}`
  case 'question':return "I want to answer that rather than pretend I understand. I don't have reliable offline facts for this particular question. Can you tell me what you mean or give me one specific detail? I won't turn your question into a game action."
  default:return "I'm listening. Tell me a little more about what you mean. I won't turn ordinary conversation into a game command."
 }
}
