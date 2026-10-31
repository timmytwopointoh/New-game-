import test from 'node:test'
import assert from 'node:assert/strict'
import {playerInventoryWindow, stackIdentity, inventoryTotals, inventorySlotChanges, assessHotbarSelection, damageDiagnosis} from '../src/survival/inventory-evidence.js'

test('only player inventory window is treated as player inventory', () => {
  for (const id of [0, '0', 'inventory']) assert.equal(playerInventoryWindow(id), true)
  for (const id of [1, 2, 'armor', 'offhand', undefined]) assert.equal(playerInventoryWindow(id), false)
})
test('unknown server item IDs stay visible and empty slots are ignored', () => {
  const inventory = new Map([[0, {network_id: 301, count: 1}], [1, {network_id: 0, count: 0}], [2, {network_id: 999, count: 2}]])
  assert.deepEqual(inventoryTotals(inventory, {301: {name:'iron_shovel'}}), {iron_shovel:1, unmapped_item_999:2})
  assert.equal(stackIdentity(inventory.get(1)), null)
})
test('server receipt history can distinguish shovel addition from subsequent removal', () => {
  const a = new Map([[0,{network_id:0,count:0}]]), b = new Map([[0,{network_id:301,count:1}]])
  assert.deepEqual(inventorySlotChanges(a,b,{301:{name:'iron_shovel'}}), [{slot:0,before:'empty',after:'iron_shovel',beforeCount:0,afterCount:1}])
  assert.equal(inventorySlotChanges(b,a,{301:{name:'iron_shovel'}})[0].after,'empty')
})
test('selection refuses unknown or malformed server descriptors', () => {
  assert.equal(assessHotbarSelection(new Map(),0).ok,false)
  assert.equal(assessHotbarSelection(new Map([[0,{network_id:3,count:0}]]),0).ok,false)
  assert.equal(assessHotbarSelection(new Map([[0,{network_id:301,count:1}]]),0).ok,true)
  assert.equal(assessHotbarSelection(new Map([[0,{network_id:0,count:0}]]),0).ok,true)
  assert.equal(assessHotbarSelection(new Map([[9,{network_id:301,count:1}]]),9).ok,false)
})
test('diagnosis distinguishes invulnerability and unconfirmed PvP behavior', () => {
  assert.match(damageDiagnosis('survival',{effective:{invulnerable:false},active:[]}),/invulnerability: disabled/)
  assert.match(damageDiagnosis('creative',{effective:{invulnerable:true},active:['invulnerable']}),/invulnerability: enabled/)
  assert.match(damageDiagnosis('survival',null),/invulnerability: not reported/)
  assert.match(damageDiagnosis('survival',null),/missed hit alone does not prove Creative/)
})
