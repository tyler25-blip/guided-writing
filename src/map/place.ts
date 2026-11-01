// Thought map v2 · the parts that are plain code (no AI): kinds, where cards go, which words were trimmed, the summary's main line.
import { matchIn, tokens } from './mapchecks.ts'

export type Kind = 'A' | 'B' | 'C' | 'DE' | 'NEXT'
export const KINDS: Kind[] = ['A', 'B', 'C', 'DE', 'NEXT']
export const LABEL: Record<Kind, string> = { A: 'What happened', B: 'What I told myself', C: 'What I felt', DE: 'Another way to see it', NEXT: 'Next step' }
const COLS: Kind[] = ['A', 'B', 'C', 'DE']

// no AI: a rough guess at the kind of a short text (stubs, and the fallback for a card added on the canvas)
const FEEL = /\b(feel|felt|feeling|tight|afraid|scared|anxious|sad|angry|numb|heavy|chest|stomach)/i
export const feels = (text: string) => FEEL.test(text)
export function guessKind(text: string): Kind {
  const t = text.replace(/[’‘]/g, "'")
  if (FEEL.test(t)) return 'C'
  if (/\b(i think|i keep thinking|i'm going to|i'll|i must|i should|they think|he thinks|she thinks|what if)\b/i.test(t)) return 'B'
  return 'A'
}

// nearest free spot for a new card: right of the source, then lower down, in steps, until it overlaps no card
export function freeSpot(boxes: { x: number; y: number; h: number }[], x: number, y: number, w = 180, nh = 100): { x: number; y: number } {
  const hit = (cx: number, cy: number) => boxes.some((b) => cx < b.x + w + 16 && cx + w + 16 > b.x && cy < b.y + b.h + 16 && cy + nh + 16 > b.y)
  for (let j = 0; j < 30; j++)
    for (let i = j ? 0 : 1; i < 6; i++) {
      const [cx, cy] = [x + i * (w + 40), y + j * 40]
      if (!hit(cx, cy)) return { x: cx, y: cy }
    }
  return { x, y: y + 30 * 40 }
}

type M = { role: 'you' | 'ai'; text: string; naming?: boolean; options?: string[] }
// index into msgs of each ordinary message the person wrote (naming messages are not material)
export const personIdx = (msgs: M[]) => msgs.flatMap((m, i) => (m.role === 'you' && !m.naming ? [i] : []))
// the first naming message after message i and before the person's next ordinary message
export function namesFor(msgs: M[], i: number): string[] {
  for (let k = i + 1; k < msgs.length; k++) {
    if (msgs[k].role === 'you' && !msgs[k].naming) return []
    if (msgs[k].naming) return msgs[k].text.split(',').map((x) => x.trim()).filter(Boolean)
  }
  return []
}
// the two words the AI offered after message i (if it did)
export function optionsFor(msgs: M[], i: number): string[] {
  for (let k = i + 1; k < msgs.length; k++) {
    if (msgs[k].role === 'you' && !msgs[k].naming) return []
    if (msgs[k].role === 'ai' && msgs[k].options?.length) return msgs[k].options!
  }
  return []
}

// the message split into pieces, kept = the words the card kept (normal ink), the rest is shown faded
export function segments(source: string, card: string): { s: string; keep: boolean }[] {
  const parts = source.split(/([\p{L}\d'’‘]+)/u)
  const wordIx = parts.flatMap((_, i) => (i % 2 ? [i] : []))
  const m = matchIn(tokens(card), wordIx.map((i) => tokens(parts[i])[0] ?? ''))
  const hit = new Set((m?.idx ?? []).map((k) => wordIx[k]))
  const [a, z] = [Math.min(...hit), Math.max(...hit)]
  return parts.map((s, i) => ({ s, keep: i % 2 ? hit.has(i) : hit.size > 0 && i > a && i < z && hit.has(i - 1) && hit.has(i + 1) })).filter((x) => x.s)
}

export type View = { x: number; y: number; z: number; n?: number } // n: bumped on every layout / jump, so the canvas starts from the fitted view
export type Piles = Partial<Record<Kind, { x: number; y: number }>>
const CW = 180 // card width, px
const rowOf = (k?: Kind) => (k ? { A: 0, B: 1, C: 2, DE: 3, NEXT: 4 }[k] : 0)
// roughly how tall a card is before it has been drawn (text lines + kind chip + names row)
export const estH = (text: string, kind?: Kind) => 46 + 22 * Math.ceil(text.length / 19) + (kind === 'C' ? 26 : 0)

// the view that shows every box with a margin (zoom 25%–200%, never bigger than `max`)
export function fitView(boxes: { x: number; y: number; w: number; h: number }[], bw: number, bh: number, pad = 60, max = 1.5): View {
  if (!boxes.length) return { x: 0, y: 0, z: 1 }
  const [x0, y0] = [Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y))]
  const [x1, y1] = [Math.max(...boxes.map((b) => b.x + b.w)), Math.max(...boxes.map((b) => b.y + b.h))]
  const z = Math.max(0.25, Math.min(max, (bw - 2 * pad) / (x1 - x0 || 1), (bh - 2 * pad) / (y1 - y0 || 1)))
  return { z, x: (bw - (x1 - x0) * z) / 2 - x0 * z, y: (bh - (y1 - y0) * z) / 2 - y0 * z }
}

// "I'll arrange it myself": one pile per kind on the right of the canvas, stacked top to bottom A, B, C, DE
export function pilesLayout(cards: { kind?: Kind; text: string }[], bw: number, bh: number): { piles: Piles; view: View } {
  const kinds = COLS.filter((k) => cards.some((c) => (c.kind ?? 'A') === k))
  const piles: Piles = {}
  let y = 70
  let most = 1
  for (const k of kinds) {
    const mine = cards.filter((c) => (c.kind ?? 'A') === k)
    piles[k] = { x: 0, y }
    most = Math.max(most, mine.length)
    y += 28 + Math.max(...mine.map((c) => estH(c.text, c.kind))) + 4 * (mine.length - 1) + 40
  }
  const z = Math.max(0.25, Math.min(1, (bh - 30) / y))
  return { piles, view: { z, x: bw - 50 - (CW + 4 * most) * z, y: 10 } }
}
// cards still in a pile lie neatly on top of each other (4 px offset); a card that leaves the pile has `pile` cleared
export function tidyPiles<T extends { piles?: Piles; cards: { kind?: Kind; pile?: Kind; x: number; y: number }[] }>(st: T): T {
  const piles = st.piles
  if (!piles || !st.cards.some((c) => c.pile)) return st
  const n: Partial<Record<Kind, number>> = {}
  return {
    ...st,
    cards: st.cards.map((c) => {
      const o = c.pile && piles[c.pile]
      if (!c.pile || !o) return c
      const i = (n[c.pile] = (n[c.pile] ?? -1) + 1)
      return { ...c, x: o.x + 4 * i, y: o.y + 4 * i }
    }),
  }
}

// --- "Lay it out for me": layered, top to bottom (A, B, C, DE), lines routed so that none cross and none pass through a card ---
type Pt = [number, number]
const orient = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
const crosses = (a: Pt, b: Pt, c: Pt, d: Pt) => orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0 // proper crossings only; touching ends don't count
// does the segment enter the inside of the box (shrunk by 2 px so a line leaving a card's edge doesn't count)?
export function hitsBox(a: Pt, b: Pt, bx: { x: number; y: number; w: number; h: number }) {
  const [x0, y0, x1, y1] = [bx.x + 2, bx.y + 2, bx.x + bx.w - 2, bx.y + bx.h - 2]
  let [t0, t1] = [0, 1]
  const d = [b[0] - a[0], b[1] - a[1]]
  for (const [p, q] of [[-d[0], a[0] - x0], [d[0], x1 - a[0]], [-d[1], a[1] - y0], [d[1], y1 - a[1]]]) {
    if (p === 0) {
      if (q < 0) return false
    } else {
      const t = q / p
      if (p < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
    }
  }
  return t0 < t1
}
const rng = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// --- orthogonal lines: horizontal and vertical runs only ------------------------------------------------------
export type Box = { x: number; y: number; w: number; h: number }
type Side = 'T' | 'B' | 'L' | 'R'
const segs = (p: Pt[]) => p.slice(1).map((q, i): [Pt, Pt] => [p[i], q])
// two axis-parallel runs lying on top of each other (same line within 6 px, sharing more than 1 px of length)
function overlap(a: [Pt, Pt], b: [Pt, Pt]) {
  const [av, bv] = [a[0][0] === a[1][0], b[0][0] === b[1][0]]
  if (av !== bv || (a[0][0] === a[1][0] && a[0][1] === a[1][1]) || (b[0][0] === b[1][0] && b[0][1] === b[1][1])) return false
  const [k, m] = av ? [0, 1] : [1, 0]
  if (Math.abs(a[0][k] - b[0][k]) > 6) return false
  return Math.min(Math.max(a[0][m], a[1][m]), Math.max(b[0][m], b[1][m])) - Math.max(Math.min(a[0][m], a[1][m]), Math.min(b[0][m], b[1][m])) > 1
}
// an end of one run lying on the inside of the other (a T-junction reads as a crossing or a merge)
const touches = (a: [Pt, Pt], b: [Pt, Pt]) => {
  const on = (p: Pt, [q, r]: [Pt, Pt]) => (q[0] === r[0] ? Math.abs(p[0] - q[0]) < 1 && p[1] > Math.min(q[1], r[1]) + 1 && p[1] < Math.max(q[1], r[1]) - 1 : Math.abs(p[1] - q[1]) < 1 && p[0] > Math.min(q[0], r[0]) + 1 && p[0] < Math.max(q[0], r[0]) - 1)
  const perp = (a[0][0] === a[1][0]) !== (b[0][0] === b[1][0])
  return perp && (on(a[0], b) || on(a[1], b) || on(b[0], a) || on(b[1], a))
}
// how a route does against the cards it must avoid and the lines already drawn
export function scoreRoute(pts: Pt[], avoid: Box[], existing: Pt[][]) {
  let [hits, cross, over] = [0, 0, 0]
  const mine = segs(pts)
  for (const [p, q] of mine) for (const b of avoid) if (hitsBox(p, q, b)) hits++
  for (const l of existing)
    for (const t of segs(l))
      for (const m of mine) {
        if (crosses(m[0], m[1], t[0], t[1]) || touches(m, t)) cross++
        else if (overlap(m, t)) over++
      }
  return { hits, cross, over, bad: hits * 1000 + over * 100 + cross * 80 } // a crossing costs more than any reasonable detour
}
const tidy = (p: Pt[]): Pt[] => {
  const q = p.filter((x, i) => i === 0 || x[0] !== p[i - 1][0] || x[1] !== p[i - 1][1])
  return q.filter((x, i) => i === 0 || i === q.length - 1 || !((q[i - 1][0] === x[0] && x[0] === q[i + 1][0]) || (q[i - 1][1] === x[1] && x[1] === q[i + 1][1])))
}
// routes that leave a card straight out to an envelope round every card and line, run along it clockwise or anticlockwise, and come straight in
function aroundAll(a: Box, b: Box, boxes: Box[], existing: Pt[][]): Pt[][] {
  const xs = [...boxes.flatMap((x) => [x.x, x.x + x.w]), ...existing.flat().map((p) => p[0])]
  const ys = [...boxes.flatMap((x) => [x.y, x.y + x.h]), ...existing.flat().map((p) => p[1])]
  const out: Pt[][] = []
  const order: Side[] = ['T', 'R', 'B', 'L'] // clockwise
  for (const pad of [24, 40, 56]) {
    const e = { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad }
    const corner: Record<Side, Pt> = { T: [e.x1, e.y0], R: [e.x1, e.y1], B: [e.x0, e.y1], L: [e.x0, e.y0] } // the corner reached after each side, going clockwise
    const onEdge = (p: Pt, s: Side): Pt => (s === 'T' ? [p[0], e.y0] : s === 'B' ? [p[0], e.y1] : s === 'L' ? [e.x0, p[1]] : [e.x1, p[1]])
    for (const sa of order)
      for (const sb of order) {
        const [pa, pb] = [portAt(a, sa, 0.5), portAt(b, sb, 0.5)]
        const [ea, eb] = [onEdge(pa, sa), onEdge(pb, sb)]
        for (const dir of [1, -1]) {
          const path: Pt[] = [pa, ea]
          let s = sa
          for (let k = 0; k < 4 && s !== sb; k++) {
            path.push(dir === 1 ? corner[s] : corner[order[(order.indexOf(s) + 3) % 4]])
            s = order[(order.indexOf(s) + (dir === 1 ? 1 : 3)) % 4]
          }
          out.push(tidy([...path, eb, pb]))
        }
      }
  }
  return out
}
const portAt = (b: Box, s: Side, f: number): Pt => (s === 'T' ? [b.x + b.w * f, b.y] : s === 'B' ? [b.x + b.w * f, b.y + b.h] : s === 'L' ? [b.x, b.y + b.h * f] : [b.x + b.w, b.y + b.h * f])
// the elbow shapes that leave side sa of one card and arrive at side sb of the other (m: where the middle run sits, shift: pushes it sideways)
function shapes(pa: Pt, sa: Side, pb: Pt, sb: Side, m: number, shift: number, o: { x0: number; y0: number; x1: number; y1: number }): Pt[][] {
  const g = 24
  const [va, vb] = [sa === 'T' || sa === 'B', sb === 'T' || sb === 'B']
  if (va && vb) {
    const [da, db] = [sa === 'B' ? 1 : -1, sb === 'T' ? 1 : -1]
    if (sa !== sb) {
      if ((pb[1] - pa[1]) * da > 8) {
        const ym = pa[1] + (pb[1] - pa[1]) * m + shift
        return [[pa, [pa[0], ym], [pb[0], ym], pb]]
      }
      const [ya, yb] = [pa[1] + da * g, pb[1] - db * g]
      return [o.x0 - g, o.x1 + g].map((xs): Pt[] => [pa, [pa[0], ya], [xs, ya], [xs, yb], [pb[0], yb], pb])
    }
    const yl = da > 0 ? Math.max(pa[1], pb[1]) + g + Math.abs(shift) : Math.min(pa[1], pb[1]) - g - Math.abs(shift)
    return [[pa, [pa[0], yl], [pb[0], yl], pb]]
  }
  if (!va && !vb) {
    const [da, db] = [sa === 'R' ? 1 : -1, sb === 'L' ? 1 : -1]
    if (sa !== sb) {
      if ((pb[0] - pa[0]) * da > 8) {
        const xm = pa[0] + (pb[0] - pa[0]) * m + shift
        return [[pa, [xm, pa[1]], [xm, pb[1]], pb]]
      }
      const [xa, xb] = [pa[0] + da * g, pb[0] - db * g]
      return [o.y0 - g, o.y1 + g].map((ys): Pt[] => [pa, [xa, pa[1]], [xa, ys], [xb, ys], [xb, pb[1]], pb])
    }
    const xl = da > 0 ? Math.max(pa[0], pb[0]) + g + Math.abs(shift) : Math.min(pa[0], pb[0]) - g - Math.abs(shift)
    return [[pa, [xl, pa[1]], [xl, pb[1]], pb]]
  }
  if (va) {
    const ok = (sa === 'B' ? pb[1] > pa[1] + 8 : pb[1] < pa[1] - 8) && (sb === 'L' ? pa[0] < pb[0] - 8 : pa[0] > pb[0] + 8)
    return ok ? [[pa, [pa[0], pb[1]], pb]] : []
  }
  const ok = (sa === 'R' ? pb[0] > pa[0] + 8 : pb[0] < pa[0] - 8) && (sb === 'T' ? pa[1] < pb[1] - 8 : pa[1] > pb[1] + 8)
  return ok ? [[pa, [pb[0], pa[1]], pb]] : []
}
// A line from card a to card b made of horizontal and vertical runs: leaves the middle of a side (a different spot along the side if that
// avoids a clash), never runs through a card (`obstacles`), crosses or lies on top of the fewest existing lines (`existing`).
export function routeOrtho(a: Box, b: Box, obstacles: Box[], existing: Pt[][], fast = false): Pt[] {
  const avoid = [...obstacles, a, b]
  const all = [a, b, ...obstacles]
  const o = { x0: Math.min(...all.map((x) => x.x)), y0: Math.min(...all.map((x) => x.y)), x1: Math.max(...all.map((x) => x.x + x.w)), y1: Math.max(...all.map((x) => x.y + x.h)) }
  const below = b.y > a.y + a.h + 10
  const above = b.y + b.h < a.y - 10
  const pref = below ? 'BT' : above ? 'TB' : b.x + b.w / 2 > a.x + a.w / 2 ? 'RL' : 'LR'
  const sides: Side[] = ['B', 'T', 'L', 'R']
  let best = null as { pts: Pt[]; score: number; bad: number } | null
  for (const fracs of [[0.5], [0.5, 0.25, 0.75]]) {
    const seen = new Set<string>()
    for (const sa of sides)
      for (const sb of sides)
        for (const fa of fracs)
          for (const fb of fracs)
            for (const m of [0.5, 0.3, 0.7, 0.15, 0.85])
              for (const shift of [0, 8, -8, 16, -16]) {
                for (const raw of shapes(portAt(a, sa, fa), sa, portAt(b, sb, fb), sb, m, shift, o)) {
                  const pts = tidy(raw)
                  const key = pts.join()
                  if (seen.has(key)) continue
                  seen.add(key)
                  const sc = scoreRoute(pts, avoid, existing)
                  const len = segs(pts).reduce((t, [p, q]) => t + Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]), 0)
                  const score = sc.bad + len * 0.02 + (sa + sb === pref ? 0 : 40) + pts.length * 3 + Math.abs(shift) * 0.3 + Math.abs(fa - 0.5) * 6 + Math.abs(fb - 0.5) * 6
                  if (!best || score < best.score) best = { pts, score, bad: sc.bad }
                }
              }
    if (fast || (best && best.bad === 0)) break
  }
  // still crossing something: also try going round the outside of everything (cards and lines), either way round
  if (!fast && best && best.bad > 0)
    for (const pts of aroundAll(a, b, all, existing)) {
      const sc = scoreRoute(pts, avoid, existing)
      const len = segs(pts).reduce((t, [p, q]) => t + Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]), 0)
      const score = sc.bad + len * 0.02 + 40 + pts.length * 3
      if (score < best.score) best = { pts, score, bad: sc.bad }
    }
  return best ? best.pts : [[a.x + a.w / 2, a.y + a.h / 2], [b.x + b.w / 2, b.y + b.h / 2]]
}

// "Lay it out for me": one column per story thread. Every A card starts a thread (in message order); the other cards join the thread of the A that
// reaches them with forward lines (fewest lines, then earliest A). Rows A, B, C, DE share the same y across columns. Inside a column a card's forward
// lines are one trunk (down from the middle of its bottom, a bus above the children, a drop into each child); a line that skips a row runs down a
// lane beside the cards of the row it passes. Lines between threads run in the gutter; back lines inside a thread go round the column's outer side.
export function layered(
  cards: { id: string; text: string; kind?: Kind }[],
  edges: { id: string; from: string; to: string }[],
): { pos: Record<string, { x: number; y: number }>; routes: Record<string, Pt[]>; crossings: number; hits: number; overlaps: number; cols: Record<string, number>; between: Record<string, boolean> } {
  const GAP = 44 // between neighbours in a row
  const DW = 36 // width of a lane beside the cards
  const GUT = 240 // between two columns: room for the lanes between threads
  const ids = cards.map((c) => c.id)
  const rankOf = new Map(cards.map((c) => [c.id, rowOf(c.kind)]))
  const hOf = new Map(cards.map((c) => [c.id, estH(c.text, c.kind)]))
  const present = [...new Set(rankOf.values())].sort((a, b) => a - b)
  const R = (id: string) => present.indexOf(rankOf.get(id)!)
  const nRows = Math.max(1, present.length)
  const maxH = Math.max(60, ...hOf.values()) + 12
  const rowY = (r: number) => r * (maxH + 100)
  const ok = edges.filter((e) => rankOf.has(e.from) && rankOf.has(e.to) && e.from !== e.to)
  const fwd = ok.filter((e) => rankOf.get(e.to)! > rankOf.get(e.from)!)

  // --- threads
  const seeds = ids.filter((id) => rankOf.get(id) === 0)
  const thread = new Map<string, number>(seeds.map((id, i) => [id, i]))
  const kids = new Map<string, string[]>()
  const pars = new Map<string, string[]>()
  for (const e of fwd) {
    kids.set(e.from, [...(kids.get(e.from) ?? []), e.to])
    pars.set(e.to, [...(pars.get(e.to) ?? []), e.from])
  }
  const best = new Map<string, { t: number; d: number }>()
  seeds.forEach((a, t) => {
    const seen = new Map([[a, 0]])
    const q = [a]
    for (let i = 0; i < q.length; i++)
      for (const k of kids.get(q[i]) ?? [])
        if (!seen.has(k)) {
          seen.set(k, seen.get(q[i])! + 1)
          q.push(k)
        }
    for (const [id, d] of seen) if (!thread.has(id) && (!best.has(id) || d < best.get(id)!.d)) best.set(id, { t, d })
  })
  for (const [id, b] of best) thread.set(id, b.t)
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false
    for (const id of ids)
      if (!thread.has(id)) {
        const near = [...(kids.get(id) ?? []), ...(pars.get(id) ?? [])].map((k) => thread.get(k)).find((t) => t !== undefined)
        if (near !== undefined) {
          thread.set(id, near)
          changed = true
        }
      }
    if (!changed) break
  }
  for (const id of ids) if (!thread.has(id)) thread.set(id, 0)
  const nCols = Math.max(1, seeds.length)
  const T = (id: string) => thread.get(id)!
  const inCol = fwd.filter((e) => T(e.from) === T(e.to))
  const others = ok.filter((e) => !inCol.includes(e)) // lines between threads, and back lines inside a thread
  const between = Object.fromEntries(ok.map((e) => [e.id, T(e.from) !== T(e.to)]))

  // --- trees: the forward lines of one card inside its column, with a lane (dummy) in each row they skip
  const childrenOf = new Map<string, typeof inCol>()
  for (const e of inCol) childrenOf.set(e.from, [...(childrenOf.get(e.from) ?? []), e])
  const dummies = new Map<string, { row: number; col: number; src: string }>()
  for (const [u, es] of childrenOf) {
    const maxR = Math.max(...es.map((e) => R(e.to)))
    for (let r = R(u) + 1; r < maxR; r++) if (es.some((e) => R(e.to) > r)) dummies.set(`~${u}:${r}`, { row: r, col: T(u), src: u })
  }
  type Group = { key: string; col: number; row: number; items: string[] }
  const groups: Group[] = []
  for (let c = 0; c < nCols; c++)
    for (let r = 0; r < nRows; r++)
      groups.push({ key: `${c}:${r}`, col: c, row: r, items: [...ids.filter((id) => T(id) === c && R(id) === r), ...[...dummies].filter(([, d]) => d.col === c && d.row === r).map(([id]) => id)] })

  // x of every item: left to right in the given order, each as close under its parents as the neighbours allow
  const positions = (order: Map<string, string[]>) => {
    const cx = new Map<string, number>() // inside its column
    const colW: number[] = []
    for (let c = 0; c < nCols; c++) {
      let wMax = 0
      for (let r = 0; r < nRows; r++) {
        let cursor = 0
        for (const id of order.get(`${c}:${r}`) ?? []) {
          const w = dummies.has(id) ? DW : CW
          const d = dummies.get(id)
          const ps = d ? [r - 1 === R(d.src) ? d.src : `~${d.src}:${r - 1}`] : inCol.filter((e) => e.to === id).map((e) => e.from)
          const want = ps.map((p) => cx.get(p)).filter((x): x is number => x !== undefined)
          const mid = want.length ? want.reduce((t, x) => t + x, 0) / want.length : cursor + w / 2
          const left = Math.max(mid - w / 2, cursor)
          cx.set(id, left + w / 2)
          cursor = left + w + GAP
        }
        wMax = Math.max(wMax, cursor - GAP)
      }
      colW.push(wMax)
    }
    const x0 = colW.map((_, c) => colW.slice(0, c).reduce((t, w) => t + w + GUT, 0))
    return { cx: new Map([...cx].map(([id, x]) => [id, x + x0[dummies.has(id) ? dummies.get(id)!.col : T(id)]])), colW, x0 }
  }

  type Out = { pos: Record<string, { x: number; y: number }>; routes: Record<string, Pt[]>; crossings: number; hits: number; overlaps: number; score: number }
  const evaluate = (order: Map<string, string[]>): Out => {
    const { cx, colW, x0 } = positions(order)
    const box = (id: string): Box => ({ x: cx.get(id)! - CW / 2, y: rowY(R(id)), w: CW, h: hOf.get(id)! })
    const boxes = cards.map((c) => box(c.id))
    // fan-in: each line into a card gets its own place along its top, in the order of where it comes from
    const portIn = new Map<string, number>()
    for (const c of cards) {
      const srcs = [...new Set(inCol.filter((e) => e.to === c.id).map((e) => e.from))].sort((a, b) => cx.get(a)! - cx.get(b)!)
      srcs.forEach((u, i) => portIn.set(`${u}>${c.id}`, box(c.id).x + 18 + ((CW - 36) * (i + 1)) / (srcs.length + 1)))
    }
    const routes: Record<string, Pt[]> = {}
    const placed: Pt[][] = []
    const treeSrc: Record<string, string> = {}
    const sources = [...childrenOf.keys()].sort((a, b) => R(a) - R(b) || cx.get(a)! - cx.get(b)!)
    for (const u of sources) {
      const es = childrenOf.get(u)!
      const [bu, r0] = [box(u), R(u)]
      const maxR = Math.max(...es.map((e) => R(e.to)))
      const sx = bu.x + CW / 2
      const build = (e: (typeof es)[number], ys: number[]) => {
        const rv = R(e.to)
        const pts: Pt[] = [[sx, bu.y + bu.h]]
        let cur = sx
        for (let g = r0; g < rv; g++) {
          const tx = g === rv - 1 ? portIn.get(`${u}>${e.to}`)! : cx.get(`~${u}:${g + 1}`)!
          pts.push([cur, ys[g - r0]], [tx, ys[g - r0]])
          cur = tx
        }
        pts.push([cur, rowY(rv)])
        return tidy(pts)
      }
      const track = (g: number, k: number) => rowY(g) + maxH + 12 + k * 8
      const ys: number[] = []
      for (let g = r0; g < maxR; g++) {
        let pick = { y: track(g, 3), v: Infinity }
        for (let k = 0; k < 8; k++) {
          const trial = [...ys, track(g, k)]
          for (let h = g + 1; h < maxR; h++) trial.push(track(h, 3))
          const v = es.filter((e) => R(e.to) > g).reduce((t, e) => t + scoreRoute(build(e, trial), boxes, placed).bad, 0) + Math.abs(k - 3) * 0.01
          if (v < pick.v) pick = { y: track(g, k), v }
        }
        ys.push(pick.y)
      }
      for (const e of es) {
        routes[e.id] = build(e, ys)
        treeSrc[e.id] = u
        placed.push(routes[e.id])
      }
    }
    // lines between threads (in the gutter) and back lines inside a thread (round the column's outer side), shortest first
    const used = new Map<string, number>()
    const nth = (k: string) => used.get(k) ?? 0
    const bump = (k: string) => used.set(k, nth(k) + 1)
    const colRight = (c: number) => x0[c] + colW[c]
    for (const e of [...others].sort((a, b) => Math.abs(R(a.from) - R(a.to)) - Math.abs(R(b.from) - R(b.to)) || (a.id < b.id ? -1 : 1))) {
      const [u, v] = [box(e.from), box(e.to)]
      const [cu, cv] = [T(e.from), T(e.to)]
      const y = (b: Box, id: string, side: string) => b.y + b.h / 2 + Math.min(12 * nth(`${id}:${side}`), b.h / 2 - 8)
      let pts: Pt[]
      if (cu === cv) {
        const side = cu >= nCols / 2 ? 'R' : 'L'
        const k = nth(`${side}${cu}`)
        const lx = side === 'R' ? colRight(cu) + 26 + 20 * k : x0[cu] - 26 - 20 * k
        const [uy, vy] = [y(u, e.from, side), y(v, e.to, side)]
        pts = side === 'R' ? [[u.x + u.w, uy], [lx, uy], [lx, vy], [v.x + v.w, vy]] : [[u.x, uy], [lx, uy], [lx, vy], [v.x, vy]]
        bump(`${side}${cu}`)
        bump(`${e.from}:${side}`)
        bump(`${e.to}:${side}`)
      } else if (Math.abs(cu - cv) === 1) {
        const [lo, right] = [Math.min(cu, cv), cv > cu]
        const k = nth(`g${lo}`)
        const lx = colRight(lo) + 70 + 24 * k
        const [outS, inS] = right ? ['R', 'L'] : ['L', 'R']
        const [uy, vy] = [y(u, e.from, outS), y(v, e.to, inS)]
        const direct: Pt[] = right ? [[u.x + u.w, uy], [lx, uy], [lx, vy], [v.x, vy]] : [[u.x, uy], [lx, uy], [lx, vy], [v.x + v.w, vy]]
        // when the sides of the source are shut in by other lines, the way out is the bottom: down a free slot, under the column, up the gutter
        const yB = rowY(nRows - 1) + maxH + 36 + 20 * nth('under')
        const clear = boxes.map((b, i) => (i === ids.indexOf(e.from) || i === ids.indexOf(e.to) ? b : { x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20 })) // a slot between two cards: keep clear of both
        const under = Array.from({ length: 19 }, (_, i) => 0.05 + i * 0.05).map((f): Pt[] => [[u.x + u.w * f, u.y + u.h], [u.x + u.w * f, yB], [lx, yB], [lx, vy], right ? [v.x, vy] : [v.x + v.w, vy]])
        const cands = [direct, ...under]
        const sc = cands.map((c, i) => scoreRoute(c, i ? clear : boxes, Object.values(routes)).bad)
        const at = sc.indexOf(Math.min(...sc))
        pts = cands[at]
        if (at > 0) bump('under')
        bump(`g${lo}`)
        bump(`${e.from}:${outS}`)
        bump(`${e.to}:${inS}`)
      } else pts = routeOrtho(u, v, boxes.filter((b) => b !== u && b !== v), Object.values(routes))
      routes[e.id] = tidy(pts)
    }
    // count what is left: crossings, runs through a card, runs lying on each other (branches of one trunk may share their start)
    let [crossings, overlaps, hits] = [0, 0, 0]
    const all = Object.entries(routes)
    all.forEach(([ida, ra], i) => {
      hits += scoreRoute(ra, boxes, []).hits
      for (const [idb, rb] of all.slice(i + 1)) {
        const same = treeSrc[ida] !== undefined && treeSrc[ida] === treeSrc[idb]
        for (const m of segs(ra))
          for (const t of segs(rb)) {
            if (crosses(m[0], m[1], t[0], t[1])) crossings++
            else if (!same && touches(m, t)) crossings++
            else if (!same && overlap(m, t)) overlaps++
          }
      }
    })
    const length = all.reduce((t, [, r]) => t + segs(r).reduce((s, [p, q]) => s + Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]), 0), 0)
    const pos = Object.fromEntries(cards.map((c) => [c.id, { x: box(c.id).x, y: box(c.id).y }]))
    return { pos, routes, crossings, hits, overlaps, score: crossings + 100 * overlaps + 1000 * hits + length * 0.0005 }
  }

  // order inside each row: first by where the parents are, then every other order (or a sample of them) is tried; the cleanest layout wins
  const order = new Map(groups.map((g) => [g.key, [...g.items]]))
  for (let r = 1; r < nRows; r++) {
    const { cx } = positions(order)
    for (const g of groups.filter((x) => x.row === r)) {
      const want = (id: string) => {
        const d = dummies.get(id)
        const ps = d ? [r - 1 === R(d.src) ? d.src : `~${d.src}:${r - 1}`] : inCol.filter((e) => e.to === id).map((e) => e.from)
        const xs = ps.map((p) => cx.get(p)).filter((x): x is number => x !== undefined)
        return xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : Infinity
      }
      order.set(g.key, [...g.items].sort((a, b) => want(a) - want(b)))
    }
  }
  const perms = (a: string[]): string[][] => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r])))
  const options = groups.map((g) => ({ key: g.key, list: perms(order.get(g.key)!) }))
  const total = options.reduce((t, o) => t * o.list.length, 1)
  const rand = rng(7)
  let bestOut = evaluate(order)
  for (let n = 0; n < Math.min(total, 600) && bestOut.score >= 1; n++) {
    const pick = new Map(options.map((o) => [o.key, total <= 600 ? o.list[Math.floor(n / options.slice(0, options.indexOf(o)).reduce((t, p) => t * p.list.length, 1)) % o.list.length] : o.list[Math.floor(rand() * o.list.length)]]))
    const o = evaluate(pick)
    if (o.score < bestOut.score) bestOut = o
  }
  const out = bestOut
  // everything at least 40 px from the top-left
  const xs = [...Object.values(out.pos).map((p) => p.x), ...Object.values(out.routes).flat().map((p) => p[0])]
  const ys = [...Object.values(out.pos).map((p) => p.y), ...Object.values(out.routes).flat().map((p) => p[1])]
  const [dx, dy] = [40 - Math.min(...xs, 0), 40 - Math.min(...ys, 0)]
  return {
    pos: Object.fromEntries(Object.entries(out.pos).map(([k, p]) => [k, { x: p.x + dx, y: p.y + dy }])),
    routes: Object.fromEntries(Object.entries(out.routes).map(([k, r]) => [k, r.map(([x, y]): Pt => [x + dx, y + dy])])),
    crossings: out.crossings,
    hits: out.hits,
    overlaps: out.overlaps,
    cols: Object.fromEntries(ids.map((id) => [id, T(id)])),
    between,
  }
}

// --- summary (spec §11): built from the person's cards only ---------------------------------
type SC = { id: string; text: string; kind?: Kind; names?: string[]; stack: string[]; t?: number }
export type Sum = { names: string[]; unnamed: boolean; hasC: boolean; rows: { label: string; text: string }[]; de: string[]; next: string[]; more: number }

export function summaryOf(cards: SC[], edges: { id: string; from: string; to: string }[]): Sum {
  const next = cards.filter((c) => c.kind === 'NEXT').map((c) => c.text)
  const cs = cards.filter((c) => c.kind === 'C')
  const base = { next, more: 0, de: [] as string[], rows: [] as Sum['rows'] }
  const named = (l: SC[]) => [...new Set(l.flatMap((c) => c.names ?? []))]
  if (!edges.length) return { ...base, names: named(cs), unnamed: cs.length > 0 && !named(cs).length, hasC: cs.length > 0 }
  // connected parts (lines read both ways); a candidate holds at least one C
  const part = new Map(cards.map((c) => [c.id, c.id]))
  const root = (a: string): string => (part.get(a) === a ? a : (part.set(a, root(part.get(a)!)), part.get(a)!))
  for (const e of edges) if (part.has(e.from) && part.has(e.to)) part.set(root(e.from), root(e.to))
  const comps = new Map<string, SC[]>()
  for (const c of cards) comps.set(root(c.id), [...(comps.get(root(c.id)) ?? []), c])
  const rank = [...comps.values()]
    .filter((l) => l.some((c) => c.kind === 'C'))
    .map((l) => {
      const ids = new Set(l.map((c) => c.id))
      return {
        l,
        named: l.some((c) => c.kind === 'C' && c.names?.length) ? 1 : 0,
        kinds: new Set(l.map((c) => c.kind).filter(Boolean)).size,
        weight: l.length + l.reduce((n, c) => n + c.stack.length, 0) + edges.filter((e) => ids.has(e.from) && ids.has(e.to)).length,
        t: Math.max(0, ...l.map((c) => c.t ?? 0)),
      }
    })
    .sort((a, b) => b.named - a.named || b.kinds - a.kinds || b.weight - a.weight || b.t - a.t)
  const main = rank[0]
  if (!main) return { ...base, names: [], unnamed: false, hasC: false }
  const inMain = main.l
  const of = (k: Kind) => inMain.filter((c) => c.kind === k)
  const c = of('C').find((x) => x.names?.length) ?? of('C')[0]
  const has = (a: string, b: string) => edges.some((e) => e.from === a && e.to === b)
  const b = of('B').find((x) => has(x.id, c.id)) ?? of('B')[0]
  const a = (b && of('A').find((x) => has(x.id, b.id))) || of('A')[0]
  const rows = [a && { label: 'WHAT HAPPENED', text: a.text }, b && { label: 'WHAT YOU TOLD YOURSELF', text: b.text }, { label: 'WHAT YOU FELT', text: c.text }].filter((x): x is { label: string; text: string } => !!x)
  // every "another way to see it" card on the main line, in chat order (at most 3); none there → the first one anywhere
  const des = of('DE').slice(0, 3).map((x) => x.text)
  const de = des.length ? des : cards.filter((x) => x.kind === 'DE').slice(0, 1).map((x) => x.text)
  return { ...base, names: named(of('C')), unnamed: !named(of('C')).length, hasC: true, rows, de, more: rank.length - 1 }
}
// plain description of what the summary showed, for the back office
export const describe = (s: Sum) =>
  [s.hasC ? (s.unnamed ? 'feeling left unnamed' : `named: ${s.names.join(' · ')}`) : '', ...s.rows.map((r) => `${r.label.toLowerCase()}: ${r.text}`), s.de.length && `another way: ${s.de.join(' / ')}`, s.next.length && `next step: ${s.next.join(' / ')}`, s.more && `${s.more} more on the map`]
    .filter(Boolean)
    .join('. ')

// --- pan and zoom ---------------------------------------------------------------------------
export const zoomAt = (v: View, z: number, cx: number, cy: number): View => {
  const nz = Math.max(0.25, Math.min(2, z))
  return { z: nz, x: cx - ((cx - v.x) * nz) / v.z, y: cy - ((cy - v.y) * nz) / v.z }
}
// a route drawn as straight runs with rounded corners
export function smoothPath(p: [number, number][], r = 8): string {
  if (p.length < 2) return ''
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 1; i < p.length - 1; i++) {
    const [a, b, c] = [p[i - 1], p[i], p[i + 1]]
    const [l1, l2] = [Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, Math.hypot(c[0] - b[0], c[1] - b[1]) || 1]
    const [k1, k2] = [Math.min(r, l1 / 2) / l1, Math.min(r, l2 / 2) / l2]
    d += ` L${b[0] + (a[0] - b[0]) * k1},${b[1] + (a[1] - b[1]) * k1} Q${b[0]},${b[1]} ${b[0] + (c[0] - b[0]) * k2},${b[1] + (c[1] - b[1]) * k2}`
  }
  return `${d} L${p[p.length - 1][0]},${p[p.length - 1][1]}`
}
// the point halfway along a route
export function routeMid(p: [number, number][]): { x: number; y: number } {
  const len = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1]))
  let half = len.reduce((t, l) => t + l, 0) / 2
  for (let i = 0; i < len.length; i++) {
    if (half <= len[i]) return { x: p[i][0] + ((p[i + 1][0] - p[i][0]) * half) / (len[i] || 1), y: p[i][1] + ((p[i + 1][1] - p[i][1]) * half) / (len[i] || 1) }
    half -= len[i]
  }
  return { x: p[0][0], y: p[0][1] }
}

// where a new card goes when it will be joined to `src` by an orthogonal line: the first spot (below, left, right, then further out)
// where the card overlaps no card and the line to it crosses no card and no existing line (`lines` = polylines of the existing lines)
export function freeSpotLinked(
  boxes: { x: number; y: number; h: number }[],
  lines: Pt[][],
  src: { x: number; y: number; h: number },
  w = 180,
  nh = 100,
): { x: number; y: number } {
  const g = 50
  const sb: Box = { x: src.x, y: src.y, w, h: src.h }
  const others: Box[] = boxes.filter((b) => b.x !== src.x || b.y !== src.y).map((b) => ({ x: b.x, y: b.y, w, h: b.h }))
  const overlaps = (cx: number, cy: number) => boxes.some((b) => cx < b.x + w + 16 && cx + w + 16 > b.x && cy < b.y + b.h + 16 && cy + nh + 16 > b.y)
  // the line that will join them is orthogonal: it must run through no card and cross or lie on no other line, and no line runs through the new card
  const clean = (cx: number, cy: number) => {
    const nb: Box = { x: cx, y: cy, w, h: nh }
    if (lines.some((l) => l.some((_, i) => i + 1 < l.length && hitsBox(l[i], l[i + 1], nb)))) return false
    return scoreRoute(routeOrtho(sb, nb, others, lines), [...others], lines).bad === 0
  }
  let first: { x: number; y: number } | null = null
  for (let r = 1; r <= 8; r++) {
    const [dx, dy] = [(w + g) * r, src.h + g * r]
    for (const [cx, cy] of [[src.x, src.y + dy], [src.x - dx, src.y], [src.x + dx, src.y], [src.x - dx, src.y + dy], [src.x + dx, src.y + dy], [src.x, src.y - nh - g * r], [src.x - dx, src.y - nh - g * r], [src.x + dx, src.y - nh - g * r]]) {
      if (overlaps(cx, cy)) continue
      first ??= { x: cx, y: cy }
      if (clean(cx, cy)) return { x: cx, y: cy }
    }
  }
  return first ?? { x: src.x, y: src.y + src.h + 400 }
}
