import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const target=path.join(root,'config.json')
if (fs.existsSync(target)) {
  console.log('config.json exists; leaving it unchanged.'); process.exit(0)
}
const data=JSON.parse(fs.readFileSync(path.join(root,'config.example.json'),'utf8'))
data.localAPI.token=crypto.randomBytes(32).toString('hex')
fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'})
console.log('Created config.json with random local API token. Edit address, exact gamertags, and edition settings before running.')
