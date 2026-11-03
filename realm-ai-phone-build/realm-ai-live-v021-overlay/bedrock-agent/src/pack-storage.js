// Private pack storage. Minecraft 1.26.60 advertises all content through one
// resource pack list; the later ResourcePackDataInfo packet identifies its
// actual pack type (behavior/resources/addon). Never run or unzip scripts.
import path from 'node:path'

const FOLDERS=Object.freeze({
 behavior:'behavior-packs',
 resource:'resource-packs',
 addon:'addon-packs'
})
export function classifyPack({origin='resource',metadata={},serverType=null}={}){
 const kind=String(serverType||'').toLowerCase()
 if(kind==='behavior')return 'behavior'
 if(kind==='resources'||kind==='resource')return 'resource'
 if(kind==='addon')return 'addon'
 if(origin==='behavior')return 'behavior'
 if(metadata.addon_pack===true||metadata.has_scripts===true)return 'addon'
 return 'resource'
}
export function packDirectory(root,kind){
 const folder=FOLDERS[kind]
 if(!folder)throw Error('Unknown private resource pack classification')
 return path.join(root,folder)
}
export function packFilePath(root,kind,basename){
 if(!/^[a-f0-9]{64}\.mcpack$/.test(basename))throw Error('Unsafe pack cache filename')
 return path.join(packDirectory(root,kind),basename)
}
export function priorPackLocations(root,basename,preferred){
 // Preserve existing verified caches from the historical shared directory.
 const order=[packFilePath(root,preferred,basename),path.join(root,basename),
  ...Object.keys(FOLDERS).filter(x=>x!==preferred).map(x=>packFilePath(root,x,basename))]
 return [...new Set(order)]
}
export const PACK_CATEGORIES=Object.keys(FOLDERS)
