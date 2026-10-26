// node src/map/mapchecks.check.ts
import assert from 'node:assert/strict'
import { ownWords, problems } from './mapchecks.ts'

assert.deepEqual(problems('That sounds heavy. It makes sense it keeps coming back.', { maxQ: 1 }), [])
assert.match(problems('You should talk to your manager.')[0], /strong advice/)
assert.match(problems('Sounds like anxiety disorder.')[0], /clinical/)
assert.match(problems('You are overreacting.')[0], /judges/)
assert.match(problems('A? B? C?', { maxQ: 1 })[0], /questions/)
assert.match(problems('one two three four five six seven', { maxWords: 6 })[0], /words/)
assert.ok(ownWords('I keep putting it off.', 'Honestly I keep putting it off every day'))
assert.ok(!ownWords('You avoid hard tasks.', 'I keep putting it off'))
assert.match(problems('That is very common.', { noCommon: true })[0], /once per session/)
assert.deepEqual(problems('That is very common.'), [])
console.log('mapchecks ok')
