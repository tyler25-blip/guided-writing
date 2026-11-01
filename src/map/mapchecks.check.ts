// node src/map/mapchecks.check.ts
import assert from 'node:assert/strict'
import { ownWords, problems, replyProblems, trimmed } from './mapchecks.ts'

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

// cards are delete-only trims
const said = 'Um, I keep thinking I’m going to totally mess it up, you know'
assert.deepEqual(trimmed('I keep thinking I’m going to totally mess it up', said), [])
assert.deepEqual(trimmed('I keep thinking I’m going to totally mess it up', 'Um, I don’t know, I just, like, I keep thinking I’m going to totally mess it up, you know, like totally.'), [])
assert.match(trimmed('mess it up I keep thinking', said)[0], /order/)
assert.match(trimmed('I keep thinking I’m going to totally definitely mess it up', said)[0], /adds words/)
assert.match(trimmed('I keep thinking I’m going to totally break it up', said)[0], /adds words/)
assert.match(trimmed('I do think I will pass', 'I do not think I will pass')[0], /“not”/)
assert.match(trimmed('I think I will fail', 'I think maybe I will fail')[0], /“maybe”/)
assert.deepEqual(trimmed('I will fail', 'Maybe I will fail'), []) // a leading hedge outside the kept span is a cut the person sees on the left
// chat replies
assert.deepEqual(replyProblems({ reply: 'Dread is a heavy one to carry. Want to put a word to it?'.replace('?', '.'), options: ['dread', 'overwhelmed'] }), [])
assert.match(replyProblems({ reply: 'These are the facts.', options: [] })[0], /fact/)
assert.match(replyProblems({ reply: 'I hear you, that sounds hard today.', options: [] }, 'I hear you, that is a lot')[0], /same opening/)
assert.match(replyProblems({ reply: 'Which is closer?', options: ['dread', 'overwhelmed'] })[0], /question mark/)
assert.match(replyProblems({ reply: 'ok.', options: ['dread'] })[0], /exactly 2/)
assert.match(replyProblems({ reply: 'ok.', options: ['dread', 'Dread'] })[0], /same word/)
assert.match(replyProblems({ reply: 'ok.', options: ['very deep dread', 'fear'] })[0], /2 words/)
assert.match(replyProblems({ reply: 'ok.', options: ['depression', 'fear'] })[0], /clinical/)
console.log('mapchecks ok')
