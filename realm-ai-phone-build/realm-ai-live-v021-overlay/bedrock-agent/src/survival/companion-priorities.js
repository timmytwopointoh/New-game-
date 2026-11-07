// Evidence-based suggestions for a growing Minecraft companion. Advisory only:
// no unsafe auto-execution, invented biome, mythical inventory or fake certainty.
const clear=s=>String(s??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,160)
const safeNumber=n=>typeof n==='number'&&Number.isFinite(n)?n:null
export function companionPriorities({survival=null,spawned=false}={}){
 const p=[]
 const add=(priority,title,why,action,evidence='observed')=>
  p.push({priority,title,why:clear(why),suggestedOwnerRequest:action,evidence,automatic:false})
 if(!survival||!spawned)return [{
  priority:100,title:'Reconnect RoveKin',why:'The companion is not confirmed spawned in the Realm.',
  suggestedOwnerRequest:'Reconnect using the saved session; inspect diagnostics if joining fails.',
  evidence:'connection-status',automatic:false
 }]
 const world=survival.world||{},nav=survival.navigation||{}
 const health=safeNumber(world.attributes?.['minecraft:health'])
 if(health!==null&&health>0&&health<=6)
  add(100,'Recover safely','Server-reported health is '+health+'. Combat and risky building should wait.',
   'Find a safe dry place and recover before working.')
 const home=survival.companion?.homeProject
 const saved=survival.companion?.homeMemory?.hasHome===true
 const blockedHome=Boolean(home?.proximityReview||home?.review||home?.pending)
 if(blockedHome)
  add(93,'Answer a precise home question','The home project has an active approval request. A note alone is not permission.',
   'Open the top-right envelope and review the exact block or stage.')
 if(nav.state==='blocked')
  add(88,'Repair the walking route','Navigation reports it is blocked. I will not invent a path through water or unknown terrain.',
   'Inspect the area, move to a safe place, then ask try again.')
 if(home?.state==='paused'&&!blockedHome)
  add(81,'Inspect the saved house','The home project is paused; a previous stage is not confirmed complete.',
   'Ask home status; if safe, explicitly say resume home.')
 if(!saved)
  add(65,'Choose one permanent home','No permanent home was confirmed for this Realm.',
   'Stand at the chosen location and say this is your new home spot.')
 if(saved&&home?.state==='furnishing')
  add(60,'Finish making home livable','A server-verified shell is not yet proof of a safe bed, chest, furnace and light.',
   'Check bed supplies and storage before calling the home complete.')
 if(saved&&home?.state==='restoring')
  add(55,'Verify the remembered home','Previously placed blocks must load and match the saved stages before work can resume.',
   'Keep the Realm loaded near the saved house; use home status to inspect progress.')
 const inventoryKnown=world.inventoryKnown===true
 const items=inventoryKnown&&typeof world.items==='function'?world.items():null
 if(items&&Object.keys(items).length===0)
  add(35,'Gather the first supplies','The server inventory snapshot is empty.',
   'Inspect the nearby terrain, then collect reachable logs without entering water.')
 if(!p.length)add(20,'Pick a helpful task','No urgent danger, held home approval or blocked route is currently observed.',
  'Ask for home status, gather supplies, follow me or explore safely.','no-urgent-warning')
 p.sort((a,b)=>b.priority-a.priority)
 return p.slice(0,3)
}
