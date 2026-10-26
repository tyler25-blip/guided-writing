// Dev panel (bottom-left): load a sample, jump to any screen, poke the current one. Collapses to one icon.
import { useState } from 'react'
import { SAMPLES, type Sample } from './samples.ts'
import type { State } from './MapApp.tsx'

const uid = () => Math.random().toString(36).slice(2, 9)
type Phase = 'chat' | 'pick' | 'map' | 'summary'

const build = (x: Sample, to: Phase): State => {
  const cands = x.cands.map((c) => ({ ...c, id: uid() }))
  const ids = Object.fromEntries(x.cards.map((c) => [c.key, uid()]))
  const cards = x.cards.map((c) => ({ id: ids[c.key], text: c.text, src: c.src, x: c.x, y: c.y, stack: c.stack ?? [] }))
  const edges = x.edges.map(([f, t, label]) => ({ id: uid(), from: ids[f], to: ids[t], label }))
  if (to === 'chat') return { phase: 'chat', msgs: x.msgs, cands: [], cards: [], edges: [], ended: false }
  if (to === 'pick') return { phase: 'pick', msgs: x.msgs, cands, cards: [], edges: [], ended: false }
  return { phase: 'map', msgs: x.msgs, cands: [], cards, edges, ended: to === 'summary' }
}

const read = <T,>(k: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d
  } catch {
    return d
  }
}

export function DevPanel({ s, setS, openSummary, crisis }: { s: State; setS: (s: State) => void; openSummary: (o: boolean) => void; crisis: () => void }) {
  const [open, setOpen] = useState(() => read('tm-dev-open', true))
  const [pick, setPick] = useState(() => read('tm-dev-sample', 0))
  const toggle = (o: boolean) => (setOpen(o), localStorage.setItem('tm-dev-open', JSON.stringify(o)))
  const choose = (i: number) => (setPick(i), localStorage.setItem('tm-dev-sample', JSON.stringify(i)))
  const go = (to: Phase) => (setS(build(SAMPLES[pick], to)), openSummary(to === 'summary'))
  const here = (f: (s: State) => State) => setS(f(s))

  if (!open)
    return (
      <button className="tm-dev-icon" aria-label="Open dev panel" title="Dev panel" onClick={() => toggle(true)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
        </svg>
      </button>
    )

  return (
    <aside className="tm-dev" aria-label="Dev panel">
      <div className="tm-dev-head">
        <span className="tm-tag">Dev</span>
        <button aria-label="Collapse dev panel" onClick={() => toggle(false)}>
          –
        </button>
      </div>

      <label className="tm-dev-row">
        <span className="tm-tag">Sample</span>
        <select id="tm-dev-sample" value={pick} onChange={(e) => choose(Number(e.target.value))}>
          {SAMPLES.map((x, i) => (
            <option key={x.name} value={i}>
              {x.name}
            </option>
          ))}
        </select>
      </label>

      <span className="tm-tag">Jump to (loads the sample)</span>
      <div className="tm-dev-btns">
        <button onClick={() => go('chat')}>1 Chat</button>
        <button onClick={() => go('pick')}>2 Pick</button>
        <button onClick={() => go('map')}>3 Map</button>
        <button onClick={() => go('summary')}>4 Summary</button>
      </div>

      <span className="tm-tag">This screen</span>
      <div className="tm-dev-btns">
        {s.phase === 'chat' && s.msgs.length > 0 && <button onClick={() => here((p) => ({ ...p, phase: 'pick', cands: [] }))}>Spread it out now</button>}
        {s.phase === 'pick' && (
          <>
            <button onClick={() => here((p) => ({ ...p, cands: p.cands.map((c) => ({ ...c, on: true })) }))}>Select all</button>
            <button onClick={() => here((p) => ({ ...p, cands: p.cands.map((c) => ({ ...c, on: false })) }))}>Select none</button>
          </>
        )}
        {s.phase === 'map' && (
          <>
            <button
              disabled={s.cards.length < 3}
              onClick={() =>
                here((p) => {
                  const [a, b, c] = p.cards
                  const add = [[a, b], [b, c], [c, a]].filter(([x, y]) => !p.edges.some((e) => e.from === x.id && e.to === y.id))
                  return { ...p, edges: [...p.edges, ...add.map(([x, y]) => ({ id: uid(), from: x.id, to: y.id, label: '' }))] }
                })
              }
            >
              Make a loop
            </button>
            <button onClick={() => here((p) => ({ ...p, edges: [] }))}>Clear lines</button>
            <button onClick={() => here((p) => ({ ...p, edges: p.edges.map((e) => ({ ...e, label: '' })) }))}>Clear labels</button>
            <button onClick={() => here((p) => ({ ...p, cards: p.cards.map((c) => ({ ...c, stack: [] })) }))}>Unstack all</button>
            {s.ended && <button onClick={() => (here((p) => ({ ...p, ended: false })), openSummary(false))}>Unlock map</button>}
          </>
        )}
        <button onClick={crisis}>Show crisis card</button>
        <button onClick={() => (setS({ phase: 'chat', msgs: [], cands: [], cards: [], edges: [], ended: false }), openSummary(false))}>Reset (empty)</button>
      </div>
      <p className="tm-dev-note">Screen: {s.phase}{s.ended ? ' · ended' : ''} · {s.cards.length} cards · {s.edges.length} lines</p>
    </aside>
  )
}
