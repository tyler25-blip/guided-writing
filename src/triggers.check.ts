// Run: node src/triggers.check.ts
import assert from 'node:assert/strict'
import { isCrisis, isWhyLoop } from './triggers.ts'

// Immersed why-loops fire.
assert.ok(isWhyLoop('I messed up again. Why am I always like this?'))
assert.ok(isWhyLoop("What's wrong with me"))
assert.ok(isWhyLoop('It is always my fault'))
// Distanced or concrete writing stays silent.
assert.ok(!isWhyLoop('Tyler froze when the professor asked about the sample size.'))
assert.ok(!isWhyLoop('The meeting started at nine and the projector broke.'))
assert.ok(!isWhyLoop('Why does Tyler freeze in meetings?'))
// Crisis words.
assert.ok(isCrisis('sometimes I want to die'))
assert.ok(isCrisis('thinking about self-harm'))
assert.ok(!isCrisis('this deadline is killing me'))
assert.ok(isCrisis('everyone would be better off without me'))
assert.ok(isCrisis('sometimes I hope I just don’t wake up'))
assert.ok(isCrisis('ich will nicht mehr leben'))
assert.ok(isCrisis('有時候覺得沒有我大家會更好'))
assert.ok(!isCrisis('I am a bit burned out from the burden of homework'))

console.log('triggers: ok')
