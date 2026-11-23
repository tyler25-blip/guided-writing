// Where the joins go (plain geometry, drawn by Links.tsx): the arrow between two cards next to each other, and the band round the ring.
import type { Round } from './flow.ts'
import type { Box } from './place.ts'

export type LinkState = 'kept' | 'waiting' | 'cut'
export type Arrow = { key: string; to: string; from: Box; at: Box; state: LinkState; insets?: [number, number] } // insets: how far in from each card's corner its shape starts
export type Band = { key: string; to: string; d: string; state: LinkState }

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

// the band round the ring from card a to card b: along the circle, stopping short of both cards (Figma: the ring's gaps)
export function bandD(rd: Round, a: Box, b: Box, pad = 16): string {
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
  if (dir * (v1 - v0) <= 0.02) return ''
  const [p0, p1] = [at(v0), at(v1)]
  return `M${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${rd.r},${rd.r} 0 ${Math.abs(v1 - v0) > Math.PI ? 1 : 0} ${rd.ccw ? 0 : 1} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`
}

