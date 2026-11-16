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
// the light goes once round the whole circle (the cut line included) whichever line was cut, then on to the card the road leaves from
const ringOf = ['e2', 'e3', 'e4']
for (const [cut, pick, after] of [['e4', 'DE', []], ['e3', 'NEXT', ['e2', 'e3']], ['e3', 'DE', ['e2', 'e3']]] as const) {
  const o = road(cut, pick).order
  assert.deepEqual(o.slice(0, 5), ['in', 'e1', ...ringOf]) // in, the way to the circle, round it
  assert.deepEqual(o.slice(5, 5 + after.length), after) // on to where it leaves (b1 → c1 → a2 for a next step)
  assert.deepEqual(o.slice(5 + after.length), ['esc0', 'esc1', 'esc2', 'out'])
}
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
