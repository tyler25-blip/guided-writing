// node src/map/demo.check.ts
import assert from 'node:assert/strict'
import { CARDS, NEW, SCRIPT, afterNaming, demoLines, demoMade, demoMsgs, demoNewKind } from './demo.ts'
import { trimmed } from './mapchecks.ts'
import { candidates, insertNew, walkPlan } from './walk.ts'

// 6–8 turns, the last reply offers the map, every reply has its popup text
assert.ok(SCRIPT.length >= 6 && SCRIPT.length <= 8)
assert.ok(SCRIPT.at(-1)!.propose)
assert.ok(SCRIPT.every((s) => s.why))
// every scripted card is a delete-only trim of the line it comes from
for (const c of CARDS) assert.deepEqual(trimmed(c.text, SCRIPT[c.step].p), [], c.key)
// the feeling is named once; an own word works like a chosen one
assert.deepEqual(SCRIPT.filter((s) => s.options).map((s) => s.options!.length), [2])
assert.match(afterNaming(SCRIPT[0].ai, ['embarrassed'])!.text, /^Embarrassed\. Thank you/)
assert.equal(afterNaming(SCRIPT[0].ai, ['embarrassed'])!.next, 1)
// all five labels are collected along the way
const got = new Set(demoMsgs().flatMap((m) => m.why?.got ?? []))
assert.deepEqual([...got].sort(), ['A', 'B', 'C', 'DE', 'NEXT'])
// the scripted cut follows the messages that were really sent; the map walks the circle A1 → B1 → C1 → A2 → back to B1
const made = demoMade(demoMsgs())
assert.equal(made.length, CARDS.length)
const cards = made.map((c, i) => ({ id: CARDS[i].key, text: c.text, kind: CARDS[i].kind }))
const lines = demoLines(cards).map((l, i) => ({ id: `e${i}`, ...l }))
const p = walkPlan(cards, lines)
assert.deepEqual(p.path, ['A1', 'B1', 'C1', 'A2'])
assert.deepEqual(lines.find((l) => l.id === p.close), { id: p.close, from: 'A2', to: 'B1' })
assert.deepEqual(p.options.map((o) => o.kind), ['DE', 'NEXT'])
// closing the circle: level 1 lights "they don't like me" and the dinner; "somewhere new" adds a thought that leads back to the same card
assert.deepEqual(candidates(p, lines), ['B1', 'A1'])
assert.equal(demoNewKind(NEW.text), 'B')
assert.equal(demoNewKind('something else'), undefined)
const withNew = insertNew(lines, p, 'B2', ['n1', 'n2'])
const p2 = walkPlan([...cards, { id: 'B2', text: NEW.text, kind: NEW.kind }], withNew)
assert.deepEqual(p2.path, ['A1', 'B1', 'C1', 'A2', 'B2'])
assert.deepEqual(withNew.find((l) => l.id === p2.close), { id: 'n2', from: 'B2', to: 'B1', by: 'ai' })
console.log('demo ok')
