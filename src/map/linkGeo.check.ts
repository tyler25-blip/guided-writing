// node src/map/linkGeo.check.ts
import assert from 'node:assert/strict'
import { arrowAt, bandD, gapMid, ringJoin } from './linkGeo.ts'
import { cardSize, CELL } from './place.ts'

// sizes: one cell, two wide for a long sentence, Next step 2×2
assert.deepEqual(cardSize('they don’t actually like me that much', 'B'), { w: CELL, h: CELL })
assert.deepEqual(cardSize('Amy planned it last minute, and I’d told everyone I was busy that week, so of course nobody asked me, and it was not about me at all, it was about timing', 'DE'), { w: 2 * CELL, h: CELL })
assert.deepEqual(cardSize('Text Mia', 'NEXT'), { w: 2 * CELL, h: 2 * CELL })
// a Felt card keeps room for its feeling names: it goes wide sooner
const mid = 'I just feel kind of pathetic tonight, and small, and tired, and like nothing I do really matters to anyone at all'
assert.equal(cardSize(mid, 'B').w, CELL)
assert.equal(cardSize(mid, 'C').w, 2 * CELL)

// arrows between cards that sit close (24px): the point 8px into the next card, in the middle of the side (where the notch is)
const a = { x: 0, y: 0, w: 252, h: 252 }
assert.deepEqual(arrowAt(a, { x: 0, y: 276, w: 252, h: 252 }), { x: 126, y: 284, deg: 0 })
assert.deepEqual(arrowAt(a, { x: 276, y: 0, w: 252, h: 252 }), { x: 284, y: 126, deg: -90 }) // to the right
assert.deepEqual(arrowAt(a, { x: -276, y: 0, w: 252, h: 252 }), { x: -32, y: 126, deg: 90 }) // to the left
assert.deepEqual(arrowAt(a, { x: 0, y: -276, w: 252, h: 252 }), { x: 126, y: -32, deg: 180 }) // up
// a 64px gap: the arrow floats in its middle (its point 22px short of the next card)
assert.deepEqual(arrowAt(a, { x: 0, y: 316, w: 252, h: 252 }), { x: 126, y: 294, deg: 0 })
// a wide card below: the notch over the overlap (its left cell's middle)
assert.equal(arrowAt(a, { x: 0, y: 276, w: 504, h: 252 }).x, 126)
// off the bottom-right corner (a Next step below and to the right): in the gap between the two corners, pointing down and right
const d = arrowAt(a, { x: 276, y: 276, w: 504, h: 504 })
assert.equal(d.deg, -45)
assert.ok(d.x > 252 && d.x < 276 && d.y > 252 && d.y < 276)
assert.equal(arrowAt(a, { x: -400, y: 300, w: 252, h: 252 }).deg, 45) // down and left
// with the shapes' round corners: the arrow sits between the corners you see (Another way 26px in, Next step 113px in)
const seen = arrowAt(a, { x: 199, y: 199, w: 504, h: 504 }, [26, 113])
assert.equal(seen.deg, -45)
assert.ok(Math.abs(seen.x - seen.y) < 0.01 && seen.x > 252 - 26 / Math.SQRT2 && seen.x < 199 + 113 / Math.SQRT2)

// bands follow the ring and stop short of both cards; a flipped ring sweeps the other way
const rd = { cx: 126, cy: 436, r: 310, ids: [] as string[] }
const top = { x: 0, y: 0, w: 252, h: 252 }, right = { x: 310, y: 310, w: 252, h: 252 }
const cw = bandD(rd, top, right)
assert.match(cw, / 0 0 1 /) // clockwise
assert.match(bandD({ ...rd, ccw: true }, right, top), / 0 0 0 /) // anticlockwise
const [x0, y0] = cw.slice(1).split(' ')[0].split(',').map(Number)
assert.ok(!(x0 > top.x - 16 && x0 < top.x + top.w + 16 && y0 > top.y - 16 && y0 < top.y + top.h + 16)) // starts outside the top card
// an arrowhead sits in the middle of the gap between two cards (along the line joining their centres)
const m = gapMid({ x: 0, y: 0, w: 252, h: 252 }, { x: 316, y: 316, w: 252, h: 252 })
assert.ok(Math.abs(m.x - 284) < 1e-9 && Math.abs(m.y - 284) < 1e-9 && m.gap > 0) // diagonal neighbours: the middle of the gap between the two facing corners
assert.deepEqual(gapMid({ x: 0, y: 0, w: 252, h: 252 }, { x: 0, y: 316, w: 252, h: 252 }), { x: 126, y: 284, gap: 64 })
// on a ring the head points along the arc: from the top card clockwise to the lower right one, it faces down and right
const jn = ringJoin({ cx: 126, cy: 500, r: 300, ids: [] }, top, { x: 316, y: 316, w: 252, h: 252 })
assert.ok(jn.head.deg < 0 && jn.head.deg > -180 && jn.d.startsWith('M'))
console.log('linkGeo ok')
