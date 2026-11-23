// The shape behind a card (Figma: Thought card, 252px cells). Built from the same circles and rectangles as the Figma variants; one fill, so the
// overlaps read as one shape. Told myself and Felt have a notch cut into each side (where an arrow's point sits).
import { useId } from 'react'
import { CELL, type Kind } from './place.ts'

export type Size = '1x1' | '2x1' | '2x2'
type Circle = [x: number, y: number, d: number]
type Rect = [x: number, y: number, w: number, h: number, r: number]
type Spec = { c: Circle[]; r: Rect[]; notch?: Rect }

const sizeOf = (w: number, h: number): Size => (h > CELL ? '2x2' : w > CELL ? '2x1' : '1x1')

function spec(kind: Kind | undefined, size: Size): Spec {
  const two = size !== '1x1'
  if (kind === 'NEXT') {
    const d = 163.33
    const at = [[163.33, 0], [0, 163.33], [44.72, 272.22], [44.72, 54.44], [280, 54.44], [163.33, 163.33], [163.33, 326.67], [326.67, 163.33], [301.39, 256.67]]
    return { c: at.map(([x, y]) => [x + 7, y + 7, d] as Circle), r: [[88.67, 88.67, 340.28, 326.67, 0]] }
  }
  if (kind === 'A') {
    const c: Circle[] = []
    for (let i = 0; i < (two ? 6 : 3); i++) for (let j = 0; j < 3; j++) c.push([i * 84, j * 84, 84])
    return { c, r: [[42, 42, two ? 420 : 175, 168, 0]] }
  }
  if (kind === 'DE') {
    const c: Circle[] = []
    for (let i = 0; i < (two ? 4 : 2); i++) for (let j = 0; j < 2; j++) c.push([i * 126, j * 126, 126])
    for (let i = 0; i < (two ? 3 : 1); i++) c.push([86 + i * 126, 84, 84])
    return { c, r: [[44, 42, two ? 420 : 168, 168, 0]] }
  }
  if (kind === 'C') {
    const r: Rect = two ? [5, 5, 494, 242, 121] : [5, 5, 242, 242, 121]
    return { c: [], r: [r], notch: r }
  }
  // Told myself (and a card with no kind yet): a rounded square
  const r: Rect = two ? [4, 8, 497, 236, 29] : [4, 8, 245, 236, 29]
  return { c: [], r: [r], notch: kind === 'B' ? r : undefined }
}

// a triangle cut into the middle of each side (20px wide at the edge, 20px deep); a wide card has one per cell on its long sides
function notches([x, y, w, h]: Rect, size: Size): string {
  const cy = y + h / 2
  const xs = size === '2x1' ? [x + w / 4, x + (3 * w) / 4] : [x + w / 2]
  const tri = (p: number[][]) => `M${p[0][0]},${p[0][1]} L${p[1][0]},${p[1][1]} L${p[2][0]},${p[2][1]} Z`
  return [
    ...xs.flatMap((cx) => [tri([[cx - 20, y - 20], [cx + 20, y - 20], [cx, y + 20]]), tri([[cx - 20, y + h + 20], [cx + 20, y + h + 20], [cx, y + h - 20]])]),
    tri([[x - 20, cy - 20], [x - 20, cy + 20], [x + 20, cy]]),
    tri([[x + w + 20, cy - 20], [x + w + 20, cy + 20], [x + w - 20, cy]]),
  ].join(' ')
}

export function CardShape({ kind, w, h, ghost }: { kind?: Kind; w: number; h: number; ghost?: boolean }) {
  const id = useId().replace(/:/g, '')
  const size = sizeOf(w, h)
  const s = spec(kind, size)
  return (
    <svg className="tm-shape" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        {s.notch && (
          <mask id={`n${id}`} maskUnits="userSpaceOnUse" x={-30} y={-30} width={w + 60} height={h + 60}>
            <rect x={-30} y={-30} width={w + 60} height={h + 60} fill="#fff" />
            <path d={notches(s.notch, size)} fill="#000" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
          </mask>
        )}
        {/* a card that waits for a yes: only its outline */}
        <filter id={`o${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d" />
          <feComposite in="d" in2="SourceAlpha" operator="out" result="o" />
          <feFlood floodColor="#FDF6E9" />
          <feComposite in2="o" operator="in" />
        </filter>
      </defs>
      <g filter={ghost ? `url(#o${id})` : undefined}>
      <g className="tm-shape-fill" mask={s.notch ? `url(#n${id})` : undefined}>
        {s.c.map(([x, y, d], i) => (
          <circle key={i} cx={x + d / 2} cy={y + d / 2} r={d / 2} />
        ))}
        {s.r.map(([x, y, rw, rh, r], i) => (
          <rect key={`r${i}`} x={x} y={y} width={rw} height={rh} rx={r} />
        ))}
      </g>
      </g>
    </svg>
  )
}
