// node src/map/walk.check.ts
import assert from 'node:assert/strict'
import { escapeOf } from './flow.ts'
import { ask, askOther, candidates, insertNew, orderedLoops, rewire, sameMoment, sayCircle, stages, through, walkPlan, walkShown, walkWhy, wayLoops, waysOf } from './walk.ts'

type C = Parameters<typeof walkPlan>[0][number]
type E = Parameters<typeof walkPlan>[1][number]
const cards: C[] = [
  { id: 'a1', text: 'nobody asked me', kind: 'A' },
  { id: 'b1', text: 'they don’t like me', kind: 'B' },
  { id: 'c1', text: 'pathetic', kind: 'C', names: ['embarrassed'] },
  { id: 'a2', text: 'I haven’t texted anyone', kind: 'A' },
  { id: 'd1', text: 'Amy planned it last minute', kind: 'DE' },
]
const edges: E[] = [
  { id: 'e1', from: 'a1', to: 'b1' },
  { id: 'e2', from: 'b1', to: 'c1' },
  { id: 'e3', from: 'c1', to: 'a2' },
  { id: 'e4', from: 'a2', to: 'b1' },
  { id: 'e5', from: 'b1', to: 'd1' },
]
const p = walkPlan(cards, edges)
assert.deepEqual(p.path, ['a1', 'b1', 'c1', 'a2'])
assert.deepEqual(p.links, ['', 'e1', 'e2', 'e3'])
assert.equal(p.close, 'e4')
assert.deepEqual(p.options.map((o) => [o.edge, o.kind]), [['e4', 'DE'], ['e3', 'NEXT']])
// said, not asked: the buttons do the checking
assert.equal(ask(cards[0], 0), `It started here: “${cards[0].text}”`)
assert.equal(ask(cards[1], 1), 'Then a thought came: “they don’t like me”')
assert.equal(ask(cards[2], 2), 'And it left you feeling embarrassed.')
assert.equal(ask(cards[3], 3), `And then: “${cards[3].text}”`)
assert.equal(askOther('DE', cards[1]), 'The other way you found: “they don’t like me”')
assert.equal(askOther('NEXT', cards[1]), 'And one small step: “they don’t like me”')
// no circle: the chain from the first A
assert.deepEqual(walkPlan(cards, edges.slice(0, 3)).path, ['a1', 'b1', 'c1', 'a2'])
assert.equal(walkPlan(cards, edges.slice(0, 3)).close, undefined)
// the hint ladder: level 1 lights the guess and where it started, never the card they are on
assert.deepEqual(candidates(p, edges), ['b1'])
assert.equal(stages(p).pick, stages(p).close + 1)
// they tap where it started instead of the guess: their line replaces the guess, the circle is theirs
const own = rewire(edges, p, 'a1', 'mine')
const p2 = walkPlan(cards, own)
assert.deepEqual(p2.path, ['a1', 'b1', 'c1', 'a2'])
assert.equal(p2.close, 'mine')
assert.ok(!own.some((e) => e.id === 'e4'))
// they tap the feeling: a smaller circle, and the cards before it stay on the map as the way in
const small = walkPlan(cards, rewire(edges, p, 'c1', 'mine'))
assert.deepEqual(small.path, ['a1', 'b1', 'c1', 'a2'])
assert.deepEqual(small.links, ['', 'e1', 'e2', 'e3'])
assert.equal(small.close, 'mine')
assert.deepEqual(small.options.map((o) => [o.edge, o.kind]), [['e3', 'NEXT']])
// somewhere new: the new thought goes in after the last card, and the guess now starts from it
const cards3 = [...cards, { id: 'b2', text: 'if they cared they would text me', kind: 'B' as const }]
const more = insertNew(edges, p, 'b2', ['n1', 'n2'])
const p3 = walkPlan(cards3, more)
assert.deepEqual(p3.path, ['a1', 'b1', 'c1', 'a2', 'b2'])
assert.equal(p3.close, 'n2')
assert.equal(more.find((e) => e.id === 'n2')!.by, 'ai')
assert.equal(more.find((e) => e.id === 'n1')!.by, undefined)
assert.deepEqual(candidates(p3, more), ['b1'])
assert.deepEqual(p3.options.map((o) => [o.edge, o.kind]), [['n1', 'DE'], ['n2', 'DE'], ['e3', 'NEXT']])
// they tap where it all started: the dinner is on the circle, but there is nothing to "do differently" about an event that happened to them
assert.deepEqual(p2.options.map((o) => [o.edge, o.kind]), [['e1', 'DE'], ['e3', 'NEXT']])
// the sentence about the circle starts on the circle (the dinner led into it, it is not where the circle "came back" to)
assert.equal(sayCircle(cards[1]), 'From “they don’t like me” it went round, and came back to where it started.')
// the circle through a card they added beside the thought: both lines are theirs (no line is added for them)
const cards4 = [...cards, { id: 's1', text: 'I’m the extra one', kind: 'B' as const }]
const edges4 = [...edges, { id: 'e9', from: 'a1', to: 's1' }]
const via = through(edges4, walkPlan(cards4, edges4), 's1', 'c1', ['v1', 'v2'])
assert.ok(!via.some((e) => e.id === 'e4'))
assert.deepEqual(via.slice(-2), [{ id: 'v1', from: 'a2', to: 's1' }, { id: 'v2', from: 's1', to: 'c1' }])
const p4 = walkPlan(cards4, via)
assert.deepEqual(p4.path, ['a1', 's1', 'c1', 'a2'])
assert.equal(p4.close, 'v1')
assert.deepEqual(walkPlan(cards4, through(edges4, walkPlan(cards4, edges4), 's1', 'b1', ['v1', 'v2'])).path, ['a1', 'b1', 'c1', 'a2', 's1']) // or back through the thought itself
// where the road leaves after each option of the plan: another way → at the thought, DE cards then the step; do something different → at what they did, the step then DE cards
const cutOf = (edge: string) => edges.map((e) => ({ ...e, cut: e.id === edge || undefined }))
const ways = p.options.map((o) => ({ kind: o.kind, esc: escapeOf(cards, cutOf(o.edge), o.kind) }))
assert.deepEqual(ways.map((w) => [w.kind, w.esc?.at, w.esc?.chain]), [['DE', 'b1', ['d1']], ['NEXT', 'a2', ['d1']]])

// two circles from the same event (a1): one only in the head (b2 → c2 → b3 → b2), one in the world (b1 → c1 → a2 → b1). The head circle is walked first,
// the world circle (with the Next step) last
const two: C[] = [...cards, { id: 'b2', text: 'I’m so stupid', kind: 'B' }, { id: 'c2', text: 'can’t breathe', kind: 'C' }, { id: 'b3', text: 'she only likes smart people', kind: 'B' }, { id: 'd2', text: 'she said sorry', kind: 'DE' }, { id: 'n1', text: 'ask Jonas', kind: 'NEXT' }]
const twoEdges: E[] = [...edges, { id: 'f1', from: 'a1', to: 'b2' }, { id: 'f2', from: 'b2', to: 'c2' }, { id: 'f3', from: 'c2', to: 'b3' }, { id: 'f4', from: 'b3', to: 'b2' }, { id: 'f5', from: 'b3', to: 'd2' }, { id: 'f6', from: 'a2', to: 'n1' }]
assert.equal(orderedLoops(two, twoEdges).length, 2)
assert.ok(orderedLoops(two, twoEdges)[0].includes('f4') && orderedLoops(two, twoEdges)[1].includes('e4')) // no event on the ring: first; an event on it: last
const flipped = [...twoEdges.filter((e) => ['e1', 'e2', 'e3', 'e4', 'e5', 'f6'].includes(e.id)), ...twoEdges.filter((e) => !['e1', 'e2', 'e3', 'e4', 'e5', 'f6'].includes(e.id))]
assert.deepEqual(orderedLoops(two, flipped).map((g) => g.length), orderedLoops(two, twoEdges).map((g) => g.length)) // whatever order loops() gives
// round 0 is the head circle: its lead is the event, it opens with "It started here"; round 1 has no lead, starts at the card the way in arrives at, links[0] is that way in
const t0 = walkPlan(two, twoEdges)
assert.deepEqual(t0, walkPlan(two, twoEdges, 0))
assert.deepEqual(t0.path, ['a1', 'b2', 'c2', 'b3'])
assert.deepEqual(t0.links, ['', 'f1', 'f2', 'f3'])
assert.equal(t0.close, 'f4')
assert.deepEqual(t0.options.map((o) => [o.edge, o.kind]), [['f3', 'DE'], ['f4', 'DE']]) // nothing happens on it: only a thought can be seen another way
const t1 = walkPlan(two, twoEdges, 1)
assert.deepEqual(t1.path, ['b1', 'c1', 'a2'])
assert.deepEqual(t1.links, ['e1', 'e2', 'e3'])
assert.equal(t1.close, 'e4')
assert.deepEqual(t1.options.map((o) => [o.edge, o.kind]), [['e4', 'DE'], ['e3', 'NEXT']])
assert.deepEqual(walkPlan(two, twoEdges, 2), { path: [], links: [], options: [] })
assert.equal(ask(two[0], 0, 0), 'It started here: “nobody asked me”')
assert.equal(ask(two[1], 0, 1, true), 'From the same moment, another thought came: “they don’t like me”')
assert.equal(ask(two[5], 0, 1), 'And another thought came after it: “I’m so stupid”')
assert.equal(ask(two[6], 1, 1), 'And it left you feeling: “can’t breathe”')
assert.match(walkWhy(t1, 0, two, 0, 1)!.what, /^The same event, a second circle: this one plays out in the world/)
assert.match(walkWhy({ path: ['b2', 'c2', 'b3'], links: [], options: [] }, 0, two, 0, 1)!.what, /nothing happens in the world/) // a later circle that stays in the head
assert.match(walkWhy(t0, 0, two, 0, 0)!.what, /^The map starts/)
// the world circle comes from the same moment: its way in leaves the first card of the first circle (the event)
assert.equal(sameMoment(two, twoEdges, 1), true)
assert.equal(sameMoment(two, twoEdges, 0), false)
assert.equal(sameMoment(two, twoEdges.map((e) => (e.id === 'e1' ? { ...e, from: 'c2', to: 'b1' } : e)), 1), false)
// ways out belong to the circle of the card their line comes from
assert.deepEqual([...wayLoops(two, twoEdges)], [['d1', 1], ['d2', 0], ['n1', 1]])
assert.deepEqual(waysOf(two, twoEdges, 0), ['d2'])
assert.deepEqual(waysOf(two, twoEdges, 1), ['d1', 'n1'])
// a way out whose parent is on no circle belongs to the first
assert.equal(wayLoops([...two, { id: 'd9', text: 'x', kind: 'DE' }], [...twoEdges, { id: 'f9', from: 'a1', to: 'd9' }]).get('d9'), 0)
// each circle has its own cut and its own road
const cutTwo = twoEdges.map((e) => ({ ...e, cut: e.id === 'e4' || e.id === 'f3' || undefined, pick: e.id === 'e4' ? ('DE' as const) : e.id === 'f3' ? ('DE' as const) : undefined }))
assert.deepEqual(escapeOf(two, cutTwo, undefined, 0), { at: 'b3', chain: ['d2'], first: 'DE' })
assert.deepEqual(escapeOf(two, cutTwo, undefined, 1), { at: 'b1', chain: ['d1', 'n1'], first: 'DE' })
assert.equal(escapeOf(two, twoEdges, undefined, 1), null) // no cut on it yet
assert.equal(escapeOf(two, cutTwo.map((e) => ({ ...e, cut: e.id === 'e4' || undefined })), undefined, 0), null)
// the walk shows the head circle while it is walked, and keeps it (with its ways out) once the world circle starts
const at = (w: Parameters<typeof walkShown>[2]) => [...walkShown(two, cutTwo, w)].sort()
assert.deepEqual(at({ step: 1 }), ['a1', 'b2'])
assert.deepEqual(at({ step: stages(t0).placed, pick: 'DE' }), ['a1', 'b2', 'b3', 'c2', 'd2']) // the chosen kind of this circle's ways out only
assert.deepEqual(at({ step: stages(t0).done, pick: 'DE' }), ['a1', 'b2', 'b3', 'c2', 'd2']) // no Next step on this circle: nothing more to show
assert.deepEqual(at({ loop: 1, step: 0 }), ['a1', 'b1', 'b2', 'b3', 'c2', 'd2'])
assert.deepEqual(at({ loop: 1, step: stages(t1).done, pick: 'DE' }), ['a1', 'a2', 'b1', 'b2', 'b3', 'c1', 'c2', 'd1', 'd2', 'n1'])
// one glowing card when a circle is closed: the program's guess
assert.deepEqual(candidates(t1, twoEdges), ['b1'])
// older maps: one circle, no cut kind stored: everything as before
assert.deepEqual([...walkShown(cards, edges, { step: 0 })], ['a1'])
console.log('walk ok')
