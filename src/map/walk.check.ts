// node src/map/walk.check.ts
import assert from 'node:assert/strict'
import { ask, walkPlan } from './walk.ts'

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
console.log('walk ok')
