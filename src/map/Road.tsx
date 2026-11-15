// Draws the road (geometry in road.ts): every piece is a thick stroke with its own gradient, dim → bright in the direction of travel.
import { BRIGHT, DIM, type Seg } from './road.ts'

export function Road({ segs }: { segs: Seg[] }) {
  return (
    <g className="tm-road">
      <defs>
        {segs.map((s) => (
          <linearGradient key={s.key} id={`tm-g-${s.key}`} gradientUnits="userSpaceOnUse" x1={s.geo.a[0]} y1={s.geo.a[1]} x2={s.geo.b[0]} y2={s.geo.b[1]}>
            {s.state === 'in' ? (
              <>
                <stop offset="0" stopColor={BRIGHT} stopOpacity="0" />
                <stop offset="1" stopColor={BRIGHT} stopOpacity="0.55" />
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
        ))}
      </defs>
      {segs.map((s) => (
        <path key={s.key} d={s.geo.d} className={s.state} stroke={`url(#tm-g-${s.key})`} />
      ))}
    </g>
  )
}
