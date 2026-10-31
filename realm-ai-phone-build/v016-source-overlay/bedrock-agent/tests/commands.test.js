import test from 'node:test'
import assert from 'node:assert/strict'
import {parseCommand} from '../pack-template/scripts/commands.js'
test('follow command',()=>assert.equal(parseCommand('follow me').action,'follow'))
test('stop command',()=>assert.equal(parseCommand('stop').action,'stop'))
test('wall has hard safety budget',()=>assert.equal(parseCommand('build wall 6 x 3 of stone').action,'invalid'))
test('valid mine limited to twelve blocks',()=>assert.equal(parseCommand('mine 3 oak_log').count,3))
test('unknown command rejected',()=>assert.equal(parseCommand('delete realm').action,'invalid'))
