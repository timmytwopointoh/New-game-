import test from 'node:test'
import assert from 'node:assert/strict'
import {answerWordQuestion,bundledEnglishWordCount,lookupEnglishWord} from '../src/lexicon/lookup.js'
import {classifyConversation,respondToConversation} from '../src/conversation.js'
import {CommandVocabulary} from '../src/survival/command-vocabulary.js'

test('the bundled offline English glossary has 5,000 ranked entries with definitions and context',()=>{
 assert.equal(bundledEnglishWordCount,5000)
 const stone=lookupEnglishWord('STONE')
 assert.equal(stone.word,'stone');assert(stone.rank<8000);assert(stone.senses.length>=1)
 assert(stone.senses[0].definition.length>10)
 assert.equal(lookupEnglishWord('not a single word'),null)
})

test('questions and definitions stay conversational and never create a plan',()=>{
 assert.equal(classifyConversation('What does troll mean?').kind,'about')
 const reply=respondToConversation('What does troll mean?')
 assert.match(reply,/troll/i);assert.match(reply,/noun|verb|adjective|adverb/i)
 assert.equal(classifyConversation('I am just joking').kind,'chat')
 assert.match(respondToConversation('I am just joking'),/chat, not an action/i)
 const answer=answerWordQuestion('an absolutely-unlisted term')
 assert.equal(answer.kind,'unknown')
 assert.match(respondToConversation('what is an absolutely-unlisted term?'),/What context did you see it in/i)
})

test('Minecraft concepts use the game catalog while supported action synonyms stay command-only',()=>{
 assert.deepEqual(answerWordQuestion('a cobblestone'),{kind:'material',material:'cobblestone'})
 const vocabulary=new CommandVocabulary()
 assert.equal(vocabulary.expand('excavate 1 62 3').text,'dig 1 62 3')
 assert.equal(vocabulary.expand('travel to 4 62 8').text,'walk to 4 62 8')
 assert.equal(vocabulary.expand('search for diamond_ore').text,'find diamond_ore')
 assert.equal(classifyConversation('search for diamond ore').kind,'chat')
})
