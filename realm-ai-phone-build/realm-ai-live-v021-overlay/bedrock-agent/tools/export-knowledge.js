// Deterministic, offline Bedrock knowledge export: node tools/export-knowledge.js [output-dir]
import fs from 'node:fs'
import path from 'node:path'
import {blockCatalog,entityCatalog,blockAllTools,referenceStats} from '../src/knowledge/bedrock-reference.js'
const dir=path.resolve(process.argv[2]||'knowledge-export');fs.mkdirSync(dir,{recursive:true})
const blocks=blockCatalog(),mobs=entityCatalog()
fs.writeFileSync(path.join(dir,'blocks.json'),JSON.stringify({meta:referenceStats,blocks},null,2))
fs.writeFileSync(path.join(dir,'mobs.json'),JSON.stringify({meta:referenceStats,entities:mobs},null,2))
const file=fs.openSync(path.join(dir,'mining-times.jsonl'),'w')
try{for(const block of blocks){for(const fact of blockAllTools(block.id)){fs.writeSync(file,JSON.stringify(fact)+'\n')}}}finally{fs.closeSync(file)}
fs.writeFileSync(path.join(dir,'README.txt'),`Minecraft ${referenceStats.version} data. Each line of mining-times.jsonl is a block+tool with normal standing, dry conditions. Exact status combinations are calculated on demand with /knowledge/block?name=...&tool=...&efficiency=...&haste=...&miningFatigue=...&underwater=true&airborne=true. Missing or variant-dependent mob damage values remain null. Server-confirmed behavior overrides estimates.\n`)
console.log(`Exported ${blocks.length} blocks, ${mobs.length} entities and baseline tool timings`)
