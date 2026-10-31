// node src/map/demo.check.ts
import assert from 'node:assert/strict'
import { CARDS, SCRIPT, afterNaming, demoLines, demoMade } from './demo.ts'
import { trimmed } from './mapchecks.ts'

// every scripted card is a delete-only trim of the line it comes from
for (const c of CARDS) assert.deepEqual(trimmed(c.text, SCRIPT[c.step].p), [], c.key)
// the options steps and the naming follow-ups
assert.deepEqual(SCRIPT.filter((s) => s.options).map((s) => s.options!.length), [2, 2])
assert.match(afterNaming(SCRIPT[3].ai, ['dread', 'overwhelmed'])!.text, /^Dread and overwhelmed\. Thank you/)
assert.equal(afterNaming(SCRIPT[3].ai, ['dread'])!.next, 4)
assert.equal(afterNaming(SCRIPT[5].ai, ['afraid'])!.next, 7) // naming at step 6 skips "I don't know what to call it"
// the scripted cut follows the messages that were really sent
const msgs = SCRIPT.map((s) => ({ role: 'you' as const, text: s.p }))
assert.equal(demoMade(msgs).length, 11)
assert.equal(demoMade(msgs.filter((_, i) => i !== 6)).find((c) => c.text.startsWith('maybe'))!.from, 7)
const cards = demoMade(msgs).map((c, i) => ({ id: `c${i}`, text: c.text }))
assert.equal(demoLines(cards).length, 12)
console.log('demo ok')
