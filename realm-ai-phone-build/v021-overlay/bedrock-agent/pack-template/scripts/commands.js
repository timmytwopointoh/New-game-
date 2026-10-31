// Shared canonical command parser. Identical ES module in Node and Bedrock Script API.
// Only these explicitly validated commands can reach the Realm world bridge.
export const ALLOWED_MINE=Object.freeze([
 'oak_log','birch_log','spruce_log','jungle_log','acacia_log','dark_oak_log','mangrove_log','cherry_log',
 'dirt','stone','cobblestone','sand','gravel','oak_planks','spruce_planks','birch_planks','andesite','granite','diorite',
 'coal_ore','iron_ore','copper_ore','deepslate_iron_ore','deepslate_coal_ore'
])
export const ALLOWED_BUILD=Object.freeze(['cobblestone','oak_planks','stone','dirt','spruce_planks','birch_planks','andesite','granite','diorite'])
export const ALLOWED_SCAN=Object.freeze([...new Set([...ALLOWED_MINE,...ALLOWED_BUILD])])
export const HELP_CATEGORIES=Object.freeze({
 movement:['follow me','come here','stay','stop','go to 100 64 200'],
 reports:['status','what are you doing','where are you','inventory','who is online','survey nearby','find iron ore','count oak logs'],
 gathering:['mine 3 oak logs','collect 4 dirt','gather 2 iron ore'],
 building:['build wall 3 x 2 of cobblestone','build floor 3 x 3 of oak planks','build pillar 4 of stone','build bridge 4 of spruce planks'],
 memory:['mark this spot','return to mark','forget mark']
})
const nameOk=/^[a-z][a-z0-9_]{0,50}$/
const strip=(s)=>s.replace(/^minecraft:/,'')
const parseNumber=(s,min,max)=>{const n=Number(s);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null}
const invalid=(reason='That job is not currently supported. Type help for examples.')=>({action:'invalid',message:reason})
export function parseCommand(raw){
 if(typeof raw!=='string'||raw.length>190||/[\x00-\x1F\x7F]/.test(raw))return invalid('Please send a single-line command under 190 characters.')
 const s=raw.trim().toLowerCase().replace(/^!vf(?:\s+|$)/,'').replace(/[?!.]+$/,'').trim().replace(/\s+/g,' ')
 if(s==='help'||s==='commands'||s==='jobs')return {action:'help'}
 if(s==='help movement'||s==='help building'||s==='help gathering'||s==='help reports'||s==='help memory')return {action:'help',category:s.slice(5)}
 if(['status','report','what are you doing'].includes(s))return {action:'status'}
 if(['inventory','what do you have','what is in your inventory'].includes(s))return {action:'inventory'}
 if(['position','coordinates','where are you'].includes(s))return {action:'position'}
 if(['who is online','players','online players'].includes(s))return {action:'players'}
 if(['survey','survey nearby','scan','scan area','look around'].includes(s))return {action:'survey'}
 if(['task','task status','progress','job progress'].includes(s))return {action:'task'}
 if(['stop','cancel','abort'].includes(s))return {action:'stop'}
 if(['stay','wait','stay here'].includes(s))return {action:'stay'}
 if(['follow','follow me'].includes(s))return {action:'follow'}
 if(['come','come here'].includes(s))return {action:'come'}
 if(['mark','mark spot','mark this spot','save position'].includes(s))return {action:'mark'}
 if(['return to mark','go to mark','return to saved spot'].includes(s))return {action:'return'}
 if(['forget mark','clear mark'].includes(s))return {action:'forget'}
 let m=s.match(/^go(?: to)? (-?\d+)[ ,]+(-?\d+)[ ,]+(-?\d+)$/)
 if(m){const [x,y,z]=m.slice(1).map(Number);if(![x,y,z].every(Number.isSafeInteger)||Math.abs(x)>30000000||Math.abs(z)>30000000||y< -128||y>512)return invalid('Coordinates outside the allowed world range.');return {action:'go',x,y,z}}
 m=s.match(/^(?:mine|gather) (\d+) (?:minecraft:)?([a-z0-9_]+)$/)
 if(m){const count=parseNumber(m[1],1,12),block=strip(m[2]);if(!count||!nameOk.test(block)||!ALLOWED_MINE.includes(block))return invalid('I can mine 1–12 nearby permitted blocks.');return {action:'mine',count,block}}
 m=s.match(/^(?:find|locate|search for|count) (?:minecraft:)?([a-z0-9_]+)$/)
 if(m){const block=strip(m[1]);if(!ALLOWED_SCAN.includes(block))return invalid('That block is not in the safe nearby-scanning catalog.');return {action:s.startsWith('count ')?'count':'find',block}}
 m=s.match(/^build(?: a)? (?:wall|floor) (\d+)\s*(?:x|by)\s*(\d+) (?:of|with) (?:minecraft:)?([a-z0-9_]+)$/)
 if(m){const shape=s.startsWith('build floor')||s.startsWith('build a floor')?'floor':'wall',width=parseNumber(m[1],1,6),height=parseNumber(m[2],1,6),block=strip(m[3]);
   if(!width||!height||width*height>12||(shape==='wall'&&height>3)||!ALLOWED_BUILD.includes(block))return invalid('Build up to 12 blocks: wall width 1–6 height 1–3, or floor up to 6x6.');
   return {action:shape,width,height,block,length:width}
 }
 m=s.match(/^build(?: a)? (pillar|bridge) (\d+) (?:of|with) (?:minecraft:)?([a-z0-9_]+)$/)
 if(m){const length=parseNumber(m[2],1,12),block=strip(m[3]);if(!length||!ALLOWED_BUILD.includes(block))return invalid('Pillars and bridges are limited to 12 supported blocks.');return {action:m[1],length,block}}
 return invalid()
}
