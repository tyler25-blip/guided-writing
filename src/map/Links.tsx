// How cards are joined on the map (Figma: Map arrow, Map arc): a white triangle between two cards that sit next to each other, its point in the
// next card's notch, and a 25px band round the ring. A line that waits for a yes is drawn as an outline only; the line the person broke is faint.
import { AH, AW, arrowAt, type Arrow, type Band } from './linkGeo.ts'

// a rounded triangle, point at (0, 0), pointing down
const TRI = `M${-AW / 2},${-AH} L${AW / 2},${-AH} L0,0 Z`

export function Links({ arrows, bands }: { arrows: Arrow[]; bands: Band[] }) {
  return (
    <g className="tm-links">
      {bands.map((b) => (
        <g key={b.key} data-link={b.key} data-to={b.to} className={`band ${b.state}`}>
          <path d={b.d} className="outer" />
          {b.state === 'waiting' && <path d={b.d} className="inner" />}
        </g>
      ))}
      {arrows.map((l) => {
        const p = arrowAt(l.from, l.at, l.insets)
        return <path key={l.key} data-link={l.key} data-to={l.to} className={`arrow ${l.state}`} d={TRI} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.deg.toFixed(1)})`} />
      })}
    </g>
  )
}
