// node src/map/place.check.ts
import assert from 'node:assert/strict'
import { estH, feels, fitView, freeSpot, freeSpotLinked, guessKind, layered, namesFor, optionsFor, pilesLayout, segments, summaryOf, tidyPiles, type Kind } from './place.ts'

assert.equal(guessKind('My chest gets tight'), 'C')
assert.equal(guessKind('I keep thinking I’m going to mess it up'), 'B')
assert.equal(guessKind('I have a presentation on Thursday'), 'A')
assert.equal(guessKind('I have a presentation on Thursday and I can’t stop thinking about it.'), 'A')
assert.ok(feels('I feel like I’m not good enough') && !feels('I have a meeting'))
const fs = freeSpot([{ x: 100, y: 100, h: 80 }, { x: 320, y: 100, h: 80 }], 100, 100)
assert.ok(![{ x: 100, y: 100, h: 80 }, { x: 320, y: 100, h: 80 }].some((b) => fs.x < b.x + 196 && fs.x + 196 > b.x && fs.y < b.y + 96 && fs.y + 116 > b.y))

const msgs = [
  { role: 'you' as const, text: 'one' },
  { role: 'ai' as const, text: 'x', options: ['dread', 'overwhelmed'] },
  { role: 'you' as const, text: 'dread, overwhelmed', naming: true },
  { role: 'ai' as const, text: 'y' },
  { role: 'you' as const, text: 'two' },
]
assert.deepEqual(namesFor(msgs, 0), ['dread', 'overwhelmed'])
assert.deepEqual(namesFor(msgs, 4), [])
assert.deepEqual(optionsFor(msgs, 0), ['dread', 'overwhelmed'])

const seg = segments('Um, I keep thinking I’m going to totally mess it up, you know', 'I keep thinking I’m going to totally mess it up')
assert.equal(seg.filter((x) => x.keep).map((x) => x.s).join(''), 'I keep thinking I’m going to totally mess it up')
assert.equal(seg.filter((x) => !x.keep).map((x) => x.s).join(''), 'Um, , you know')

// a new card joined to a card: clear of cards, and the straight line crosses no card and no line
const bx = [{ x: 100, y: 100, h: 80 }, { x: 100, y: 260, h: 80 }]
const fl = freeSpotLinked(bx, [[[0, 180], [500, 180]]], bx[0], 180, 100)
assert.ok(!bx.some((b) => fl.x < b.x + 196 && fl.x + 196 > b.x && fl.y < b.y + 96 && fl.y + 116 > b.y))
assert.ok(!(fl.y > 180 && fl.x === 100)) // straight below would cross the line at y=180 and run into the card below
// a line already entering the source card from straight above: the new card must not sit above it on that same line
const up = freeSpotLinked([{ x: 100, y: 300, h: 80 }], [[[190, 0], [190, 300]]], { x: 100, y: 300, h: 80 }, 180, 100)
assert.ok(!(up.x === 100 && up.y < 300)) // straight above would run along the incoming line
// piles: right-hand, stacked A, B, C, DE; a card that leaves is no longer re-tidied
const cs = [
  { id: 'a', kind: 'A' as Kind, text: 'presentation Thursday' },
  { id: 'b', kind: 'B' as Kind, text: 'I will mess it up' },
  { id: 'b2', kind: 'B' as Kind, text: 'again' },
  { id: 'c', kind: 'C' as Kind, text: 'chest tight' },
]
const pl = pilesLayout(cs, 1200, 800)
assert.ok(pl.piles.A!.y < pl.piles.B!.y && pl.piles.B!.y < pl.piles.C!.y && !pl.piles.DE)
const st = tidyPiles({ piles: pl.piles, cards: cs.map((c) => ({ ...c, pile: c.kind, x: 0, y: 0 })) })
assert.equal(st.cards[2].x - st.cards[1].x, 4)
assert.equal(tidyPiles({ piles: pl.piles, cards: st.cards.map((c) => (c.id === 'b' ? { ...c, pile: undefined } : c)) }).cards[2].x, pl.piles.B!.x)
const fv = fitView([{ x: 0, y: 0, w: 1000, h: 500 }], 800, 600)
assert.ok(fv.z < 1 && fv.z >= 0.25)

// layered layout: one column per story thread; no crossing lines, no line through a card, only horizontal and vertical runs
const W = 180
type Ln = { id: string; from: string; to: string }
function verify(cards: { id: string; text: string; kind?: Kind }[], edges: Ln[]) {
  const r = layered(cards, edges)
  assert.equal(r.crossings, 0, `crossings ${r.crossings}`)
  assert.equal(r.hits, 0)
  assert.equal(r.overlaps, 0, `overlaps ${r.overlaps}`)
  const src = Object.fromEntries(edges.map((e) => [e.id, e.from]))
  const all = Object.entries(r.routes).flatMap(([id, pts]) => pts.slice(1).map((q, i) => ({ id, a: pts[i], b: q })))
  for (const sg of all) assert.ok(sg.a[0] === sg.b[0] || sg.a[1] === sg.b[1], `diagonal run in ${sg.id}`)
  // independent check: two runs of different lines never lie on each other, except branches of one trunk (same source)
  for (const [i, x] of all.entries())
    for (const y of all.slice(i + 1)) {
      if (x.id === y.id || src[x.id] === src[y.id]) continue
      const v = x.a[0] === x.b[0] && y.a[0] === y.b[0]
      const hz = x.a[1] === x.b[1] && y.a[1] === y.b[1]
      if (v && Math.abs(x.a[0] - y.a[0]) < 3) assert.ok(Math.min(Math.max(x.a[1], x.b[1]), Math.max(y.a[1], y.b[1])) - Math.max(Math.min(x.a[1], x.b[1]), Math.min(y.a[1], y.b[1])) <= 1, `${x.id} and ${y.id} overlap`)
      if (hz && Math.abs(x.a[1] - y.a[1]) < 3) assert.ok(Math.min(Math.max(x.a[0], x.b[0]), Math.max(y.a[0], y.b[0])) - Math.max(Math.min(x.a[0], x.b[0]), Math.min(y.a[0], y.b[0])) <= 1, `${x.id} and ${y.id} overlap`)
    }
  // independent check: no run passes through a card
  for (const [id, pts] of Object.entries(r.routes))
    for (let i = 0; i + 1 < pts.length; i++)
      for (const c of cards) {
        const [bx, by, bh] = [r.pos[c.id].x + 2, r.pos[c.id].y + 2, estH(c.text, c.kind) - 4]
        for (let t = 0; t <= 1; t += 0.01) {
          const [x, y] = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]
          assert.ok(!(x > bx && x < bx + W - 4 && y > by && y < by + bh), `edge ${id} passes through ${c.id}`)
        }
      }
  return r
}
const demo = [
  ['A1', 'A', 'I have a presentation on Thursday'],
  ['B1', 'B', 'I keep thinking I’m going to totally mess it up in front of everyone'],
  ['B2', 'B', 'I’m just not good enough for this job'],
  ['C1', 'C', 'my chest getting really tight'],
  ['A2', 'A', 'I lie awake half the night'],
  ['B3', 'B', 'I’ll be too tired to present well'],
  ['C2', 'C', 'I’m kind of scared'],
  ['B4', 'B', 'I’m going to screw this up'],
  ['D1', 'DE', 'maybe last time I prepared properly, it actually went okay'],
  ['D2', 'DE', 'Probably I’d stumble on a slide or two, but that’s not the whole thing falling apart'],
  ['D3', 'DE', 'I can be nervous and still get through it'],
].map(([id, kind, text]) => ({ id, kind: kind as Kind, text }))
const lines = [['A1', 'B1'], ['A1', 'B2'], ['B1', 'C1'], ['B2', 'C1'], ['C1', 'A2'], ['A2', 'B3'], ['B3', 'C2'], ['B4', 'C2'], ['C2', 'A2'], ['B1', 'D1'], ['B1', 'D2'], ['B2', 'D3']].map(([from, to]) => ({ id: `${from}>${to}`, from, to }))
const dl = verify(demo, lines)
// two columns: the Thursday thread in the first, the night thread in the second
assert.equal(new Set(Object.values(dl.cols)).size, 2)
for (const id of ['A1', 'B1', 'B2', 'C1', 'D1', 'D2', 'D3']) assert.equal(dl.cols[id], 0, id)
for (const id of ['A2', 'B3', 'B4', 'C2']) assert.equal(dl.cols[id], 1, id)
// exactly one line between columns (C1 → A2); the back line of the loop stays next to its column
assert.deepEqual(Object.keys(dl.between).filter((k) => dl.between[k]), ['C1>A2'])
const right = (ids: string[]) => Math.max(...ids.map((id) => dl.pos[id].x + W))
const left = (ids: string[]) => Math.min(...ids.map((id) => dl.pos[id].x))
const col1 = ['A1', 'B1', 'B2', 'C1', 'D1', 'D2', 'D3']
const col2 = ['A2', 'B3', 'B4', 'C2']
const cross = dl.routes['C1>A2']
assert.ok(cross[0][0] >= dl.pos.C1.x && cross.at(-1)![0] === dl.pos.A2.x) // leaves C1, enters A2 on its side facing the first column
assert.ok(cross.slice(-3).every((p) => p[0] > right(col1) && p[0] < left(col2) || p === cross.at(-1))) // the last run up (and across) is in the gutter
const loop = dl.routes['C2>A2']
assert.ok(Math.max(...loop.map((p) => p[0])) <= right(col2) + 60 && Math.min(...loop.map((p) => p[0])) >= left(col2)) // next to column 2, not round the map
assert.ok(loop.every((p) => p[0] >= left(col2)))
// rows strictly in order, evenly spaced, the same y in both columns
const ys = ['A', 'B', 'C', 'DE'].map((k) => dl.pos[demo.find((c) => c.kind === k)!.id].y)
assert.ok(ys[0] < ys[1] && ys[1] < ys[2] && ys[2] < ys[3] && Math.abs(ys[1] - ys[0] - (ys[2] - ys[1])) < 1 && Math.abs(ys[3] - ys[2] - (ys[1] - ys[0])) < 1)
assert.equal(dl.pos.A1.y, dl.pos.A2.y)
assert.equal(dl.pos.C1.y, dl.pos.C2.y)
// fan-out is one trunk: A1's lines to B1 and B2 start at the same point
assert.deepEqual(dl.routes['A1>B1'][0], dl.routes['A1>B2'][0])
// fan-in is not shared: B1 and B2 drop into C1 at different places
assert.notEqual(dl.routes['B1>C1'].at(-1)![0], dl.routes['B2>C1'].at(-1)![0])
// a chain, and a chain with one back edge
const chain = [{ id: 'a', kind: 'A' as Kind, text: 'one' }, { id: 'b', kind: 'B' as Kind, text: 'two' }, { id: 'c', kind: 'C' as Kind, text: 'three' }]
verify(chain, [{ id: '1', from: 'a', to: 'b' }, { id: '2', from: 'b', to: 'c' }])
const looped = verify(chain, [{ id: '1', from: 'a', to: 'b' }, { id: '2', from: 'b', to: 'c' }, { id: '3', from: 'c', to: 'a' }])
assert.ok(looped.routes['3'].some(([x]) => x < Math.min(...chain.map((c) => looped.pos[c.id].x)) || x > Math.max(...chain.map((c) => looped.pos[c.id].x)) + W)) // the arc runs outside the layout

// summary
const cards = [
  { id: 'a', kind: 'A' as Kind, text: 'presentation Thursday', stack: [] },
  { id: 'b', kind: 'B' as Kind, text: 'I will mess it up', stack: [] },
  { id: 'c', kind: 'C' as Kind, text: 'chest tight', stack: [], names: ['dread'], t: 5 },
  { id: 'd', kind: 'DE' as Kind, text: 'last time it went okay', stack: [] },
  { id: 'e', kind: 'C' as Kind, text: 'stuck', stack: [], t: 9 },
]
const edges = [{ id: '1', from: 'a', to: 'b' }, { id: '2', from: 'b', to: 'c' }]
const sum = summaryOf(cards, edges)
assert.deepEqual(sum.names, ['dread'])
assert.deepEqual(sum.rows.map((r) => r.text), ['presentation Thursday', 'I will mess it up', 'chest tight'])
assert.deepEqual(sum.de, ['last time it went okay'])
assert.equal(sum.more, 1)
assert.ok(!('loop' in sum)) // the summary never mentions unresolved loops
assert.deepEqual(summaryOf(cards, []).names, ['dread'])
assert.equal(summaryOf(cards, []).rows.length, 0)
assert.equal(summaryOf([{ id: 'c', kind: 'C', text: 'x', stack: [] }, { id: 'a', kind: 'A', text: 'y', stack: [] }], [{ id: '1', from: 'a', to: 'c' }]).unnamed, true)
console.log('place ok')
