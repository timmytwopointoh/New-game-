// Independent wire fixtures from Gophertunnel's ResourcePackClientResponse Marshal:
// varuint32 variant tag 0..3, lowercase string, then varuint32 string-list for tag 1.
// The fixtures do not deserialize using the same patched schema.
const assert=require('node:assert/strict')
const path=require('node:path')
const {EventEmitter}=require('node:events')
const {pathToFileURL}=require('node:url')
const fs=require('node:fs'),os=require('node:os')
const base=path.resolve(process.argv[2])
const {createSerializer}=require(path.join(base,'bedrock-agent/node_modules/bedrock-protocol/src/transforms/serializer'))
const writer=createSerializer('1.26.60')
const cases=[
 ['refused','cancel','08000663616e63656c',[]],
 ['send_packs','downloading','08010b646f776e6c6f6164696e670103615f31',['a_1']],
 ['have_all_packs','downloadingfinished','080213646f776e6c6f6164696e6766696e6973686564',[]],
 ['completed','resourcepackstackfinished','0803197265736f757263657061636b737461636b66696e6973686564',[]]
]
for(const [status,name,hex,ids] of cases){
 const actual=writer.createPacketBuffer({name:'resource_pack_client_response',params:{response_status:status,response_status_name:name,resourcepackids:ids}})
 assert.equal(actual.toString('hex'),hex,`Wire fixture mismatch: ${status}`)
}
;(async()=>{
 const {attachRealmPacks}=await import(pathToFileURL(path.join(base,'bedrock-agent/src/realm-packs.js')))
 const client=new EventEmitter(),sent=[]
 client.write=(name,params)=>sent.push(writer.createPacketBuffer({name,params}).toString('hex'))
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vf-wire-'))
 const h=attachRealmPacks(client,dir)
 try{
  client.emit('resource_packs_info',{texture_packs:[]});client.emit('resource_pack_stack',{})
  assert.deepEqual(sent,[cases[2][2],cases[3][2]])
  console.log('PASS: four independent wire fixtures and actual empty-pack handshake')
 }finally{h.cleanup();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1})
