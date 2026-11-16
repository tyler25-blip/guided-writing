// node src/map/road.check.ts
import assert from 'node:assert/strict'
import { flow } from './flow.ts'
import { CARD_W, type Kind } from './place.ts'
import { arcGeo, buildRoad, routeGeo, snapToRing, type RoadEdge } from './road.ts'
import { walkPlan } from './walk.ts'

type C = { id: string; text: string; kind?: Kind }
const cards: C[] = [
  { id: 'c1', text: 'pathetic', kind: 'C' },
  { id: 'a1', text: 'nobody asked me', kind: 'A' },
  { id: 'b1', text: 'they don’t like me', kind: 'B' },
  { id: 'a2', text: 'I haven’t texted anyone', kind: 'A' },
  { id: 'd1', text: 'Amy', kind: 'DE' },
  { id: 'd2', text: 'dinner', kind: 'DE' },
  { id: 'n1', text: 'Text Mia', kind: 'NEXT' },
]
const lines = [['e1', 'a1', 'b1'], ['e2', 'b1', 'c1'], ['e3', 'c1', 'a2'], ['e4', 'a2', 'b1'], ['e5', 'b1', 'd1'], ['e6', 'b1', 'd2'], ['e7', 'a2', 'n1']]
const h = () => 80

// the road for a map whose circle was cut at `cut` (what they chose: pick)
function road(cut: string, pick: 'DE' | 'NEXT', pos?: Record<string, { x: number; y: number }>) {
  const edges = lines.map(([id, from, to]) => ({ id, from, to, cut: id === cut || undefined }))
  const f = flow(cards, edges, [], h, pick)
  const at = pos ?? f.pos
  const boxes = Object.fromEntries(cards.map((c) => [c.id, { x: at[c.id].x, y: at[c.id].y, w: CARD_W, h: 80 }]))
  const re: RoadEdge[] = edges.flatMap((e) => (f.arcs[e.id] ? [{ ...e, geo: arcGeo(f.round!, boxes[e.from], boxes[e.to]) }] : f.routes[e.id] ? [{ ...e, geo: routeGeo(f.routes[e.id]) }] : []))
  return { f, boxes, ...buildRoad({ edges: re, plan: walkPlan(cards, edges), esc: f.escape ?? null, boxes, story: true, exitUncut: false }) }
}

for (const [cut, pick, column] of [['e4', 'DE', ['d1', 'd2', 'n1']], ['e3', 'NEXT', ['n1', 'd1', 'd2']]] as const) {
  const r = road(cut, pick)
  const keys = r.segs.map((s) => s.key)
  assert.ok(keys.includes('in') && keys.includes('out')) // in from outside, out again
  assert.deepEqual(keys.filter((k) => k.startsWith('esc')), ['esc0', 'esc1', 'esc2']) // one chain through the column
  assert.ok(!keys.includes('e5') && !keys.includes('e6') && !keys.includes('e7')) // no fan of lines
  assert.equal(r.segs.find((s) => s.key === cut)!.state, 'cut') // the cut piece is the faint one
  // the road leaves at the right card: the first column card is level with it
  assert.equal(r.boxes[column[0]].y, r.boxes[pick === 'DE' ? 'b1' : 'a2'].y)
  // the exit starts at the last column card and runs right
  const out = r.segs.find((s) => s.key === 'out')!
  assert.ok(out.geo.d.startsWith(`M${r.boxes[column[2]].x + CARD_W / 2},`))
  assert.ok(out.geo.b[0] > r.boxes[column[2]].x + CARD_W)
  // the light's path: one path from outside to outside
  assert.equal(r.walk.match(/M/g)!.length, 1)
}
// the light goes once round the whole circle (the cut line included) whichever line was cut, then straight out: no line is walked twice
for (const [cut, pick] of [['e4', 'DE'], ['e3', 'NEXT'], ['e3', 'DE'], ['e2', 'NEXT']] as const) {
  const o = road(cut, pick).order
  assert.deepEqual(o, ['in', 'e1', 'e2', 'e3', 'e4', 'esc0', 'esc1', 'esc2', 'out'])
}
// the road out to the first card of the column is a straight line
for (const [cut, pick] of [['e4', 'DE'], ['e3', 'NEXT'], ['e3', 'DE']] as const) {
  const d = road(cut, pick).segs.find((s) => s.key === 'esc0')!.geo.d
  assert.match(d, /^M[-\d.]+,([-\d.]+) L[-\d.]+,\1$/, `${cut} ${pick}: ${d}`)
}
// the road always leaves on the right: whichever line is cut and whatever was chosen, the card it leaves from is never on the ring's left half,
// the top card stays on top, and the way out does not cross the ring (it starts at that card's right side)
for (const cut of ['e2', 'e3', 'e4'])
  for (const pick of ['DE', 'NEXT'] as const) {
    const r = road(cut, pick)
    const rd = r.f.round!
    const at = r.boxes[r.f.escape!.at]
    assert.ok(at.x + CARD_W / 2 >= rd.cx - 1, `${cut} ${pick}: leaves on the left`)
    assert.equal(r.boxes.b1.x + CARD_W / 2, rd.cx)
    assert.ok(r.boxes.b1.y < r.boxes.c1.y && r.boxes.b1.y < r.boxes.a2.y)
    assert.ok(r.segs.find((s) => s.key === 'esc0')!.geo.d.startsWith(`M${at.x + CARD_W - 20},`) || r.segs.find((s) => s.key === 'esc0')!.geo.a[0] === at.x + CARD_W, `${cut} ${pick}: not from the right side`)
    // every arc of a flipped ring is drawn anticlockwise (sweep flag 0), of an unflipped one clockwise
    for (const s of r.segs.filter((x) => / A/.test(x.geo.d))) assert.ok(new RegExp(` 0 [01] ${rd.ccw ? 0 : 1} `).test(s.geo.d))
  }
assert.equal(road('e3', 'NEXT').f.round!.ccw, true) // a2 would be lower left: flipped
assert.equal(road('e4', 'DE').f.round!.ccw, undefined) // b1 is on top: as before
// dragging a ring card along the ring keeps it on the circle
const f = flow(cards, lines.map(([id, from, to]) => ({ id, from, to })), [], h)
for (const [dx, dy] of [[60, -90], [-200, 30], [10, 400]]) {
  const p = snapToRing(f.round!, f.pos.c1.x + dx, f.pos.c1.y + dy, 80)
  assert.ok(Math.abs(Math.hypot(p.x + CARD_W / 2 - f.round!.cx, p.y + 40 - f.round!.cy) - f.round!.r) < 1.5)
}
// the arcs always have the ring's radius, wherever the cards are
const moved = { x: f.pos.c1.x, y: f.pos.c1.y }
const snapped = snapToRing(f.round!, moved.x + 40, moved.y - 120, 80)
const g = arcGeo(f.round!, { ...snapped, w: CARD_W, h: 80 }, { x: f.pos.a2.x, y: f.pos.a2.y, w: CARD_W, h: 80 })
assert.ok(new RegExp(`A${f.round!.r},${f.round!.r} `).test(g.d))
console.log('road ok')
