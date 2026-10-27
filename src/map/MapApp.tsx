// Thought map MVP (/map): chat → the AI lays out up to 10 of your sentences → connect them yourself → summary. Greyscale on purpose.
// Step 4: the AI calls go through server/map.ts (checked there). If the server has no key or no answer passes, the stubs below stand in.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isCrisis } from '../triggers.ts'
import { DevPanel } from './dev.tsx'
import { loops } from './graph.ts'
import { ai, getKey, hasServer, NEED_KEY, setKey } from './link.ts'
import './map.css'

type Src = 'you' | 'ai'
type Step = { when: string; where: string } // a card the person wrote to break a loop: what (= text), when, where
type Card = { id: string; text: string; src: Src; x: number; y: number; stack: string[]; step?: Step; kind?: string } // stack = texts merged in; kind = event/feeling/thought/worry/action, AI-only for now
type Edge = { id: string; from: string; to: string; label: string; by?: 'ai' } // by: drawn by "Arrange for me" until the person edits it
// notes: the AI's private understanding after this reply (what material is there, the core, how they're stuck). Never shown in the chat.
export type Notes = { have: Record<string, boolean>; core: string; stuck: string; help: string; ready: boolean }
type Msg = { role: Src; text: string; propose?: boolean; declined?: boolean; notes?: Notes } // propose: the AI offers to spread it out
type Phase = 'chat' | 'layout' | 'map'
type Sum = { restate: string; stuck?: string; step: string } // stuck: the one place the AI's read of the core shows; step: only when no step card
// risk: something they wrote sounded like hopelessness or self-harm → no map, no loop notes, no summary; support numbers instead
// log: every AI decision on this map, for the back office (/map/admin). Stays in this browser like the map.
export type Made = { id: string; text: string; kind: string; from: number; why: string }
export type Log =
  | { t: 'cards'; at: number; notes?: Notes; made: Made[]; skipped: { text: string; why: string }[]; fallback?: boolean; since?: number }
  | { t: 'arrange'; at: number; groups: { name: string; ids: string[] }[]; lines: { id: string; from: string; to: string; label: string }[] }
  | { t: 'label'; at: number; edge: string; from: string; to: string; label: string } // label '' = the AI left it blank
  | { t: 'stack'; at: number; pairs: { a: string; b: string }[] }
  | { t: 'loop'; at: number; edges: string[]; note: string; breakEdge: string }
  | { t: 'break'; at: number; edge: string; question: string; example: string; card: string; what: string; when: string; where: string }
  | { t: 'summary'; at: number; restate: string; stuck: string; step: string }
  | { t: 'risk'; at: number; where: string; text: string }
// spreadAt: how many messages had been sent when the last cards were made; areas: group names from "Arrange for me"
export type State = { phase: Phase; msgs: Msg[]; cards: Card[]; edges: Edge[]; ended: boolean; sum?: Sum; risk?: boolean; log?: Log[]; spreadAt?: number; areas?: { name: string; x: number; y: number }[] }
export const KEY = 'thought-map-v1'
type Set = (f: (s: State) => State) => void
type Entry = Log extends infer L ? (L extends Log ? Omit<L, 'at'> : never) : never
const logIt = (set: Set, e: Entry) => set((p) => ({ ...p, log: [...(p.log ?? []), { ...e, at: Date.now() } as Log] }))

const W = 180 // card width, px
const uid = () => Math.random().toString(36).slice(2, 9)
const fresh = (): State => ({ phase: 'chat', msgs: [], cards: [], edges: [], ended: false })
const load = (): State => {
  try {
    const st = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    if (st.phase === 'pick') return { ...st, phase: 'chat' } // the pick screen is gone
    return st.phase === 'map' && st.spreadAt === undefined ? { ...st, spreadAt: st.msgs.length } : st // older maps: all of the chat is already on it
  } catch {
    return fresh()
  }
}

const plain = (cards: Card[]) => cards.map(({ id, text, src }) => ({ id, text, src }))
export const lastNotes = (msgs: Msg[]) => msgs.findLast((m) => m.notes)?.notes

// --- stubs: used when the AI is unavailable ---------------------------------------------------
const stubReply = (n: number): Msg =>
  n < 3 ? { role: 'ai', text: 'That sounds like a lot at once. Which part is taking up the most room right now?' } : { role: 'ai', text: 'There are quite a few threads here now.', propose: true }
const stubCards = (msgs: Msg[]) =>
  msgs.filter((m) => m.role === 'you').flatMap((m) => m.text.split(/(?<=[.!?。！？])\s*/).map((t) => t.trim()).filter(Boolean)).slice(0, 10)
const stubLoop = { note: 'One thought here leads to the next and back again. Click any line in the loop to write one thing you could do there.', edge: '' }
const SAFE = 'Something you wrote sounds really heavy. The map can wait. Please talk to someone now: the numbers are under “Get support”.'

export default function MapApp() {
  const [s, setS] = useState<State>(load)
  const set = (f: (s: State) => State) => setS((p) => f(p))
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(s))
  }, [s])
  const [toast, setToast] = useState('')
  const [crisis, setCrisis] = useState(false)
  const [summary, setSummary] = useState(false)
  const [talk, setTalk] = useState(false) // the conversation panel beside the map
  const [keyOpen, setKeyOpen] = useState(false)
  const [needKey, setNeedKey] = useState(false)
  const [arranging, setArranging] = useState(false)
  useEffect(() => {
    const on = () => setNeedKey(true)
    addEventListener(NEED_KEY, on)
    return () => removeEventListener(NEED_KEY, on)
  }, [])
  // "Arrange for me": the AI groups the cards and draws a few lines, all of it editable
  const arrange = async () => {
    setArranging(true)
    const r = await ai<{ groups: { name: string; ids: string[] }[]; lines: { from: string; to: string; label: string }[]; risk?: boolean }>('arrange', {
      cards: s.cards.map(({ id, text, src, kind }) => ({ id, text, src, kind })),
      edges: s.edges,
    })
    setArranging(false)
    if (!r) return say('The AI couldn’t arrange it this time. Your map is unchanged.')
    if (r.risk) return set((p) => ({ ...p, risk: true }))
    set((p) => {
      const pos: Record<string, { x: number; y: number }> = {}
      r.groups.forEach((g, gi) => g.ids.forEach((id, k) => (pos[id] = { x: 60 + gi * 320 + (k % 2) * 24, y: 96 + k * 175 })))
      const lines = r.lines.map((l) => ({ id: uid(), ...l, by: 'ai' as const }))
      const entry: Log = { t: 'arrange', at: Date.now(), groups: r.groups, lines }
      return {
        ...p,
        cards: p.cards.map((c) => (pos[c.id] ? { ...c, ...pos[c.id] } : c)),
        edges: [...p.edges, ...lines],
        areas: r.groups.map((g, gi) => ({ name: g.name, x: 60 + gi * 320, y: 52 })),
        log: [...(p.log ?? []), entry],
      }
    })
  }
  const say = (t: string) => (setToast(t), setTimeout(() => setToast(''), 2200))
  const restart = () => (setS(fresh()), setSummary(false))
  // any text the person writes
  const risky = (t: string, where = 'chat') => isCrisis(t) && (set((p) => ({ ...p, risk: true })), logIt(set, { t: 'risk', where: `${where} (risk words)`, text: t }), setCrisis(true), true)
  return (
    <div className="tm">
      <header className="tm-bar">
        <span className="tm-title">Thought map{s.phase === 'map' ? (s.ended ? ' · summary' : ' · connect them yourself') : ''}</span>
        <span className="tm-actions">
          {s.risk && (
            <button className="solid" onClick={() => setCrisis(true)}>
              Get support
            </button>
          )}
          {s.phase === 'map' && (
            <button aria-pressed={talk} onClick={() => setTalk(!talk)}>
              Conversation
            </button>
          )}
          {s.phase === 'map' && !s.ended && !s.risk && s.cards.length > 1 && (
            <button disabled={arranging} onClick={arrange} title="The AI groups your cards and draws a few lines. You can change all of it.">
              {arranging ? 'Arranging…' : 'Arrange for me'}
            </button>
          )}
          {s.phase === 'map' && !s.ended && !s.risk && (
            <button className="solid" onClick={() => (set((p) => ({ ...p, ended: true, sum: undefined })), setSummary(true))}>
              That’s enough for now
            </button>
          )}
          {s.phase === 'map' && s.ended && <button onClick={() => setSummary(true)}>Summary</button>}
          {(s.ended || s.phase !== 'chat') && <button onClick={restart}>New map</button>}
          <button className="tm-keybtn" onClick={() => setKeyOpen(true)} title="Your Anthropic API key">
            AI key
          </button>
        </span>
      </header>
      {s.phase === 'chat' && <Chat s={s} set={set} risky={risky} onRisk={() => setCrisis(true)} say={say} />}
      {s.phase === 'layout' && <Layout s={s} set={set} />}
      {s.phase === 'map' && <MapCanvas s={s} set={set} risky={risky} />}
      {s.phase === 'map' && talk && (
        <aside className="tm-talk" aria-label="Conversation">
          <Chat s={s} set={set} risky={risky} onRisk={() => setCrisis(true)} say={say} compact close={() => setTalk(false)} />
        </aside>
      )}
      {keyOpen && <KeyPanel close={() => (setKeyOpen(false), setNeedKey(false))} />}
      {needKey && !keyOpen && (
        <div className="tm-needkey" role="status">
          The AI needs an Anthropic API key to answer.
          <button className="solid" onClick={() => setKeyOpen(true)}>
            Add your key
          </button>
          <button onClick={() => setNeedKey(false)}>Not now</button>
        </div>
      )}
      {summary && <Summary s={s} set={set} close={() => setSummary(false)} />}
      {crisis && <Referral close={() => setCrisis(false)} />}
      {toast && <div className="tm-toast">{toast}</div>}
      {import.meta.env.DEV && <DevPanel s={s} setS={setS} openSummary={setSummary} crisis={() => setCrisis(true)} />}
    </div>
  )
}

// --- 1 · chat ----------------------------------------------------------------------------------
function Chat({ s, set, risky, onRisk, say, compact, close }: { s: State; set: Set; risky: (t: string, where?: string) => boolean; onRisk: () => void; say: (t: string) => void; compact?: boolean; close?: () => void }) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  // compact = the panel beside the map: whatever they say after the map was made can become new cards
  const newTurns = compact ? s.msgs.slice(s.spreadAt ?? s.msgs.length).filter((m) => m.role === 'you').length : 0
  const addNew = async () => {
    setAdding(true)
    const since = s.msgs.slice(0, s.spreadAt ?? 0).filter((m) => m.role === 'you').length
    const r = await ai<{ you: Omit<Made, 'id'>[]; skipped: { text: string; why: string }[]; risk?: boolean }>('cards', {
      msgs: s.msgs.map(({ role, text }) => ({ role, text })),
      notes: lastNotes(s.msgs),
      since,
      existing: s.cards.map((c) => c.text),
    })
    setAdding(false)
    if (r?.risk) return set((p) => ({ ...p, risk: true }))
    if (!r?.you.length) return say('Nothing new to add as a card this time.')
    set((p) => {
      const bottom = Math.max(0, ...p.cards.map((c) => c.y)) + 230
      const made = r.you.map((c) => ({ ...c, id: uid() }))
      const cards = made.map(({ id, text, kind }, i) => ({ id, text, kind, src: 'you' as Src, x: 60 + i * 260, y: bottom, stack: [] }))
      const entry: Log = { t: 'cards', at: Date.now(), notes: lastNotes(p.msgs), made, skipped: r.skipped, since }
      return { ...p, cards: [...p.cards, ...cards], spreadAt: p.msgs.length, log: [...(p.log ?? []), entry] }
    })
    say(`Added ${r.you.length} new card${r.you.length > 1 ? 's' : ''} at the bottom of the map.`)
  }
  const [typing, setTyping] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [s.msgs.length, typing])
  const last = s.msgs.at(-1)
  const declines = s.msgs.filter((m) => m.declined).length
  const propose = !compact && !s.risk && !typing && last?.role === 'ai' && last.propose && !last.declined && declines < 2 // the AI offers; at most twice declined
  const send = async () => {
    const text = draft.trim()
    if (!text || typing) return
    setDraft('')
    const risk = risky(text) || !!s.risk
    const msgs: Msg[] = [...s.msgs, { role: 'you', text }]
    set((p) => ({ ...p, msgs }))
    setTyping(true)
    const r = await ai<{ reply: string; propose: boolean; risk: boolean; notes?: Notes }>('reply', { msgs: msgs.map(({ role, text, declined }) => ({ role, text, declined })), risk })
    setTyping(false)
    if (r?.risk && !s.risk) {
      set((p) => ({ ...p, risk: true })) // the AI heard it even without the words
      logIt(set, { t: 'risk', where: 'chat (AI judged it, no risk words)', text })
      onRisk()
    }
    const reply: Msg = r ? { role: 'ai', text: r.reply, propose: r.propose && !r.risk, notes: r.notes } : risk ? { role: 'ai', text: SAFE } : stubReply(msgs.filter((m) => m.role === 'you').length)
    set((p) => ({ ...p, msgs: [...p.msgs, reply] }))
  }
  const decline = () => set((p) => ({ ...p, msgs: p.msgs.map((m, i) => (i === p.msgs.length - 1 ? { ...m, declined: true } : m)) }))
  return (
    <main className={`tm-chat${compact ? ' compact' : ''}`}>
      {compact && (
        <div className="tm-talkhead">
          <span className="tm-tag">The whole conversation</span>
          <button aria-label="Close the conversation" onClick={close}>
            ×
          </button>
        </div>
      )}
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
            <button className="solid" onClick={() => set((p) => ({ ...p, phase: 'layout' }))}>
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
      {compact && newTurns > 0 && !s.risk && !s.ended && (
        <button className="solid tm-addnew" disabled={adding} onClick={addNew}>
          {adding ? 'Making cards…' : 'Add what’s new to the map'}
        </button>
      )}
      {!compact && !s.risk && s.msgs.some((m) => m.role === 'you') && !propose && (
        <button className="tm-early" onClick={() => set((p) => ({ ...p, phase: 'layout' }))}>
          Spread it out now
        </button>
      )}
    </main>
  )
}

// --- 2 · layout: the AI picks up to 10 of your sentences and puts them on the map, no lines -------
function Layout({ s, set }: { s: State; set: Set }) {
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    ai<{ you: Omit<Made, 'id'>[]; skipped: { text: string; why: string }[]; risk?: boolean }>('cards', { msgs: s.msgs.map(({ role, text }) => ({ role, text })), notes: lastNotes(s.msgs) }).then((r) =>
      set((p) => {
        if (r?.risk) return { ...p, phase: 'chat', risk: true }
        const got = r?.you ?? stubCards(p.msgs).map((text) => ({ text, kind: '', from: 0, why: 'fallback: the AI was unavailable, sentences split by the program' }))
        const cols = got.length > 6 ? 4 : 3
        const made = got.map((c) => ({ ...c, id: uid() }))
        const cards = made.map(({ id, text, kind }, i) => ({ id, text, kind: kind || undefined, src: 'you' as Src, x: 60 + (i % cols) * 300 + (Math.floor(i / cols) % 2) * 60, y: 50 + Math.floor(i / cols) * 230, stack: [] }))
        const entry: Log = { t: 'cards', at: Date.now(), notes: lastNotes(p.msgs), made, skipped: r?.skipped ?? [], fallback: !r }
        return { ...p, phase: 'map', cards: [...p.cards, ...cards], log: [...(p.log ?? []), entry], spreadAt: p.msgs.length }
      }),
    )
  })
  return (
    <main className="tm-pick">
      <p className="tm-empty tm-wait">Laying your words out as cards…</p>
    </main>
  )
}

// --- 3 · map -----------------------------------------------------------------------------------
type Drag = { kind: 'move'; id: string; dx: number; dy: number } | { kind: 'link'; from: string; x: number; y: number }

function MapCanvas({ s, set, risky }: { s: State; set: Set; risky: (t: string, where?: string) => boolean }) {
  const board = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const [h, setH] = useState<Record<string, number>>({})
  const [drag, setDrag] = useState<Drag | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [editCard, setEditCard] = useState<string | null>(null)
  const [editEdge, setEditEdge] = useState<string | null>(null)
  const [openStack, setOpenStack] = useState<string | null>(null)
  const [openLoop, setOpenLoop] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<string, { note: string; edge: string }>>({}) // per loop (edge ids joined): note + the link that looks easiest to loosen
  const [breaking, setBreaking] = useState<string | null>(null) // the loop line the person clicked to write a step for
  const [labelling, setLabelling] = useState<string[]>([]) // edges waiting for an AI label
  const [pairs, setPairs] = useState<{ a: string; b: string }[]>([]) // AI: these two say the same thing
  const ro = s.ended // read-only after the summary

  // once per visit: ask which cards repeat each other; the person stacks them by hand (or not)
  const askedStack = useRef(false)
  useEffect(() => {
    if (ro || askedStack.current || s.cards.length < 2) return
    askedStack.current = true
    ai<{ pairs: { a: string; b: string }[] }>('stack', { cards: plain(s.cards) }).then((r) => {
      if (!r) return
      setPairs(r.pairs)
      logIt(set, { t: 'stack', pairs: r.pairs })
    })
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
        const from = drag.from
        ai<{ label: string }>('label', { cards: plain(s.cards), from, to: target }).then((r) => {
          setLabelling((l) => l.filter((x) => x !== id))
          logIt(set, { t: 'label', edge: id, from, to: target, label: r?.label ?? '' })
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
    setBreaking(null)
    setOpenLoop(openLoop === i ? null : i)
    const k = g.join()
    if (notes[k] !== undefined) return
    if (s.risk) return setNotes((n) => ({ ...n, [k]: { note: SAFE, edge: '' } }))
    setNotes((n) => ({ ...n, [k]: { note: '', edge: '' } }))
    ai<{ note: string; break_edge: string; risk?: boolean }>('loop', { cards: plain(s.cards), edges: g.map((id) => s.edges.find((x) => x.id === id)!) }).then((r) => {
      if (r?.risk) set((p) => ({ ...p, risk: true }))
      setNotes((n) => ({ ...n, [k]: r?.risk ? { note: SAFE, edge: '' } : r ? { note: r.note, edge: r.break_edge } : stubLoop }))
      if (r && !r.risk) logIt(set, { t: 'loop', edges: g, note: r.note, breakEdge: r.break_edge })
    })
  }
  const breakable = new Set(Object.values(notes).map((n) => n.edge))
  const loopOf = (edge: string) => groups.find((g) => g.includes(edge)) ?? []
  const addStep = (edge: Edge, what: string, step: Step, g: { question: string; example: string }) => {
    if ([what, step.when, step.where].some((t) => risky(t, 'step card'))) return setBreaking(null)
    const m = mid(edge)
    const id = uid()
    logIt(set, { t: 'break', edge: edge.id, question: g.question, example: g.example, card: id, what, ...step })
    set((st) => ({
      ...st,
      cards: [...st.cards, { id, text: what, src: 'you', x: Math.max(0, m.x - W / 2 + 40), y: m.y + 70, stack: [], step }],
      edges: [...st.edges, { id: uid(), from: edge.from, to: id, label: 'this time' }],
    }))
    setBreaking(null)
    setOpenLoop(null)
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
          const cls = [inLoop.has(x.id) && 'loop', breakable.has(x.id) && 'breakable', breaking === x.id && 'breaking', x.by === 'ai' && 'ai'].filter(Boolean).join(' ')
          return <path key={x.id} d={geom(x).d} className={cls} markerEnd="url(#tm-arrow)" />
        })}
        {!ro &&
          !s.risk &&
          s.edges
            .filter((x) => inLoop.has(x.id))
            .map((x) => (
              <path key={x.id} d={geom(x).d} className="hit" onClick={() => (setOpenLoop(null), setBreaking(x.id))}>
                <title>Write one thing you could do here</title>
              </path>
            ))}
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
            <input autoFocus defaultValue={x.label} maxLength={60} placeholder="how are they linked?" onBlur={(e) => (risky(e.target.value, 'line label'), set((st) => ({ ...st, edges: st.edges.map((y) => (y.id === x.id ? { ...y, label: e.target.value, by: e.target.value === y.label ? y.by : undefined } : y)) })), setEditEdge(null))} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            <button aria-label="Delete line" onPointerDown={(e) => (e.preventDefault(), set((st) => ({ ...st, edges: st.edges.filter((y) => y.id !== x.id) })), setEditEdge(null))}>
              ×
            </button>
          </span>
        ) : (
          <button key={x.id} className={`tm-label${x.label ? '' : ' blank'}${x.by === 'ai' ? ' ai' : ''}`} style={{ left: m.x, top: m.y }} disabled={ro} onClick={() => setEditEdge(x.id)} title={x.by === 'ai' ? 'Drawn by “Arrange for me”. Click to change or delete it.' : undefined}>
            {x.by === 'ai' && <span className="tm-by">AI</span>}
            {x.label || (labelling.includes(x.id) ? '…' : '+ label')}
          </button>
        )
      })}

      {(s.areas ?? []).map((a, i) => (
        <span key={i} className="tm-area" style={{ left: a.x, top: a.y }}>
          {a.name}
          {!ro && (
            <button aria-label={`Remove the group name ${a.name}`} onClick={() => set((p) => ({ ...p, areas: (p.areas ?? []).filter((_, j) => j !== i) }))}>
              ×
            </button>
          )}
        </span>
      ))}

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
                <p>{notes[g.join()]?.note || '…'}</p>
                {!s.risk && notes[g.join()]?.note && <p className="tm-hint">The dashed line looks easiest to loosen. Click any line in the loop to write one thing you could do there.</p>}
                <span className="tm-actions">
                  {!ro && !s.risk && notes[g.join()]?.edge && (
                    <button className="solid" onClick={() => (setOpenLoop(null), setBreaking(notes[g.join()].edge))}>
                      Start with the dashed line
                    </button>
                  )}
                  <button onClick={() => setOpenLoop(null)}>Close</button>
                </span>
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
          className={`tm-card ${c.src}${c.step ? ' step' : ''}${sel === c.id ? ' sel' : ''}${pair && (pair.a === c.id || pair.b === c.id) ? ' hint' : ''}${c.stack.length ? ' stacked' : ''}${drag?.kind === 'move' && drag.id === c.id ? ' dragging' : ''}`}
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
                risky(t, 'card')
                if (t) set((st) => ({ ...st, cards: st.cards.map((x) => (x.id === c.id ? { ...x, text: t } : x)) }))
                else remove(c.id) // an empty new card disappears
                setEditCard(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), e.currentTarget.blur())}
            />
          ) : (
            <span className="tm-text">{c.text}</span>
          )}
          {c.step ? (
            <span className="tm-src">
              step{c.step.when && ` · ${c.step.when}`}
              {c.step.where && ` · ${c.step.where}`}
            </span>
          ) : (
            <span className="tm-src">{c.src === 'ai' ? 'AI' : 'you'}</span>
          )}
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

      {breaking && s.edges.some((x) => x.id === breaking) && (
        <Breaker key={breaking} s={s} edge={s.edges.find((x) => x.id === breaking)!} loop={loopOf(breaking)} done={addStep} cancel={() => setBreaking(null)} />
      )}
      {!ro && pair && openLoop === null && !breaking && (
        <div className="tm-tip">
          These two look like the same thought. Drag one onto the other to stack them, or leave them as they are.
          <button onClick={() => setPairs((ps) => ps.filter((x) => x !== pair))}>Leave them</button>
        </div>
      )}
      {!s.cards.length && <p className="tm-empty board">Double-click anywhere to add a card.</p>}
      {!ro && s.cards.length > 0 && !breaking && <p className="tm-help">Drag a card to move it · drag a dot on any edge to another card to connect · drop a card onto another to stack · double-click to edit · Delete removes{groups.length ? ' · click a line in a loop to write one thing you could do' : ''}</p>}
    </main>
  )
}

// The person's own Anthropic key: kept in this browser only, sent only to Anthropic.
function KeyPanel({ close }: { close: () => void }) {
  const [v, setV] = useState('')
  const [has, setHas] = useState(Boolean(getKey()))
  const [srv, setSrv] = useState(false)
  useEffect(() => void hasServer().then(setSrv), [])
  return (
    <>
      <div className="tm-dim" onClick={close} />
      <div className="tm-keypanel" role="dialog" aria-label="Your Anthropic API key">
        <span className="tm-tag">AI key</span>
        <p>{has ? 'Your key is saved in this browser.' : srv ? 'No key of your own: the AI runs on this computer’s server.' : 'No key yet. The AI needs your own Anthropic API key.'}</p>
        <label className="tm-field">
          <span>Anthropic API key</span>
          <input id="tm-key" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={v} onChange={(e) => setV(e.target.value)} />
        </label>
        <ul className="tm-keynotes">
          <li>The key stays in this browser and is sent only to Anthropic. Your conversation goes straight from here to Anthropic too; this site has no server.</li>
          <li>Use a key with a monthly spending limit. On a shared computer, press “Forget my key” when you are done.</li>
          <li>Get a key at console.anthropic.com → API keys.</li>
        </ul>
        <span className="tm-actions">
          <button className="solid" disabled={!v.trim().startsWith('sk-')} onClick={() => (setKey(v.trim()), setHas(true), setV(''), close())}>
            Save key
          </button>
          {has && <button onClick={() => (setKey(''), setHas(false))}>Forget my key</button>}
          <button onClick={close}>Close</button>
        </span>
      </div>
    </>
  )
}

// Click a line in a loop → one guiding question → write what / when / where → a step card next to that line.
function Breaker({ s, edge, loop, done, cancel }: { s: State; edge: Edge; loop: string[]; done: (e: Edge, what: string, step: Step, g: { question: string; example: string }) => void; cancel: () => void }) {
  const [g, setG] = useState<{ question: string; example: string } | null>(null)
  const [what, setWhat] = useState('')
  const [when, setWhen] = useState('')
  const [where, setWhere] = useState('')
  const name = (id: string) => s.cards.find((c) => c.id === id)?.text ?? ''
  useEffect(() => {
    let on = true
    ai<{ question: string; example: string }>('break', { cards: plain(s.cards), edge, loop: loop.map((id) => s.edges.find((x) => x.id === id)!) }).then(
      (r) => on && setG(r ?? { question: `Between “${name(edge.from)}” and “${name(edge.to)}”, what is one small thing you could do once, soon?`, example: '' }),
    )
    return () => void (on = false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="tm-pop tm-break" role="dialog" aria-label="Write one thing you could do">
      <span className="tm-tag">
        {name(edge.from)} → {name(edge.to)}
      </span>
      <p>{g ? g.question : '…'}</p>
      <label className="tm-field">
        <span>What will you do?</span>
        <textarea id="tm-step-what" rows={2} value={what} placeholder={g?.example || 'One small thing'} onChange={(e) => setWhat(e.target.value)} autoFocus />
      </label>
      <div className="tm-row">
        <label className="tm-field">
          <span>When?</span>
          <input id="tm-step-when" value={when} placeholder="Tomorrow after lunch" onChange={(e) => setWhen(e.target.value)} />
        </label>
        <label className="tm-field">
          <span>Where?</span>
          <input id="tm-step-where" value={where} placeholder="At my desk" onChange={(e) => setWhere(e.target.value)} />
        </label>
      </div>
      {what.trim() && (!when.trim() || !where.trim()) && <p className="tm-hint">A time and a place make it much more likely to happen.</p>}
      <span className="tm-actions">
        <button className="solid" disabled={!what.trim()} onClick={() => done(edge, what.trim(), { when: when.trim(), where: where.trim() }, g ?? { question: '', example: '' })}>
          Put it on the map
        </button>
        <button onClick={cancel}>Not now</button>
      </span>
    </div>
  )
}

// --- 4 · summary -------------------------------------------------------------------------------
function Summary({ s, set, close }: { s: State; set: Set; close: () => void }) {
  const ls = loops(s.edges)
  const steps = s.cards.filter((c) => c.step)
  const asked = useRef(false)
  useEffect(() => {
    if (s.sum || asked.current) return
    asked.current = true
    if (s.risk) return set((p) => ({ ...p, sum: { restate: SAFE, step: '' } }))
    ai<{ restate: string; stuck: string; step: string; risk?: boolean }>('summary', { cards: s.cards.map(({ id, text, src, step }) => ({ id, text, src, step })), edges: s.edges, loops: ls.length, notes: lastNotes(s.msgs) }).then((r) =>
      set((p) => {
        const sum = r?.risk ? { restate: SAFE, step: '' } : r ? { restate: r.restate, stuck: r.stuck, step: r.step } : stubSum(p)
        const entry: Log = { t: 'summary', at: Date.now(), restate: sum.restate, stuck: sum.stuck ?? '', step: sum.step }
        return { ...p, ...(r?.risk ? { risk: true } : {}), sum, log: [...(p.log ?? []), entry] }
      }),
    )
  })
  return (
    <>
      <div className="tm-dim" onClick={close} />
      <aside className="tm-summary" aria-label="Summary">
        <span className="tm-tag">Tonight’s map</span>
        {!s.sum && <p className="tm-muted">Reading your map…</p>}
        {s.sum && <p>{s.sum.restate}</p>}
        {s.sum?.stuck && !s.risk && (
          <>
            <span className="tm-tag">What seems most stuck</span>
            <p>{s.sum.stuck}</p>
          </>
        )}
        {s.sum && !s.risk && steps.length > 0 && (
          <>
            <span className="tm-tag">Your next step</span>
            {steps.map((c) => (
              <div key={c.id} className="tm-step">
                <b>{c.text}</b>
                <span className="tm-src">
                  {c.step!.when || 'when?'} · {c.step!.where || 'where?'}
                </span>
              </div>
            ))}
          </>
        )}
        {s.sum && !s.risk && !steps.length && s.sum.step && (
          <>
            <span className="tm-tag">A next step you could take</span>
            <div className="tm-step">{s.sum.step}</div>
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
    step: '',
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
