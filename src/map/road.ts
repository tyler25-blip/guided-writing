// The road (plain code, no React): the lines of the map as one thick road that comes in from outside, passes through the cards,
// loops round the ring, leaves it where the person cut it, walks down a column and out again.
// Geometry only: Road.tsx draws it, MapApp.tsx decides which lines and cards are on the map.
import { CARD_W, routeMid, routeOrtho, smoothPath, type Box } from './place.ts'
import type { Escape, Round } from './flow.ts'
import type { Plan } from './walk.ts'

export type Pt = [number, number]
export const ROAD_W = 28
export const DIM = '#3A332E'
export const BRIGHT = '#F3F0EB'
// a line as a road piece: d = the path (its ends run a little under the cards so butt caps never show), a → b = the stretch between the
// cards where the gradient runs (dim → bright), m = its middle
export type Geo = { d: string; a: Pt; b: Pt; m: { x: number; y: number } }
// road = confirmed; flow = waiting for a yes (dashes flowing on); cut = the line the person broke (30%); in / out = the road from and to outside the canvas (fading)
export type SegState = 'road' | 'flow' | 'cut' | 'in' | 'out'
export type Seg = { key: string; geo: Geo; state: SegState }

const UNDER = 30 // how far a piece runs under a card
const OUTSIDE = 340 // how far the road reaches outside the cards
const push = (q: Pt, from: Pt, n: number): Pt => {
  const l = Math.hypot(q[0] - from[0], q[1] - from[1]) || 1
  return [q[0] + ((q[0] - from[0]) / l) * n, q[1] + ((q[1] - from[1]) / l) * n]
}

// a right-angled route, with rounded corners (the radius shrinks on short runs)
export function routeGeo(route: Pt[], r = 56): Geo {
  const p = route.map((q) => [...q] as Pt)
  if (p.length > 1) {
    p[0] = push(p[0], p[1], UNDER)
    p[p.length - 1] = push(p[p.length - 1], p[p.length - 2], UNDER)
  }
  return { d: smoothPath(p, r), a: route[0], b: route[route.length - 1], m: routeMid(route) }
}

// a piece of the ring: always part of the circle (centre, radius), from the angle of one card to the angle of the next, clockwise
export function arcGeo(rd: Round, from: Box, to: Box): Geo {
  const ang = (b: Box) => Math.atan2(b.y + b.h / 2 - rd.cy, b.x + b.w / 2 - rd.cx)
  const a0 = ang(from)
  let a1 = ang(to)
  while (a1 <= a0 + 1e-3) a1 += 2 * Math.PI
  const at = (t: number): Pt => [rd.cx + rd.r * Math.cos(t), rd.cy + rd.r * Math.sin(t)]
  const inside = (b: Box, t: number) => {
    const [x, y] = at(t)
    return x > b.x - 2 && x < b.x + b.w + 2 && y > b.y - 2 && y < b.y + b.h + 2
  }
  let [v0, v1] = [a0, a1]
  while (v0 < v1 && inside(from, v0)) v0 += 0.01
  while (v1 > v0 && inside(to, v1)) v1 -= 0.01
  const [p0, p1] = [at(a0), at(a1)]
  const mid = at((a0 + a1) / 2)
  return { d: `M${p0[0]},${p0[1]} A${rd.r},${rd.r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1[0]},${p1[1]}`, a: at(v0), b: at(v1), m: { x: mid[0], y: mid[1] } }
}

// a card on the ring moves along the ring: the nearest point of the circle to where it was dragged
export function snapToRing(rd: Round, x: number, y: number, h: number): { x: number; y: number } {
  const t = Math.atan2(y + h / 2 - rd.cy, x + CARD_W / 2 - rd.cx)
  return { x: Math.round(rd.cx + rd.r * Math.cos(t) - CARD_W / 2), y: Math.round(rd.cy + rd.r * Math.sin(t) - h / 2) }
}

// from outside the canvas, straight down into the first card
export const entryGeo = (b: Box): Geo => {
  const x = b.x + b.w / 2
  return { d: `M${x},${b.y - OUTSIDE} L${x},${b.y + b.h / 2}`, a: [x, b.y - OUTSIDE], b: [x, b.y], m: { x, y: b.y - OUTSIDE / 2 } }
}
// from a card straight out to the right, away from the canvas
export const exitGeo = (b: Box): Geo => {
  const y = b.y + b.h / 2
  const x0 = b.x + b.w
  return { d: `M${b.x + b.w / 2},${y} L${x0 + OUTSIDE},${y}`, a: [x0, y], b: [x0 + OUTSIDE, y], m: { x: x0 + OUTSIDE / 2, y } }
}
// down the column: straight when the cards are in line, otherwise a routed line
const colGeo = (a: Box, b: Box): Geo => {
  const [ax, bx] = [a.x + a.w / 2, b.x + b.w / 2]
  if (Math.abs(ax - bx) < 2 && b.y > a.y + a.h) return { d: `M${ax},${a.y + a.h / 2} L${bx},${b.y + b.h / 2}`, a: [ax, a.y + a.h], b: [bx, b.y], m: { x: ax, y: (a.y + a.h + b.y) / 2 } }
  return routeGeo(routeOrtho(a, b, [], [], true))
}
// a card on the left or lower left of the ring cannot go straight to the column (the ring is in the way): down from it, under the ring, then up into the column's first card
function underRing(rd: Round, a: Box, b: Box): Pt[] | null {
  const ang = Math.atan2(a.y + a.h / 2 - rd.cy, a.x + a.w / 2 - rd.cx)
  const side = Math.cos(ang) < -0.3 && Math.abs(Math.sin(ang)) <= 0.3 // straight left of the centre
  if (!side && !(Math.sin(ang) > 0.3 && Math.cos(ang) < 0.3)) return null
  // from the side the road goes down from the card's outer part, clear of the ring's own curve
  const [x, y, by] = [side ? a.x + 40 : a.x + a.w / 2, Math.max(rd.cy + rd.r + 60, a.y + a.h + 40), b.y + b.h / 2]
  return [[x, a.y + a.h], [x, y], [b.x - 40, y], [b.x - 40, by], [b.x, by]]
}
// from the ring out to the first card of the column
const linkGeo = (a: Box, b: Box, rd?: Round): Geo => {
  const under = rd && underRing(rd, a, b)
  if (under) return routeGeo(under)
  // otherwise one smooth S: out of the card's right side, into the first card's left side, no corners
  const [x0, y0, x1, y1] = [a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2]
  const xm = (x0 + x1) / 2
  return { d: `M${x0 - UNDER},${y0} L${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1 + UNDER},${y1}`, a: [x0, y0], b: [x1, y1], m: { x: xm, y: (y0 + y1) / 2 } }
}

export type RoadEdge = { id: string; from: string; to: string; by?: 'ai'; cut?: boolean; geo: Geo }
export type RoadIn = {
  edges: RoadEdge[] // the lines on the map, none of them quiet
  plan: Plan | null
  esc: Escape | null
  round?: Round // the ring, if there is one
  boxes: Record<string, Box> // the cards on the map
  story: boolean // the road comes in from outside (and, once the circle is closed, goes out again)
  exitUncut: boolean // no cut: the road still leaves from the ring's last card
  pending?: Set<string> // cards that are only a placeholder, waiting for a yes: the road does not leave from them yet
}
// the road: its pieces in the order they are drawn, and the one path the light travels (entry → cards in order → once round the whole ring → on to the card it leaves from → down the column → out)
export function buildRoad(i: RoadIn): { segs: Seg[]; walk: string; order: string[] } {
  const segs: Seg[] = []
  const hide = new Set(i.esc?.chain) // the fan of lines from one card to every way out is replaced by the chain
  const edgeSeg = (e: RoadEdge): Seg => ({ key: e.id, geo: e.geo, state: e.cut ? 'cut' : e.by === 'ai' ? 'flow' : 'road' })
  const drawn = new Map(i.edges.filter((e) => !hide.has(e.to)).map((e) => [e.id, edgeSeg(e)]))
  segs.push(...drawn.values())
  const order: Seg[] = []
  const first = i.plan?.path[0]
  if (i.story && first && i.boxes[first]) {
    const s: Seg = { key: 'in', geo: entryGeo(i.boxes[first]), state: i.pending?.has(first) ? 'flow' : 'in' } // while the first card waits for its yes, the way in waits too
    segs.push(s)
    order.push(s)
  }
  // the light follows the path's lines in order, then the line that closes the circle: once round the whole circle, the cut line included.
  // If the road leaves further along the circle than where that round ended, the light goes on over the same lines to that card (they come up twice in `order`).
  if (i.plan) {
    for (const id of [...i.plan.links.slice(1), ...(i.plan.close ? [i.plan.close] : [])]) {
      const s = drawn.get(id)
      if (s) order.push(s)
    }
    const back = i.edges.find((e) => e.id === i.plan!.close)?.to
    const from = back ? i.plan.path.indexOf(back) : -1
    const to = i.esc ? i.plan.path.indexOf(i.esc.at) : -1
    for (let k = from + 1; from >= 0 && k <= to; k++) {
      const s = drawn.get(i.plan.links[k])
      if (s) order.push(s)
    }
  }
  let end: string | undefined
  if (i.esc) {
    let prev = i.esc.at
    i.esc.chain
      .filter((id) => i.boxes[id])
      .forEach((id, k) => {
        const [a, b] = [i.boxes[prev], i.boxes[id]]
        const into = i.edges.find((e) => e.to === id)
        const s: Seg = { key: `esc${k}`, geo: k ? colGeo(a, b) : linkGeo(a, b, i.round), state: into?.by === 'ai' ? 'flow' : 'road' }
        segs.push(s)
        order.push(s)
        prev = id
        end = id
      })
  } else if (i.exitUncut && i.plan?.close) end = i.plan.path[i.plan.path.length - 1]
  if (i.story && end && i.boxes[end] && !i.pending?.has(end)) {
    const s: Seg = { key: 'out', geo: exitGeo(i.boxes[end]), state: 'out' }
    segs.push(s)
    order.push(s)
  }
  return { segs, order: order.map((x) => x.key), walk: order.map((s, k) => (k ? s.geo.d.replace(/^M/, 'L') : s.geo.d)).join(' ') }
}
