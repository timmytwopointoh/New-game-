import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {CompanionCommands} from '../src/survival/companion-commands.js'
import {PermanentHome} from '../src/survival/permanent-home.js'

function fixture(homeDirectory,{ownerX=40,scope='realm-one'}={}){
 const messages=[],reports=[]
 const w={dimension:0,enabled:true,editModeVerified:false,
  players:new Map([['owner',{name:'Owner',position:{x:ownerX+.5,y:65.62,z:40.5}}]]),
  block(p,layer=0){return layer===1?{name:'air',shapes:[]}:
   p.y<=63?{name:'stone',shapes:[[0,0,0,1,1,1]]}:{name:'air',shapes:[]}},
  items(){return {dirt:64}},scan(){return {found:[{x:39,y:63,z:39,name:'dirt'}]}},
  requestNearby(){this.requested=true}
 }
 const navigation={job:{kind:'follow',name:'Owner'},survey:false,
  stop(){this.job=null}}
 const connection={spawned:true,client:{},config:{ownerPlayerNames:['Owner']},
  say(message){messages.push(message);return true}}
 const controller={world:w,navigation,connection,commandPlans:{scope},
  resources:{active:null},acquisition:{active:null},miningJobs:{active:null},
  operations:{pending:null},exploration:{active:null},report(message){reports.push(message)}}
 const companion=new CompanionCommands(controller,scope,{homeDirectory})
 controller.companion=companion
 return {companion,controller,world:w,messages,reports}
}

test('the first confirmed home is private, Realm-scoped and cannot be moved to another observed owner location',t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-home-'))
 t.after(()=>fs.rmSync(folder,{recursive:true,force:true}))
 const a=fixture(folder)
 const accepted=a.companion.handle('this is your new home spot')
 assert.equal(accepted.accepted,true,accepted.message)
 assert.equal(a.companion.homeProject.state,'running')
 const original=structuredClone(a.companion.plot)
 const record=a.companion.homeMemory
 assert(fs.existsSync(record.file),'home is committed to private storage before work can proceed')
 assert.equal(fs.statSync(record.file).mode&0o777,0o600)
 // This progress is normally marked only by server receipts inside HomeProject.tick.
 const project=a.companion.homeProject,stage=project.plan.stages[0]
 stage.status='confirmed';stage.serverConfirmed=stage.positions.length
 project.stage=1;project.plan.placementsVerified=stage.positions.length
 assert.equal(record.updateVerifiedProgress(project),true)
 const restarted=fixture(folder,{ownerX:210})
 assert.deepEqual(restarted.companion.plot.center,original.center)
 assert.equal(restarted.companion.homeProject.stage,1)
 assert.equal(restarted.companion.homeProject.plan.stages[0].status,'confirmed')
 assert.equal(restarted.companion.homeProject.plan.designId,project.plan.designId)
 const refused=restarted.companion.handle('this is your new home spot')
 assert.equal(refused.accepted,true)
 assert.match(refused.message,/permanent home/i)
 assert.deepEqual(restarted.companion.plot.center,original.center)
 assert.equal(restarted.companion.handle('this is your land').accepted,true)
 assert.deepEqual(restarted.companion.plot.center,original.center)
 assert.equal(restarted.messages.length,0,'no duplicate owner thank-you / assignment')
 restarted.companion.reset({sessionTransition:true})
 assert.equal(restarted.companion.social.mode,'house')
 assert(restarted.companion.homeProject.resumeLockedHomeOnSpawn('realm-one'),
   'rejoin should restore same project after real Realm spawn')
 restarted.companion.reset() // Explicit STOP is NOT a reconnect!
 assert.equal(restarted.companion.social.mode,'held')
})

test('a corrupt saved home is preserved and blocks any replacement home',t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rovekin-corrupt-'))
 t.after(()=>fs.rmSync(folder,{recursive:true,force:true}))
 const storage=new PermanentHome({directory:folder,scope:'realm-one'})
 fs.mkdirSync(path.dirname(storage.file),{recursive:true})
 fs.writeFileSync(storage.file,'{"schema":1,"bad":"do not overwrite"}')
 const reopened=new PermanentHome({directory:folder,scope:'realm-one'})
 assert.equal(reopened.readOnly,true)
 const attempt=fixture(folder).companion.handle('this is your new home spot')
 assert.equal(attempt.accepted,false)
 assert.match(attempt.message,/original file preserved/i)
 assert.equal(fs.readFileSync(storage.file,'utf8'),'{"schema":1,"bad":"do not overwrite"}')
})
