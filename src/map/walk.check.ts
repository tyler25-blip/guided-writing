// node src/map/walk.check.ts
import assert from 'node:assert/strict'
import { ask, candidates, insertNew, rewire, stages, walkPlan } from './walk.ts'

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
console.log('walk ok')
