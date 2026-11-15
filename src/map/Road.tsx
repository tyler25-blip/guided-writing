// Draws the road (geometry in road.ts): every piece is a thick stroke with its own gradient, dim → bright in the direction of travel.
// A piece waiting for a yes is solid like the rest, but one wide soft band keeps travelling along it from its dim end to its bright end.
// The band is moved by changing the gradient's stop offsets from a timer (SMIL did not work in every browser).
import { useEffect, useRef } from 'react'
import { BRIGHT, DIM, type Seg } from './road.ts'

const CYCLE = 4000 // ms for the band to cross a piece
const BASE = [0x3a, 0x33, 0x2e] // the dim road
const PEAK = [0xe9, 0xe3, 0xda] // the brightest the band gets (gently brighter than the base)
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const KS = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1] // across the band, edge to edge
const W = 0.28 // half the band, as a share of the piece: one wide band (~56%), never two at once
const hex = (m: number) => '#' + BASE.map((b, i) => Math.round(b + (PEAK[i] - b) * m).toString(16).padStart(2, '0')).join('')
// the stops for a band centred at p: a long, soft (cosine) falloff on both sides, base colour outside
const stops = (p: number): { o: number; c: string }[] => [{ o: 0, c: hex(0) }, ...KS.map((k) => ({ o: clamp(p + k * W), c: hex(0.5 * (1 + Math.cos(Math.PI * k))) })), { o: 1, c: hex(0) }]
const ease = (t: number) => t * t * (3 - 2 * t) // slow in, slow out

export function Road({ segs }: { segs: Seg[] }) {
  const root = useRef<SVGGElement>(null)
  const waiting = segs.some((s) => s.state === 'flow')
  useEffect(() => {
    const g = root.current
    if (!g || !waiting) return
    const move = (p: number) => {
      const st = stops(p)
      g.querySelectorAll<SVGLinearGradientElement>('linearGradient[data-flow]').forEach((lg) =>
        lg.querySelectorAll('stop').forEach((el, i) => (el.setAttribute('offset', String(st[i].o)), el.setAttribute('stop-color', st[i].c))),
      )
    }
    if (reduced()) return move(0.6) // still: the band rests near the bright end
    // a timer rather than requestAnimationFrame: it keeps running in panes the browser treats as hidden, and ~25 fps is plenty for a slow band
    const tick = () => move(-W + (1 + 2 * W) * ease((performance.now() % CYCLE) / CYCLE)) // from before the dim end to past the bright end
    tick()
    const t = setInterval(tick, 40)
    return () => clearInterval(t)
  })
  return (
    <g className="tm-road" ref={root}>
      <defs>
        {segs.map((s) => {
          const [a, b] = [s.geo.a, s.geo.b]
          if (s.state === 'flow')
            return (
              <linearGradient key={s.key} id={`tm-g-${s.key}`} gradientUnits="userSpaceOnUse" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} data-flow="1">
                {stops(0).map((_, i) => (
                  <stop key={i} stopColor={DIM} />
                ))}
              </linearGradient>
            )
          return (
            <linearGradient key={s.key} id={`tm-g-${s.key}`} gradientUnits="userSpaceOnUse" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}>
              {s.state === 'in' ? (
                <>
                  <stop offset="0" stopColor={BRIGHT} stopOpacity="0" />
                  <stop offset="1" stopColor={BRIGHT} stopOpacity="0.6" />
                </>
              ) : s.state === 'out' ? (
                <>
                  <stop offset="0" stopColor={BRIGHT} stopOpacity="0.9" />
                  <stop offset="1" stopColor={BRIGHT} stopOpacity="0" />
                </>
              ) : (
                <>
                  <stop offset="0" stopColor={DIM} />
                  <stop offset="1" stopColor={BRIGHT} />
                </>
              )}
            </linearGradient>
          )
        })}
      </defs>
      {segs.map((s) => (
        <path key={s.key} data-seg={s.key} d={s.geo.d} pathLength={1} className={s.state} stroke={`url(#tm-g-${s.key})`} />
      ))}
    </g>
  )
}
