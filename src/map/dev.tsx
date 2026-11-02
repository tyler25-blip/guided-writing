// Dev panel (dev builds only, drag it anywhere): jump to any screen of the demo story, poke the current one. Collapses to one icon.
import { useRef, useState } from 'react'
import { demoState } from './demo.ts'
import { lastNotes, type State } from './MapApp.tsx'
import { SAMPLES, sampleState } from './samples.ts'

const uid = () => Math.random().toString(36).slice(2, 9)

const read = <T,>(k: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d
  } catch {
    return d
  }
}

export function DevPanel({ s, setS, openSummary, crisis, pane }: { s: State; setS: (s: State) => void; openSummary: (o: boolean) => void; crisis: () => void; pane: (open: boolean) => void }) {
  const [open, setOpen] = useState(() => read('tm-dev-open', true))
  // drag it by its head (or the icon) anywhere; the spot is remembered
  const [at, setAt] = useState<{ x: number; y: number }>(() => read('tm-dev-at', { x: innerWidth - 300, y: 60 }))
  const keep = (p: { x: number; y: number }) => ({ x: Math.min(Math.max(0, p.x), innerWidth - 60), y: Math.min(Math.max(0, p.y), innerHeight - 40) })
  const dragged = useRef(false)
  const grab = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.tm-dev-head button')) return
    const dx = e.clientX - at.x
    const dy = e.clientY - at.y
    let last = at
    dragged.current = false
    const move = (ev: PointerEvent) => ((dragged.current = true), setAt((last = keep({ x: ev.clientX - dx, y: ev.clientY - dy }))))
    const up = () => (removeEventListener('pointermove', move), removeEventListener('pointerup', up), localStorage.setItem('tm-dev-at', JSON.stringify(last)))
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
  }
  const pos = { left: keep(at).x, top: keep(at).y }
  const toggle = (o: boolean) => (setOpen(o), localStorage.setItem('tm-dev-open', JSON.stringify(o)))
  const here = (f: (s: State) => State) => setS(f(s))
  const jump = (to: 'chat' | 'piles' | 'laid' | 'summary') => (setS(demoState(to)), openSummary(to === 'summary'), pane(to === 'chat'))

  if (!open)
    return (
      <button className="tm-dev-icon" style={pos} aria-label="Open dev panel" title="Dev panel (drag to move)" onPointerDown={grab} onClick={() => !dragged.current && toggle(true)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
        </svg>
      </button>
    )

  return (
    <aside className="tm-dev" style={pos} aria-label="Dev panel">
      <div className="tm-dev-head" onPointerDown={grab} title="Drag to move">
        <span className="tm-tag">Dev</span>
        <button aria-label="Collapse dev panel" onClick={() => toggle(false)}>
          –
        </button>
      </div>

      <span className="tm-tag">Demo story (also at /map?demo)</span>
      <div className="tm-dev-btns">
        <button onClick={() => jump('chat')}>Start chat</button>
        <button onClick={() => jump('piles')}>Jump to map — piles</button>
        <button onClick={() => jump('laid')}>Jump to map — laid out</button>
        <button onClick={() => jump('summary')}>Jump to summary</button>
      </div>

      <span className="tm-tag">Samples (real AI, real posts)</span>
      {SAMPLES.map((x, i) => (
        <div key={x.name} className="tm-dev-btns" title={x.source}>
          <span>{x.name}</span>
          <button onClick={() => (setS(sampleState(i, 'chat')), openSummary(false), pane(true))}>Chat</button>
          <button onClick={() => (setS(sampleState(i, 'piles')), openSummary(false), pane(false))}>Piles</button>
          <button onClick={() => (setS(sampleState(i, 'laid')), openSummary(false), pane(false))}>Laid out</button>
        </div>
      ))}

      <span className="tm-tag">This screen</span>
      <div className="tm-dev-btns">
        {s.phase === 'chat' && s.msgs.length > 0 && (
          <>
            <button onClick={() => here((p) => ({ ...p, phase: 'layout', mode: 'manual' }))}>Spread: piles</button>
            <button onClick={() => here((p) => ({ ...p, phase: 'layout', mode: 'auto' }))}>Spread: lay it out</button>
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
                  return { ...p, edges: [...p.edges, ...add.map(([x, y]) => ({ id: uid(), from: x.id, to: y.id }))] }
                })
              }
            >
              Make a loop
            </button>
            <button onClick={() => here((p) => ({ ...p, edges: [] }))}>Clear lines</button>
            <button onClick={() => here((p) => ({ ...p, cards: p.cards.map((c) => ({ ...c, stack: [] })) }))}>Unstack all</button>
            {s.ended && <button onClick={() => (here((p) => ({ ...p, ended: false })), openSummary(false))}>Unlock map</button>}
          </>
        )}
        <button onClick={crisis}>Show crisis card</button>
        {s.risk && <button onClick={() => here((p) => ({ ...p, risk: false }))}>Clear risk state</button>}
        <button onClick={() => (setS({ phase: 'chat', msgs: [], cards: [], edges: [], ended: false }), openSummary(false))}>Reset (empty)</button>
      </div>
      {(() => {
        const n = lastNotes(s.msgs)
        return (
          n && (
            <div className="tm-dev-notes">
              <span className="tm-tag">AI’s private notes</span>
              <span>
                {Object.entries(n.have)
                  .map(([k, v]) => (v ? `✓${k}` : `·${k}`))
                  .join(' ')}
                {n.ready ? ' · ready' : ''}
              </span>
              <span>
                <b>core</b> {n.core}
              </span>
              <span>
                <b>stuck</b> {n.stuck} · <b>help</b> {n.help}
              </span>
            </div>
          )
        )
      })()}
      <p className="tm-dev-note">Screen: {s.phase}{s.ended ? ' · ended' : ''}{s.demo ? ' · demo' : ''} · {s.cards.length} cards · {s.edges.length} lines</p>
    </aside>
  )
}
