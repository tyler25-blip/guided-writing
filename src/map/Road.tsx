// Draws the road (geometry in road.ts): every piece is a thick stroke with its own gradient, dim → bright in the direction of travel.
// A piece waiting for a yes is solid like the rest, but a bright band keeps travelling along it from its dim end to its bright end.
// The band is moved by changing the gradient's stop offsets from a timer (SMIL did not work in every browser).
import { useEffect, useRef } from 'react'
import { BRIGHT, DIM, type Seg } from './road.ts'

const CYCLE = 2000 // ms for the band to cross a piece
const BAND = 70 // px, half the width of the band
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (n: number) => Math.max(0, Math.min(1, n))
// stop offsets for a band centred at p (0..1 along the piece), half-width w
const band = (p: number, w: number): number[] => [0, clamp(p - w), clamp(p), clamp(p + w), 1]

export function Road({ segs }: { segs: Seg[] }) {
  const root = useRef<SVGGElement>(null)
  const waiting = segs.some((s) => s.state === 'flow')
  useEffect(() => {
    const g = root.current
    if (!g || !waiting) return
    const move = (p: number) =>
      g.querySelectorAll<SVGLinearGradientElement>('linearGradient[data-flow]').forEach((lg) => {
        const w = Number(lg.dataset.w)
        lg.querySelectorAll('stop').forEach((st, i) => st.setAttribute('offset', String(band(p, w)[i])))
      })
    if (reduced()) return move(0.6) // still: the band rests near the bright end
    // a timer rather than requestAnimationFrame: it keeps running in panes the browser treats as hidden, and ~25 fps is plenty for a slow band
    const tick = () => move(-0.3 + 1.6 * ((performance.now() % CYCLE) / CYCLE)) // from before the dim end to past the bright end
    tick()
    const t = setInterval(tick, 40)
    return () => clearInterval(t)
  })
  return (
    <g className="tm-road" ref={root}>
      <defs>
        {segs.map((s) => {
          const [a, b] = [s.geo.a, s.geo.b]
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
          if (s.state === 'flow')
            return (
              <linearGradient key={s.key} id={`tm-g-${s.key}`} gradientUnits="userSpaceOnUse" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} data-flow="1" data-w={Math.min(0.5, BAND / len)}>
                <stop stopColor={DIM} />
                <stop stopColor={DIM} />
                <stop stopColor={BRIGHT} />
                <stop stopColor={DIM} />
                <stop stopColor={DIM} />
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
