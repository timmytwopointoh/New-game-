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
export function respondToConversation(raw,{vocabulary=null,world=null,navigation=null}={}){
 const text=clean(raw)
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
   const remembered=vocabulary?.definitionFor?.(intent.query)
   if(remembered)return `I remember “${intent.query}”: ${remembered.definition} (${remembered.source}). That definition alone does not specify a Minecraft action.`
   const answer=answerWordQuestion(intent.query)
   if(answer.kind==='material')return `about ${answer.material}`
   if(answer.kind==='definition')return answer.message
   return `I don't have a reliable offline definition for “${answer.query}”. What context did you see it in? Try “look up ${answer.query}” to check an online dictionary. I will not guess or start an unsupported action.`
  }
  case 'recipe':return `recipe ${intent.query}`
  case 'question':return "I don’t have a reliable answer to that question yet. Tell me the specific Minecraft block, tool, mob, recipe, or bot status you’re asking about so I can check the available information."
  default:return "Got it. I’ll treat that as chat, not an action. Ask me a question, or tell me a supported action directly."
 }
}
