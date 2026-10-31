// Local, offline intent matching; deliberately does NOT invent unsupported game actions.
// Returns canonical commands accepted by SurvivalController / shared command catalog.
const coords='(-?\\d+)[, ]+(-?\\d+)[, ]+(-?\\d+)'
const phrasePatterns=[
 [/^(?:hi|hello|hey|hey bot|are you there|can you hear me|you there)$/i,'hello'],
 [/^(?:help me|what can you do|show (?:me )?commands|help|instructions)$/i,'help survival'],
 [/^(?:are you okay|how are you|what is happening|give (?:me )?(?:a )?status(?: report)?|check (?:your )?status|diagnos(?:e|tics)|check everything|how is the bot doing)$/i,'diagnostics'],
 [/^(?:what do you have|what(?:'s| is) in your inventory|show (?:me )?your inventory|do you have (?:my )?shovel|where is my shovel|check inventory)$/i,'inventory'],
 [/^(?:come here|come with me|come follow me|follow me around|follow me|stay with me)$/i,'follow me'],
 [/^(?:look around|look around you|what do you see|what is around you|scan the area)$/i,'look around'],
 [/^(?:stop|stop now|stop everything|cancel|cancel job|abort|abort mission|stay still|stay put|wait here)$/i,'stop'],
 [/^(?:start (?:the )?queue|run (?:my |the |all )?(?:plans|commands|queue)|do (?:everything|all my commands) in order)$/i,'run queue'],
 [/^(?:show (?:my |the )?(?:queue|saved plans|saved commands)|what is on the list)$/i,'saved plans'],
 [/^(?:verify survival|check survival mode|make sure (?:you are|you're) in survival)$/i,'ensure survival']
]
export function understandCommand(raw){
 if(typeof raw!=='string'||raw.length>190||/[\x00-\x1f\x7f]/.test(raw))return null
 let s=raw.trim().replace(/[.!?]+$/,'').replace(/^(?:please |could you |can you |would you |i want you to |bot,? )/i,'').trim()
 if(!s)return null
 for(const [pattern,command] of phrasePatterns)if(pattern.test(s))return command
 for(const [pattern,command] of [
  [new RegExp('^(?:go|walk|head|move|travel|run|come) (?:over )?to '+coords+'$','i'),'walk to'],
  [new RegExp('^(?:go|walk|head|move|travel|run) to (?:block )?'+coords+'$','i'),'walk to'],
  [new RegExp('^(?:break|mine|dig|destroy) (?:the )?(?:block )?(?:at )?'+coords+'$','i'),'dig'],
  [new RegExp('^(?:turn and |turn to |look toward |look towards |look at )(?:the )?(?:block )?(?:at )?'+coords+'$','i'),'look at'],
  [new RegExp('^(?:follow|walk with|go with|come with) (.+)$','i'),'follow']
 ]){const m=s.match(pattern);if(m){if(command==='follow')return 'follow '+m[1];return command+' '+m.slice(1).join(' ')}}
 if(/^(?:follow|walk|route|clear path|dig|look at|select slot|select hotbar slot|find|locate|materials|about|recipe|plan get|plan build|inventory|look around|rejoin realm|ensure survival|view off|help survival|diagnostics|movement status|combat status|control status|player identity|survival status|inventory status|plan status)(?:\b|$)/i.test(s))return s
 return null
}
