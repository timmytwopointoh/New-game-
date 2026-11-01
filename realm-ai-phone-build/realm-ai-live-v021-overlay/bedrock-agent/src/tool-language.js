// Contextual Minecraft wording: "switch" is not globally replaced with one sense.
export function resolveToolInstruction(raw,world){
 if(typeof raw!=='string')return null
 const text=raw.trim().toLowerCase().replace(/^command\s+/,'').replace(/^(?:please\s+|(?:can|could|would) you\s+)/,'').replace(/[.!?]+$/,'')
 const slot=text.match(/^(?:switch|swap|change|select)(?: (?:items?|your item|the item))?(?: to)? (?:hotbar )?slot (one|two|three|four|five|six|seven|eight|nine|[1-9])$/)
 if(slot){const value=Number(slot[1])||['one','two','three','four','five','six','seven','eight','nine'].indexOf(slot[1])+1;if(!world?.inventoryKnown||!world.inventory?.has(value-1))return {error:'That hotbar slot has not been received from the server yet.'};return {descriptor:{id:'hotbar',values:{slot:value}}}}
 if(/^(?:switch|swap|equip|change tool|switch slot items|switch slots)$/.test(text))return {error:'Do you mean select a held tool? Tell me which tool, such as “switch to the pickaxe”.'}
 const m=text.match(/^(?:switch(?: over)?(?: to)?|swap(?: to)?|change(?: (?:your|the|my))? (?:tool|hand)(?: to)?|equip|hold|wield|select(?: tool)?|use)\s+(?:(?:the|your|my|their|there|a|an)\s+)?((?:(?:wooden|stone|copper|golden|gold|iron|diamond|netherite)[ _])?(?:pickaxe|axe|shovel|hoe|sword)|shears)(?:\s+so\s+.{1,100})?$/)
 if(!m)return null
 if(!world?.inventoryKnown)return {error:'Waiting for the server inventory before selecting a tool. I have not changed equipment.'}
 const requested=m[1].replace(/ /g,'_').replace(/^gold_/,'golden_'),generic=!requested.includes('_'),tiers=['netherite','diamond','iron','stone','copper','golden','wooden']
 const candidates=[...(world.inventory||new Map())].map(([slot,item])=>({slot,item,name:world.registry?.items?.[item?.network_id]?.name})).filter(x=>x.item?.count>0&&x.name&&(x.name===requested||generic&&x.name.endsWith('_'+requested)))
 const hotbar=candidates.filter(x=>x.slot>=0&&x.slot<9).sort((a,b)=>tiers.indexOf(a.name.split('_')[0])-tiers.indexOf(b.name.split('_')[0])||a.slot-b.slot)
 if(!hotbar.length)return {error:candidates.length?`I can see ${candidates[0].name} in inventory, but it is not in the hotbar. Move it to slots 1–9, then ask again.`:`No ${requested.replace(/_/g,' ')} is present in the server-reported inventory. I have not selected or crafted an imaginary tool.`}
 return {descriptor:{id:'hotbar',values:{slot:hotbar[0].slot+1}},tool:hotbar[0].name}
}
