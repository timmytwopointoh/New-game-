// Human-reviewed Google AI explanation -> constrained, existing-game-command proposals.
// This module NEVER interprets webpage prose as code, scripts or game packets.
// Google AI Mode in Chrome has no supported automatic results API.
const READ_ONLY=[/^(?:look around|survival status|movement status|inventory|help survival|plan status)$/i,/^find [a-z][a-z_ ]{1,55}$/i,/^route to -?\d+ -?\d+ -?\d+$/i]
const MOVE=[/^walk to -?\d+ -?\d+ -?\d+$/i,/^follow [a-z0-9_ -]{1,45}$/i]
const EDIT=[/^collect drops$/i,/^dig -?\d+ -?\d+ -?\d+$/i,/^place [a-z][a-z_ ]{1,40} at -?\d+ -?\d+ -?\d+$/i,/^build (?:wall|floor) [1-6] by [1-6] with [a-z][a-z_ ]{1,40} at -?\d+ -?\d+ -?\d+$/i,/^build shelter with [a-z][a-z_ ]{1,40} at -?\d+ -?\d+ -?\d+$/i]
const moveAsked=task=>/\b(?:walk|go|move|travel|head|navigate|follow|come|reach|approach|climb|jump|explore|gather|collect|harvest|get|find)\b/i.test(task)
const editAsked=task=>/\b(?:mine|dig|break|place|build|construct|remove|clear|gather|collect|harvest|pick up|get)\b/i.test(task)
export function extractGooglePlan(task,answer){
 if(typeof task!=='string'||!task.trim()||task.length>190)throw Error('Enter an original owner task of 1-190 characters.')
 if(typeof answer!=='string'||answer.length>7000)throw Error('Paste a Google AI explanation of at most 7,000 characters.')
 const commands=[],warnings=[],seen=new Set()
 for(const line of answer.split(/\r?\n/).slice(0,120)){
  const match=line.trim().match(/^(?:[-*]\s*|\d+[.)]\s*)?COMMAND\s*:\s*(.{1,180})$/i)
  if(!match)continue
  const cmd=match[1].trim().replace(/[.!]+$/,'')
  const classification=READ_ONLY.some(rx=>rx.test(cmd))?'read-only':MOVE.some(rx=>rx.test(cmd))?'movement':EDIT.some(rx=>rx.test(cmd))?'world-edit':null
  if(!classification){warnings.push('Ignored unsupported or ungrounded command.');continue}
  if(classification==='movement'&&!moveAsked(task)){warnings.push('Ignored movement not requested in the original task.');continue}
  const buildingCommand=/^(?:place|build)\b/i.test(cmd)
  const miningCommand=/^dig\b/i.test(cmd)
  const pickupCommand=/^collect drops$/i.test(cmd)
  const requested=buildingCommand?/\b(?:place|build|construct|erect|make (?:a |me a )?(?:wall|floor|shelter|house|base|platform))\b/i.test(task):
    miningCommand?/\b(?:mine|dig|break|harvest|gather|collect|get|clear|remove)\b/i.test(task):
    pickupCommand?/\b(?:collect|gather|pick up|get|loot|harvest)\b/i.test(task):editAsked(task)
  if(classification==='world-edit'&&!requested){warnings.push('Ignored world edit not explicitly requested in the original task.');continue}
  const key=cmd.toLowerCase();if(seen.has(key))continue;seen.add(key)
  if(commands.length<5)commands.push({text:cmd,kind:classification});else warnings.push('Limited to five commands per researched plan.')
 }
 if(!commands.length)warnings.push('Google supplied no executable COMMAND: lines. A definition or broad explanation alone cannot control the Realm.')
 return {task:task.trim(),commands,warnings:[...new Set(warnings)],needsLiveVerification:true,executionPolicy:'Only explicitly labeled supported commands; no web scripts, fabricated inventory or teleports.'}
}
export function googleResearchPrompt(task){
 if(typeof task!=='string'||!task.trim()||task.length>190)throw Error('Enter a short task before searching.')
 return `For Minecraft Bedrock survival, explain this task: ${JSON.stringify(task.trim())}.\n`+
 `Then list up to five exact executable commands, each on a separate line starting COMMAND:. Supported commands: look around; find MATERIAL; route to X Y Z; walk to X Y Z; follow PLAYER; dig X Y Z; place MATERIAL at X Y Z; build wall WIDTH by HEIGHT with MATERIAL at X Y Z; build floor WIDTH by HEIGHT with MATERIAL at X Y Z; build shelter with MATERIAL at X Y Z; inventory; collect drops; survival status.\n`+
 `Never invent coordinates, inventory, permissions or unseen blocks. If the real position is unknown, explain which observations are needed and omit the command. Crafting is unavailable. Drop pickup and hostile-defense packet paths are experimental and must be server-confirmed. Do not pretend the tasks worked; success requires server feedback.`
}
