// Thought map MVP (/map): chat → pick cards → connect them yourself → summary. Greyscale on purpose.
// Steps 1–3 of the MVP plan: all UI and canvas behaviour. AI calls are stubbed (marked "stub") and get wired in step 4.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isCrisis } from '../triggers.ts'
import { loops } from './graph.ts'
import './map.css'

type Src = 'you' | 'ai'
type Card = { id: string; text: string; src: Src; x: number; y: number; stack: string[] } // stack = texts merged into this card
type Edge = { id: string; from: string; to: string; label: string }
type Msg = { role: Src; text: string }
type Cand = { id: string; text: string; src: Src; on: boolean }
type Phase = 'chat' | 'pick' | 'map'
type State = { phase: Phase; msgs: Msg[]; cands: Cand[]; cards: Card[]; edges: Edge[]; ended: boolean }

const KEY = 'thought-map-v1'
const W = 180 // card width, px
const uid = () => Math.random().toString(36).slice(2, 9)
const fresh = (): State => ({ phase: 'chat', msgs: [], cands: [], cards: [], edges: [], ended: false })
const load = (): State => {
  try {
    return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return fresh()
  }
}

// --- stubs, replaced by the AI in step 4 -------------------------------------------------------
const stubReply = (n: number) =>
  n < 2 ? 'That sounds like a lot at once. Which part is taking up the most room right now?' : 'It makes sense that it feels heavy when deadlines pile up like this.'
const stubCands = (msgs: Msg[]): Cand[] => [
  ...msgs.filter((m) => m.role === 'you').flatMap((m) => m.text.split(/(?<=[.!?。！？])\s*/).filter((s) => s.trim()).map((text) => ({ id: uid(), text: text.trim(), src: 'you' as Src, on: false }))),
  { id: uid(), text: 'Send a one-line status update', src: 'ai', on: false },
]
const stubLabel = () => ''
const stubLoopNote = 'Loops like this are very common: one worry feeds the next. Which line in this loop could you most easily cut?'

export default function MapApp() {
  const [s, setS] = useState<State>(load)
  const set = (f: (s: State) => State) => setS((p) => f(p))
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(s))
  }, [s])
  const [toast, setToast] = useState('')
  const [crisis, setCrisis] = useState(false)
  const [summary, setSummary] = useState(false)
  const say = (t: string) => (setToast(t), setTimeout(() => setToast(''), 2200))
  const restart = () => (setS(fresh()), setSummary(false))

  return (
    <div className="tm">
      <header className="tm-bar">
        <span className="tm-title">Thought map{s.phase === 'pick' ? ' · pick what goes on the map' : s.phase === 'map' ? (s.ended ? ' · summary' : ' · connect them yourself') : ''}</span>
        <span className="tm-actions">
          {s.phase === 'pick' && <button onClick={() => set((p) => ({ ...p, phase: 'chat' }))}>Back to chat</button>}
          {s.phase === 'map' && !s.ended && (
            <button className="solid" onClick={() => (set((p) => ({ ...p, ended: true })), setSummary(true))}>
              That’s enough for now
            </button>
          )}
          {s.phase === 'map' && s.ended && <button onClick={() => setSummary(true)}>Summary</button>}
          {(s.ended || s.phase !== 'chat') && <button onClick={restart}>New map</button>}
        </span>
      </header>
      {s.phase === 'chat' && <Chat s={s} set={set} onCrisis={() => setCrisis(true)} say={say} />}
      {s.phase === 'pick' && <Pick s={s} set={set} />}
      {s.phase === 'map' && <MapCanvas s={s} set={set} />}
      {summary && <Summary s={s} close={() => setSummary(false)} />}
      {crisis && <Referral close={() => setCrisis(false)} />}
      {toast && <div className="tm-toast">{toast}</div>}
    </div>
  )
}

// --- 1 · chat ----------------------------------------------------------------------------------
function Chat({ s, set, onCrisis, say }: { s: State; set: (f: (s: State) => State) => void; onCrisis: () => void; say: (t: string) => void }) {
  const [draft, setDraft] = useState('')
  const [declined, setDeclined] = useState(0)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [s.msgs.length])
  const mine = s.msgs.filter((m) => m.role === 'you').length
  const propose = mine >= 2 + declined * 2 && declined < 2 && s.msgs.at(-1)?.role === 'ai' // offer to spread it out; at most twice
  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    if (isCrisis(text)) onCrisis()
    set((p) => ({ ...p, msgs: [...p.msgs, { role: 'you', text }] }))
    setTimeout(() => set((p) => ({ ...p, msgs: [...p.msgs, { role: 'ai', text: stubReply(mine + 1) }] })), 600) // stub
  }
  return (
    <main className="tm-chat">
      <div className="tm-msgs">
        {!s.msgs.length && <p className="tm-empty">What’s taking up room in your head tonight?</p>}
        {s.msgs.map((m, i) => (
          <p key={i} className={`tm-msg ${m.role}`}>
            {m.text}
          </p>
        ))}
        {propose && (
          <div className="tm-propose">
            Want to spread it out and look at it?
            <button className="solid" onClick={() => set((p) => ({ ...p, phase: 'pick', cands: stubCands(p.msgs) }))}>
              Spread it out
            </button>
            <button onClick={() => setDeclined((d) => d + 1)}>Talk a bit more</button>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="tm-input">
        <textarea
          id="tm-draft"
          value={draft}
          placeholder="Type…"
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && (e.preventDefault(), send())}
        />
        <button className="tm-mic" aria-label="Voice input" onClick={() => say('Voice input is coming soon')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <button onClick={send} disabled={!draft.trim()}>
          Send
        </button>
      </div>
    </main>
  )
}

// --- 2 · pick ----------------------------------------------------------------------------------
function Pick({ s, set }: { s: State; set: (f: (s: State) => State) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const upd = (id: string, f: (c: Cand) => Cand) => set((p) => ({ ...p, cands: p.cands.map((c) => (c.id === id ? f(c) : c)) }))
  const chosen = s.cands.filter((c) => c.on)
  const place = () =>
    set((p) => ({
      ...p,
      phase: 'map',
      cards: [...p.cards, ...chosen.map((c, i) => ({ id: c.id, text: c.text, src: c.src, x: 60 + (i % 4) * 240, y: 60 + Math.floor(i / 4) * 150, stack: [] }))],
      cands: [],
    }))
  const col = (src: Src, title: string) => (
    <div className="tm-pcol">
      <span className="tm-tag">{title}</span>
      {s.cands
        .filter((c) => c.src === src)
        .map((c) => (
          <div key={c.id} className={`tm-pc ${c.src}${c.on ? ' on' : ''}`} onClick={() => editing !== c.id && upd(c.id, (x) => ({ ...x, on: !x.on }))} onDoubleClick={() => setEditing(c.id)}>
            <span className="tm-box" aria-hidden="true" />
            {editing === c.id ? (
              <input autoFocus defaultValue={c.text} onBlur={(e) => (upd(c.id, (x) => ({ ...x, text: e.target.value || x.text })), setEditing(null))} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            ) : (
              <span>{c.text}</span>
            )}
          </div>
        ))}
      {src === 'you' && (
        <button className="tm-add" onClick={() => set((p) => ({ ...p, cands: [...p.cands, { id: uid(), text: 'New card', src: 'you', on: true }] }))}>
          + Add your own
        </button>
      )}
    </div>
  )
  return (
    <main className="tm-pick">
      <p className="tm-hint">{chosen.length ? '' : 'Nothing is selected yet. '}Click to choose, double-click to edit. Cards you don’t choose are discarded.</p>
      <div className="tm-pgrid">
        {col('you', 'What you said')}
        {col('ai', 'AI’s suggestions')}
      </div>
      <div className="tm-pfoot">
        <span>{chosen.length} selected</span>
        <button className="solid" disabled={!chosen.length} onClick={place}>
          Put on the map ({chosen.length})
        </button>
      </div>
    </main>
  )
}

// --- 3 · map -----------------------------------------------------------------------------------
type Drag = { kind: 'move'; id: string; dx: number; dy: number } | { kind: 'link'; from: string; x: number; y: number }

function MapCanvas({ s, set }: { s: State; set: (f: (s: State) => State) => void }) {
  const board = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const [h, setH] = useState<Record<string, number>>({})
  const [drag, setDrag] = useState<Drag | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [editCard, setEditCard] = useState<string | null>(null)
  const [editEdge, setEditEdge] = useState<string | null>(null)
  const [openStack, setOpenStack] = useState<string | null>(null)
  const [openLoop, setOpenLoop] = useState<number | null>(null)
  const ro = s.ended // read-only after the summary

  // card heights for edge geometry
  useLayoutEffect(() => {
    const next: Record<string, number> = {}
    refs.current.forEach((el, id) => (next[id] = el.offsetHeight))
    if (JSON.stringify(next) !== JSON.stringify(h)) setH(next)
  })

  const pt = (e: { clientX: number; clientY: number }) => {
    const r = board.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const card = (id: string) => s.cards.find((c) => c.id === id)!
  const center = (c: Card) => ({ x: c.x + W / 2, y: c.y + (h[c.id] ?? 48) / 2 })
  // where the line from a card's centre towards p leaves the card's box
  const exit = (c: Card, p: { x: number; y: number }) => {
    const o = center(c)
    const dx = p.x - o.x
    const dy = p.y - o.y
    const k = Math.min(W / 2 / Math.abs(dx || 1e-6), (h[c.id] ?? 48) / 2 / Math.abs(dy || 1e-6))
    return { x: o.x + dx * Math.min(k, 1), y: o.y + dy * Math.min(k, 1) }
  }
  const cardAt = (cx: number, cy: number, except: string) =>
    document
      .elementsFromPoint(cx, cy)
      .map((el) => (el as HTMLElement).closest<HTMLElement>('[data-card]')?.dataset.card)
      .find((id) => id && id !== except)

  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      const p = pt(e)
      if (drag.kind === 'move') set((st) => ({ ...st, cards: st.cards.map((c) => (c.id === drag.id ? { ...c, x: Math.max(0, p.x - drag.dx), y: Math.max(0, p.y - drag.dy) } : c)) }))
      else setDrag({ ...drag, x: p.x, y: p.y })
    }
    const up = (e: PointerEvent) => {
      const target = cardAt(e.clientX, e.clientY, drag.kind === 'move' ? drag.id : drag.from)
      if (drag.kind === 'link' && target && !s.edges.some((x) => x.from === drag.from && x.to === target))
        set((st) => ({ ...st, edges: [...st.edges, { id: uid(), from: drag.from, to: target, label: stubLabel() }] })) // stub: AI labels in step 4
      if (drag.kind === 'move' && target) stack(drag.id, target) // dropped onto another card → stack
      setDrag(null)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    return () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
    }
  })

  // merge `from` into `into`; edges follow the surviving card
  const stack = (from: string, into: string) =>
    set((st) => {
      const a = st.cards.find((c) => c.id === from)!
      return {
        ...st,
        cards: st.cards.filter((c) => c.id !== from).map((c) => (c.id === into ? { ...c, stack: [...c.stack, a.text, ...a.stack] } : c)),
        edges: st.edges
          .map((x) => ({ ...x, from: x.from === from ? into : x.from, to: x.to === from ? into : x.to }))
          .filter((x, i, all) => x.from !== x.to && all.findIndex((y) => y.from === x.from && y.to === x.to) === i),
      }
    })
  const unstack = (id: string, i: number) =>
    set((st) => {
      const c = st.cards.find((x) => x.id === id)!
      return { ...st, cards: [...st.cards.map((x) => (x.id === id ? { ...x, stack: x.stack.filter((_, j) => j !== i) } : x)), { id: uid(), text: c.stack[i], src: c.src, x: c.x + 30, y: c.y + 120, stack: [] }] }
    })
  const remove = (id: string) => set((st) => ({ ...st, cards: st.cards.filter((c) => c.id !== id), edges: st.edges.filter((x) => x.from !== id && x.to !== id) }))

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (ro || !sel || (e.key !== 'Delete' && e.key !== 'Backspace') || (e.target as HTMLElement).closest('input,textarea')) return
      remove(sel)
      setSel(null)
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })

  const groups = loops(s.edges)
  const inLoop = new Set(groups.flat())
  const mid = (x: Edge) => {
    const a = center(card(x.from))
    const b = center(card(x.to))
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  return (
    <main
      className={`tm-board${ro ? ' ro' : ''}`}
      ref={board}
      onPointerDown={(e) => e.target === board.current && (setSel(null), setOpenLoop(null))}
      onDoubleClick={(e) => {
        if (ro || e.target !== board.current) return
        const p = pt(e)
        const id = uid()
        set((st) => ({ ...st, cards: [...st.cards, { id, text: '', src: 'you', x: p.x - W / 2, y: p.y - 20, stack: [] }] }))
        setEditCard(id)
      }}
    >
      <svg className="tm-edges" aria-hidden="true">
        <defs>
          <marker id="tm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        </defs>
        {s.edges.map((x) => {
          const a = card(x.from)
          const b = card(x.to)
          if (!a || !b) return null
          const p = exit(a, center(b))
          const q = exit(b, center(a))
          return <line key={x.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={inLoop.has(x.id) ? 'loop' : ''} markerEnd="url(#tm-arrow)" />
        })}
        {drag?.kind === 'link' && (() => {
          const a = center(card(drag.from))
          return <line x1={a.x} y1={a.y} x2={drag.x} y2={drag.y} className="temp" />
        })()}
      </svg>

      {s.edges.map((x) => {
        if (!card(x.from) || !card(x.to)) return null
        const m = mid(x)
        return editEdge === x.id ? (
          <span key={x.id} className="tm-label edit" style={{ left: m.x, top: m.y }}>
            <input autoFocus defaultValue={x.label} maxLength={60} placeholder="how are they linked?" onBlur={(e) => (set((st) => ({ ...st, edges: st.edges.map((y) => (y.id === x.id ? { ...y, label: e.target.value } : y)) })), setEditEdge(null))} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            <button aria-label="Delete line" onPointerDown={(e) => (e.preventDefault(), set((st) => ({ ...st, edges: st.edges.filter((y) => y.id !== x.id) })), setEditEdge(null))}>
              ×
            </button>
          </span>
        ) : (
          <button key={x.id} className={`tm-label${x.label ? '' : ' blank'}`} style={{ left: m.x, top: m.y }} disabled={ro} onClick={() => setEditEdge(x.id)}>
            {x.label || '+ label'}
          </button>
        )
      })}

      {groups.map((g, i) => {
        const ms = g.map((id) => mid(s.edges.find((x) => x.id === id)!))
        const c = { x: ms.reduce((t, m) => t + m.x, 0) / ms.length, y: ms.reduce((t, m) => t + m.y, 0) / ms.length }
        return (
          <span key={g.join()}>
            <button className="tm-loop" style={{ left: c.x, top: c.y }} onClick={() => setOpenLoop(openLoop === i ? null : i)}>
              loop
            </button>
            {openLoop === i && (
              <div className="tm-pop">
                <p>{stubLoopNote}</p>
                <button onClick={() => setOpenLoop(null)}>Got it</button>
              </div>
            )}
          </span>
        )
      })}

      {s.cards.map((c) => (
        <div
          key={c.id}
          data-card={c.id}
          ref={(el) => void (el ? refs.current.set(c.id, el) : refs.current.delete(c.id))}
          className={`tm-card ${c.src}${sel === c.id ? ' sel' : ''}${c.stack.length ? ' stacked' : ''}${drag?.kind === 'move' && drag.id === c.id ? ' dragging' : ''}`}
          style={{ left: c.x, top: c.y, width: W }}
          onPointerDown={(e) => {
            if (ro || editCard === c.id || (e.target as HTMLElement).closest('button')) return
            const p = pt(e)
            setSel(c.id)
            setDrag({ kind: 'move', id: c.id, dx: p.x - c.x, dy: p.y - c.y })
          }}
          onDoubleClick={() => !ro && setEditCard(c.id)}
        >
          {editCard === c.id ? (
            <textarea
              autoFocus
              defaultValue={c.text}
              onBlur={(e) => {
                const t = e.target.value.trim()
                if (t) set((st) => ({ ...st, cards: st.cards.map((x) => (x.id === c.id ? { ...x, text: t } : x)) }))
                else remove(c.id) // an empty new card disappears
                setEditCard(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), e.currentTarget.blur())}
            />
          ) : (
            <span className="tm-text">{c.text}</span>
          )}
          <span className="tm-src">{c.src === 'ai' ? 'AI' : 'you'}</span>
          {c.stack.length > 0 && (
            <button className="tm-badge" onClick={() => setOpenStack(openStack === c.id ? null : c.id)}>
              ×{c.stack.length + 1}
            </button>
          )}
          {openStack === c.id && (
            <div className="tm-stacklist">
              {c.stack.map((t, i) => (
                <div key={i}>
                  <span>{t}</span>
                  {!ro && <button onClick={() => unstack(c.id, i)}>pull out</button>}
                </div>
              ))}
            </div>
          )}
          {!ro && (
            <span
              className="tm-handle"
              title="Drag to another card to connect"
              onPointerDown={(e) => {
                e.stopPropagation()
                const p = pt(e)
                setDrag({ kind: 'link', from: c.id, x: p.x, y: p.y })
              }}
            />
          )}
        </div>
      ))}

      {!s.cards.length && <p className="tm-empty board">Double-click anywhere to add a card.</p>}
      {!ro && s.cards.length > 0 && <p className="tm-help">Drag a card to move it · drag the dot on its right edge to another card to connect · drop a card onto another to stack · double-click to edit · Delete removes</p>}
    </main>
  )
}

// --- 4 · summary -------------------------------------------------------------------------------
function Summary({ s, close }: { s: State; close: () => void }) {
  const ls = loops(s.edges)
  const hub = [...s.cards].sort((a, b) => s.edges.filter((x) => x.to === b.id || x.from === b.id).length - s.edges.filter((x) => x.to === a.id || x.from === a.id).length)[0]
  const step = s.cards.find((c) => c.src === 'ai') ?? s.cards.at(-1) // stub: the AI picks one of your cards in step 4
  return (
    <>
      <div className="tm-dim" onClick={close} />
      <aside className="tm-summary" aria-label="Summary">
        <span className="tm-tag">Tonight’s map</span>
        <p>
          You put {s.cards.length} cards on the map{hub ? `; most lines run through “${hub.text}”` : ''}
          {ls.length ? `, and ${ls.length === 1 ? 'one loop' : `${ls.length} loops`} showed up` : ''}.
        </p>
        <span className="tm-tag">This is common</span>
        <p>When several unfinished things pile up, they keep claiming working memory, which is why it gets harder to start. (stub)</p>
        <span className="tm-tag">A next step already on your map</span>
        {step && <p className="tm-step">“{step.text}”</p>}
        <p className="tm-muted">That’s it for tonight. Your map stays here for next time.</p>
        <button onClick={close}>Close</button>
      </aside>
    </>
  )
}

function Referral({ close }: { close: () => void }) {
  return (
    <div className="tm-referral" role="alert">
      <p>
        <b>It sounds like things are really heavy right now.</b> You don’t have to carry this alone. Please reach out to someone now:
      </p>
      <ul>
        <li>Germany · TelefonSeelsorge: 0800 111 0 111 or 0800 111 0 222 (free, 24/7)</li>
        <li>Taiwan · 安心專線: 1925 (24/7)</li>
        <li>In immediate danger: 112 (EU emergency)</li>
      </ul>
      <button onClick={close}>Close</button>
    </div>
  )
}
