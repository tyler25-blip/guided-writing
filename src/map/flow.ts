// Where the cards lie on the map (plain code, no AI).
//   top to bottom = cause and effect: the walk's path is one column, each card under the one it follows from
//   left and right = the same level: cards that follow from the same card sit side by side, joined by a dotted-end line (a "peer")
//   once the person has closed the circle, the cards on it move onto a ring (clockwise from the top) and its lines become arcs
import { AH } from './linkGeo.ts'
import { CARD_W, estH, estW, routeOrtho, type Box, type Kind } from './place.ts'
import { orderedLoops, walkPlan, waysOf } from './walk.ts'

type Pt = [number, number]
type FC = { id: string; text: string; kind?: Kind }
type FE = { id: string; from: string; to: string; by?: 'ai'; cut?: boolean; pick?: 'DE' | 'NEXT' }
// a joins b on the same level; own = made by the person (kept across layouts); side = which side of a they added it on
export type Peer = { a: string; b: string; own?: boolean; side?: 'l' | 'r' }
// a line along the ring: centre, radius, the angle it leaves its card at, the angle it arrives at (radians, clockwise on screen)
export type Arc = [cx: number, cy: number, r: number, from: number, to: number]
// the ring's circle: centre, radius and the cards on it (clockwise). The arcs are always drawn from this, never from where a card happens to be
export type Round = { cx: number; cy: number; r: number; ids: string[]; ccw?: boolean } // ccw: the ring runs anticlockwise (flipped left to right, so the road can leave on the right)
// the one road after the cut: it leaves the ring at `at`, then runs down a column through `chain` (the chosen kind first, in the order the cards were made, then the other kind)
export type Escape = { at: string; chain: string[]; first: 'DE' | 'NEXT' }
// ring / round / escape = the first circle's; rings / rounds / escapes = every circle that is closed (or cut), in the order they are walked
export type Flow = { pos: Record<string, { x: number; y: number }>; routes: Record<string, Pt[]>; arcs: Record<string, Arc>; peers: Peer[]; ring: string[]; round?: Round; escape?: Escape; rings: string[][]; rounds: Round[]; escapes: Escape[] }

export const GX = 24 // between cards that lie together with no arrow (a heap, cards side by side)
export const GY = 24
export const LG = 64 // between two cards joined by an arrow: the arrow floats in the middle of the gap (Figma reference: about 64px)

// one cell of the grid the ways out lie on: a card and the gutter after it
export const PITCH = CARD_W + LG
const span = (v: number) => Math.max(1, Math.ceil((v - 0.5) / CARD_W)) // how many cells a card of this size takes

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

// where the road leaves the ring and which cards it passes after that; null while no line is cut. pick = what the person chose (older maps: guessed from the cut line).
// loop = which circle (its own cut line and its own ways out); each cut line can carry its own pick, `pick` is the fallback for the first circle (older maps)
export function escapeOf(cards: FC[], edges: FE[], pick?: 'DE' | 'NEXT', loop = 0): Escape | null {
  const groups = orderedLoops(cards, edges)
  const cut = edges.find((e) => e.cut && (groups.length <= 1 ? loop === 0 : groups[loop]?.includes(e.id) || (loop === 0 && !groups.some((g) => g.includes(e.id)))))
  const to = cards.find((c) => c.id === cut?.to)
  if (!cut || !to || !cards.some((c) => c.id === cut.from)) return null
  const first = cut.pick ?? (loop === 0 ? pick : undefined) ?? (to.kind === 'B' ? 'DE' : 'NEXT')
  // another way → it leaves at the thought; do something different → at the card for what they did (the end of the cut line, or its start)
  const at = first === 'DE' ? cut.to : to.kind === 'A' ? cut.to : cut.from
  const ways = waysOf(cards, edges, loop)
  const ids = (k: string) => ways.filter((id) => cards.find((c) => c.id === id)?.kind === k)
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
  // one plan per circle (the first circle, then the ones walked after it)
  const plans = [...Array(Math.max(1, orderedLoops(cards, edges).length))].map((_, l) => walkPlan(cards, edges, l))
  const info = plans.map((plan) => {
    const closing = edges.find((e) => e.id === plan.close)
    // the circle counts once the person made or kept its last line (a line still "by the AI" is only a guess)
    const at = closing && !closing.by ? plan.path.indexOf(closing.to) : -1
    const ring = at >= 0 && plan.path.length - at >= 2 ? plan.path.slice(at) : []
    return { plan, ring, lead: ring.length ? plan.path.slice(0, at) : plan.path }
  })
  const closeIds = new Set(plans.map((p) => p.close))
  const pos: Flow['pos'] = {}
  const box = (id: string): Box => ({ x: pos[id].x, y: pos[id].y, w: Wd(id), h: H(id) })
  // after the cut the way out is one road in a column to the right of everything else: those cards are placed below, not beside their parent
  const escs = info.map((i, l) => (i.ring.length ? escapeOf(cards, edges, pick, l) : null))
  const chain = new Set(escs.flatMap((e) => e?.chain ?? []))
  // the cards of a later circle are placed with that circle, not as something that hangs off the first one
  const later = new Set(info.slice(1).flatMap((i) => i.plan.path))
  const rings: { ids: string[]; cx: number; cy: number; R: number; ccw: boolean; outer: 1 | -1; a0: number }[] = []
  const angle = (g: (typeof rings)[number], i: number) => g.a0 + ((g.ccw ? -1 : 1) * i * 2 * Math.PI) / g.ids.length
  const left = () => Math.min(...Object.keys(pos).map((id) => pos[id].x))
  const cw = (id: string) => span(Wd(id))
  const rh = (id: string) => span(H(id))
  const right = () => Math.max(0, ...Object.keys(pos).map((id) => pos[id].x + Wd(id)))

  // Two circles that come from the same event (a later circle's way in leaves the last card of the first circle's lead): the event sits on top, centred
  // between the two rings; the first ring below-left, the second below-right, level with each other, their top cards an arrow apart (diagonally) from the event.
  // The ways out go outward: the first ring's to its left, the second's to the right of its ring. Worked out from the cards alone, so nothing jumps between rounds.
  const inFrom1 = edges.find((e) => e.id === plans[1]?.links[0])?.from
  const sideBySide = info.length > 1 && info[0].ring.length > 1 && !!inFrom1 && info[0].lead.at(-1) === inFrom1
  // The world circle (the one that stands on the right) starts at the top with the card the event's line arrives at and runs anticlockwise, so the card
  // before it (the thought it comes back through) sits on the ring's outer side, next to its pile of ways out
  const dims = (ids: string[], a0 = -Math.PI / 2) => {
    const n = Math.max(2, ids.length)
    const big = Math.max(...ids.map(Wd))
    const R = (big / 2 + 60) / Math.sin(Math.PI / n) // as big as the cards need, no more: the two rings have to stand close under the event
    const sgn = a0 === 0 ? -1 : 1
    return { R, reach: Math.max(...ids.map((id, i) => Math.abs(R * Math.cos(a0 + (sgn * i * 2 * Math.PI) / n)) + Wd(id) / 2)) }
  }
  const side = (() => {
    if (!sideBySide) return null
    const ids1 = info[1].ring.length ? info[1].ring : info[1].plan.path.length > 1 ? info[1].plan.path : [info[1].plan.path[0] ?? inFrom1!, inFrom1!]
    const [a, b] = [dims(info[0].ring), dims(ids1)]
    const cx0 = CARD_W / 2
    const cx1 = cx0 + a.reach + b.reach + LG // two separate circles: an arrow gap apart, so they never read as one
    const lead = info[0].lead
    const top = lead.reduce((t, id) => t + H(id) + LG, 0) - LG // the event's bottom
    const ev = lead.at(-1)!
    const R = Math.max(a.R, b.R)
    const topOf = (xe: number) => top + Math.max(GY, Math.round(Math.sqrt(Math.max(0, LG * LG - Math.max(0, Math.abs(xe - cx0) - (Wd(ev) + Wd(info[0].ring[0])) / 2) ** 2))))
    // the event is centred above the gap between the rings; its line to the world ring's first card is a long arrow, floating mid-gap. It stays centred even when
    // that arrow lands under a card (Nicole's choice: the layout matters more than that one arrow); onCard / onBand are kept for the record
    const cyOf = (xe: number) => topOf(xe) + H(info[0].ring[0]) / 2 + R
    const bx = cx1 + b.R // the first card's centre: the ring's right
    let xm = (cx0 + cx1) / 2
    const cy = cyOf(xm)
    const E = { x: xm - Wd(ev) / 2, y: top - H(ev), w: Wd(ev), h: H(ev) }
    const first = ids1[0]
    const B = { x: bx - Wd(first) / 2, y: cy - H(first) / 2, w: Wd(first), h: H(first) }
    const [ox0, ox1] = [Math.max(E.x, B.x), Math.min(E.x + E.w, B.x + B.w)]
    const m = ox1 - ox0 > 40 ? { x: (ox0 + ox1) / 2, y: (E.y + E.h + B.y) / 2 } : { x: (E.x + E.w + B.x) / 2, y: (E.y + E.h + B.y) / 2 }
    const onCard = ids1.some((id, i) => {
      const t = (-i * 2 * Math.PI) / ids1.length
      const [px, py] = [cx1 + b.R * Math.cos(t), cy + b.R * Math.sin(t)]
      return Math.abs(m.x - px) < Wd(id) / 2 + AH && Math.abs(m.y - py) < H(id) / 2 + AH
    })
    const onBand = Math.abs(Math.hypot(m.x - cx1, m.y - cy) - b.R) < 14 + AH
    void onCard; void onBand // Nicole: the event stays centred above the gap even if its arrow to the world ring passes near a card (2026-11-23)
    return { cx: [cx0, cx1], xm, topY: topOf(xm), R: [a.R, b.R], cy: cyOf(xm) }
  })()

  // one circle: its lead as a column, its ring (clockwise from the top, the first card straight under the column). The first circle stands on the left;
  // a later one stands to the right of everything placed so far (x0), its ring level with the first ring's centre (or, with a lead, under its column)
  const placeLoop = (l: number, x0: number) => {
    const { plan: pl, ring, lead } = info[l]
    const esc = escs[l]
    const S = side
    const world = !!S && l > 0 // the world circle of a side by side pair: turned, see above
    // big enough that neighbours on the ring do not touch (Figma: Ø620 for four one-cell cards)
    const big = ring.length ? Math.max(...ring.map(Wd)) : 0
    const R = ring.length ? (S ? S.R[l] : Math.max(310, (big / 2 + 60) / Math.sin(Math.PI / ring.length))) : 0
    const cx = S ? S.cx[l] : l === 0 ? CARD_W / 2 : ring.length ? x0 + R + big / 2 : x0 + CARD_W / 2
    const inFrom = edges.find((e) => e.id === pl.links[0])?.from
    let y = S ? (l ? S.cy - S.R[1] - (lead[0] ? H(lead[0]) / 2 : 0) : 0) : l && inFrom && pos[inFrom] ? pos[inFrom].y : 0
    // the column: the path, top to bottom (the world circle's open path stands where its first card will be: on the ring's right)
    for (const id of lead) {
      const lx = S && l === 0 ? S.xm : cx
      pos[id] = { x: lx - Wd(id) / 2, y } // centred on the column
      y += H(id) + LG
    }
    if (!ring.length) return
    // The road always leaves on the outer side (the right; for the first of two side by side rings, which stands on the left, the left): if the card it leaves from would sit on
    // the inner half, the ring is flipped left to right (it then runs anticlockwise; the top card and the way in stay where they are)
    const outer: 1 | -1 = S && l === 0 ? -1 : 1
    const out = esc ? ring.indexOf(esc.at) : -1
    const ccw = world || (out >= 0 && outer * Math.cos(-Math.PI / 2 + (out * 2 * Math.PI) / ring.length) < -0.05)
    const cy = S && (l === 0 || !lead.length) ? S.cy : l > 0 && !lead.length && rings[0] ? rings[0].cy : y + H(ring[0]) / 2 + R
    const g = { ids: ring, cx, cy, R, ccw, outer, a0: -Math.PI / 2 }
    rings.push(g)
    ring.forEach((id, i) => (pos[id] = { x: Math.round(cx + R * Math.cos(angle(g, i)) - Wd(id) / 2), y: Math.round(cy + R * Math.sin(angle(g, i)) - H(id) / 2) }))
  }

  // everything else hangs off a card that is already placed
  const free = (x: number, yy: number, h: number, w = CARD_W) => !Object.keys(pos).some((id) => x < pos[id].x + Wd(id) + GX - 1 && x + w + GX - 1 > pos[id].x && yy < pos[id].y + H(id) + GY - 1 && yy + h + GY - 1 > pos[id].y)
  const put = (id: string, x: number, yy: number, dx: number) => {
    while (!free(x, yy, H(id), Wd(id))) x += dx * (Wd(id) + GX)
    pos[id] = { x, y: yy }
  }
  // the x of a card set beside another on the right (d = 1) or the left (d = -1)
  const nextTo = (anchor: string, id: string, d: number, g = GX) => (d > 0 ? pos[anchor].x + Wd(anchor) + g : pos[anchor].x - Wd(id) - g)
  const outward = (id: string) => {
    const g = rings.find((r) => r.ids.includes(id)) ?? rings[0]
    if (!g) return 1
    const dx = pos[id].x + Wd(id) / 2 - g.cx
    return Math.abs(dx) <= 1 ? g.outer : dx < 0 ? -1 : 1 // away from the ring's centre
  }
  const peers: Peer[] = []
  const onPath = new Set(plans.flatMap((p) => p.path))
  const settle = () => {
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
      const open = (x: FC) => !pos[x.id] && !chain.has(x.id) && !later.has(x.id)
      const c = cards.find((x) => open(x) && !own.some((o) => o.a === x.id || o.b === x.id) && edges.some((e) => e.to === x.id && !closeIds.has(e.id) && pos[e.from])) ?? cards.find((x) => open(x) && edges.some((e) => e.to === x.id && !closeIds.has(e.id) && pos[e.from]))
      if (!c) break
      const parent = edges.find((e) => e.to === c.id && !closeIds.has(e.id) && pos[e.from])!.from
      if (rings.length || c.kind === 'DE' || c.kind === 'NEXT') {
        // a way out (another way, a next step) sits beside the card it answers, on its level; so does everything once there is a ring (no "below" there).
        // Outward from the ring; the other side if that one is taken; the way its siblings already went
        const first = (d: number) => free(nextTo(parent, c.id, d, LG), pos[parent].y, H(c.id), Wd(c.id))
        const sib = edges.find((e) => e.from === parent && e.to !== c.id && pos[e.to] && by.get(e.to)!.kind === c.kind && !onPath.has(e.to))?.to
        const d = sib ? Math.sign(pos[sib].x - pos[parent].x) || 1 : first(outward(parent)) ? outward(parent) : first(-outward(parent)) ? -outward(parent) : outward(parent)
        put(c.id, nextTo(parent, c.id, d, LG), pos[parent].y, d)
      } else put(c.id, pos[parent].x + (Wd(parent) - Wd(c.id)) / 2, pos[parent].y + H(parent) + LG, 1) // one level down, centred under it; to the right if the place is taken
      moved = true
    }
  }
  // the circle of a ring as a band (an arc is drawn along it): a box that the band runs through is not a place for a card
  const crossesRing = (x: number, y: number, w: number, h: number) =>
    rings.some((g) => {
      const [dx, dy] = [Math.max(x - g.cx, 0, g.cx - (x + w)), Math.max(y - g.cy, 0, g.cy - (y + h))]
      const [fx, fy] = [Math.max(Math.abs(x - g.cx), Math.abs(x + w - g.cx)), Math.max(Math.abs(y - g.cy), Math.abs(y + h - g.cy))]
      return Math.hypot(dx, dy) <= g.R + 14 && Math.hypot(fx, fy) >= g.R - 14
    })
  // the ways out: the first pile starts an arrow gap from the card the circle is left from, its first card level with it, on the ring's outer side. Within a pile the
  // cards lie on a two-wide grid, one cell (a card plus a gutter) apart; the second pile (the Next step) sits diagonally off a corner of the first, one gutter away,
  // on the same grid: off the far corner first, else off another corner (the one nearest the exit card first). A pile that would sit on a ring's band or on a card
  // moves out, or grows upward instead of downward.
  const heaps = (esc: Escape, dir: 1 | -1) => {
    const groups = escGroups(esc, (id) => by.get(id)?.kind)
    const heap = (ids: string[]) => {
      const colW = [0, 1].map((c) => Math.max(0, ...ids.filter((_, i) => slot(i)[0] === c).map(cw)))
      const rows = Math.max(0, ...ids.map((_, i) => slot(i)[1])) + 1
      const rowH = [...Array(rows)].map((_, r) => Math.max(0, ...ids.filter((_, i) => slot(i)[1] === r).map(rh)))
      const at: Record<string, [number, number]> = {}
      ids.forEach((id, i) => {
        const [c, r] = slot(i)
        at[id] = [c ? colW[0] : 0, rowH.slice(0, r).reduce((t, v) => t + v, 0)]
      })
      return { at, w: colW[0] + colW[1], h: rowH.reduce((t, v) => t + v, 0) }
    }
    const [a, b] = [heap(groups[0]), heap(groups[1])]
    const lead = groups[0][0] ?? groups[1][0]
    const ex = pos[esc.at] ? { x: pos[esc.at].x, y: pos[esc.at].y, w: Wd(esc.at), h: H(esc.at) } : { x: 0, y: 0, w: 0, h: 0 }
    const y0 = lead ? ex.y + ex.h / 2 - H(lead) / 2 : 0 // the first card level with the exit card
    const yb = y0 + (lead ? H(lead) : 0) // the bottom of that card: an upward pile hangs from it
    const wb = Math.max(0, ...groups[1].map((id) => b.at[id][0] + cw(id)))
    const hb = Math.max(0, ...groups[1].map((id) => b.at[id][1] + rh(id)))
    const corners: [number, number][] = groups[0].length ? [[a.w, a.h], [a.w, -hb], [-wb, a.h], [-wb, -hb]] : [[0, 0]]
    const relAt = ([ox, oy]: [number, number]) => {
      const rel: Record<string, [number, number]> = { ...a.at }
      for (const id of groups[1]) rel[id] = [b.at[id][0] + ox, b.at[id][1] + oy]
      return rel
    }
    // out = how far the pile has moved out (px); up = it hangs upward; x0 = where its inner edge starts
    const lay = (rel: Record<string, [number, number]>, x0: number, up: boolean) =>
      Object.fromEntries(Object.entries(rel).map(([id, [dc, dr]]) => [id, { x: dir > 0 ? x0 + dc * PITCH : x0 - dc * PITCH - Wd(id), y: up ? yb - dr * PITCH - H(id) : y0 + dr * PITCH }]))
    const fits = (p: Record<string, { x: number; y: number }>) => Object.entries(p).every(([id, q]) => free(q.x, q.y, H(id), Wd(id)) && !crossesRing(q.x, q.y, Wd(id), H(id)))
    const inner = dir > 0 ? ex.x + ex.w + LG : ex.x - LG
    const attempt = (x0: number, up: boolean) => {
      const tries = corners.map((c) => lay(relAt(c), x0, up))
      const first = groups[1][0]
      const near = (t: (typeof tries)[number]) => (first && t[first] ? Math.hypot(t[first].x + Wd(first) / 2 - ex.x - ex.w / 2, t[first].y + H(first) / 2 - ex.y - ex.h / 2) : 0)
      return [tries[0], ...tries.slice(1).sort((x, y) => near(x) - near(y))].find(fits)
    }
    let target: ReturnType<typeof lay> | undefined
    for (let out = 0; out <= 480 && !target; out += 8) for (const up of [false, true]) target ??= attempt(inner + dir * out, up)
    target ??= lay(relAt(corners[0]), dir > 0 ? right() + LG : left() - LG, false)
    Object.assign(pos, target)
  }
  // each circle in turn: first the one with the event on it, everything it brought, then the next to the right of all of that
  plans.forEach((_, l) => {
    placeLoop(l, l ? right() + LG : 0)
    settle()
    if (escs[l]) {
      // the pile goes to the side of the ring the road leaves from
      const g = rings.find((r) => r.ids.includes(escs[l]!.at))
      const dx = g ? pos[escs[l]!.at].x + Wd(escs[l]!.at) / 2 - g.cx : 0
      heaps(escs[l]!, dx > 1 ? 1 : dx < -1 ? -1 : (g?.outer ?? 1))
    }
  })
  settle()
  // cards with no line at all: a last level at the bottom
  const rest = cards.filter((c) => !pos[c.id])
  if (rest.length) {
    const low = Math.max(0, ...Object.keys(pos).map((id) => pos[id].y + H(id))) + (Object.keys(pos).length ? GY : 0)
    let rx = 0
    rest.forEach((c) => ((pos[c.id] = { x: rx, y: low }), (rx += Wd(c.id) + GX)))
  }

  // the same kind, from the same card, side by side → one arrow to the nearest, dotted-end lines between the rest
  for (const p of cards) {
    const kids = edges.filter((e) => e.from === p.id && !closeIds.has(e.id) && pos[e.to]).map((e) => e.to)
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

  // the lines: arcs round each ring, right angles everywhere else
  const arcs: Flow['arcs'] = {}
  const inside = (b: Box, px: number, py: number, pad: number) => px > b.x - pad && px < b.x + b.w + pad && py > b.y - pad && py < b.y + b.h + pad
  for (const g of rings) {
    const { ids, cx, cy, R, ccw } = g
    ids.forEach((id, i) => {
      const next = ids[(i + 1) % ids.length]
      const e = edges.find((x) => x.from === id && x.to === next)
      if (!e) return
      let [a0, a1] = ccw ? [angle(g, i + 1), angle(g, i)] : [angle(g, i), angle(g, i + 1)] // always the smaller angle first
      while (a0 < a1 && inside(box(ccw ? next : id), cx + R * Math.cos(a0), cy + R * Math.sin(a0), 4)) a0 += 0.01
      while (a1 > a0 && inside(box(ccw ? id : next), cx + R * Math.cos(a1), cy + R * Math.sin(a1), 9)) a1 -= 0.01
      if (a1 - a0 > 0.05) arcs[e.id] = [cx, cy, R, a0, a1]
    })
  }
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
  const rounds: Round[] = rings.map((g) => ({ cx: g.cx, cy: g.cy, r: g.R, ids: g.ids, ...(g.ccw ? { ccw: true } : {}) }))
  const escapes = escs.filter((e): e is Escape => !!e)
  return { pos, routes, arcs, peers, ring: rings[0]?.ids ?? [], round: rounds[0], rounds, rings: rings.map((g) => g.ids), escape: escapes[0], escapes }
}

// an arc as an SVG path, and the point half-way along it
export const arcPath = ([cx, cy, r, a0, a1]: Arc) => `M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`
export const arcMid = ([cx, cy, r, a0, a1]: Arc) => ({ x: cx + r * Math.cos((a0 + a1) / 2), y: cy + r * Math.sin((a0 + a1) / 2) })
