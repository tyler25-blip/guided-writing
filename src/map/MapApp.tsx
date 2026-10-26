// Thought map MVP (/map): chat → pick cards → connect them yourself → summary. Greyscale on purpose.
// Step 4: the AI calls go through server/map.ts (checked there). If the server has no key or no answer passes, the stubs below stand in.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isCrisis } from '../triggers.ts'
import { DevPanel } from './dev.tsx'
import { loops } from './graph.ts'
import './map.css'

type Src = 'you' | 'ai'
type Card = { id: string; text: string; src: Src; x: number; y: number; stack: string[] } // stack = texts merged into this card
type Edge = { id: string; from: string; to: string; label: string }
type Msg = { role: Src; text: string; propose?: boolean; declined?: boolean } // propose: the AI offers to spread it out
type Cand = { id: string; text: string; src: Src; on: boolean }
type Phase = 'chat' | 'pick' | 'map'
type Sum = { restate: string; common: string; step: string } // step = id of a card on the map, or ''
export type State = { phase: Phase; msgs: Msg[]; cands: Cand[]; cards: Card[]; edges: Edge[]; ended: boolean; sum?: Sum }

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

const ai = async <T,>(path: string, body: unknown): Promise<T | null> => {
  try {
    const r = await fetch(`/api/map/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}
const plain = (cards: Card[]) => cards.map(({ id, text, src }) => ({ id, text, src }))

// --- stubs: used when the AI is unavailable ---------------------------------------------------
const stubReply = (n: number): Msg =>
  n < 3 ? { role: 'ai', text: 'That sounds like a lot at once. Which part is taking up the most room right now?' } : { role: 'ai', text: 'There are quite a few threads here now.', propose: true }
const stubCands = (msgs: Msg[]): Cand[] => [
  ...msgs.filter((m) => m.role === 'you').flatMap((m) => m.text.split(/(?<=[.!?。！？])\s*/).filter((s) => s.trim()).map((text) => ({ id: uid(), text: text.trim(), src: 'you' as Src, on: false }))),
  { id: uid(), text: 'Send a one-line status update', src: 'ai', on: false },
]
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
            <button className="solid" onClick={() => (set((p) => ({ ...p, ended: true, sum: undefined })), setSummary(true))}>
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
      {summary && <Summary s={s} set={set} close={() => setSummary(false)} />}
      {crisis && <Referral close={() => setCrisis(false)} />}
      {toast && <div className="tm-toast">{toast}</div>}
      {import.meta.env.DEV && <DevPanel s={s} setS={setS} openSummary={setSummary} crisis={() => setCrisis(true)} />}
    </div>
  )
}

// --- 1 · chat ----------------------------------------------------------------------------------
function Chat({ s, set, onCrisis, say }: { s: State; set: (f: (s: State) => State) => void; onCrisis: () => void; say: (t: string) => void }) {
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [s.msgs.length, typing])
  const last = s.msgs.at(-1)
  const declines = s.msgs.filter((m) => m.declined).length
  const propose = !typing && last?.role === 'ai' && last.propose && !last.declined && declines < 2 // the AI offers; at most twice declined
  const send = async () => {
    const text = draft.trim()
    if (!text || typing) return
    setDraft('')
    if (isCrisis(text)) onCrisis()
    const msgs: Msg[] = [...s.msgs, { role: 'you', text }]
    set((p) => ({ ...p, msgs }))
    setTyping(true)
    const r = await ai<{ reply: string; propose: boolean }>('reply', { msgs })
    setTyping(false)
    const reply: Msg = r ? { role: 'ai', text: r.reply, propose: r.propose } : stubReply(msgs.filter((m) => m.role === 'you').length)
    set((p) => ({ ...p, msgs: [...p.msgs, reply] }))
  }
  const decline = () => set((p) => ({ ...p, msgs: p.msgs.map((m, i) => (i === p.msgs.length - 1 ? { ...m, declined: true } : m)) }))
  return (
    <main className="tm-chat">
      <div className="tm-msgs">
        {!s.msgs.length && <p className="tm-empty">What’s taking up room in your head tonight?</p>}
        {s.msgs.map((m, i) => (
          <p key={i} className={`tm-msg ${m.role}`}>
            {m.text}
          </p>
        ))}
        {typing && <p className="tm-msg ai tm-typing">…</p>}
        {propose && (
          <div className="tm-propose">
            Want to spread it out and look at it?
            <button className="solid" onClick={() => set((p) => ({ ...p, phase: 'pick', cands: [] }))}>
              Spread it out
            </button>
            <button onClick={decline}>Talk a bit more</button>
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
  const asked = useRef(false)
  useEffect(() => {
    if (s.cands.length || asked.current) return
    asked.current = true
    ai<{ you: string[]; ai: string[] }>('cards', { msgs: s.msgs }).then((r) =>
      set((p) => ({
        ...p,
        cands: r ? [...r.you.map((text) => ({ id: uid(), text, src: 'you' as Src, on: false })), ...r.ai.map((text) => ({ id: uid(), text, src: 'ai' as Src, on: false }))] : stubCands(p.msgs),
      })),
    )
  })
  const place = () =>
    set((p) => ({
      ...p,
      phase: 'map',
      cards: [...p.cards, ...chosen.map((c, i) => ({ id: c.id, text: c.text, src: c.src, x: 60 + (i % 4) * 300, y: 60 + Math.floor(i / 4) * 230, stack: [] }))],
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
      <p className="tm-hint">{!s.cands.length ? 'Laying your words out as cards…' : `${chosen.length ? '' : 'Nothing is selected yet. '}Click to choose, double-click to edit. Cards you don’t choose are discarded.`}</p>
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
  const [notes, setNotes] = useState<Record<string, string>>({}) // loop note per loop (edge ids joined)
  const [labelling, setLabelling] = useState<string[]>([]) // edges waiting for an AI label
  const [pairs, setPairs] = useState<{ a: string; b: string }[]>([]) // AI: these two say the same thing
  const ro = s.ended // read-only after the summary

  // once per visit: ask which cards repeat each other; the person stacks them by hand (or not)
  const askedStack = useRef(false)
  useEffect(() => {
    if (ro || askedStack.current || s.cards.length < 2) return
    askedStack.current = true
    ai<{ pairs: { a: string; b: string }[] }>('stack', { cards: plain(s.cards) }).then((r) => r && setPairs(r.pairs))
  })
  const pair = pairs.find((x) => s.cards.some((c) => c.id === x.a) && s.cards.some((c) => c.id === x.b))

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
      if (drag.kind === 'link' && target && !s.edges.some((x) => x.from === drag.from && x.to === target)) {
        const id = uid()
        set((st) => ({ ...st, edges: [...st.edges, { id, from: drag.from, to: target, label: '' }] }))
        setLabelling((l) => [...l, id])
        ai<{ label: string }>('label', { cards: plain(s.cards), from: drag.from, to: target }).then((r) => {
          setLabelling((l) => l.filter((x) => x !== id))
          if (r?.label) set((st) => ({ ...st, edges: st.edges.map((x) => (x.id === id && !x.label ? { ...x, label: r.label } : x)) })) // never over a label they typed
        })
      }
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
  // A line, or an arc when the opposite line exists too, so A→B and B→A don't sit on top of each other.
  // The bend is to the left of the travel direction, so the two arcs fall on opposite sides.
  const geom = (x: Edge) => {
    const a = card(x.from)
    const b = card(x.to)
    const ca = center(a)
    const cb = center(b)
    const bend = s.edges.some((y) => y.from === x.to && y.to === x.from) ? 45 : 0
    const len = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1
    const c = { x: (ca.x + cb.x) / 2 + ((cb.y - ca.y) / len) * bend, y: (ca.y + cb.y) / 2 - ((cb.x - ca.x) / len) * bend }
    const p = exit(a, c)
    const q = exit(b, c)
    return { d: `M${p.x},${p.y} Q${c.x},${c.y} ${q.x},${q.y}`, m: { x: (p.x + 2 * c.x + q.x) / 4, y: (p.y + 2 * c.y + q.y) / 4 } }
  }
  const mid = (x: Edge) => geom(x).m
  const openNote = (i: number, g: string[]) => {
    setOpenLoop(openLoop === i ? null : i)
    const k = g.join()
    if (notes[k] !== undefined) return
    setNotes((n) => ({ ...n, [k]: '' }))
    ai<{ note: string }>('loop', { cards: plain(s.cards), edges: g.map((id) => s.edges.find((x) => x.id === id)!) }).then((r) => setNotes((n) => ({ ...n, [k]: r?.note || stubLoopNote })))
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
          return <path key={x.id} d={geom(x).d} className={inLoop.has(x.id) ? 'loop' : ''} markerEnd="url(#tm-arrow)" />
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
            {x.label || (labelling.includes(x.id) ? '…' : '+ label')}
          </button>
        )
      })}

      {groups.map((g, i) => {
        const ms = g.map((id) => mid(s.edges.find((x) => x.id === id)!))
        const c = { x: ms.reduce((t, m) => t + m.x, 0) / ms.length, y: ms.reduce((t, m) => t + m.y, 0) / ms.length }
        return (
          <span key={g.join()}>
            <button className="tm-loop" style={{ left: c.x, top: c.y }} onClick={() => openNote(i, g)}>
              loop
            </button>
            {openLoop === i && (
              <div className="tm-pop">
                <p>{notes[g.join()] || '…'}</p>
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
          className={`tm-card ${c.src}${sel === c.id ? ' sel' : ''}${pair && (pair.a === c.id || pair.b === c.id) ? ' hint' : ''}${c.stack.length ? ' stacked' : ''}${drag?.kind === 'move' && drag.id === c.id ? ' dragging' : ''}`}
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
          {!ro &&
            (['t', 'r', 'b', 'l'] as const).map((side) => (
              <span
                key={side}
                className={`tm-handle ${side}`}
                title="Drag to another card to connect"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  const p = pt(e)
                  setDrag({ kind: 'link', from: c.id, x: p.x, y: p.y })
                }}
              />
            ))}
        </div>
      ))}

      {!ro && pair && openLoop === null && (
        <div className="tm-tip">
          These two look like the same thought. Drag one onto the other to stack them, or leave them as they are.
          <button onClick={() => setPairs((ps) => ps.filter((x) => x !== pair))}>Leave them</button>
        </div>
      )}
      {!s.cards.length && <p className="tm-empty board">Double-click anywhere to add a card.</p>}
      {!ro && s.cards.length > 0 && <p className="tm-help">Drag a card to move it · drag a dot on any edge to another card to connect · drop a card onto another to stack · double-click to edit · Delete removes</p>}
    </main>
  )
}

// --- 4 · summary -------------------------------------------------------------------------------
function Summary({ s, set, close }: { s: State; set: (f: (s: State) => State) => void; close: () => void }) {
  const ls = loops(s.edges)
  const asked = useRef(false)
  useEffect(() => {
    if (s.sum || asked.current) return
    asked.current = true
    ai<{ restate: string; common: string; step_id: string }>('summary', { cards: plain(s.cards), edges: s.edges, loops: ls.length }).then((r) =>
      set((p) => ({ ...p, sum: r ? { restate: r.restate, common: r.common, step: r.step_id } : stubSum(p) })),
    )
  })
  const step = s.cards.find((c) => c.id === s.sum?.step)
  return (
    <>
      <div className="tm-dim" onClick={close} />
      <aside className="tm-summary" aria-label="Summary">
        <span className="tm-tag">Tonight’s map</span>
        {!s.sum && <p className="tm-muted">Reading your map…</p>}
        {s.sum && (
          <>
            <p>{s.sum.restate}</p>
            <span className="tm-tag">This is common</span>
            <p>{s.sum.common}</p>
            {step && (
              <>
                <span className="tm-tag">A next step already on your map</span>
                <p className="tm-step">“{step.text}”</p>
              </>
            )}
          </>
        )}
        <p className="tm-muted">That’s it for tonight. Your map stays here for next time.</p>
        <button onClick={close}>Close</button>
      </aside>
    </>
  )
}

function stubSum(s: State): Sum {
  const deg = (id: string) => s.edges.filter((x) => x.to === id || x.from === id).length
  const hub = [...s.cards].sort((a, b) => deg(b.id) - deg(a.id))[0]
  const n = loops(s.edges).length
  return {
    restate: `You put ${s.cards.length} cards on the map${hub ? `; most lines run through “${hub.text}”` : ''}${n ? `, and ${n === 1 ? 'one loop' : `${n} loops`} showed up` : ''}.`,
    common: 'When several unfinished things pile up, they keep claiming attention, which is why it gets harder to start.',
    step: (s.cards.find((c) => c.src === 'ai') ?? s.cards.at(-1))?.id ?? '',
  }
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
