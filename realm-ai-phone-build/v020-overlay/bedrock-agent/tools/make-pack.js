import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'
import {readConfig,validate,root} from './config.js'
const require=createRequire(import.meta.url)
const AdmZip=require('adm-zip')
const c=validate(readConfig())
const out=path.join(root,'dist')
const bp=path.join(out,'VEILFORGE_Bedrock_World_Bridge')
fs.mkdirSync(path.join(bp,'scripts'),{recursive:true})
const manifest={
  format_version:2,
  header:{name:'VEILFORGE Bedrock World Bridge v0.6',description:'Owner-controlled Bedrock AI player actions. Back up world before enabling.',uuid:'7c592e5f-8ba2-4377-ae16-50f6fbad64b3',version:[0,6,0],min_engine_version:[1,21,80]},
  modules:[{type:'script',language:'javascript',entry:'scripts/main.js',uuid:'b6c23b0e-4ce2-4f31-84b5-3382896a7881',version:[0,6,0]}],
  dependencies:[{module_name:'@minecraft/server',version:'2.0.0'}]
}
fs.writeFileSync(path.join(bp,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
for(const name of ['main.js','commands.js','logic.js'])fs.copyFileSync(path.join(root,'pack-template/scripts',name),path.join(bp,'scripts',name))
const world=c.worldBridge
const packConfig={botPlayerName:c.minecraft.botPlayerName,ownerNames:c.ownerPlayerNames,allowWorldEdits:world.allowWorldEdits,maxRadius:Math.min(12,Math.max(4,Number(world.maxRadius)||10)),maxBlocksPerTask:Math.min(12,Math.max(1,Number(world.maxBlocksPerTask)||12)),followIntervalTicks:Math.min(40,Math.max(5,Number(world.followIntervalTicks)||10))}
fs.writeFileSync(path.join(bp,'scripts','config.js'),'// Generated locally. Never add account secrets here.\nexport default '+JSON.stringify(packConfig,null,2)+'\n')
const archive=new AdmZip()
for(const rel of ['manifest.json','scripts/main.js','scripts/commands.js','scripts/logic.js','scripts/config.js'])archive.addLocalFile(path.join(bp,rel),path.dirname(rel)==='.'?'':path.dirname(rel))
const packFile=path.join(out,'VEILFORGE_Bedrock_World_Bridge_v0.6.mcpack')
archive.writeZip(packFile)
console.log('Created world behavior pack:',packFile)
console.log('Unpacked server folder:',bp)
console.log('World edits:',packConfig.allowWorldEdits?'ENABLED - back up your world before using':'DISABLED (safe initial default)')
console.log('SHA256:',crypto.createHash('sha256').update(fs.readFileSync(packFile)).digest('hex'))
