// node src/map/demo.check.ts
import assert from 'node:assert/strict'
import { CARDS, SCRIPT, STORIES, afterNaming, demoLines, demoMade, setStory } from './demo.ts'
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
// the recorded stories: every card trims a line of its own script, every line joins two of its cards, the last reply offers the map
for (let i = 1; i < STORIES.length; i++) {
  setStory(i)
  const st = STORIES[i]
  assert.ok(st.script.length >= 8 && st.script.at(-1)!.propose, st.name)
  assert.ok(st.script.filter((x) => x.options).length >= 1, `${st.name}: at least one feeling to name`)
  for (const c of CARDS) assert.deepEqual(trimmed(c.text, SCRIPT[c.step].p), [], `${st.name} ${c.key}`)
  const made = demoMade(SCRIPT.map((x) => ({ role: 'you' as const, text: x.p })))
  assert.equal(made.length, st.cards.length, st.name)
  assert.equal(demoLines(made.map((c, j) => ({ id: `c${j}`, text: c.text }))).length, st.lines.length, st.name)
}
setStory(0)
console.log('demo ok')
