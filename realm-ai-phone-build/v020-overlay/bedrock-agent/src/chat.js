// Conversational deterministic command translator. It is not a free-form LLM planner.
// Commands validated again by the Bedrock world bridge; unrecognized jobs are never queued.
import {parseCommand,ALLOWED_SCAN,HELP_CATEGORIES} from '../pack-template/scripts/commands.js'
const NUM=Object.freeze({a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12})
const BLOCK=Object.freeze({
 'oak log':'oak_log','oak logs':'oak_log','wood':'oak_log','wood logs':'oak_log','birch log':'birch_log','birch logs':'birch_log',
 'spruce log':'spruce_log','spruce logs':'spruce_log','jungle log':'jungle_log','jungle logs':'jungle_log',
 'acacia log':'acacia_log','acacia logs':'acacia_log','dark oak log':'dark_oak_log','dark oak logs':'dark_oak_log',
 'mangrove log':'mangrove_log','mangrove logs':'mangrove_log','cherry log':'cherry_log','cherry logs':'cherry_log',
 'oak planks':'oak_planks','spruce planks':'spruce_planks','birch planks':'birch_planks',
 'cobblestone blocks':'cobblestone','cobble':'cobblestone','stone blocks':'stone','coal ore':'coal_ore',
 'iron ore':'iron_ore','copper ore':'copper_ore','deepslate iron ore':'deepslate_iron_ore',
 'deepslate coal ore':'deepslate_coal_ore',
 'dirt blocks':'dirt','sand blocks':'sand','gravel blocks':'gravel',
 'granite blocks':'granite','diorite blocks':'diorite','andesite blocks':'andesite'
})
const normalized=(s)=>s.trim().toLowerCase().replace(/^[\s,!.]+|[\s,!.?]+$/g,'').replace(/\s+/g,' ')
const reply=(message,command=null)=>({message,command,accepted:!!command})
const material=(s)=>BLOCK[s]||s.replace(/^minecraft:/,'').replace(/\s+/g,'_')
function validated(command,success,bad='That job is outside the current safety limits or material list.'){
 const p=parseCommand(command);return p.action==='invalid'?reply(bad+' Type “help” for supported jobs.'):reply(success,command)
}
const HELP_SUMMARY='I can follow, move short distances, remember a spot, report inventory and position, scan nearby blocks, gather 1–12 nearby blocks, and build small walls, floors, pillars or bridges. Try “help building”, “help gathering” or “help reports”. No distant pathfinding, crafting, combat or large autonomous jobs yet.'
export function interpretMessage(raw){
 if(typeof raw!=='string'||raw.length>190||/[\x00-\x1F\x7F]/.test(raw))return reply('Please send one short text message (190 characters maximum).')
 let s=normalized(raw).replace(/^!vf(?:\s+|$)/,'').replace(/^(?:hey|hi)\s+(?:veilforge|buddy|bot)[, ]*/,'').replace(/^(?:veilforge|buddy|bot)[, ]*/,'')
 for(let n=0;n<3;n++){const old=s;s=s.replace(/^(?:please\s+|can you\s+|could you\s+|would you\s+|i want you to\s+|i need you to\s+|go ahead and\s+)/,'');if(s===old)break}
 s=s.replace(/\s+please$/,'').trim()
 if(!s)return reply('Try “follow me”, “find iron ore”, “build a wall 2 by 2 with stone”, or “help”.')
 if(/\b(?:don't|do not|never|without|except)\b/.test(s))return reply('I will not execute negative or conditional instructions. Use “stop” or tell me exactly what to do.')
 if(/^(?:hi|hello|hey|yo|how are you|what's up)$/.test(s))return reply('Hey! I am ready for text orders. Type “help” to see the jobs I can really perform.')
 if(/^(?:help|commands|what can you do|what jobs can you do|show commands|show jobs|list commands|list jobs)$/.test(s))return reply(HELP_SUMMARY)
 let help=s.match(/^(?:help|show|list) (movement|building|gathering|reports|memory)(?: commands| jobs)?$/)
 if(help)return reply('Examples: '+HELP_CATEGORIES[help[1]].join(' • ')+'. Jobs have limits and require a connected Bedrock world bridge.')
 if(/^(?:status|report|what are you doing|how is it going|are you okay|are you online|are you connected|what's your status)$/.test(s))return validated('status','Checking my bot status and active job…')
 if(/^(?:progress|job progress|task progress|how much have you done|how is the job going|what job are you on)$/.test(s))return validated('task','Checking the actual world-bridge task progress…')
 if(/^(?:inventory|what do you have|what is in your inventory|show inventory|check your inventory|what supplies do you have)$/.test(s))return validated('inventory','Checking what items my player currently carries…')
 if(/^(?:position|coordinates|coords|where are you|what are your coordinates|tell me your coordinates)$/.test(s))return validated('position','Checking my coordinates…')
 if(/^(?:players|online players|who is online|who is here|who is playing)$/.test(s))return validated('players','Checking online players…')
 if(/^(?:scan|survey|survey nearby|look around|scan area|check the area|what is nearby|what's around you)$/.test(s))return validated('survey','Surveying nearby loaded blocks…')
 if(/^(?:stop|stop everything|stop following|stop following me|stop what you're doing|stop what you are doing|cancel|cancel job|cancel task|abort|abort mission|quit job)$/.test(s))return validated('stop','Stopping follow mode and the pending job…')
 if(/^(?:stay|wait|wait here|stay here|hold position|stand still|don't move)$/.test(s))return validated('stay','Holding position…')
 if(/^(?:follow|follow me|come with me|follow me around|follow behind me|stick with me|keep up with me|tag along)$/.test(s))return validated('follow me','Following you with safe short teleports, not natural pathfinding…')
 if(/^(?:come|come here|come to me|come over here|get over here|teleport to me|meet me here)$/.test(s))return validated('come here','Trying to move close to you…')
 if(/^(?:mark|mark spot|mark this spot|remember this place|remember this spot|save this position|save position|set waypoint)$/.test(s))return validated('mark this spot','Saving my current location until the world bridge reloads…')
 if(/^(?:return to mark|go to mark|return to saved spot|go back to marked spot|return to waypoint|go to waypoint)$/.test(s))return validated('return to mark','Trying to return to the marked nearby spot…')
 if(/^(?:forget mark|clear mark|delete waypoint|forget waypoint)$/.test(s))return validated('forget mark','Clearing the saved spot…')
 let m=s.match(/^(?:go to|move to|walk to|head to|teleport to)\s+(-?\d+)[, ]+(-?\d+)[, ]+(-?\d+)$/)
 if(m)return validated('go to '+m.slice(1).join(' '),'Trying a short, safe move to the given coordinates…')
 m=s.match(/^(?:mine|gather|collect|get|break|harvest)\s+(?:(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+)?(?:some\s+)?(.+)$/)
 if(m){const count=NUM[m[1]]||Number(m[1]),b=material(m[2]||'')
  if(!m[1]||!Number.isInteger(count))return reply('How many? Tell me a number from 1 to 12, such as “gather 4 oak logs”.')
  return validated(`mine ${count} ${b}`,`Searching nearby loaded blocks for up to ${count} ${b.replace(/_/g,' ')}. World edits must be enabled; this is bounded Script API mining, not true survival mining.`,'I can only gather 1–12 approved common blocks that are already near me.')}
 m=s.match(/^(?:find|locate|search for|look for|show me|where (?:can i find|is|are))\s+(?:some\s+)?(.+)$/)
 if(m){const b=material(m[1]);if(!ALLOWED_SCAN.includes(b))return reply('I can only locate approved blocks in the nearby loaded area. Type “help reports”.')
  return validated(`find ${b}`,`Looking for nearby ${b.replace(/_/g,' ')}; I will report coordinates, not travel to distant ore veins…`)}
 m=s.match(/^(?:count|how many|count nearby)\s+(?:nearby\s+)?(.+)$/)
 if(m){const b=material(m[1]);return validated(`count ${b}`,`Counting visible nearby ${b.replace(/_/g,' ')} blocks…`)}
 m=s.match(/^(?:build|make|place|construct)\s+(?:me\s+)?(?:a\s+)?(wall|floor|platform)\s+(\d+)\s*(?:x|by)\s*(\d+)\s+(?:of|with|out of|using)\s+(.+)$/)
 if(m){const shape=m[1]==='platform'?'floor':m[1],block=material(m[4]);return validated(`build ${shape} ${m[2]} x ${m[3]} of ${block}`,`Starting a small ${shape} ${m[2]} by ${m[3]} of ${block.replace(/_/g,' ')} if the footprint is safe and I have enough materials…`)}
 m=s.match(/^(?:build|make|place|construct)\s+(?:me\s+)?(?:a\s+)?(pillar|bridge)\s+(\d+)\s+(?:of|with|out of|using)\s+(.+)$/)
 if(m){const block=material(m[3]);return validated(`build ${m[1]} ${m[2]} of ${block}`,`Starting a small ${m[1]} of ${m[2]} ${block.replace(/_/g,' ')} blocks if safe and supplied…`)}
 const canonical=parseCommand(s)
 if(canonical.action!=='invalid')return reply('Sending the supported command; I will wait for real Realm confirmation…',s)
 return reply('I cannot do that job yet. I do not have autonomous exploration, mobs, crafting, farming, trading, large structures or combat. Try “help building”, “help gathering” or “help reports”.')
}
