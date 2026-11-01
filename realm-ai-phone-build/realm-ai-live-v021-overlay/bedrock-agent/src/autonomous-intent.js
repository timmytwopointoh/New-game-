import {resolveToolInstruction} from './tool-language.js'
// Bounded owner-intent recognizer. Never treat web text, chat questions or
// another player's conversation as executable commands.
import {parseCommandRequest,renderDescriptor} from './survival/command-plans.js'
import {parseExploreCommand} from './survival/exploration-jobs.js'

const IMPERATIVE=/^(?:strip|quarry|gather|craft|roam|explore|walk|go|move|head|travel|follow|come|dig|mine|break|place|build|select|look|scan|survey|find|locate|collect|pick|clear|check|show|inspect|respawn)\b/i
const READ_ONLY=new Set(['status','movement','look','inventory','help','plan_status','find','materials','about','recipe','route','view_off','situation'])
const CLEAN_PREFIX=/^(?:(?:please|hey bot|bot)[, ]+|(?:can|could|would|will) you\s+|i (?:want|need) you to\s+|i'd like you to\s+|i would like you to\s+|go ahead and\s+)+/i
const NUMBERS={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twelve:12}
function number(text){return /^\d+$/.test(text)?Number(text):NUMBERS[text.toLowerCase()]}
export function relativeGoal(raw,world,yaw){
 const m=raw.match(/^(?:(?:walk|go|move|head|travel)\s+)?(forward|backward|backwards|back|left|right)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+blocks?$/i)
 if(!m)return null
 const count=number(m[2]);if(!Number.isSafeInteger(count)||count<1||count>12)return {error:'Relative movements are limited to 1–12 blocks.'}
 const start=world?.standPosition?.();if(!start||!Number.isFinite(yaw))return {error:'Waiting for a verified position and facing direction before relative movement.'}
 // Bedrock yaw 0 faces +Z; positive yaw faces -X.
 const theta=(yaw+(m[1]==='back'||m[1]==='backward'||m[1]==='backwards'?180:m[1]==='left'?-90:m[1]==='right'?90:0))*Math.PI/180
 const dx=-Math.sin(theta),dz=Math.cos(theta)
 const x=Math.round(start.x+dx*count),z=Math.round(start.z+dz*count)
 if(x===start.x&&z===start.z)return {error:'Could not calculate a new destination.'}
 return {descriptor:{id:'walk',values:{x,y:start.y,z}},relative:true}
}
export function recognizeAutonomous(raw,{world=null,yaw=null,vocabulary=null}={}){
 if(typeof raw!=='string'||raw.length>190||/[\x00-\x1f\x7f]/.test(raw))return null
 const source=raw.trim();if(!source||/\?\s*$/.test(source))return null
 let text=source.replace(CLEAN_PREFIX,'').replace(/[.!]+$/,'').trim()
 const equipment=resolveToolInstruction(text,world)
 if(equipment)return equipment.error?equipment:{...equipment,command:renderDescriptor(equipment.descriptor),readOnly:false}
 // Resolve Realm-scoped learned action aliases BEFORE the imperative check.
 // An unfamiliar verb such as "march" can become "walk to" only after a
 // verified dictionary match has been stored, not before.
 text=vocabulary?.expand?.(text)?.text||text
 // Only explicit imperatives are auto-executable; questions/banter remain chat.
 if(!IMPERATIVE.test(text))return null
 if(parseExploreCommand(text))return {command:text,special:'explore',readOnly:false}
 const relative=relativeGoal(text,world,yaw)
 if(relative)return relative
 try{
  const request=parseCommandRequest(text)
  if(request.clarification)return {error:request.clarification}
  const descriptor=request.descriptor
  // Reference-only catalog commands can answer immediately but never edit the world.
  return {descriptor,command:renderDescriptor(descriptor),readOnly:READ_ONLY.has(descriptor.id)}
 }catch(e){return {error:`I couldn't ground that instruction in a supported action: ${String(e.message||e).slice(0,150)}. I haven't started anything.`}}
}

export function runAutonomous(text,survival){
 const n=survival?.navigation,plans=survival?.commandPlans
 const intent=recognizeAutonomous(text,{world:survival?.world,yaw:n?.yaw,vocabulary:survival?.commandVocabulary})
 if(!intent)return null
 if(intent.error)return {accepted:false,queued:false,message:intent.error}
 if(intent.descriptor?.id==='hotbar'&&n?.mining?.job)return {accepted:false,queued:false,message:'Finish the current block break or press Stop before changing the held tool.'}
 if(!intent.readOnly&&intent.descriptor?.id!=='hotbar'&&(n?.job||plans?.batch||n?.survey||survival?.miningJobs?.active||survival?.acquisition?.active||survival?.resources?.active||survival?.operations?.pending))return {accepted:false,queued:false,message:'A task is already active. Say Stop before starting a different task.'}
 const cmd=intent.command||(intent.descriptor&&renderDescriptor(intent.descriptor))
 const response=survival.handle(cmd)
 return {...response,autonomous:true,message:(response?.accepted?'Handled without an Activate tap. ':'Not started. ')+(response?.message||'Waiting for server feedback; game success is not yet confirmed.')}
}
