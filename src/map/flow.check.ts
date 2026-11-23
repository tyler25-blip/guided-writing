// node src/map/flow.check.ts
import assert from 'node:assert/strict'
import { escapeOf, flow, GX, LG, PITCH, quietEdges, type Peer } from './flow.ts'
import { CARD_W, estW, type Kind } from './place.ts'

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
// "see it another way": cut at the line into the thought, the road leaves at the thought, another ways, then the next step
const de = flow(cards, cutAt('e4'), [], h, 'DE')
assert.deepEqual(de.escape, { at: 'b1', chain: ['d1', 'd2', 'd3', 'n1'], first: 'DE' })
assert.deepEqual(de.pos.d1, { x: de.pos.b1.x + CARD_W + LG, y: de.pos.b1.y }) // beside the thought, an arrow apart, level with it
// the cells under it are the ring's (its band and its lower-right card), so the heap hangs upward from the first card, one cell (a card and a gutter) apart
assert.deepEqual(de.pos.d2, { x: de.pos.d1.x, y: de.pos.d1.y - PITCH })
assert.deepEqual(de.pos.d3, { x: de.pos.d2.x + PITCH, y: de.pos.d2.y }) // beside that
assert.deepEqual(de.pos.n1, { x: de.pos.d1.x + 2 * PITCH, y: de.pos.d1.y - 2 * PITCH }) // the next step diagonally off the heap's far corner, one gutter away, on the same grid
assert.ok(['b1', 'c1', 'a2'].every((id) => de.pos[id].x === ring.pos[id].x && de.pos[id].y === ring.pos[id].y)) // the ring does not move
assert.ok(!de.routes.e5 && !de.routes.e8 && de.routes.e1) // the fan of lines to the ways out is gone
assert.ok(!overlap(de, ['n1'])) // the next step's empty corner tucks in by the heap's
// "do something different": cut at the line into what they did, the road leaves at that card, the next step, then the other ways as a heap
const act = flow(cards, cutAt('e3'), [], h, 'NEXT')
assert.deepEqual(act.escape, { at: 'a2', chain: ['n1', 'd1', 'd2', 'd3'], first: 'NEXT' })
assert.equal(act.pos.n1.y, act.pos.a2.y)
assert.deepEqual(act.pos.d1, { x: act.pos.n1.x + 2 * PITCH, y: act.pos.n1.y + PITCH }) // diagonally off the next step's far corner (two cells wide, one tall here: every card is 80 high in this test)
assert.deepEqual(act.pos.d2, { x: act.pos.d1.x, y: act.pos.d1.y + PITCH })
assert.deepEqual(act.pos.d3, { x: act.pos.d2.x + PITCH, y: act.pos.d2.y })
assert.ok(!overlap(act, ['n1']))
// older maps have no pick: it is read from the cut line
assert.deepEqual(escapeOf(cards, cutAt('e4')), de.escape)
assert.deepEqual(escapeOf(cards, cutAt('e3')), act.escape)
assert.equal(escapeOf(cards, kept), null) // nothing cut: no escape

// two circles from the same event a1: one only in the head (b2 → x2 → b3 → b2, walked first, stands on the LEFT), one in the world (b1 → c1 → a2 → b1, walked last,
// stands on the RIGHT with its ways out and the Next step); the event sits on top between the rings, their top cards level
const duo: C[] = [...cards, { id: 'b2', text: 'I’m so stupid', kind: 'B' }, { id: 'x2', text: 'I can’t breathe', kind: 'C' }, { id: 'b3', text: 'she only likes smart people', kind: 'B' }, { id: 'dh', text: 'she said sorry', kind: 'DE' }]
const duoLines: E[] = [...kept, { id: 'f1', from: 'a1', to: 'b2' }, { id: 'f2', from: 'b2', to: 'x2' }, { id: 'f3', from: 'x2', to: 'b3' }, { id: 'f4', from: 'b3', to: 'b2' }, { id: 'f5', from: 'b3', to: 'dh' }]
const boxes = (f: ReturnType<typeof flow>, skip: string[] = []) => Object.keys(f.pos).filter((id) => !skip.includes(id)).map((id) => ({ id, x: f.pos[id].x, y: f.pos[id].y, w: estW(duo.find((c) => c.id === id)!.text, duo.find((c) => c.id === id)!.kind), h: 80 }))
const clash = (f: ReturnType<typeof flow>, skip: string[] = []) => boxes(f, skip).some((a, i, all) => all.slice(i + 1).some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h))
const cut2 = duoLines.map((e) => ({ ...e, cut: e.id === 'e4' || e.id === 'f3' || undefined, pick: e.id === 'e4' || e.id === 'f3' ? ('DE' as const) : undefined }))
const sbsLines = cut2
// both circles closed
const pair = flow(duo, duoLines, [], h)
assert.deepEqual(pair.rings, [['b2', 'x2', 'b3'], ['b1', 'c1', 'a2']])
assert.equal(pair.rounds.length, 2)
assert.equal(pair.round, pair.rounds[0])
assert.equal(pair.rounds[1].cy, pair.rounds[0].cy)
// the world circle (on the right) starts at the top with b1 (where the event's line arrives) and runs anticlockwise: c1 down-left, a2 down-right;
// the head circle (on the left) keeps its top card on top, clockwise
const ang = (f: ReturnType<typeof flow>, r: { cx: number; cy: number }, id: string) => (Math.atan2(f.pos[id].y + 40 - r.cy, f.pos[id].x + CARD_W / 2 - r.cx) * 180) / Math.PI
assert.ok(Math.abs(ang(pair, pair.rounds[1], 'b1') + 90) <= 1 && pair.rounds[1].ccw)
assert.ok(Math.abs(ang(pair, pair.rounds[1], 'c1') - 150) <= 1 && Math.abs(ang(pair, pair.rounds[1], 'a2') - 30) <= 1)
assert.ok(Math.abs(ang(pair, pair.rounds[0], 'b2') + 90) <= 1 && !pair.rounds[0].ccw)
assert.ok(pair.rounds[0].cx < pair.rounds[1].cx && pair.pos.a1.y + 80 < pair.pos.b2.y && pair.pos.a1.y + 80 < pair.pos.b1.y) // the event above both rings
assert.deepEqual(Object.keys(pair.arcs).sort(), ['e2', 'e3', 'e4', 'f2', 'f3', 'f4'])
assert.ok(pair.routes.f1 && pair.routes.e1 && !pair.routes.f2)
assert.ok(!clash(pair, ['n1']))
// both cut: each circle's ways out go outward, beside its own exit card, nothing overlaps
const sbs = flow(duo, sbsLines, [], h)
const [r0, r1] = sbs.rounds
assert.equal(sbs.escapes.length, 2)
assert.deepEqual(sbs.escapes[0], { at: 'b3', chain: ['dh'], first: 'DE' }) // the head circle
assert.deepEqual(sbs.escapes[1], { at: 'b1', chain: ['d1', 'd2', 'd3', 'n1'], first: 'DE' }) // the world circle
assert.deepEqual(sbs.escape, sbs.escapes[0])
assert.ok(sbs.pos.dh.x + CARD_W <= sbs.pos.b3.x - LG + 1 && sbs.pos.dh.x + CARD_W < r0.cx) // the head circle's way out, to the left of its ring
assert.ok(['d1', 'd2', 'd3', 'n1'].every((id) => sbs.pos[id].x > r1.cx)) // the world circle's ways out and the Next step, to the right of its ring
assert.deepEqual(sbs.pos.d1, { x: sbs.pos.b1.x + CARD_W + LG, y: sbs.pos.b1.y }) // the pile starts an arrow gap right of b1, level with it
assert.ok(!sbs.routes.f5 && !sbs.routes.e5)
assert.ok(!clash(sbs, ['n1']))
// the world circle open (its closing line a guess): the head circle stays where it is, the world path stands in a column on the right
const open2 = flow(duo, duoLines.map((e) => (e.id === 'e4' ? { ...e, by: 'ai' as const } : e)), [], h)
assert.deepEqual(open2.rings, [['b2', 'x2', 'b3']])
assert.deepEqual(open2.pos.b2, pair.pos.b2)
assert.ok(open2.pos.b1.y + 40 < open2.rounds[0].cy) // where b1 will be: the top of the world ring
assert.ok(open2.pos.b1.x > open2.rounds[0].cx)
assert.ok(!clash(open2, ['n1']))
// each cut line keeps its own pick: the world circle cut at what they did, the head circle at the line that closes it
const mixed = flow(duo, duoLines.map((e) => ({ ...e, cut: e.id === 'e3' || e.id === 'f4' || undefined, pick: e.id === 'e3' ? ('NEXT' as const) : e.id === 'f4' ? ('DE' as const) : undefined })), [], h)
assert.deepEqual(mixed.escapes.map((e) => [e.at, e.first]), [['b2', 'DE'], ['a2', 'NEXT']])
assert.ok(!clash(mixed, ['n1', 'd1']))
// a ring whose road would leave on its inner half is mirrored: the head circle cut at the line into x2 (its right-hand card) leaves on the left
const flipped = flow(duo, duoLines.map((e) => ({ ...e, cut: e.id === 'f2' || undefined, pick: e.id === 'f2' ? ('DE' as const) : undefined })), [], h)
assert.equal(flipped.escapes[0].at, 'x2')
assert.ok(flipped.rounds[0].ccw && flipped.pos.x2.x < flipped.rounds[0].cx)
// older maps: one circle, the pick given on its own, nothing else stored
assert.equal(flow(cards, cutAt('e4'), [], h, 'DE').escapes.length, 1)
assert.deepEqual(escapeOf(cards, cutAt('e4'), 'NEXT')?.first, 'NEXT')

// ---- real card sizes (252 high): the rings are true circles, their ways out stay clear of them ----
const fSbs = flow(duo, sbsLines, [], undefined)
const fOne = [flow(cards, cutAt('e4'), [], undefined), flow(cards, cutAt('e3'), [], undefined), flow(cards, cutAt('e4'), [], undefined, 'DE')]
const fPair = flow(duo, cut2, [], undefined)
const reals = (f: ReturnType<typeof flow>) => Object.keys(f.pos).map((id) => ({ id, x: f.pos[id].x, y: f.pos[id].y, w: estW(duo.find((c) => c.id === id)!.text, duo.find((c) => c.id === id)!.kind), h: CARD_W }))
for (const f of [fSbs, fPair, ...fOne]) {
  const bs = reals(f)
  assert.ok(!bs.some((a, i) => bs.slice(i + 1).some((b) => a.id !== 'n1' && b.id !== 'n1' && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)), 'no overlap')
  const onRingIds = new Set(f.rings.flat())
  for (const rd of f.rounds) {
    // every ring card sits exactly on its circle
    assert.ok(rd.ids.every((id) => Math.abs(Math.hypot(f.pos[id].x + estW(duo.find((c) => c.id === id)!.text, duo.find((c) => c.id === id)!.kind) / 2 - rd.cx, f.pos[id].y + CARD_W / 2 - rd.cy) - rd.r) <= 1), 'ring cards on their circle')
  }
  // no arc crosses a card that is not on a ring
  for (const [cx, cy, r, a0, a1] of Object.values(f.arcs))
    for (let t = a0; t <= a1; t += 0.02) {
      const [px, py] = [cx + r * Math.cos(t), cy + r * Math.sin(t)]
      assert.ok(!bs.some((q) => !onRingIds.has(q.id) && px > q.x && px < q.x + q.w && py > q.y && py < q.y + q.h), 'no arc through a way-out card')
    }
}
// the ways out lie on a grid of their own: within a pile, a card is a whole number of cells (a card and a gutter) from the pile's first card
assert.ok(['d2', 'd3'].every((id) => (fSbs.pos[id].x - fSbs.pos.d1.x) % PITCH === 0 && (fSbs.pos[id].y - fSbs.pos.d1.y) % PITCH === 0))
console.log('flow ok')
