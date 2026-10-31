import test from 'node:test'
import assert from 'node:assert/strict'
import {validate} from '../tools/config.js'
const baseline=()=>({minecraft:{mode:'realm',realmInvite:'a-valid-invite',realmId:'',username:'mycache',botPlayerName:'BotTag',offline:false},ownerPlayerNames:['OwnerTag'],localAPI:{port:8765,token:'a'.repeat(64)},worldBridge:{allowWorldEdits:false}})
test('realms configuration accepted with invite',()=>assert.equal(validate(baseline()).minecraft.mode,'realm'))
test('realms rejects unauthenticated bot',()=>{const c=baseline();c.minecraft.offline=true;assert.throws(()=>validate(c),/online/)})
test('realms can discover previously joined Realm without an invite',()=>{const c=baseline();c.minecraft.realmInvite='';assert.equal(validate(c).minecraft.mode,'realm')})
test('server mode still supported',()=>{const c=baseline();c.minecraft={...c.minecraft,mode:'server',host:'localhost',port:19132};assert.equal(validate(c).minecraft.mode,'server')})
