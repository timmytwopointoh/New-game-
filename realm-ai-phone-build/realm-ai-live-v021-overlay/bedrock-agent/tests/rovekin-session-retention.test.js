import test from 'node:test'
import assert from 'node:assert/strict'
import {Connection} from '../src/connection.js'
import {recoveryDecision} from '../src/join-loading-liveness.js'

// Synthetic, credential-free tests for the REAL Connection recovery method.
// Completion, STOP, server kicks, login errors and explicit close must never
// be treated as a transient transport failure.
const fixture=()=>({
  wasSpawnedThisSession:true,spawned:false,manualRecoveryStop:false,lastFailure:null,
  authChallenge:null,authState:'disconnected',transportCloseKind:'transport-close',
  transportCloseOrigin:'remote-transport',sessionCloseWindowAt:0,sessionCloseCount:0,
  lastSessionCloseCause:'none',messages:[],schedules:[],
  log(message){this.messages.push(message)},
  scheduleLoadingRecovery(stage,reason){this.schedules.push({stage,reason});return true}
})
const recover=s=>Connection.prototype.recoverUnexpectedPlayedSession.call(s)

test('task completion or STOP cannot trigger a Realm exit or reconnect without a transport close',()=>{
  const c=fixture()
  c.transportCloseKind='none'
  assert.equal(recover(c),false)
  c.transportCloseKind='transport-close'
  c.transportCloseOrigin='local-client-close'
  assert.equal(recover(c),false)
  c.transportCloseOrigin='remote-transport'
  c.manualRecoveryStop=true
  assert.equal(recover(c),false)
  assert.equal(c.sessionCloseCount,0)
  assert.deepEqual(c.schedules,[])
})
test('unexpected post-spawn transport loss schedules bounded saved-login retries',()=>{
  const c=fixture()
  assert.equal(recover(c),true)
  assert.equal(recover(c),true)
  assert.equal(recover(c),false,'third retry within a ten-minute window blocked')
  assert.deepEqual(c.schedules,[
    {stage:'spawned',reason:'unexpected-session-close'},
    {stage:'spawned',reason:'unexpected-session-close'}])
  assert.equal(c.sessionCloseCount,2)
  assert.match(c.messages[0],/No task or STOP command closed the session/)
})
test('cannot recover before a verified Realm spawn or after an explicit kick/protocol rejection',()=>{
  const c=fixture()
  c.wasSpawnedThisSession=false
  assert.equal(recover(c),false)
  c.wasSpawnedThisSession=true
  c.transportCloseKind='server-disconnect'
  c.transportCloseOrigin='server-kick'
  assert.equal(recover(c),false)
  c.transportCloseKind='protocol-error'
  c.transportCloseOrigin='network-error'
  assert.equal(recover(c),false)
  c.transportCloseKind='transport-close'
  c.lastFailure={phase:'minecraft-error'}
  assert.equal(recover(c),false)
  c.lastFailure=null
  c.authChallenge={userCode:'PENDING'}
  assert.equal(recover(c),false)
  assert.deepEqual(c.schedules,[])
})
test('loading-recovery policy accepts unverified transport loss only after closed and unspawned',()=>{
  assert.equal(recoveryDecision({stage:'spawned',reason:'unexpected-session-close',spawned:false,attempts:0}).retry,true)
  assert.equal(recoveryDecision({stage:'spawned',reason:'unexpected-session-close',spawned:true,attempts:0}).retry,false)
  assert.equal(recoveryDecision({stage:'spawned',reason:'unexpected-session-close',authPending:true}).retry,false)
  assert.equal(recoveryDecision({stage:'spawned',reason:'unexpected-session-close',manualStop:true}).retry,false)
  assert.equal(recoveryDecision({stage:'spawned',reason:'task-completed'}).retry,false)
})
