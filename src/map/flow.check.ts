// node src/map/flow.check.ts
import assert from 'node:assert/strict'
import { escapeOf, flow, GX, GY, LG, quietEdges, type Peer } from './flow.ts'
import { CARD_W, type Kind } from './place.ts'

type C = { id: string; text: string; kind?: Kind }
type E = { id: string; from: string; to: string; by?: 'ai'; cut?: boolean }
const cards: C[] = [
  { id: 'c1', text: 'pathetic', kind: 'C' },
  { id: 'a1', text: 'nobody asked me', kind: 'A' },
  { id: 'b1', text: 'they don’t like me', kind: 'B' },
  { id: 'a2', text: 'I haven’t texted anyone', kind: 'A' },
  { id: 'd1', text: 'Amy planned it last minute', kind: 'DE' },
  { id: 'd2', text: 'I set up dinner last month', kind: 'DE' },
  { id: 'd3', text: 'one dinner doesn’t mean that', kind: 'DE' },
  { id: 'n1', text: 'Text Mia', kind: 'NEXT' },
]
const guess: E[] = [
  { id: 'e1', from: 'a1', to: 'b1', by: 'ai' },
  { id: 'e2', from: 'b1', to: 'c1', by: 'ai' },
  { id: 'e3', from: 'c1', to: 'a2', by: 'ai' },
  { id: 'e4', from: 'a2', to: 'b1', by: 'ai' },
  { id: 'e5', from: 'b1', to: 'd1', by: 'ai' },
  { id: 'e6', from: 'b1', to: 'd2', by: 'ai' },
  { id: 'e7', from: 'b1', to: 'd3', by: 'ai' },
  { id: 'e8', from: 'a2', to: 'n1', by: 'ai' },
]
const h = () => 80
const overlap = (f: ReturnType<typeof flow>, skip: string[] = []) => {
  const ids = Object.keys(f.pos).filter((id) => !skip.includes(id))
  return ids.some((a, i) => ids.slice(i + 1).some((b) => Math.abs(f.pos[a].x - f.pos[b].x) < CARD_W && Math.abs(f.pos[a].y - f.pos[b].y) < 80))
}

// before the circle is closed: one column, top to bottom, in the order of cause and effect
const col = flow(cards, guess, [], h)
assert.deepEqual(col.ring, [])
assert.deepEqual(['a1', 'b1', 'c1', 'a2'].map((id) => col.pos[id]), [0, 1, 2, 3].map((i) => ({ x: 0, y: i * (80 + LG) }))) // an arrow apart
// the ways out sit beside the card they answer, on its level (an arrow apart), side by side with each other: the other ways beside the thought, the step beside what they did
assert.deepEqual(['d1', 'd2', 'd3'].map((id) => col.pos[id]), [0, 1, 2].map((i) => ({ x: CARD_W + LG + i * (CARD_W + GX), y: col.pos.b1.y })))
assert.deepEqual(col.pos.n1, { x: CARD_W + LG, y: col.pos.a2.y })
assert.ok(!overlap(col))
// one arrow to the first "another way", dotted-end lines between the rest
assert.deepEqual(col.peers, [{ a: 'd1', b: 'd2' }, { a: 'd2', b: 'd3' }])
assert.deepEqual([...quietEdges(guess, col.peers)].sort(), ['e6', 'e7'])
assert.ok(col.routes.e5 && !col.routes.e6 && !col.routes.e7)
assert.deepEqual(col.arcs, {})
// the path's lines are straight down
assert.ok(['e1', 'e2', 'e3'].every((id) => col.routes[id].every(([x]) => x === col.routes[id][0][0])))

// once the person closed the circle: the cards on it lie on a ring, clockwise from the top; what led in stays above
const kept = guess.map((e) => ({ ...e, by: undefined }))
const ring = flow(cards, kept, [], h)
assert.deepEqual(ring.ring, ['b1', 'c1', 'a2'])
assert.deepEqual(ring.pos.a1, { x: 0, y: 0 })
assert.equal(ring.pos.b1.x, 0)
assert.equal(ring.pos.b1.y, 80 + LG)
assert.ok(ring.pos.c1.x > ring.pos.b1.x && ring.pos.c1.y > ring.pos.b1.y) // right and down
assert.ok(ring.pos.a2.x < ring.pos.b1.x && Math.abs(ring.pos.a2.y - ring.pos.c1.y) < 1) // left, level with it
assert.deepEqual(Object.keys(ring.arcs).sort(), ['e2', 'e3', 'e4'])
assert.ok(Object.values(ring.arcs).every(([, , r, a0, a1]) => r >= 180 && a1 > a0))
assert.ok(!ring.routes.e2 && ring.routes.e1)
// the other ways hang outward from the thought, the step outward from what they did
assert.ok(['d1', 'd2', 'd3'].every((id) => ring.pos[id].x > ring.pos.b1.x && ring.pos[id].y === ring.pos.b1.y))
assert.ok(ring.pos.n1.x < ring.pos.a2.x && ring.pos.n1.y === ring.pos.a2.y)
assert.ok(!overlap(ring))
assert.deepEqual(ring.routes.e5, [[CARD_W, ring.pos.b1.y + 40], [CARD_W + LG, ring.pos.b1.y + 40]]) // side by side: one straight line
assert.deepEqual(ring.peers, [{ a: 'd1', b: 'd2' }, { a: 'd2', b: 'd3' }])

// a card the person added beside another: same level, on the side they chose, sharing its arrow
const own: Peer[] = [{ a: 'b1', b: 'b2', own: true, side: 'r' }]
const cards2 = [...cards, { id: 'b2', text: 'I’m just the extra one', kind: 'B' as const }]
const edges2 = [...guess, { id: 'e9', from: 'a1', to: 'b2' }]
const two = flow(cards2, edges2, own, h)
assert.deepEqual(two.pos.b2, { x: CARD_W + GX, y: two.pos.b1.y })
assert.deepEqual(two.peers[0], own[0])
assert.ok(quietEdges(edges2, two.peers).has('e9'))
assert.deepEqual(two.pos.c1, col.pos.c1) // the path does not move
assert.ok(['d1', 'd2', 'd3'].every((id) => two.pos[id].x < 0 && two.pos[id].y === two.pos.b1.y)) // the other ways stay with their own thought: on its free side, not under the added card
assert.ok(!overlap(two))
const left = flow(cards2, edges2, [{ ...own[0], side: 'l' }], h)
assert.deepEqual(left.pos.b2, { x: -(CARD_W + GX), y: left.pos.b1.y })
// and it stays beside its card when the ring forms
const two2 = flow(cards2, edges2.map((e) => ({ ...e, by: undefined })), own, h)
assert.equal(two2.pos.b2.y, two2.pos.b1.y)
assert.equal(two2.pos.b2.x, two2.pos.b1.x + CARD_W + GX) // right next to it, not pushed out by the other ways
assert.ok(['d1', 'd2', 'd3'].every((id) => two2.pos[id].x < two2.pos.b1.x && two2.pos[id].y === two2.pos.b1.y)) // those take the free side
assert.deepEqual(two2.peers.filter((p) => !p.own), [{ a: 'd1', b: 'd2' }, { a: 'd2', b: 'd3' }])
assert.ok(!overlap(two2))

// no lines at all: nothing breaks, nothing overlaps
const none = flow(cards, [], [], h)
assert.equal(Object.keys(none.pos).length, cards.length)
assert.ok(!overlap(none))
// the circle closes at the card they added (not texting → "I'm just the extra one" → the feeling → …): that card is on the ring,
// and the thought it was added beside stays next to it, joined by the dotted-end line
const viaSide = [...edges2.filter((e) => e.id !== 'e4'), { id: 'e10', from: 'b2', to: 'c1' }, { id: 'e11', from: 'a2', to: 'b2' }].map((e) => ({ ...e, by: undefined }))
const side = flow(cards2, viaSide, own, h)
assert.deepEqual(side.ring, ['b2', 'c1', 'a2'])
assert.equal(side.pos.b1.y, side.pos.b2.y)
assert.equal(side.pos.b1.x, side.pos.b2.x - CARD_W - GX) // it was added on the right of b1, so b1 is on its left
assert.deepEqual(side.peers[0], { a: 'b2', b: 'b1', own: true, side: 'l' })
assert.ok(quietEdges(viaSide, side.peers).has('e1') && !quietEdges(viaSide, side.peers).has('e9')) // the arrow goes to the card on the ring
assert.ok(quietEdges(viaSide, side.peers).has('e2') && !quietEdges(viaSide, side.peers).has('e10')) // both lead to the feeling: one arrow, from the card on the ring
assert.ok(!side.routes.e2)
assert.ok(!overlap(side))

// the ring is a circle: every ring card sits on it, centre = the circle's centre
assert.deepEqual(ring.round?.ids, ring.ring)
assert.ok(ring.round && ring.ring.every((id) => Math.abs(Math.hypot(ring.pos[id].x + CARD_W / 2 - ring.round!.cx, ring.pos[id].y + 40 - ring.round!.cy) - ring.round!.r) < 1.5))

// after the cut: the ways out lie in two heaps. The chosen kind sits right next to the card the circle is left from (its first card level with it),
// parallel cards as one heap on a two-wide grid (top left, under it, beside that); the other kind sits off that heap's bottom-right corner
const cutAt = (id: string) => kept.map((e) => ({ ...e, cut: e.id === id || undefined }))
const next = (f: ReturnType<typeof flow>, a: string, w = CARD_W, g = GX) => f.pos[a].x + w + g
// off a card's bottom-right corner by a 64px gap between the shapes you see (Another way's corner starts 26px in, Next step's 113px in)
const off = (f: ReturnType<typeof flow>, a: string, w: number, ia: number, ib: number) => ({ x: f.pos[a].x + w + (LG - ia - ib) / Math.SQRT2, y: f.pos[a].y + 80 + (LG - ia - ib) / Math.SQRT2 })
// "see it another way": cut at the line into the thought, the road leaves at the thought, another ways, then the next step
const de = flow(cards, cutAt('e4'), [], h, 'DE')
assert.deepEqual(de.escape, { at: 'b1', chain: ['d1', 'd2', 'd3', 'n1'], first: 'DE' })
assert.deepEqual(de.pos.d1, { x: next(de, 'b1', CARD_W, LG), y: de.pos.b1.y }) // beside the thought, an arrow apart, level with it
assert.deepEqual(de.pos.d2, { x: de.pos.d1.x, y: de.pos.d1.y + 80 + GY }) // under the first
assert.deepEqual(de.pos.d3, { x: next(de, 'd2'), y: de.pos.d2.y }) // beside that
assert.deepEqual(de.pos.n1, off(de, 'd3', CARD_W, 26, 113)) // the next step off the heap's bottom-right corner
assert.ok(['b1', 'c1', 'a2'].every((id) => de.pos[id].x === ring.pos[id].x && de.pos[id].y === ring.pos[id].y)) // the ring does not move
assert.ok(!de.routes.e5 && !de.routes.e8 && de.routes.e1) // the fan of lines to the ways out is gone
assert.ok(!overlap(de, ['n1'])) // the next step's empty corner tucks in by the heap's
// "do something different": cut at the line into what they did, the road leaves at that card, the next step, then the other ways as a heap
const act = flow(cards, cutAt('e3'), [], h, 'NEXT')
assert.deepEqual(act.escape, { at: 'a2', chain: ['n1', 'd1', 'd2', 'd3'], first: 'NEXT' })
assert.equal(act.pos.n1.y, act.pos.a2.y)
assert.deepEqual(act.pos.d1, off(act, 'n1', 2 * CARD_W, 113, 26)) // off the next step's bottom-right corner (it is two cells wide)
assert.deepEqual(act.pos.d2, { x: act.pos.d1.x, y: act.pos.d1.y + 80 + GY })
assert.deepEqual(act.pos.d3, { x: next(act, 'd2'), y: act.pos.d2.y })
assert.ok(!overlap(act, ['n1']))
// older maps have no pick: it is read from the cut line
assert.deepEqual(escapeOf(cards, cutAt('e4')), de.escape)
assert.deepEqual(escapeOf(cards, cutAt('e3')), act.escape)
assert.equal(escapeOf(cards, kept), null) // nothing cut: no escape
console.log('flow ok')
