// Where the cards lie on the map (plain code, no AI).
//   top to bottom = cause and effect: the walk's path is one column, each card under the one it follows from
//   left and right = the same level: cards that follow from the same card sit side by side, joined by a dotted-end line (a "peer")
//   once the person has closed the circle, the cards on it move onto a ring (clockwise from the top) and its lines become arcs
import { CARD_W, cornerInset, estH, estW, routeOrtho, type Box, type Kind } from './place.ts'
import { walkPlan } from './walk.ts'

type Pt = [number, number]
type FC = { id: string; text: string; kind?: Kind }
type FE = { id: string; from: string; to: string; by?: 'ai'; cut?: boolean }
// a joins b on the same level; own = made by the person (kept across layouts); side = which side of a they added it on
export type Peer = { a: string; b: string; own?: boolean; side?: 'l' | 'r' }
// a line along the ring: centre, radius, the angle it leaves its card at, the angle it arrives at (radians, clockwise on screen)
export type Arc = [cx: number, cy: number, r: number, from: number, to: number]
// the ring's circle: centre, radius and the cards on it (clockwise). The arcs are always drawn from this, never from where a card happens to be
export type Round = { cx: number; cy: number; r: number; ids: string[]; ccw?: boolean } // ccw: the ring runs anticlockwise (flipped left to right, so the road can leave on the right)
// the one road after the cut: it leaves the ring at `at`, then runs down a column through `chain` (the chosen kind first, in the order the cards were made, then the other kind)
export type Escape = { at: string; chain: string[]; first: 'DE' | 'NEXT' }
export type Flow = { pos: Record<string, { x: number; y: number }>; routes: Record<string, Pt[]>; arcs: Record<string, Arc>; peers: Peer[]; ring: string[]; round?: Round; escape?: Escape }

export const GX = 24 // between cards that lie together with no arrow (a heap, cards side by side)
export const GY = 24
export const LG = 64 // between two cards joined by an arrow: the arrow floats in the middle of the gap (Figma reference: about 64px)

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

// where the road leaves the ring and which cards it passes after that; null while no line is cut. pick = what the person chose (older maps: guessed from the cut line)
export function escapeOf(cards: FC[], edges: FE[], pick?: 'DE' | 'NEXT'): Escape | null {
  const cut = edges.find((e) => e.cut)
  const to = cards.find((c) => c.id === cut?.to)
  if (!cut || !to || !cards.some((c) => c.id === cut.from)) return null
  const first = pick ?? (to.kind === 'B' ? 'DE' : 'NEXT')
  // another way → it leaves at the thought; do something different → at the card for what they did (the end of the cut line, or its start)
  const at = first === 'DE' ? cut.to : to.kind === 'A' ? cut.to : cut.from
  const ids = (k: string) => cards.filter((c) => c.kind === k).map((c) => c.id)
  return { at, chain: [...ids(first), ...ids(first === 'DE' ? 'NEXT' : 'DE')], first }
}

// After the cut the ways out come in two piles: the kind the person chose first, then the other (Next step, or the other ways they found)
export const escGroups = (esc: Escape, kindOf: (id: string) => Kind | undefined): [string[], string[]] => [esc.chain.filter((id) => kindOf(id) === esc.first), esc.chain.filter((id) => kindOf(id) !== esc.first)]
// Cards that answer the same card side by side (parallel, not one after another) lie as one heap on a two-wide grid, no arrows between them:
// top left, under it, beside that, then top right, then on down in pairs (Figma: three Another way cards)
export const slot = (i: number): [col: number, row: number] => (i < 4 ? ([[0, 0], [0, 1], [1, 1], [1, 0]][i] as [number, number]) : [i % 2, Math.floor(i / 2)])

export function flow(cards: FC[], edges: FE[], own: Peer[] = [], hOf: (c: FC) => number = (c) => estH(c.text, c.kind), pick?: 'DE' | 'NEXT', wOf: (c: FC) => number = (c) => estW(c.text, c.kind)): Flow {
  const by = new Map(cards.map((c) => [c.id, c]))
  const H = (id: string) => hOf(by.get(id)!)
  const Wd = (id: string) => wOf(by.get(id)!) // one cell, or two for a wide card
  const plan = walkPlan(cards, edges)
  const closing = edges.find((e) => e.id === plan.close)
  // the circle counts once the person made or kept its last line (a line still "by the AI" is only a guess)
  const at = closing && !closing.by ? plan.path.indexOf(closing.to) : -1
  const ring = at >= 0 && plan.path.length - at >= 2 ? plan.path.slice(at) : []
  const lead = ring.length ? plan.path.slice(0, at) : plan.path
  const pos: Flow['pos'] = {}
  const box = (id: string): Box => ({ x: pos[id].x, y: pos[id].y, w: Wd(id), h: H(id) })

  // the column: the path, top to bottom
  let y = 0
  for (const id of lead) {
    pos[id] = { x: (CARD_W - Wd(id)) / 2, y } // centred on the column
    y += H(id) + LG
  }
  // after the cut the way out is one road in a column to the right of everything else: those cards are placed below, not beside their parent
  const esc = ring.length ? escapeOf(cards, edges, pick) : null
  const chain = new Set(esc?.chain)
  // the ring: clockwise from the top, the first card straight under the column. The road always leaves on the right: if the card it leaves from
  // would sit on the left half, the ring is flipped left to right (it then runs anticlockwise; the top card and the way in stay where they are)
  const cx = CARD_W / 2
  let [cy, R] = [0, 0]
  const out = esc ? ring.indexOf(esc.at) : -1
  const ccw = out >= 0 && Math.cos(-Math.PI / 2 + (out * 2 * Math.PI) / ring.length) < -0.05
  const angle = (i: number) => -Math.PI / 2 + ((ccw ? -1 : 1) * i * 2 * Math.PI) / ring.length
  if (ring.length) {
    // big enough that neighbours on the ring do not touch (Figma: Ø620 for four one-cell cards)
    const big = Math.max(...ring.map(Wd))
    R = Math.max(310, (big / 2 + 60) / Math.sin(Math.PI / ring.length))
    cy = y + H(ring[0]) / 2 + R
    ring.forEach((id, i) => (pos[id] = { x: Math.round(cx + R * Math.cos(angle(i)) - Wd(id) / 2), y: Math.round(cy + R * Math.sin(angle(i)) - H(id) / 2) }))
  }

  // everything else hangs off a card that is already placed
  const free = (x: number, yy: number, h: number, w = CARD_W) => !Object.keys(pos).some((id) => x < pos[id].x + Wd(id) + GX - 1 && x + w + GX - 1 > pos[id].x && yy < pos[id].y + H(id) + GY - 1 && yy + h + GY - 1 > pos[id].y)
  const put = (id: string, x: number, yy: number, dx: number) => {
    while (!free(x, yy, H(id), Wd(id))) x += dx * (Wd(id) + GX)
    pos[id] = { x, y: yy }
  }
  // the x of a card set beside another on the right (d = 1) or the left (d = -1)
  const nextTo = (anchor: string, id: string, d: number, g = GX) => (d > 0 ? pos[anchor].x + Wd(anchor) + g : pos[anchor].x - Wd(id) - g)
  const outward = (id: string) => (ring.length && pos[id].x + Wd(id) / 2 < cx - 1 ? -1 : 1) // away from the ring's centre
  const peers: Peer[] = []
  const onPath = new Set(plan.path)
  for (let moved = true; moved; ) {
    moved = false
    // first the cards the person put side by side: right next to each other, on the side they chose (whichever of the two is placed holds the other)
    for (const o of own) {
      if (!pos[o.a] === !pos[o.b]) continue
      const d0 = o.side === 'l' ? -1 : o.side === 'r' ? 1 : outward(pos[o.a] ? o.a : o.b)
      const [anchor, id, d] = pos[o.a] ? [o.a, o.b, d0] : [o.b, o.a, -d0]
      put(id, nextTo(anchor, id, d), pos[anchor].y, d)
      // the one on the path leads (it keeps the arrow), the other joins it
      peers.push(onPath.has(o.b) && !onPath.has(o.a) ? { a: o.b, b: o.a, own: true, side: o.side === 'l' ? 'r' : 'l' } : o)
      moved = true
    }
    if (moved) continue
    // then, one at a time, a card that follows from a placed one (and after each, its own side cards again)
    const c = cards.find((x) => !pos[x.id] && !chain.has(x.id) && !own.some((o) => o.a === x.id || o.b === x.id) && edges.some((e) => e.to === x.id && e.id !== plan.close && pos[e.from])) ?? cards.find((x) => !pos[x.id] && !chain.has(x.id) && edges.some((e) => e.to === x.id && e.id !== plan.close && pos[e.from]))
    if (!c) break
    const parent = edges.find((e) => e.to === c.id && e.id !== plan.close && pos[e.from])!.from
    if (ring.length || c.kind === 'DE' || c.kind === 'NEXT') {
      // a way out (another way, a next step) sits beside the card it answers, on its level; so does everything once there is a ring (no "below" there).
      // Outward from the ring; the other side if that one is taken; the way its siblings already went
      const first = (d: number) => free(nextTo(parent, c.id, d, LG), pos[parent].y, H(c.id), Wd(c.id))
      const sib = edges.find((e) => e.from === parent && e.to !== c.id && pos[e.to] && by.get(e.to)!.kind === c.kind && !onPath.has(e.to))?.to
      const d = sib ? Math.sign(pos[sib].x - pos[parent].x) || 1 : first(outward(parent)) ? outward(parent) : first(-outward(parent)) ? -outward(parent) : outward(parent)
      put(c.id, nextTo(parent, c.id, d, LG), pos[parent].y, d)
    } else put(c.id, pos[parent].x + (Wd(parent) - Wd(c.id)) / 2, pos[parent].y + H(parent) + LG, 1) // one level down, centred under it; to the right if the place is taken
    moved = true
  }
  // the ways out: the first pile right next to the card the circle is left from (an arrow apart, its first card level with it); the second pile
  // off the first one's bottom-right corner (a diagonal arrow). If that place is taken, both move clear of every card placed so far.
  if (esc) {
    const groups = escGroups(esc, (id) => by.get(id)?.kind)
    const heap = (ids: string[], x0: number, y0: number) => {
      const colW = [0, 1].map((c) => Math.max(0, ...ids.filter((_, i) => slot(i)[0] === c).map(Wd)))
      const rows = Math.max(0, ...ids.map((_, i) => slot(i)[1])) + 1
      const rowH = [...Array(rows)].map((_, r) => Math.max(0, ...ids.filter((_, i) => slot(i)[1] === r).map(H)))
      const at: Record<string, { x: number; y: number }> = {}
      ids.forEach((id, i) => {
        const [c, r] = slot(i)
        at[id] = { x: x0 + (c ? colW[0] + GX : 0), y: y0 + rowH.slice(0, r).reduce((t, v) => t + v + GY, 0) }
      })
      const right = Math.max(x0, ...ids.map((id) => at[id].x + Wd(id)))
      const bottom = Math.max(y0, ...ids.map((id) => at[id].y + H(id)))
      const corner = ids.reduce((p, id) => (at[id].x + Wd(id) + at[id].y + H(id) > at[p].x + Wd(p) + at[p].y + H(p) ? id : p), ids[0]) // its bottom-right card
      return { at, right, bottom, corner }
    }
    const lay = (x: number) => {
      const y0 = pos[esc.at] ? pos[esc.at].y + H(esc.at) / 2 - (groups[0][0] ? H(groups[0][0]) : 0) / 2 : 0
      const a = heap(groups[0], x, y0)
      // off the corner by the gap you see between the two shapes (their corners are round, so the boxes may overlap a little)
      const d = groups[0].length && groups[1].length ? (LG - cornerInset(by.get(a.corner)?.kind) - cornerInset(by.get(groups[1][0])?.kind)) / Math.SQRT2 : 0
      const b = groups[0].length ? heap(groups[1], a.right + d, a.bottom + d) : heap(groups[1], x, y0)
      return { ...a.at, ...b.at }
    }
    const fits = (p: Record<string, { x: number; y: number }>) => Object.entries(p).every(([id, q]) => free(q.x, q.y, H(id), Wd(id)))
    const near = lay(pos[esc.at] ? pos[esc.at].x + Wd(esc.at) + LG : 0)
    Object.assign(pos, fits(near) ? near : lay(Math.max(...Object.keys(pos).map((id) => pos[id].x + Wd(id))) + LG))
  }
  // cards with no line at all: a last level at the bottom
  const rest = cards.filter((c) => !pos[c.id])
  if (rest.length) {
    const low = Math.max(0, ...Object.keys(pos).map((id) => pos[id].y + H(id))) + (Object.keys(pos).length ? GY : 0)
    let rx = 0
    rest.forEach((c) => ((pos[c.id] = { x: rx, y: low }), (rx += Wd(c.id) + GX)))
  }

  // the same kind, from the same card, side by side → one arrow to the nearest, dotted-end lines between the rest
  for (const p of cards) {
    const kids = edges.filter((e) => e.from === p.id && e.id !== plan.close && pos[e.to]).map((e) => e.to)
    for (const k of new Set(kids.map((id) => by.get(id)!.kind))) {
      const dist = (id: string) => Math.abs(pos[id].x - pos[p.id].x)
      const row = [...new Set(kids)].filter((id) => by.get(id)!.kind === k).sort((a, b) => dist(a) - dist(b))
      for (let i = 1; i < row.length; i++) {
        const [a, b] = [row[i - 1], row[i]]
        const [l, r] = pos[a].x < pos[b].x ? [a, b] : [b, a]
        const beside = Math.abs(pos[a].y - pos[b].y) < 1 && Math.abs(pos[r].x - pos[l].x - Wd(l) - GX) < 1
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
    let [a0, a1] = ccw ? [angle(i + 1), angle(i)] : [angle(i), angle(i + 1)] // always the smaller angle first
    while (a0 < a1 && inside(box(ccw ? next : id), cx + R * Math.cos(a0), cy + R * Math.sin(a0), 4)) a0 += 0.01
    while (a1 > a0 && inside(box(ccw ? id : next), cx + R * Math.cos(a1), cy + R * Math.sin(a1), 9)) a1 -= 0.01
    if (a1 - a0 > 0.05) arcs[e.id] = [cx, cy, R, a0, a1]
  })
  const quiet = quietEdges(edges, peers)
  const routes: Flow['routes'] = {}
  const done: Pt[][] = []
  for (const e of edges) {
    if (arcs[e.id] || quiet.has(e.id) || chain.has(e.to) || !pos[e.from] || !pos[e.to]) continue
    const [a, b] = [box(e.from), box(e.to)]
    // side by side on one level: a straight line, at the height of the card it points at (its point, for a next step)
    const level = Math.abs(a.y - b.y) < 1 && [GX, LG].some((g) => Math.abs(b.x - a.x - a.w - g) < 1 || Math.abs(a.x - b.x - b.w - g) < 1)
    const yy = Math.max(a.y + 14, Math.min(a.y + a.h - 14, b.y + b.h / 2))
    const r: Pt[] = level && yy > b.y + 10 && yy < b.y + b.h - 10 ? (b.x > a.x ? [[a.x + a.w, yy], [b.x, yy]] : [[a.x, yy], [b.x + b.w, yy]]) : routeOrtho(a, b, Object.keys(pos).filter((id) => id !== e.from && id !== e.to).map(box), done)
    routes[e.id] = r
    done.push(r)
  }
  return { pos, routes, arcs, peers, ring, round: ring.length ? { cx, cy, r: R, ids: ring, ...(ccw ? { ccw } : {}) } : undefined, escape: esc ?? undefined }
}

// an arc as an SVG path, and the point half-way along it
export const arcPath = ([cx, cy, r, a0, a1]: Arc) => `M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`
export const arcMid = ([cx, cy, r, a0, a1]: Arc) => ({ x: cx + r * Math.cos((a0 + a1) / 2), y: cy + r * Math.sin((a0 + a1) / 2) })
