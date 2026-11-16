// Draws the road (geometry in road.ts): every piece is a thick stroke with its own gradient, dim → bright in the direction of travel.
// A piece waiting for a yes is the same road, with a gentler bright end (dim → MID) so it reads as not yet confirmed. All of it is static.
import { BRIGHT, DIM, type Seg } from './road.ts'

const MID = '#7A736B' // the waiting road's bright end: gently brighter than the dim end, so the direction still reads

export function Road({ segs }: { segs: Seg[] }) {
  return (
    <g className="tm-road">
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
        </g>
      ))}
    </g>
  )
}
