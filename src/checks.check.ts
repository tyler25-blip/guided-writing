// Run: node src/checks.check.ts
import assert from 'node:assert/strict'
import { allOk, checkComment } from './checks.ts'

const user = 'I froze in front of everyone again. Why am I always like this?'

const good = checkComment('Freezing in front of everyone is a hard moment. Want to try telling it as Tyler’s story?', user, ['in front of everyone', 'froze'], 'Tyler')
assert.ok(allOk(good), JSON.stringify(good))

const c = (s: string, w = ['froze']) => checkComment(s, user, w, 'Tyler')
assert.equal(c('You froze. That is hard. It happens. Want to write more?').S1.ok, false) // too many sentences
assert.equal(c('You froze. Want to say more? Or not?').S1.ok, false) // two questions
assert.equal(c('You froze. Please rewrite it as Tyler.').S3.ok, false) // command, no invitation
assert.equal(c('You froze, how devastating. Want to say more?').S2.ok, false)
assert.equal(c('You froze. Why did you freeze?').S5.ok, false)
assert.equal(c('You froze. I suggest breathing — want to try?').R3.ok, false)
assert.equal(c('You froze, maybe anxiety disorder. Want to say more?').X3.ok, false)
assert.equal(c('Rumination detected. Want to say more?').X5.ok, false)
assert.equal(c('Hard moment. Want to tell it as Tyler?', ['Tyler']).S4.ok, false) // name doesn't count
assert.equal(c('Hard moment. Want to say more?', ['stumbled']).S4.ok, false) // word not in user's text
console.log('checks ok')
