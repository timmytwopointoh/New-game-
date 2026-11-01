import test from 'node:test'
import assert from 'node:assert/strict'
import {extractGooglePlan,googleResearchPrompt} from '../src/research-action-plan.js'
test('Google advice must use explicit supported command lines',()=>{
 const r=extractGooglePlan('Look at the nearby trees','First look at the world.\nCOMMAND: look around\nCOMMAND: find oak log\nCOMMAND: /op me')
 assert.deepEqual(r.commands.map(x=>x.text),['look around','find oak log']);assert.equal(r.needsLiveVerification,true)
})
test('Cannot promote Google text into a world edit without matching owner request',()=>{
 const r=extractGooglePlan('Look around','COMMAND: dig 2 65 4\nCOMMAND: walk to 2 64 4\nCOMMAND: look around')
 assert.deepEqual(r.commands.map(x=>x.text),['look around'])
})
test('Preserves explicitly requested edits and movement, but does not invent coordinates',()=>{
 const r=extractGooglePlan('Walk to 2 64 4 and dig 3 64 5','COMMAND: walk to 2 64 4\nCOMMAND: dig 3 64 5\nCOMMAND: dig X Y Z')
 assert.deepEqual(r.commands.map(x=>x.text),['walk to 2 64 4','dig 3 64 5'])
 assert.match(googleResearchPrompt('get some wood'),/Never invent coordinates/)
})
test('Caps at five and ignores prompt injection or scripts',()=>{
 const r=extractGooglePlan('look around',Array(6).fill(0).map((_,i)=>`COMMAND: find ${String.fromCharCode(97+i)} oak`).join('\n')+'\nCOMMAND: sudo rm -rf /')
 assert.equal(r.commands.length,5);assert.ok(r.warnings.length)
 assert.throws(()=>extractGooglePlan('x','A'.repeat(7001)),/7,000/)
})
