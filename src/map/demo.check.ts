// node src/map/demo.check.ts
import assert from 'node:assert/strict'
import { demoLoops, CARDS, NEW, SCRIPT, SIDE, afterNaming, demoLines, demoMade, demoMsgs, demoNewKind, demoSide } from './demo.ts'
import { trimmed } from './mapchecks.ts'
import { estH, estW } from './place.ts'
import { demoState } from './demo.ts'
import { candidates, insertNew, sameMoment, walkPlan, waysOf } from './walk.ts'

// 6–10 turns, the last reply offers the map, every reply has its popup text
assert.ok(SCRIPT.length >= 6 && SCRIPT.length <= 10)
assert.ok(SCRIPT.at(-1)!.propose)
assert.ok(SCRIPT.every((s) => s.why))
// every scripted card is a delete-only trim of the line it comes from
for (const c of CARDS) assert.deepEqual(trimmed(c.text, SCRIPT[c.step].p), [], c.key)
// the feeling is named once; an own word works like a chosen one
assert.deepEqual(SCRIPT.filter((s) => s.options).map((s) => s.options!.length), [2])
assert.match(afterNaming(SCRIPT[0].ai, ['embarrassed'])!.text, /^Embarrassed\. Thank you/)
assert.equal(afterNaming(SCRIPT[0].ai, ['embarrassed'])!.next, 1)
assert.deepEqual(SCRIPT[0].options, ['rejected', 'ashamed'])
// all five labels are collected along the way
const got = new Set(demoMsgs().flatMap((m) => m.why?.got ?? []))
assert.deepEqual([...got].sort(), ['A', 'B', 'C', 'DE', 'NEXT'])
// the scripted cut follows the messages that were really sent; the map walks two circles one after another
const made = demoMade(demoMsgs())
assert.equal(made.length, CARDS.length)
const cards = made.map((c, i) => ({ id: CARDS[i].key, text: c.text, kind: CARDS[i].kind }))
const lines = demoLines(cards).map((l, i) => ({ id: `e${i}`, ...l }))
assert.equal(lines.length, 14)
const find = (a: string, b: string) => lines.find((l) => l.from === a && l.to === b)!
// walked first, the circle that stays in the head: A1 (the event, its lead) → B2 → B3 → C2 → B1 → back to B2; only thoughts can be seen another way
const p = walkPlan(cards, lines)
assert.deepEqual(p.path, ['A1', 'B2', 'B3', 'C2', 'B1'])
assert.deepEqual(lines.find((l) => l.id === p.close), find('B1', 'B2'))
assert.ok(p.options.length && p.options.every((o) => o.kind === 'DE'))
// walked last, the circle in the world: it starts where the line from the same event arrives, C1 → A2 → B4 → back to C1 (the event leads to the feeling); a thought or something they did (the Next step is the last step)
const q = walkPlan(cards, lines, 1)
assert.deepEqual(q.path, ['C1', 'A2', 'B4'])
assert.equal(q.links[0], find('A1', 'C1').id) // both circles come from the same event
assert.equal(sameMoment(cards, lines, 1), true)
assert.deepEqual(lines.find((l) => l.id === q.close), find('B4', 'C1'))
assert.deepEqual(q.options.map((o) => o.kind), ['DE', 'NEXT'])
assert.deepEqual(walkPlan(cards, lines, 2).path, [])
// each circle has its own ways out
assert.deepEqual(waysOf(cards, lines, 0), ['DH1'])
assert.deepEqual(waysOf(cards, lines, 1), ['DE1', 'DE2', 'DE3', 'NX'])
// closing the circle: one card glows, the guess; "somewhere new" adds a thought that leads back to the same card (the world circle)
assert.deepEqual(candidates(p, lines), ['B2'])
assert.deepEqual(candidates(q, lines), ['C1'])
assert.equal(demoNewKind(NEW.text), 'B')
assert.equal(demoNewKind('something else'), undefined)
const withNew = insertNew(lines, q, 'Bn', ['n1', 'n2'])
const q2 = walkPlan([...cards, { id: 'Bn', text: NEW.text, kind: NEW.kind }], withNew, 1)
assert.deepEqual(q2.path, ['C1', 'A2', 'B4', 'Bn'])
assert.deepEqual(withNew.find((l) => l.id === q2.close), { id: 'n2', from: 'Bn', to: 'C1', by: 'ai' })
// a card added beside another during the walk: the second thought of the same message (a delete-only trim of it), offered once
for (const [key, text] of Object.entries(SIDE)) assert.deepEqual(trimmed(text, SCRIPT[CARDS.find((c) => c.key === key)!.step].p), [], key)
const b1 = CARDS.find((c) => c.key === 'B1')!.text
assert.equal(demoSide(b1, []), 'I knew I shouldn’t have asked her')
assert.equal(demoSide(b1, [{ text: 'I knew I shouldn’t have asked her' }]), '')
assert.equal(demoSide(CARDS[0].text, []), '')
// the finished map (both circles closed and cut, real card sizes): nothing overlaps and no ring arc runs through a way-out card; the event sits between the rings
const fin = demoState('summary', { w: 1400, h: 900 })
for (const to of ['laid', 'summary'] as const) {
  const st = to === 'summary' ? fin : demoState(to, { w: 1400, h: 900 })
  const bs = st.cards.map((c) => ({ id: c.id, x: c.x, y: c.y, w: estW(c.text, c.kind), h: estH(c.text, c.kind) }))
  assert.ok(!bs.some((a, i) => bs.slice(i + 1).some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)), to)
  const rings = new Set((st.rounds ?? []).flatMap((r) => r.ids))
  for (const e of st.edges)
    if (e.arc)
      for (let t = e.arc[3]; t <= e.arc[4]; t += 0.02) {
        const [px, py] = [e.arc[0] + e.arc[2] * Math.cos(t), e.arc[1] + e.arc[2] * Math.sin(t)]
        assert.ok(!bs.some((q) => !rings.has(q.id) && px > q.x && px < q.x + q.w && py > q.y && py < q.y + q.h), `${to}: an arc runs through a card`)
      }
}
const ev = fin.cards.find((c) => c.text.startsWith('I asked Mia'))!
assert.equal(fin.rounds?.length, 2)
assert.ok(fin.rounds![0].cx < fin.rounds![1].cx) // the head circle on the left, the world circle on the right
// the world circle starts at the top with the feeling (where the event's line arrives) and runs anticlockwise; the thought it comes back through sits on the right
const angOf = (t: string, r: { cx: number; cy: number }) => { const c = fin.cards.find((x) => x.text === t)!; return (Math.atan2(c.y + 126 - r.cy, c.x + 126 - r.cx) * 180) / Math.PI }
assert.ok(Math.abs(angOf('I just feel really small today', fin.rounds![1]) + 90) <= 1 && fin.rounds![1].ccw)
assert.ok(Math.abs(angOf('I’m not worth anyone choosing me', fin.rounds![1])) < 60) // on the ring's right half
assert.ok(ev.y + 252 < Math.min(...fin.cards.filter((c) => c.id !== ev.id && (fin.rounds![0].ids.includes(c.id) || fin.rounds![1].ids.includes(c.id))).map((c) => c.y)) + 1) // the event above both rings
const cardAt = (t: string) => fin.cards.find((c) => c.text === t)!
const worldIds = new Set(fin.rounds![1].ids)
const headIds = new Set(fin.rounds![0].ids)
for (const t of ['She’d already promised Tom', 'Jonas asked me to study together last term', 'one no is about her plans, not about me', 'Ask Jonas after Thursday’s lecture if he has a group']) assert.ok(cardAt(t).x > fin.rounds![1].cx, t) // the world circle's ways out, to the right
assert.ok(cardAt('she did say sorry, and that she’d ask around who still needs someone').x + 252 < fin.rounds![0].cx) // the head circle's way out, to its left
assert.ok(Math.min(...fin.cards.filter((c) => worldIds.has(c.id)).map((c) => c.x)) > Math.max(...fin.cards.filter((c) => headIds.has(c.id)).map((c) => c.x + 126))) // the head circle's cards left of the world circle's
// the Next step sits diagonally off its pile of ways out (the other ways to see it), one gutter away on the pile's grid
const b4 = fin.cards.find((c) => c.text === 'I’m not worth anyone choosing me')!
assert.equal(cardAt('She’d already promised Tom').x, b4.x + 252 + 64) // the pile starts an arrow gap right of the first card of the world circle
assert.equal(cardAt('She’d already promised Tom').y, b4.y) // level with it
const real = (c: (typeof fin.cards)[number]) => ({ x: c.x, y: c.y, w: estW(c.text, c.kind), h: estH(c.text, c.kind) })
const boxGap = (a: ReturnType<typeof real>, b: typeof a) => Math.hypot(Math.max(0, a.x - b.x - b.w, b.x - a.x - a.w), Math.max(0, a.y - b.y - b.h, b.y - a.y - a.h))
const nx = real(fin.cards.find((c) => c.kind === 'NEXT')!)
const pile = fin.cards.filter((c) => ['She’d already promised Tom', 'Jonas asked me to study together last term', 'one no is about her plans, not about me'].includes(c.text))
assert.equal(pile.length, 3)
assert.ok(Math.min(...pile.map((c) => boxGap(nx, real(c)))) <= 2 * Math.SQRT2 * 64)
// within the pile the cards are a whole number of cells (252 + 64) from each other
assert.ok(pile.every((c) => (c.x - pile[0].x) % 316 === 0 && (c.y - pile[0].y) % 316 === 0))
console.log('demo ok')
// the presenter's panel in the chat: no loop until all its cards have been said; in the order found (the world one first), each in walk order
{
  const all = demoMsgs()
  assert.deepEqual(demoLoops([]), [])
  const found = demoLoops(all)
  assert.equal(found.length, 2)
  assert.deepEqual(found.map((l) => l.head), [false, true])
  assert.deepEqual(found[1].chain.map((c) => c.text), ['I’m so stupid', 'She only makes friends with smart people', 'I just feel worthless', 'They’re all way smarter than me and they know it'])
  assert.deepEqual(found[0].chain.map((c) => c.text), ['I just feel really small today', 'I haven’t asked anyone else since', 'I’m not worth anyone choosing me'])
  // when each one appears: the first message after which its last card exists
  const mine = all.map((_, i) => all.slice(0, i + 1))
  const firstAt = (n: number) => mine.findIndex((m) => demoLoops(m).length >= n)
  const [w, h] = [firstAt(1), firstAt(2)]
  assert.ok(w < h, `${w} < ${h}`) // the world circle closes with turn 4 (“…not worth anyone choosing me anyway”), the head circle later (“…I just feel worthless”)
}
