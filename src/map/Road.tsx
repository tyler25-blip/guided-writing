// Draws the road (geometry in road.ts): every piece is a thick stroke with its own gradient, dim → bright in the direction of travel.
// A piece waiting for a yes is the same road, with a gentler bright end (dim → MID) so it reads as not yet confirmed; it stays still.
// The confirmed road carries a slow current: soft bands of light that keep moving along it in the direction of travel. Each band is a stack of
// dashed copies of the piece's own path (so it follows corners and arcs), shorter ones on top, which gives it soft ends without a blur.
// The pattern is measured in px from the start of the road (`order`), so a band carries on from one piece into the next.
// It is moved by a timer that changes stroke-dashoffset (a timer keeps running in panes the browser treats as hidden). Off with reduced motion.
import { useEffect, useRef } from 'react'
import { BRIGHT, DIM, type Seg } from './road.ts'

const MID = '#7A736B' // the waiting road's bright end: gently brighter than the dim end, so the direction still reads
const PERIOD = 720 // px from one band to the next
const BAND = 280 // px of light in one band, soft ends included
const LAYERS = 8 // dashes stacked per band: the more, the smoother its ends
const ALPHA = 0.13 // each layer's opacity: about 0.67 in the middle of a band
const SPEED = 110 // px per second
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const layers = Array.from({ length: LAYERS }, (_, k) => (BAND * (k + 1)) / LAYERS)

export function Road({ segs, order = [] }: { segs: Seg[]; order?: string[] }) {
  const root = useRef<SVGGElement>(null)
  const calm = reduced()
  const lit = segs.filter((s) => s.state === 'road')
  const key = lit.map((s) => s.key + s.geo.d).join('|') + order.join('|')
  useEffect(() => {
    const g = root.current
    if (!g || calm || !lit.length) return
    // where each piece starts along the road (pieces off the road's one path start at 0)
    const start: Record<string, number> = {}
    let run = 0
    for (const k of order) {
      const p = g.querySelector<SVGPathElement>(`path[data-seg="${k}"]`)
      start[k] ??= run // a piece that comes up twice keeps its first place
      run += p?.getTotalLength() ?? 0
    }
    const glints = [...g.querySelectorAll<SVGPathElement>('path.glint')].map((w) => ({ w, at: (start[w.dataset.for!] ?? 0) - (BAND - Number(w.dataset.len)) / 2 }))
    const tick = () => {
      const moved = ((performance.now() / 1000) * SPEED) % PERIOD
      glints.forEach(({ w, at }) => w.setAttribute('stroke-dashoffset', String(at - moved)))
    }
    tick()
    const t = setInterval(tick, 33)
    return () => clearInterval(t)
  }, [key, calm]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <g className="tm-road" ref={root}>
      <defs>
        {segs.map((s) => {
          const [a, b] = [s.geo.a, s.geo.b]
          return (
            <g key={s.key}>
              <linearGradient id={`tm-g-${s.key}`} gradientUnits="userSpaceOnUse" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}>
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
                    <stop offset="1" stopColor={s.state === 'flow' ? MID : BRIGHT} />
                  </>
                )}
              </linearGradient>
            </g>
          )
        })}
      </defs>
      {segs.map((s) => (
        <g key={s.key}>
          <path data-seg={s.key} d={s.geo.d} pathLength={1} className={s.state} stroke={`url(#tm-g-${s.key})`} />
          {s.state === 'road' && !calm && (
            <g className="tm-current">
              {layers.map((len) => (
                <path key={len} className="glint" d={s.geo.d} stroke={BRIGHT} strokeOpacity={ALPHA} strokeDasharray={`${len} ${PERIOD - len}`} data-for={s.key} data-len={len} />
              ))}
            </g>
          )}
        </g>
      ))}
    </g>
  )
}
