// Where the cards lie on the map (plain code, no AI).
//   top to bottom = cause and effect: the walk's path is one column, each card under the one it follows from
//   left and right = the same level: cards that follow from the same card sit side by side, joined by a dotted-end line (a "peer")
//   once the person has closed the circle, the cards on it move onto a ring (clockwise from the top) and its lines become arcs
import { CARD_W, estH, routeOrtho, type Box, type Kind } from './place.ts'
import { walkPlan } from './walk.ts'

type Pt = [number, number]
type FC = { id: string; text: string; kind?: Kind }
type FE = { id: string; from: string; to: string; by?: 'ai' }
// a joins b on the same level; own = made by the person (kept across layouts); side = which side of a they added it on
export type Peer = { a: string; b: string; own?: boolean; side?: 'l' | 'r' }
// a line along the ring: centre, radius, the angle it leaves its card at, the angle it arrives at (radians, clockwise on screen)
export type Arc = [cx: number, cy: number, r: number, from: number, to: number]
export type Flow = { pos: Record<string, { x: number; y: number }>; routes: Record<string, Pt[]>; arcs: Record<string, Arc>; peers: Peer[]; ring: string[] }

export const GX = 40 // between cards on the same level
export const GY = 56 // between one level and the next

// the lines that are not drawn: a card that sits beside its peer shares the peer's arrow (one arrow to the first, dotted-end lines between the rest)
export function quietEdges(edges: FE[], peers: Peer[]): Set<string> {
  const out = new Set<string>()
  for (const p of peers)
    for (const e of edges) {
      if (e.to === p.b && edges.some((x) => x.from === e.from && x.to === p.a)) out.add(e.id) // both follow from the same card
      if (e.from === p.b && edges.some((x) => x.from === p.a && x.to === e.to)) out.add(e.id) // both lead on to the same card
    }
  return out
}

export function flow(cards: FC[], edges: FE[], own: Peer[] = [], hOf: (c: FC) => number = (c) => estH(c.text, c.kind)): Flow {
  const by = new Map(cards.map((c) => [c.id, c]))
  const H = (id: string) => hOf(by.get(id)!)
  const plan = walkPlan(cards, edges)
  const closing = edges.find((e) => e.id === plan.close)
  // the circle counts once the person made or kept its last line (a line still "by the AI" is only a guess)
  const at = closing && !closing.by ? plan.path.indexOf(closing.to) : -1
  const ring = at >= 0 && plan.path.length - at >= 2 ? plan.path.slice(at) : []
  const lead = ring.length ? plan.path.slice(0, at) : plan.path
  const pos: Flow['pos'] = {}
  const box = (id: string): Box => ({ x: pos[id].x, y: pos[id].y, w: CARD_W, h: H(id) })

  // the column: the path, top to bottom
  let y = 0
  for (const id of lead) {
    pos[id] = { x: 0, y }
    y += H(id) + GY
  }
  // the ring: clockwise from the top, the first card straight under the column
  const cx = CARD_W / 2
  let [cy, R] = [0, 0]
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / ring.length
  if (ring.length) {
    R = Math.max(180, 125 / Math.sin(Math.PI / ring.length))
    cy = y + H(ring[0]) / 2 + R
    ring.forEach((id, i) => (pos[id] = { x: Math.round(cx + R * Math.cos(angle(i)) - CARD_W / 2), y: Math.round(cy + R * Math.sin(angle(i)) - H(id) / 2) }))
  }

  // everything else hangs off a card that is already placed
  const free = (x: number, yy: number, h: number) => !Object.keys(pos).some((id) => x < pos[id].x + CARD_W + 16 && x + CARD_W + 16 > pos[id].x && yy < pos[id].y + H(id) + 16 && yy + h + 16 > pos[id].y)
  const put = (id: string, x: number, yy: number, dx: number) => {
    while (!free(x, yy, H(id))) x += dx * (CARD_W + GX)
    pos[id] = { x, y: yy }
  }
  const outward = (id: string) => (ring.length && pos[id].x + CARD_W / 2 < cx - 1 ? -1 : 1) // away from the ring's centre
  const peers: Peer[] = []
  const onPath = new Set(plan.path)
  for (let moved = true; moved; ) {
    moved = false
    // first the cards the person put side by side: right next to each other, on the side they chose (whichever of the two is placed holds the other)
    for (const o of own) {
      if (!pos[o.a] === !pos[o.b]) continue
      const d0 = o.side === 'l' ? -1 : o.side === 'r' ? 1 : outward(pos[o.a] ? o.a : o.b)
      const [anchor, id, d] = pos[o.a] ? [o.a, o.b, d0] : [o.b, o.a, -d0]
      put(id, pos[anchor].x + d * (CARD_W + GX), pos[anchor].y, d)
      // the one on the path leads (it keeps the arrow), the other joins it
      peers.push(onPath.has(o.b) && !onPath.has(o.a) ? { a: o.b, b: o.a, own: true, side: o.side === 'l' ? 'r' : 'l' } : o)
      moved = true
    }
    if (moved) continue
    // then, one at a time, a card that follows from a placed one (and after each, its own side cards again)
    const c = cards.find((x) => !pos[x.id] && !own.some((o) => o.a === x.id || o.b === x.id) && edges.some((e) => e.to === x.id && e.id !== plan.close && pos[e.from])) ?? cards.find((x) => !pos[x.id] && edges.some((e) => e.to === x.id && e.id !== plan.close && pos[e.from]))
    if (!c) break
    const parent = edges.find((e) => e.to === c.id && e.id !== plan.close && pos[e.from])!.from
    if (ring.length || c.kind === 'DE' || c.kind === 'NEXT') {
      // a way out (another way, a next step) sits beside the card it answers, on its level; so does everything once there is a ring (no "below" there).
      // Outward from the ring; the other side if that one is taken; the way its siblings already went
      const first = (d: number) => free(pos[parent].x + d * (CARD_W + GX), pos[parent].y, H(c.id))
      const sib = edges.find((e) => e.from === parent && e.to !== c.id && pos[e.to] && by.get(e.to)!.kind === c.kind && !onPath.has(e.to))?.to
      const d = sib ? Math.sign(pos[sib].x - pos[parent].x) || 1 : first(outward(parent)) ? outward(parent) : first(-outward(parent)) ? -outward(parent) : outward(parent)
      put(c.id, pos[parent].x + d * (CARD_W + GX), pos[parent].y, d)
    } else put(c.id, pos[parent].x, pos[parent].y + H(parent) + GY, 1) // one level down; to the right if the place is taken
    moved = true
  }
  // cards with no line at all: a last level at the bottom
  const rest = cards.filter((c) => !pos[c.id])
  if (rest.length) {
    const low = Math.max(0, ...Object.keys(pos).map((id) => pos[id].y + H(id))) + (Object.keys(pos).length ? GY : 0)
    rest.forEach((c, i) => (pos[c.id] = { x: i * (CARD_W + GX), y: low }))
  }

  // the same kind, from the same card, side by side → one arrow to the nearest, dotted-end lines between the rest
  for (const p of cards) {
    const kids = edges.filter((e) => e.from === p.id && e.id !== plan.close && pos[e.to]).map((e) => e.to)
    for (const k of new Set(kids.map((id) => by.get(id)!.kind))) {
      const dist = (id: string) => Math.abs(pos[id].x - pos[p.id].x)
      const row = [...new Set(kids)].filter((id) => by.get(id)!.kind === k).sort((a, b) => dist(a) - dist(b))
      for (let i = 1; i < row.length; i++) {
        const [a, b] = [row[i - 1], row[i]]
        const beside = Math.abs(pos[a].y - pos[b].y) < 1 && Math.abs(Math.abs(pos[a].x - pos[b].x) - (CARD_W + GX)) < 1
        if (beside && !onPath.has(b) && !peers.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))) peers.push({ a, b })
      }
    }
  }

  // the lines: arcs round the ring, right angles everywhere else
  const arcs: Flow['arcs'] = {}
  const inside = (b: Box, px: number, py: number, pad: number) => px > b.x - pad && px < b.x + b.w + pad && py > b.y - pad && py < b.y + b.h + pad
  ring.forEach((id, i) => {
    const next = ring[(i + 1) % ring.length]
    const e = edges.find((x) => x.from === id && x.to === next)
    if (!e) return
    let [a0, a1] = [angle(i), angle(i + 1)]
    while (a0 < a1 && inside(box(id), cx + R * Math.cos(a0), cy + R * Math.sin(a0), 4)) a0 += 0.01
    while (a1 > a0 && inside(box(next), cx + R * Math.cos(a1), cy + R * Math.sin(a1), 9)) a1 -= 0.01 // room for the arrowhead
    if (a1 - a0 > 0.05) arcs[e.id] = [cx, cy, R, a0, a1]
  })
  const quiet = quietEdges(edges, peers)
  const routes: Flow['routes'] = {}
  const done: Pt[][] = []
  for (const e of edges) {
    if (arcs[e.id] || quiet.has(e.id) || !pos[e.from] || !pos[e.to]) continue
    const [a, b] = [box(e.from), box(e.to)]
    // side by side on one level: a straight line, at the height of the card it points at (its point, for a next step)
    const level = Math.abs(a.y - b.y) < 1 && Math.abs(Math.abs(a.x - b.x) - (CARD_W + GX)) < 1
    const yy = Math.max(a.y + 14, Math.min(a.y + a.h - 14, b.y + b.h / 2))
    const r: Pt[] = level && yy > b.y + 10 && yy < b.y + b.h - 10 ? (b.x > a.x ? [[a.x + a.w, yy], [b.x, yy]] : [[a.x, yy], [b.x + b.w, yy]]) : routeOrtho(a, b, Object.keys(pos).filter((id) => id !== e.from && id !== e.to).map(box), done)
    routes[e.id] = r
    done.push(r)
  }
  return { pos, routes, arcs, peers, ring }
}

// an arc as an SVG path, and the point half-way along it
export const arcPath = ([cx, cy, r, a0, a1]: Arc) => `M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`
export const arcMid = ([cx, cy, r, a0, a1]: Arc) => ({ x: cx + r * Math.cos((a0 + a1) / 2), y: cy + r * Math.sin((a0 + a1) / 2) })
