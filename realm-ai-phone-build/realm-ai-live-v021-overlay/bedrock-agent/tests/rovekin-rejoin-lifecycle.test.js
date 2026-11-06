import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createApi} from '../src/api.js'

class FakeRealm extends EventEmitter {
 constructor(){
  super()
  this.spawned=false
  this.connected=false
  this.username='Bot'
  this.config={minecraft:{botPlayerName:'Bot'},ownerPlayerNames:['Owner']}
  this.events=[]
  this.nextEventId=0
  this.rejoins=0
  this.cancelledAutoRecoveries=0
  this.stopCalls=0
  const self=this
  this.survival={
   handle(raw){if(raw==='stop'){self.stopCalls++;return {accepted:true,queued:false,message:'Current job stopped; bot session retained.'}}
    return {accepted:false,message:'No action'}},
   companion:{handle:()=>null,beforeOwnerAction:()=>{},afterOwnerAction:()=>{},social:{}},
   voice:{handle:()=>null,frame:s=>s},
   resourceRecall:{handle:()=>null},
   commandPlans:{snapshot:()=>({cards:[],capacity:5,running:null})}
  }
 }
 status(){return {connected:this.connected,spawned:this.spawned,authState:'disconnected'}}
 reconnect(){this.rejoins++;return {accepted:true,queued:true,message:'Rejoining with saved Microsoft session.'}}
 cancelAutoRecovery(){this.cancelledAutoRecoveries++}
}

async function fixture(fn){
 const connection=new FakeRealm()
 const token='4'.repeat(64)
 const server=createApi({localAPI:{token}},connection,()=>{})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const url='http://127.0.0.1:'+server.address().port
 const post=(path,auth=token)=>fetch(url+path,{
  method:'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},body:'{}'})
 try {await fn({connection,post})}
 finally {await new Promise(resolve=>server.close(resolve))}
}
test('Rovekin reconnect uses token protected API and reuses the existing process',async()=>{
 await fixture(async ({connection,post})=>{
  const unauth=await post('/rejoin?epoch=0','wrong')
  assert.equal(unauth.status,401)
  assert.equal(connection.rejoins,0)
  const permitted=await post('/rejoin?epoch=0')
  assert.equal(permitted.status,200)
  const answer=await permitted.json()
  assert.equal(answer.queued,true)
  assert.match(answer.message,/saved Microsoft session/)
  assert.equal(connection.rejoins,1)
 })
})
test('Rovekin STOP cancels current job but never stops Realm reconnect',async()=>{
 await fixture(async ({connection,post})=>{
  const r=await post('/stop?epoch=10')
  assert.equal(r.status,200)
  assert.equal(connection.stopCalls,1)
  assert.equal(connection.cancelledAutoRecoveries,0)
  const old=await post('/rejoin?epoch=9')
  assert.equal((await old.json()).accepted,false,'stale reconnect after STOP is rejected')
  assert.equal(connection.rejoins,0)
  const fresh=await post('/rejoin?epoch=10')
  assert.equal((await fresh.json()).accepted,true)
  assert.equal(connection.rejoins,1)
 })
})