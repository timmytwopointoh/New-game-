import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {resolveMaterial} from './catalog.js'
import {readPrivateJson,writePrivateJson} from './private-json.js'

const actions=new Set(['walk','clear','dig','place','build_wall','build_floor','build_shelter','follow','ensure','rejoin'])
const outcomes=new Set(['confirmed','blocked','interrupted','unverified'])
const causes={
  terrain:'Wait for observed terrain before trying again.',
  tool:'Check the actual held tool before mining again.',
  supplies:'Check the server inventory and required supplies.',
  mode:'Wait for the bot’s server-reported mode and abilities.',
  protection:'Check reach and build protection; keep player builds intact.',
  reach:'Move within observed reach before trying again.',
  confirmation:'Wait for authoritative server feedback; inputs alone are not success.',
  other:'Recheck the current situation before another attempt.'
}
export function failureCause(reason){
  const s=String(reason||'').toLowerCase()
  if(/terrain|chunk|unloaded|unobserved/.test(s))return 'terrain'
  if(/tool|pickaxe|shovel|hardness/.test(s))return 'tool'
  if(/suppl|inventory|matching block|need \d+/.test(s))return 'supplies'
  if(/mode|survival|creative|abilit/.test(s))return 'mode'
  if(/protect|player build|permission/.test(s))return 'protection'
  if(/reach|too far/.test(s))return 'reach'
  if(/confirm|feedback|timed out|timeout|prediction/.test(s))return 'confirmation'
  return 'other'
}

// This learns task outcomes, never code, credentials, raw chat, or predicted success.
export class LearningMemory{
  constructor({directory=null,scope=null,clock=()=>Date.now()}={}){this.directory=directory;this.clock=clock;this.setScope(scope)}
  setScope(scope){
    this.scope=scope||null;this.entries={};this.error='';this.readOnly=false
    this.file=this.directory&&scope?path.join(this.directory,crypto.createHash('sha256').update(String(scope)).digest('hex')+'.json'):null
    if(!this.file||!fs.existsSync(this.file))return
    try{
      const data=readPrivateJson(this.file)
      if(data?.schema!==1||!Array.isArray(data.entries)||data.entries.length>128)throw Error()
      const restored={}
      for(const item of data.entries){
        const key=this.key(item)
        if(!key||Object.hasOwn(restored,key)||!outcomes.has(item.lastOutcome)||!Object.hasOwn(causes,item.lastCause)||!Number.isSafeInteger(item.lastAt)||item.lastAt<0)throw Error()
        for(const field of outcomes)if(!Number.isSafeInteger(item[field])||item[field]<0||item[field]>1000000)throw Error()
        restored[key]={id:item.id,material:item.material||null,...Object.fromEntries([...outcomes].map(field=>[field,item[field]])),lastOutcome:item.lastOutcome,lastCause:item.lastCause,lastAt:item.lastAt}
      }
      this.entries=restored
    }catch{this.error='Saved task learning could not be read; original file preserved.';this.readOnly=true}
  }
  key(descriptor){
    if(!actions.has(descriptor?.id))return null
    const material=descriptor.values?.material??descriptor.material??null
    if(material!==null&&(typeof material!=='string'||resolveMaterial(material)!==material))return null
    return descriptor.id+'|'+(material||'')
  }
  record(descriptor,outcome,reason=''){
    const key=this.key(descriptor)
    if(!key||!outcomes.has(outcome)||this.readOnly||(this.directory&&!this.scope))return false
    const previous=this.entries[key]||{id:descriptor.id,material:descriptor.values?.material||null,confirmed:0,blocked:0,interrupted:0,unverified:0}
    const entry={...previous,[outcome]:Math.min(previous[outcome]+1,1000000),lastOutcome:outcome,lastCause:failureCause(reason),lastAt:this.clock()}
    const next={...this.entries,[key]:entry}
    const ordered=Object.entries(next).sort((a,b)=>b[1].lastAt-a[1].lastAt)
    for(const [stale] of ordered.slice(128))delete next[stale]
    try{writePrivateJson(this.file,{schema:1,entries:Object.values(next)});this.entries=next;this.error='';return true}
    catch{this.error='Task outcome could not be saved; previous memory retained.';return false}
  }
  guidance(descriptor){
    const key=this.key(descriptor),entry=key&&this.entries[key]
    if(!entry||!['blocked','unverified'].includes(entry.lastOutcome))return ''
    return 'Learned from the previous attempt: '+causes[entry.lastCause]+' Current server checks still apply.'
  }
  snapshot(){
    const entries=Object.values(this.entries)
    return {scopeKnown:!!this.scope,patterns:entries.length,confirmed:entries.reduce((n,x)=>n+x.confirmed,0),blocked:entries.reduce((n,x)=>n+x.blocked,0),interrupted:entries.reduce((n,x)=>n+x.interrupted,0),unverified:entries.reduce((n,x)=>n+x.unverified,0),recent:entries.sort((a,b)=>b.lastAt-a.lastAt).slice(0,5).map(x=>({...x})),error:this.error}
  }
}
