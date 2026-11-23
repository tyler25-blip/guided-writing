// Where the joins go (plain geometry, drawn by Links.tsx): the arrow between two cards next to each other, and the band round the ring.
import type { Round } from './flow.ts'
import type { Box } from './place.ts'

export type LinkState = 'kept' | 'waiting' | 'cut'
export type Arrow = { key: string; to: string; from: Box; at: Box; state: LinkState; insets?: [number, number] } // insets: how far in from each card's corner its shape starts
export type Head = { x: number; y: number; deg: number } // an arrowhead: its point, and which way it faces (degrees; 0 = down, clockwise)
export type Band = { key: string; to: string; d: string; state: LinkState; head?: Head }

export const AW = 22 // the arrow: 22px wide at its base, 20px from base to point (the Figma reference is about 25 × 22 on a card a little smaller)
export const AH = 20
const DEPTH = 8 // when two cards sit close (no room in the gap), how far the point reaches into the card it points at

// where a candidate notch lies on a side: the middle, or for a wide side also each cell's middle
const notchesOn = (from: number, len: number) => (len > 300 ? [from + len / 2, from + len / 4, from + (3 * len) / 4] : [from + len / 2])

// the arrow's point and which way it faces (degrees; 0 = down, clockwise) for a line from box a to box b
export function arrowAt(a: Box, b: Box, [ia, ib]: [number, number] = [0, 0]): { x: number; y: number; deg: number } {
  const [ox0, ox1] = [Math.max(a.x, b.x), Math.min(a.x + a.w, b.x + b.w)]
  const [oy0, oy1] = [Math.max(a.y, b.y), Math.min(a.y + a.h, b.y + b.h)]
  const pick = (cands: number[], lo: number, hi: number) => {
    const mid = (lo + hi) / 2
    const inside = cands.filter((c) => c >= lo + 20 && c <= hi - 20)
    return inside.length ? inside.reduce((p, c) => (Math.abs(c - mid) < Math.abs(p - mid) ? c : p)) : mid
  }
  // the point: in the middle of a wide gap (the arrow floats between the cards), or just inside the next card when they sit close
  const tip = (gap: number, edge: number, s: number) => (gap >= AH + 8 ? edge - s * (gap - AH) / 2 : edge + s * DEPTH)
  if (ox1 - ox0 > 40) {
    const x = pick(notchesOn(b.x, b.w), ox0, ox1)
    if (b.y >= a.y + a.h - 1) return { x, y: tip(b.y - a.y - a.h, b.y, 1), deg: 0 }
    if (b.y + b.h <= a.y + 1) return { x, y: tip(a.y - b.y - b.h, b.y + b.h, -1), deg: 180 }
  }
  if (oy1 - oy0 > 40) {
    const y = pick(notchesOn(b.y, b.h), oy0, oy1)
    if (b.x >= a.x + a.w - 1) return { x: tip(b.x - a.x - a.w, b.x, 1), y, deg: -90 }
    if (b.x + b.w <= a.x + 1) return { x: tip(a.x - b.x - b.w, b.x + b.w, -1), y, deg: 90 }
  }
  // neither above nor beside (b lies off a corner): the arrow sits in the gap between the two facing corners and points along the diagonal
  const sx = b.x + b.w / 2 >= a.x + a.w / 2 ? 1 : -1
  const sy = b.y + b.h / 2 >= a.y + a.h / 2 ? 1 : -1
  // the corners as you see them: each shape starts some way in from its box's corner
  const [ka, kb] = [ia / Math.SQRT2, ib / Math.SQRT2]
  const ac = { x: sx > 0 ? a.x + a.w - ka : a.x + ka, y: sy > 0 ? a.y + a.h - ka : a.y + ka }
  const bc = { x: sx > 0 ? b.x + kb : b.x + b.w - kb, y: sy > 0 ? b.y + kb : b.y + b.h - kb }
  const k = AH / 2 / Math.SQRT2 // the point is half the arrow's length past the middle of the gap
  return { x: (ac.x + bc.x) / 2 + sx * k, y: (ac.y + bc.y) / 2 + sy * k, deg: sy > 0 ? (sx > 0 ? -45 : 45) : sx > 0 ? -135 : 135 }
}

// the stretch of the ring's circle between card a and card b (as angles, clockwise unless the ring is flipped), stopping short of both cards (Figma: the ring's gaps)
export function bandAngles(rd: Round, a: Box, b: Box, pad = 16): [number, number] | null {
  const ang = (q: Box) => Math.atan2(q.y + q.h / 2 - rd.cy, q.x + q.w / 2 - rd.cx)
  const dir = rd.ccw ? -1 : 1
  const a0 = ang(a)
  let a1 = ang(b)
  while (dir * (a1 - a0) <= 1e-3) a1 += dir * 2 * Math.PI
  const at = (t: number) => [rd.cx + rd.r * Math.cos(t), rd.cy + rd.r * Math.sin(t)]
  const inside = (q: Box, t: number) => {
    const [x, y] = at(t)
    return x > q.x - pad && x < q.x + q.w + pad && y > q.y - pad && y < q.y + q.h + pad
  }
  let [v0, v1] = [a0, a1]
  while (dir * (v1 - v0) > 0 && inside(a, v0)) v0 += dir * 0.005
  while (dir * (v1 - v0) > 0 && inside(b, v1)) v1 -= dir * 0.005
  return dir * (v1 - v0) <= 0.02 ? null : [v0, v1]
}
// the band round the ring from card a to card b: along the circle, stopping short of both cards
export function bandD(rd: Round, a: Box, b: Box, pad = 16): string {
  const v = bandAngles(rd, a, b, pad)
  if (!v) return ''
  const at = (t: number) => [rd.cx + rd.r * Math.cos(t), rd.cy + rd.r * Math.sin(t)]
  const [p0, p1] = [at(v[0]), at(v[1])]
  return `M${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${rd.r},${rd.r} 0 ${Math.abs(v[1] - v[0]) > Math.PI ? 1 : 0} ${rd.ccw ? 0 : 1} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`
}

// the middle of the gap between two cards: half-way between the two facing edges, along the line joining their centres (gap < 0 when they touch or overlap)
export function gapMid(a: Box, b: Box): { x: number; y: number; gap: number } {
  const [ac, bc] = [{ x: a.x + a.w / 2, y: a.y + a.h / 2 }, { x: b.x + b.w / 2, y: b.y + b.h / 2 }]
  const d = Math.hypot(bc.x - ac.x, bc.y - ac.y) || 1
  const [ux, uy] = [(bc.x - ac.x) / d, (bc.y - ac.y) / d]
  const out = (q: Box) => Math.min(ux ? q.w / 2 / Math.abs(ux) : Infinity, uy ? q.h / 2 / Math.abs(uy) : Infinity) // from a card's centre to its edge along the line
  const [ta, tb] = [out(a), d - out(b)]
  const m = (ta + tb) / 2
  return { x: ac.x + ux * m, y: ac.y + uy * m, gap: tb - ta }
}

// a line round the ring from card a to card b: the band along the circle, and the arrowhead ON it, at the middle of the visible stretch between the two cards,
// tangent to the ring there and pointing from a to b (head = its point; the arrow's middle is on the circle)
export function ringJoin(rd: Round, a: Box, b: Box, pad = 16): { d: string; head: Head } {
  const v = bandAngles(rd, a, b, pad)
  const dir = rd.ccw ? -1 : 1
  const phi = v ? (v[0] + v[1]) / 2 : Math.atan2((a.y + b.y + (a.h + b.h) / 2) / 2 - rd.cy, (a.x + b.x + (a.w + b.w) / 2) / 2 - rd.cx)
  const [tx, ty] = [-Math.sin(phi) * dir, Math.cos(phi) * dir]
  const [mx, my] = [rd.cx + rd.r * Math.cos(phi), rd.cy + rd.r * Math.sin(phi)]
  return { d: bandD(rd, a, b, pad), head: { x: mx + (tx * AH) / 2, y: my + (ty * AH) / 2, deg: (Math.atan2(-tx, ty) * 180) / Math.PI } }
}
