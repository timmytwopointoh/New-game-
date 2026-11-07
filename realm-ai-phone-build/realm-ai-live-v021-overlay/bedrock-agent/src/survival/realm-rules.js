// Owner-scoped Realm expectations are distinct from live server facts.
// A claim about Keep Inventory does not modify the Realm gamerule.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const ruleValue=v=>typeof v==='boolean'?v:v===0?false:v===1?true:typeof v==='string'&&/^(?:true|false|0|1)$/i.test(v)?/^(?:true|1)$/i.test(v):typeof v?.value==='boolean'?v.value:null
export function keepInventoryFromPacket(packet){
 const entries=packet?.game_rules??packet?.gamerules??packet?.rules??null
 if(!Array.isArray(entries))return null
 const rule=entries.find(x=>String(x?.name??x?.rule??'').toLowerCase().replace(/_/g,'')==='keepinventory')
 return rule?ruleValue(rule.value??rule):null
}
export class RealmRules{
 constructor({directory=null,scope=null}={}){
  this.directory=directory;this.scope=null;this.file=null;this.keepInventory=null;this.source='unknown';this.readOnly=false;this.error=''
  this.setScope(scope)
 }
 setScope(scope){
  this.scope=scope?String(scope):null;this.file=this.directory&&this.scope?path.join(this.directory,crypto.createHash('sha256').update(this.scope).digest('hex')+'.json'):null
  this.keepInventory=null;this.source='unknown';this.readOnly=false;this.error=''
  if(!this.file||!fs.existsSync(this.file))return
  try{
   const r=JSON.parse(fs.readFileSync(this.file,'utf8'))
   if(r?.schema!==1||typeof r.keepInventory!=='boolean'||r.source!=='owner-reported')throw Error('Invalid saved rule')
   this.keepInventory=r.keepInventory;this.source='owner-reported'
  }catch{this.readOnly=true;this.error='Saved Realm rule unreadable. Original file retained.'}
 }
 rememberKeepInventory(value){
  if(typeof value!=='boolean'||!this.scope||this.readOnly)return false
  // This records only what the owner says. It does not send /gamerule.
  if(!this.file){this.keepInventory=value;this.source='owner-reported';return true}
  try{
   fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700})
   const temp=this.file+'.tmp'
   fs.writeFileSync(temp,JSON.stringify({schema:1,keepInventory:value,source:'owner-reported'}),{mode:0o600})
   fs.renameSync(temp,this.file)
   this.keepInventory=value;this.source='owner-reported';return true
  }catch(e){this.error='Could not save Realm setting; no setting changed.';return false}
 }
 observeServer(packet){
  const value=keepInventoryFromPacket(packet)
  if(value===null)return false
  this.keepInventory=value;this.source='server-reported';return true
 }
 snapshot(){return {keepInventory:this.keepInventory,source:this.source,
  deathInventoryPolicy:this.keepInventory===true?'retain-on-death-expected; verify inventory after respawn':
   this.keepInventory===false?'possible-death-drops; verify actual loss':'unknown; verify gamerule or owner report',
  chestContentsProtected:false,readOnly:this.readOnly,error:this.error}}
}
