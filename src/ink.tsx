import { forwardRef, useEffect, useRef } from 'react'

// Organic threads: wobbly loops that tumble in 3D at different rates, so they wind around each other.
const THREADS = [
  { r: 40, k: [2, 3], a: [0.16, 0.07], spin: 0.09, tumble: 0.23, phase: 0, dashed: false },
  { r: 35, k: [3, 5], a: [0.13, 0.06], spin: -0.07, tumble: 0.17, phase: 2.1, dashed: false },
  { r: 29, k: [2, 4], a: [0.2, 0.05], spin: 0.05, tumble: -0.29, phase: 4.2, dashed: true },
]
const N = 72

function threadPath(t: number, th: (typeof THREADS)[number]) {
  const rot = th.phase + t * th.spin
  const squash = 0.25 + 0.75 * Math.abs(Math.cos(th.phase + t * th.tumble)) // ring turning edge-on and back
  let d = ''
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    const r = th.r * (1 + th.a[0] * Math.sin(th.k[0] * a + t * 0.5 + th.phase) + th.a[1] * Math.sin(th.k[1] * a - t * 0.37 + th.phase * 1.3))
    const x = r * Math.cos(a)
    const y = r * Math.sin(a) * squash
    d += `${i ? 'L' : 'M'}${(x * Math.cos(rot) - y * Math.sin(rot)).toFixed(2)} ${(x * Math.sin(rot) + y * Math.cos(rot)).toFixed(2)}`
  }
  return d + 'Z'
}

function Threads({ speed, still }: { speed: number; still: boolean }) {
  const paths = useRef<(SVGPathElement | null)[]>([])
  const speedRef = useRef(speed)
  speedRef.current = speed
  useEffect(() => {
    const draw = (t: number) => THREADS.forEach((th, i) => paths.current[i]?.setAttribute('d', threadPath(t, th)))
    draw(0) // first frame right away, even before (or without) requestAnimationFrame
    if (still) return
    let raf = 0
    let t = 0
    let last = performance.now()
    const tick = (now: number) => {
      const sp = Number.isFinite(speedRef.current) ? speedRef.current : 1 // stale state must not poison t with NaN
      t += (Math.max(0, now - last) / 1000) * sp
      last = now
      draw(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [still])
  return (
    <svg className="lines" viewBox="-50 -50 100 100">
      {THREADS.map((th, i) => (
        <path key={i} ref={(el) => void (paths.current[i] = el)} strokeDasharray={th.dashed ? '1.2 2.6' : undefined} />
      ))}
    </svg>
  )
}

// Outer div is moved (translate), inner div is scaled/faded; the body breathes via CSS.
export const InkDot = forwardRef<HTMLDivElement, { scalerRef: React.Ref<HTMLDivElement>; grain: number; threadSpeed: number; still: boolean }>(
  function InkDot({ scalerRef, grain, threadSpeed, still }, ref) {
    return (
      <div className="ink" ref={ref} aria-hidden>
        <div className="ink-scale" ref={scalerRef}>
          <div className="ink-body">
            <div className="glow g0" />
            <div className="glow g1" />
            <div className="glow g2" />
            <svg className="grain" viewBox="0 0 100 100" preserveAspectRatio="none">
              <filter id="noise">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              </filter>
              <rect width="100" height="100" filter="url(#noise)" opacity={grain} />
            </svg>
            <Threads speed={threadSpeed} still={still} />
          </div>
        </div>
      </div>
    )
  },
)
