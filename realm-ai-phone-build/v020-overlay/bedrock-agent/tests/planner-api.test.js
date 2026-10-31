import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createApi} from '../src/api.js'
class FakeConnection extends EventEmitter{
  constructor(){super();this.spawned=true;this.events=[];this.nextEventId=0;this.sent=[]}
  send(command){this.sent.push(command);return {accepted:true,message:'Submitted to chat, not verified'} }
  status(){return {connected:true,joined:true,spawned:this.spawned,server:'test Realm'} }
  report(message){const e={id:++this.nextEventId,message};this.events.push(e);this.emit('realm-report',e)}
}
test('HTTP conversation previews and safely executes plan with observable progress',async()=>{
  const c=new FakeConnection(),server=createApi({localAPI:{token:'a'.repeat(64)}},c,()=>{})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  try{
    const endpoint=`http://127.0.0.1:${server.address().port}`
    const req=async(method,path,data)=>{const r=await fetch(endpoint+path,{method,headers:{authorization:'Bearer '+'a'.repeat(64),'content-type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json()}}
    const preview=await req('POST','/message',{message:'plan find iron ore then gather 2 iron ore'})
    assert.equal(preview.status,200);assert.equal(preview.body.queued,false);assert.equal(c.sent.length,0)
    const begin=await req('POST','/message',{message:'start plan'})
    assert.equal(begin.status,200);assert.equal(begin.body.queued,true);assert.deepEqual(c.sent,['find iron_ore'])
    const blocked=await req('POST','/message',{message:'build a floor 2 by 2 of stone'})
    assert.equal(blocked.body.queued,false);assert.deepEqual(c.sent,['find iron_ore'])
    c.report('Nearest scanned iron_ore: 1,2,3 (only nearby loaded blocks).')
    assert.deepEqual(c.sent,['find iron_ore','mine 2 iron_ore'])
    const status=await req('GET','/planner')
    assert.equal(status.body.planner.state,'running');assert.equal(status.body.planner.current,1)
    c.report('Finished mining iron_ore: 2/2 successful.')
    const updates=await req('GET','/updates?after=0')
    assert.equal(updates.body.planner.state,'completed');assert.ok(updates.body.updates.some(e=>e.source==='Planner'))
    const unauth=await fetch(endpoint+'/planner');assert.equal(unauth.status,401)
  }finally{await new Promise(resolve=>server.close(resolve))}
})
