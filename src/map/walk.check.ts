// node src/map/walk.check.ts
import assert from 'node:assert/strict'
import { ask, candidates, insertNew, rewire, sayCircle, stages, through, walkPlan } from './walk.ts'

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
assert.equal(ask(cards[2], 2), 'And that left you feeling embarrassed, right?')
assert.equal(ask(cards[1], 1), 'So you told yourself “they don’t like me”, right?')
// no circle: the chain from the first A
assert.deepEqual(walkPlan(cards, edges.slice(0, 3)).path, ['a1', 'b1', 'c1', 'a2'])
assert.equal(walkPlan(cards, edges.slice(0, 3)).close, undefined)
// the hint ladder: level 1 lights the guess and where it started, never the card they are on
assert.deepEqual(candidates(p, edges), ['b1', 'a1'])
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
assert.deepEqual(candidates(p3, more), ['b1', 'a1'])
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
console.log('walk ok')
