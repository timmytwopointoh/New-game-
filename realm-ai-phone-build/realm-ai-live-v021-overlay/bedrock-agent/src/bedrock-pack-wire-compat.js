// Bedrock 1.26.60 resource-pack response enum compatibility.
//
// The privately bundled minecraft-data 3.119.0 protocol.json for 1.26.60
// still maps refused/send_packs/have_all_packs/completed to 0/1/2/3.
// Mojang protocol 2225 (1.26.60) maps them to 1/2/3/4 instead.
// A server interpreting our 1 as Cancel cannot send pack data.
// Correct the in-memory protocol BEFORE createClient compiles its serializer.
// No changes to auth, Bedrock login, transport, saved accounts, or local files.
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const MODERN_VERSION='1.26.60'
const OLD={'0':'refused','1':'send_packs','2':'have_all_packs','3':'completed'}
const CORRECT={'1':'refused','2':'send_packs','3':'have_all_packs','4':'completed'}

function sameMappings(actual,expected){
 return !!actual && Object.keys(actual).length===Object.keys(expected).length &&
  Object.entries(expected).every(([number,status])=>actual[number]===status)
}

export function correctPackResponseSchema(version,protocol){
 if(String(version)!==MODERN_VERSION)return {version:String(version),mode:'unchanged-version',patched:false}
 const definitions=protocol?.types?.packet_resource_pack_client_response
 const fields=definitions?.[0]==='container'?definitions[1]:null
 const entry=fields?.find(field=>field?.name==='response_status')
 const map=entry?.type?.[0]==='mapper'?entry.type[1]?.mappings:null
 if(sameMappings(map,CORRECT))return {version:MODERN_VERSION,mode:'modern-1-to-4',patched:false}
 if(!sameMappings(map,OLD))throw Error('Unsupported Bedrock 1.26.60 resource-pack response schema')
 // Mutate the schema returned by minecraft-data's shared loader. A newly
 // instantiated bedrock-protocol client compiles this same object to wire code.
 for(const key of Object.keys(map))delete map[key]
 Object.assign(map,CORRECT)
 return {version:MODERN_VERSION,mode:'modern-1-to-4',patched:true}
}

export function preparePackResponseWire(options,loadData=require('minecraft-data')){
 const installedVersion=require('bedrock-protocol/src/options').CURRENT_VERSION
 const version=String(options?.version||installedVersion)
 const data=loadData('bedrock_'+version)
 if(!data?.protocol)throw Error('Missing Bedrock protocol schema for '+version)
 return correctPackResponseSchema(version,data.protocol)
}
