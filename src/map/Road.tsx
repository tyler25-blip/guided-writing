// Draws the road (geometry in road.ts): every piece is a thick stroke with its own gradient, dim → bright in the direction of travel.
// A piece waiting for a yes is solid like the rest, but its gradient slowly flows toward the bright end.
import { BRIGHT, DIM, type Seg } from './road.ts'

const PERIOD = 100 // px along the line for one wave of the flowing gradient
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function Road({ segs }: { segs: Seg[] }) {
  const still = reduced()
  return (
    <g className="tm-road">
      <defs>
        {segs.map((s) => {
          const [a, b] = [s.geo.a, s.geo.b]
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
          const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
          if (s.state === 'flow')
            // repeating ramp, shifted by exactly one period over and over: the light part moves toward the end of the line
            return (
              <linearGradient key={s.key} id={`tm-g-${s.key}`} gradientUnits="userSpaceOnUse" spreadMethod="repeat" x1={a[0]} y1={a[1]} x2={a[0] + ux * PERIOD} y2={a[1] + uy * PERIOD}>
                <stop offset="0" stopColor={DIM} />
                <stop offset="0.8" stopColor={BRIGHT} />
                <stop offset="1" stopColor={DIM} />
                {!still && <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to={`${ux * PERIOD} ${uy * PERIOD}`} dur="2.4s" repeatCount="indefinite" />}
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
