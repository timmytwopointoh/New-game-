import fs from 'node:fs'
import path from 'node:path'
// Owner's permission for THIS Realm, pinned once to its actual discovery ID.
// A different Realm keeps the original construction protections.
export class RealmEditGrant{
 constructor(directory){this.file=directory?path.join(directory,'owner-realm-edit-grant.json'):null;this.realm=null;this.invalid=false
  if(this.file&&fs.existsSync(this.file))try{const d=JSON.parse(fs.readFileSync(this.file,'utf8'));if(d.version!==1||typeof d.realm!=='string'||d.realm.length>100)throw Error('invalid');this.realm=d.realm}catch{this.invalid=true}
 }
 allows(scope){
  if(!this.file||this.invalid||!scope||String(scope).length>100)return false
  if(this.realm===null){try{fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});fs.writeFileSync(this.file,JSON.stringify({version:1,realm:String(scope),ownerAllowsBlockClearing:true}),{mode:0o600,flag:'wx'});this.realm=String(scope)}catch{this.invalid=true;return false}}
  return this.realm===String(scope)
 }
}
