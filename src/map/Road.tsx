// Draws the road (geometry in road.ts): every piece is a thick stroke with its own gradient, dim → bright in the direction of travel.
// A piece waiting for a yes gets a swell on top: one broad, soft crest of light that rolls slowly along the road. The crest is a dashed copy of
// the road's own path (so it follows corners and arcs), a fixed size in px on every piece, blurred for soft ends and masked to the road's width (drawn much wider than the road, so the blur does not thin the light out; the mask cuts it back).
// It is moved by a timer that changes stroke-dashoffset (a timer keeps running in panes the browser treats as hidden).
import { useEffect, useRef } from 'react'
import { BRIGHT, DIM, ROAD_W, type Seg } from './road.ts'

const CREST = 360 // px of soft light: the same on every piece, however short or long
const GAP = 6000 // px after the crest before the pattern repeats: longer than any piece, so there is only ever one crest on a piece
const PASS = 7000 // ms for the crest to travel the piece
const CYCLE = 8500 // ms between starts of a pass (a short rest in between)
const ease = (t: number) => t * t * (3 - 2 * t) // slow in, slow out
const MID = '#7A736B' // the waiting road's bright end: gently brighter than the dim end, so the direction still reads
const PEAK = '#E9E3DA' // the crest
const PAD = 180 // room round a piece for the blur
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function Road({ segs }: { segs: Seg[] }) {
  const root = useRef<SVGGElement>(null)
  const waiting = segs.some((s) => s.state === 'flow')
  useEffect(() => {
    const g = root.current
    if (!g || !waiting) return
    // the filter and mask areas follow each waiting piece (a straight piece has a zero-width box, so they are set in user space)
    g.querySelectorAll<SVGPathElement>('path.flow[data-seg]').forEach((p) => {
      const bb = p.getBBox()
      for (const el of g.querySelectorAll(`[data-area="${p.dataset.seg}"]`))
        for (const [k, v] of [['x', bb.x - PAD], ['y', bb.y - PAD], ['width', bb.width + 2 * PAD], ['height', bb.height + 2 * PAD]]) el.setAttribute(k as string, String(v))
    })
    const waves = [...g.querySelectorAll<SVGPathElement>('path.wave')].map((w) => ({ w, len: g.querySelector<SVGPathElement>(`path.flow[data-seg="${w.dataset.for}"]`)?.getTotalLength() ?? 0 }))
    // pos = where the crest starts along the piece: from fully before it to fully past it
    const move = (k: number) => waves.forEach(({ w, len }) => w.setAttribute('stroke-dashoffset', String(CREST - (len + CREST) * k)))
    if (reduced()) return move(0.5) // still: one soft swell, mid-piece
    const tick = () => move(ease(Math.min(1, ((performance.now() % CYCLE) / PASS))))
    tick()
    const t = setInterval(tick, 40)
    return () => clearInterval(t)
  })
  return (
    <g className="tm-road" ref={root}>
      <defs>
        {segs.map((s) => {
          const [a, b] = [s.geo.a, s.geo.b]
          const box = { x: Math.min(a[0], b[0]) - PAD, y: Math.min(a[1], b[1]) - PAD, width: Math.abs(a[0] - b[0]) + 2 * PAD, height: Math.abs(a[1] - b[1]) + 2 * PAD }
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
              {s.state === 'flow' && (
                <>
                  <filter id={`tm-f-${s.key}`} filterUnits="userSpaceOnUse" data-area={s.key} {...box}>
                    <feGaussianBlur stdDeviation="55" />
                  </filter>
                  <mask id={`tm-m-${s.key}`} maskUnits="userSpaceOnUse" data-area={s.key} {...box}>
                    <path d={s.geo.d} fill="none" stroke="#fff" strokeWidth={ROAD_W} />
                  </mask>
                </>
              )}
            </g>
          )
        })}
      </defs>
      {segs.map((s) => (
        <g key={s.key}>
          <path data-seg={s.key} d={s.geo.d} pathLength={1} className={s.state} stroke={`url(#tm-g-${s.key})`} />
          {s.state === 'flow' && (
            <g mask={`url(#tm-m-${s.key})`}>
              <path d={s.geo.d} className="wave" style={{ strokeWidth: 220 }} stroke={PEAK} strokeOpacity="0.9" strokeDasharray={`${CREST} ${GAP}`} data-for={s.key} filter={`url(#tm-f-${s.key})`} />
            </g>
          )}
        </g>
      ))}
    </g>
  )
}
