import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { InkDot } from './ink.tsx'
import { CONDITIONS, listen, send, type Cmd, type Condition, type Ev, type Item, type Mode, type Session, type Snapshot } from './sync.ts'
import { isCrisis, isWhyLoop } from './triggers.ts'

// M1 · Journal page + break/trigger detection (no AI yet; optional mock replies to feel the flow).

type Params = {
  size: number
  introScale: number
  breathPeriod: number
  breathMin: number
  breathMax: number
  blur: number
  grain: number
  glowOpacity: number
  threadSpeed: number
  visitEvery: number
  visitSpeed: number
  pauseSec: number
  minGap: number
  thinkMs: number
  holdTimeout: number
  spreadMs: number
  revealMs: number
  condition: Condition
  name: string
  reduced: boolean
}
type Pt = { x: number; y: number }
type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number }

// Tuned in the M0 playground (2026-10-19).
const DEFAULTS: Params = {
  size: 52,
  introScale: 4,
  breathPeriod: 11,
  breathMin: 0.84,
  breathMax: 1.1,
  blur: 10,
  grain: 0.09,
  glowOpacity: 0.8,
  threadSpeed: 1,
  visitEvery: 20,
  visitSpeed: 200,
  pauseSec: 5,
  minGap: 180,
  thinkMs: 1500,
  holdTimeout: 10,
  spreadMs: 1400,
  revealMs: 800,
  condition: 'ai',
  name: 'Tyler',
  reduced: false,
}
const COLORS = ['#FF7A3D', '#FF9EC7', '#FFC56B'] // evening palette only
const PARAMS_KEY = 'inkdot-params-v3'
const SESSION_KEY = 'journal-session-v1'
const TYPING_GRACE = 3000 // no visit while the writer typed in the last 3 s

const SLIDERS: [keyof Params, string, number, number, number][] = [
  ['size', 'Dot size · px', 32, 120, 1],
  ['introScale', 'Intro scale', 2, 6, 0.1],
  ['breathPeriod', 'Breath period · s', 3, 15, 0.5],
  ['breathMin', 'Breath min', 0.8, 1, 0.01],
  ['breathMax', 'Breath max', 1, 1.2, 0.01],
  ['blur', 'Glow blur · px', 0, 40, 1],
  ['grain', 'Grain', 0, 0.4, 0.01],
  ['glowOpacity', 'Glow opacity', 0.2, 1, 0.05],
  ['threadSpeed', 'Thread speed', 0, 3, 0.1],
  ['visitEvery', 'Visit every · s', 5, 60, 1],
  ['visitSpeed', 'Visit speed · px/s', 60, 600, 10],
  ['pauseSec', 'Pause candidate · s', 2, 30, 1],
  ['minGap', 'Min gap between replies · s', 0, 600, 10],
  ['thinkMs', 'Simulated AI wait · ms', 0, 5000, 100],
  ['holdTimeout', 'AI hold timeout · s', 3, 30, 1],
  ['spreadMs', 'Spread · ms', 400, 4000, 100],
  ['revealMs', 'Text reveal · ms', 400, 4000, 100],
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const uid = () => Math.random().toString(36).slice(2, 9)
const now = () => new Date().toISOString()
const greeting = (h = new Date().getHours()) => (h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')
const load = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...fallback, ...JSON.parse(v) } : fallback
  } catch {
    return fallback
  }
}
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* storage unavailable: nothing persists, the page still works */
  }
}

export default function App() {
  const [p, setP] = useState<Params>(() => load(PARAMS_KEY, DEFAULTS))
  const [session, setSession] = useState(() =>
    load<Session>(SESSION_KEY, { started: now(), mode: 'intro' as Mode, items: [] as Item[], events: [{ t: now(), type: 'session_start' }] as Ev[] }),
  )
  const { mode, items, events } = session
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('Companion · breathing')
  const [panelOpen, setPanelOpen] = useState(false)
  const [crisis, setCrisis] = useState(false)
  const [ai, setAi] = useState('checking…')

  const page = useRef<HTMLDivElement>(null)
  const ink = useRef<HTMLDivElement>(null)
  const scaler = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const pos = useRef<Pt>({ x: 0, y: 0 })
  const look = useRef({ s: 1, o: 1 })
  // Dot actions run one after another, so a trigger that arrives mid-move waits instead of being dropped.
  const queue = useRef<Promise<void>>(Promise.resolve())
  const pending = useRef(0)
  const enqueue = (fn: () => Promise<void>) => {
    pending.current++
    queue.current = queue.current.then(fn).catch(console.error).finally(() => void pending.current--)
  }
  const idle = () => pending.current === 0
  const lastInput = useRef(0)
  const pauseLogged = useRef(true)
  const lastReply = useRef(0)
  const pRef = useRef(p)
  pRef.current = p
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => save(PARAMS_KEY, p), [p])
  useEffect(() => save(SESSION_KEY, session), [session])

  // Broadcast every change to the monitor window; a heartbeat lets it show "live", and a new monitor gets a snapshot.
  const snap = useRef<Snapshot>(null!)
  snap.current = { session, draft, status, params: { ...p, ai }, at: Date.now() }
  useEffect(() => void send({ kind: 'snapshot', snap: snap.current }), [session, draft, status, p, ai])
  useEffect(() => {
    const beat = setInterval(() => send({ kind: 'snapshot', snap: { ...snap.current, at: Date.now() } }), 2000)
    const off = listen((m) => {
      if (m.kind === 'hello') send({ kind: 'snapshot', snap: snap.current })
      if (m.kind === 'cmd') onCmd.current(m)
    })
    return () => {
      clearInterval(beat)
      off()
    }
  }, [])

  const log = (type: string, detail?: string, data?: Ev['data']) =>
    setSession((s) => ({ ...s, events: [...s.events, { t: now(), type, detail, data }] }))
  const setMode = (m: Mode) => setSession((s) => ({ ...s, mode: m }))
  const reduced = () => pRef.current.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches

  // --- geometry (relative to the scrolling page, so layers scroll with the text) ----------
  const rel = (r: DOMRect): Box => {
    const pg = page.current!
    const o = pg.getBoundingClientRect()
    const left = r.left - o.left + pg.scrollLeft
    const top = r.top - o.top + pg.scrollTop
    return { left, top, right: left + r.width, bottom: top + r.height, width: r.width, height: r.height }
  }
  const entries = () => [...page.current!.querySelectorAll<HTMLElement>('p.entry')]
  const lastWritten = () => entries().at(-1)
  const center = (): Pt => {
    const pg = page.current!
    return { x: pg.clientWidth / 2, y: pg.scrollTop + pg.clientHeight * 0.34 }
  }
  const home = (): Pt => {
    const pg = page.current!
    const s = pRef.current.size
    const last = lastWritten()
    return { x: pg.clientWidth - s / 2 - 20, y: last ? rel(last.getBoundingClientRect()).top + 14 : pg.scrollTop + 56 }
  }
  const lineBoxes = (el: HTMLElement): Box[] => {
    const range = document.createRange()
    range.selectNodeContents(el)
    const lines: Box[] = []
    for (const r of [...range.getClientRects()].map(rel).filter((r) => r.width > 2)) {
      const same = lines.find((l) => Math.abs(l.top - r.top) < 3)
      if (same) {
        same.left = Math.min(same.left, r.left)
        same.right = Math.max(same.right, r.right)
        same.width = same.right - same.left
      } else lines.push({ ...r })
    }
    return lines
  }

  // --- dot primitives ---------------------------------------------------------------------
  const tf = (pt: Pt) => `translate(${pt.x - pRef.current.size / 2}px, ${pt.y - pRef.current.size / 2}px)`
  const place = (pt: Pt) => {
    pos.current = pt
    ink.current!.style.transform = tf(pt)
  }
  const moveTo = async (pt: Pt, ms: number, easing = 'cubic-bezier(.4,0,.2,1)') => {
    if (reduced() || ms <= 0) return place(pt)
    const a = ink.current!.animate([{ transform: tf(pos.current) }, { transform: tf(pt) }], { duration: ms, easing, fill: 'forwards' })
    await a.finished
    place(pt)
    a.cancel()
  }
  const lookTo = async (s: number, o: number, ms: number) => {
    const el = scaler.current!
    const to = { transform: `scale(${s})`, opacity: o }
    if (!reduced() && ms > 0) {
      const a = el.animate([{ transform: `scale(${look.current.s})`, opacity: look.current.o }, to], { duration: ms, easing: 'ease-in-out', fill: 'forwards' })
      await a.finished
      a.cancel()
    }
    Object.assign(el.style, { transform: to.transform, opacity: String(o) })
    look.current = { s, o }
  }
  const addLayer = (style: Partial<CSSStyleDeclaration>) => {
    const d = document.createElement('div')
    Object.assign(d.style, { position: 'absolute', pointerEvents: 'none', ...style })
    page.current!.appendChild(d)
    return d
  }
  const gradient = `linear-gradient(90deg, ${COLORS.join(', ')})`
  const ripple = (pt: Pt) => {
    if (reduced()) return
    for (let i = 0; i < 3; i++) {
      const s = pRef.current.size
      const d = addLayer({ left: `${pt.x - s / 2}px`, top: `${pt.y - s / 2}px`, width: `${s}px`, height: `${s}px`, border: '1px solid #1b1b1b', borderRadius: '50%', zIndex: '2' })
      d.animate([{ transform: 'scale(.3)', opacity: 0.5 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 1400, delay: i * 260, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => d.remove())
    }
  }
  // The dot itself becomes a line under the text, then gathers back into a dot at the far end.
  const morphAlong = async (x0: number, x1: number, y: number) => {
    const d = pRef.current.size * 0.42
    const w = Math.max(x1 - x0, d)
    const off = reduced()
    const s = addLayer({ left: `${x0}px`, top: `${y - d / 2}px`, width: `${d}px`, height: `${d}px`, borderRadius: `${d}px`, background: gradient, filter: 'blur(4px)', opacity: String(pRef.current.glowOpacity), zIndex: '0' })
    await lookTo(look.current.s, 0, off ? 0 : 200)
    await s.animate(
      [
        { left: `${x0}px`, top: `${y - d / 2}px`, width: `${d}px`, height: `${d}px`, filter: 'blur(4px)' },
        { offset: 0.18, left: `${x0}px`, top: `${y - 2}px`, width: `${d * 1.8}px`, height: '4px', filter: 'blur(2px)' },
        { left: `${x0}px`, top: `${y - 1.5}px`, width: `${w}px`, height: '3px', filter: 'blur(1px)' },
      ],
      { duration: off ? 0 : (w / pRef.current.visitSpeed) * 1000, easing: 'ease-in-out', fill: 'forwards' },
    ).finished
    await s.animate(
      [
        { left: `${x0}px`, top: `${y - 1.5}px`, width: `${w}px`, height: '3px', filter: 'blur(1px)' },
        { left: `${x0 + w - d}px`, top: `${y - d / 2}px`, width: `${d}px`, height: `${d}px`, filter: 'blur(4px)' },
      ],
      { duration: off ? 0 : 700, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' },
    ).finished
    place({ x: x0 + w - d / 2, y })
    await lookTo(look.current.s, 1, off ? 0 : 200)
    s.remove()
  }

  // --- the dot's behaviours ------------------------------------------------------------------
  const retreat = () =>
    enqueue(async () => {
      await Promise.all([moveTo(home(), 1200), lookTo(1, 1, 1200)])
    })
  const settle = () => modeRef.current !== 'intro' && enqueue(() => moveTo(home(), 800))

  // Companion: the dot turns into a line under the latest entry, gathers back, returns.
  const visit = () => {
    if (!idle() || !lastWritten() || modeRef.current !== 'writing') return
    enqueue(visitNow)
  }
  const visitNow = async () => {
    const target = lastWritten()
    if (!target) return
    setStatus('Companion · visiting')
    const vid = target.dataset.id!
    setSession((s) => ({ ...s, visits: (s.visits ?? 0) + 1, visited: s.visited?.includes(vid) ? s.visited : [...(s.visited ?? []), vid] }))
    await lookTo(0.42, 1, 400)
    for (const r of lineBoxes(target)) {
      const y = r.bottom + 5
      await moveTo({ x: r.left + (pRef.current.size * 0.42) / 2, y }, 450)
      await morphAlong(r.left, r.right, y)
    }
    await moveTo(home(), 800)
    await lookTo(1, 1, 500)
    setStatus('Companion · breathing')
  }

  // Active: hold the line under the latest entry right away, then spread into the reply (or retract).
  // `reply` may still be on its way from the AI: the dot holds the line meanwhile, and retracts after holdTimeout.
  const activate = (reply: string | null | Promise<string | null>, why: string) => {
    if (!lastWritten()) return
    enqueue(() => activateNow(reply, why))
  }
  const activateNow = async (pending: string | null | Promise<string | null>, why: string) => {
    log('activate', why)
    setStatus('Active · holding the line, waiting for AI')
    const id = uid()
    flushSync(() => setSession((s) => ({ ...s, items: [...s.items, { id, kind: 'reply', text: '', at: now() }] })))
    const slot = page.current!.querySelector<HTMLElement>(`[data-id="${id}"]`)!
    const sr = rel(slot.getBoundingClientRect())
    const y = sr.top + sr.height / 2
    await lookTo(0.45, 0.85, 300)
    await moveTo({ x: sr.left + 8, y }, 700)
    await lookTo(0.7, 1, 400)
    const reply =
      typeof pending === 'string' || pending === null
        ? await sleep(pRef.current.thinkMs).then(() => pending)
        : await Promise.race([pending, sleep(pRef.current.holdTimeout * 1000).then(() => 'timeout' as const)])
    if (reply === 'timeout') log('hold_timeout', why)

    if (reply === null || reply === 'timeout') {
      setStatus('Active · AI chose silence, retracting')
      log('silent', why)
      flushSync(() => setSession((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) })))
      await lookTo(0.4, 0.8, 300)
      await moveTo(home(), 800)
      await lookTo(1, 1, 500)
    } else {
      lastReply.current = Date.now()
      setStatus('Active · spreading into the reply')
      const { spreadMs, revealMs, glowOpacity } = pRef.current
      const off = reduced()
      const band = addLayer({ left: `${sr.left}px`, top: `${y - 18}px`, width: `${sr.width}px`, height: '36px', borderRadius: '18px', background: `${gradient.slice(0, -1)}, transparent)`, filter: 'blur(12px)', transformOrigin: 'left', opacity: '0', zIndex: '0' })
      ripple(pos.current)
      lookTo(1.4, 0, spreadMs * 0.5)
      band.animate([{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 0.85 * glowOpacity }], { duration: off ? 0 : spreadMs, easing: 'ease-out', fill: 'forwards' })
      await sleep(off ? 0 : spreadMs * 0.6)
      flushSync(() => setSession((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, text: reply } : i)) })))
      log('reply_shown', reply, { replyId: id })
      slot.animate([{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: off ? 0 : revealMs, fill: 'forwards' })
      await sleep(off ? 0 : revealMs)
      await band.animate([{ opacity: 0.85 * glowOpacity }, { opacity: 0 }], { duration: off ? 0 : 1200, fill: 'forwards' }).finished
      band.remove()
      const end = lineBoxes(slot).at(-1)
      if (end) place({ x: end.right + 12, y: end.top + end.height / 2 })
      await lookTo(0.4, 0.9, 400)
      await moveTo(home(), 900)
      await lookTo(1, 1, 500)
    }
    setStatus('Companion · breathing')
  }

  // --- AI ----------------------------------------------------------------------------------------
  // Asks the judge server; logs the full judgement (AI fields + program checks) for the monitor. Errors = silence.
  const askAI = async (text: string, kind: 'commit' | 'pause', entryId?: string): Promise<string | null> => {
    const history = snap.current.session.items.filter((i) => i.id !== entryId && i.text).map(({ kind, text }) => ({ kind, text }))
    try {
      const r = await fetch('/api/judge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: pRef.current.name, kind, text, history }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? r.status)
      log('ai_judgement', text, { entryId, kind, ...j })
      return j.decision === 'speak' ? j.comment : null
    } catch (e) {
      log('ai_error', String(e), { entryId, kind })
      return null
    }
  }
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((j) => setAi(j.key ? `ready · ${j.model}` : 'no API key'))
      .catch(() => setAi('server offline'))
  }, [])

  // --- writing --------------------------------------------------------------------------------
  const onDraft = (v: string) => {
    setDraft(v)
    lastInput.current = Date.now()
    pauseLogged.current = false
    if (modeRef.current === 'intro' && v.trim()) {
      setMode('writing')
      log('first_input')
      retreat()
    }
  }

  const commit = () => {
    const text = draft.trim()
    if (!text || mode === 'closed') return
    const entryId = uid()
    flushSync(() => setSession((s) => ({ ...s, items: [...s.items, { id: entryId, kind: 'entry', text, at: now() }] })))
    setDraft('')
    log('commit', text, { entryId })
    const pg = page.current!
    pg.scrollTo({ top: pg.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' })

    // One decision record per entry: which gates passed and what happened (the monitor's decision cards).
    const crisisHit = isCrisis(text)
    const why = !crisisHit && isWhyLoop(text)
    const sinceLast = lastReply.current ? Math.round((Date.now() - lastReply.current) / 1000) : null
    const gapOk = sinceLast === null || sinceLast >= pRef.current.minGap
    const cond = pRef.current.condition
    // rules: only the why-rule replies (fixed text). ai: every entry outside the gap goes to the AI (R1). none: never speaks.
    const outcome =
      crisisHit ? 'referral' : cond === 'none' ? 'control' : !gapOk && (why || cond === 'ai') ? 'throttled' : cond === 'ai' ? 'ai' : why ? 'reply' : 'silent'
    log('decision', text, { entryId, crisis: crisisHit, why, sinceLast, minGap: pRef.current.minGap, gapOk, outcome, condition: cond })

    if (crisisHit) return setCrisis(true)
    if (outcome === 'reply') return activate(`Rough moment. Want to try telling it as ${pRef.current.name || 'you'}’s story?`, 'trigger_why')
    if (outcome === 'ai') {
      const answer = askAI(text, 'commit', entryId)
      // A why-loop holds the line right away; otherwise the dot only moves once the AI decided to speak.
      if (why) return activate(answer, 'trigger_why')
      answer.then((c) => (c ? activate(c, 'ai') : settle()))
      return
    }
    setTimeout(settle, 350)
  }

  // --- monitor commands (M4) ------------------------------------------------------------------
  const onCmd = useRef<(c: Cmd) => void>(() => {})
  onCmd.current = (c) => {
    if (c.cmd === 'condition') {
      set('condition', c.value)
      log('condition', c.value)
    } else if (c.cmd === 'say' && c.text.trim()) {
      log('override', c.text, { action: 'say' })
      activate(c.text.trim(), 'override')
    } else if (c.cmd === 'ask_ai') {
      const entry = items.filter((i) => i.kind === 'entry').at(-1)
      if (!lastWritten() || !entry) return
      log('override', entry.text, { action: 'ask_ai', entryId: entry.id })
      activate(askAI(entry.text, 'commit', entry.id), 'override_ai')
    } else if (c.cmd === 'new_session') {
      newSession()
    } else if (c.cmd === 'label') {
      setSession((s) => ({ ...s, labels: { ...s.labels, [c.key]: c.label } }))
    }
  }

  const endEntry = () => {
    log('end')
    setMode('closed')
  }
  // New session (next participant / next evening): the old one is downloaded first if anything was written.
  const newSession = () => {
    if (items.length) exportJson()
    setSession({ started: now(), mode: 'intro', items: [], events: [{ t: now(), type: 'session_start' }] })
    setDraft('')
    setCrisis(false)
    requestAnimationFrame(() => {
      place(center())
      Object.assign(scaler.current!.style, { transform: `scale(${pRef.current.introScale})`, opacity: '1' })
      look.current = { s: pRef.current.introScale, o: 1 }
    })
  }
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ params: p, ...session }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `journal-${session.started.slice(0, 19).replace(/:/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // --- lifecycle ------------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (modeRef.current === 'intro') {
      place(center())
      Object.assign(scaler.current!.style, { transform: `scale(${pRef.current.introScale})` })
      look.current = { s: pRef.current.introScale, o: 1 }
    } else place(home())
    const onResize = () => idle() && place(modeRef.current === 'intro' ? center() : home())
    addEventListener('resize', onResize)
    return () => removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!idle()) return
    if (mode === 'intro') {
      place(center())
      scaler.current!.style.transform = `scale(${p.introScale})`
      look.current = { s: p.introScale, o: 1 }
    } else place(home())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.size, p.introScale])

  // Companion visit every N s, skipped while typing.
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastInput.current >= TYPING_GRACE) visit()
    }, p.visitEvery * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.visitEvery])

  // Pause candidate: no typing for pauseSec while a draft is open. M3 hands this to the AI (thought_complete).
  useEffect(() => {
    const id = setInterval(() => {
      if (pauseLogged.current || modeRef.current !== 'writing') return
      if (Date.now() - lastInput.current >= pRef.current.pauseSec * 1000) {
        pauseLogged.current = true
        const d = composer.current?.value.trim() ?? ''
        log('pause_candidate', d ? `draft: ${d.slice(-80)}` : 'after commit', { draftLength: d.length })
        if (d && isCrisis(d)) {
          log('decision', d, { crisis: true, why: false, outcome: 'referral', fromDraft: true })
          setCrisis(true)
        } else if (d.length >= 20 && pRef.current.condition === 'ai' && idle() && Date.now() - lastReply.current >= pRef.current.minGap * 1000) {
          // Paused mid-draft: the AI judges whether the thought is complete (thought_complete) and whether to speak.
          askAI(d, 'pause').then((c) => c && activate(c, 'pause'))
        }
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-grow the composer.
  useLayoutEffect(() => {
    const c = composer.current
    if (!c) return
    c.style.height = 'auto'
    c.style.height = `${Math.min(c.scrollHeight, 200)}px`
  }, [draft])

  const set = <K extends keyof Params>(k: K, v: Params[K]) => setP((q) => ({ ...q, [k]: v }))
  const started = new Date(session.started)
  const dateLong = started.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dateShort = started.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const vars = {
    '--size': `${p.size}px`,
    '--period': `${p.breathPeriod}s`,
    '--min': p.breathMin,
    '--max': p.breathMax,
    '--blur': `${p.blur}px`,
    '--c0': COLORS[0],
    '--c1': COLORS[1],
    '--c2': COLORS[2],
    '--alpha': p.glowOpacity,
  } as React.CSSProperties

  return (
    <div className={`app${p.reduced ? ' reduced' : ''}`} style={vars}>
      <div className="backdrop" />

      <section className={`card mode-${mode}`}>
        <header className="card-head">
          <span>{dateLong}</span>
          {mode !== 'intro' && <span className="muted">{items.filter((i) => i.kind === 'entry').length} entries</span>}
        </header>

        <div className="page" ref={page}>
          <div className="hero" aria-hidden={mode !== 'intro'}>
            <p className="hello">
              {greeting()}, {p.name || 'friend'}
            </p>
            <h1>What stayed with you today?</h1>
            <p className="muted small">Write freely. I’ll stay quiet and keep you company.</p>
          </div>

          <div className="entries">
            {items.map((it) =>
              it.kind === 'entry' ? (
                <p key={it.id} className="entry" data-id={it.id}>
                  {it.text}
                </p>
              ) : (
                <p key={it.id} className="reply" data-id={it.id}>
                  {it.text}
                </p>
              ),
            )}
            {crisis && (
              <div className="referral" role="alert">
                <p>
                  <b>It sounds like things are really heavy right now.</b> You don’t have to carry this alone. Please reach out to someone now:
                </p>
                <ul>
                  <li>Germany · TelefonSeelsorge: 0800 111 0 111 or 0800 111 0 222 (free, 24/7)</li>
                  <li>Taiwan · 安心專線: 1925 (24/7)</li>
                  <li>In immediate danger: 112 (EU emergency)</li>
                </ul>
                <button className="link" onClick={() => setCrisis(false)}>
                  Close
                </button>
              </div>
            )}
            {mode === 'closed' && <p className="farewell">Today’s page is closed. See you tomorrow.</p>}
          </div>

          <InkDot ref={ink} scalerRef={scaler} grain={p.grain} threadSpeed={p.threadSpeed} still={p.reduced} />
        </div>

        <div className="composer">
          <textarea
            ref={composer}
            rows={1}
            value={draft}
            disabled={mode === 'closed'}
            placeholder={mode === 'closed' ? 'Entry closed' : 'Start writing… (Enter to add, Shift+Enter for a new line)'}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                commit()
              }
            }}
          />
          <div className="composer-bar">
            <span className="chip">{dateShort}</span>
            <div className="spacer" />
            {mode === 'writing' && (
              <button className="link" onClick={endEntry}>
                End entry
              </button>
            )}
            <button className="send" aria-label="Add to journal" disabled={!draft.trim() || mode === 'closed'} onClick={commit}>
              ↑
            </button>
          </div>
        </div>
      </section>

      <aside className={`panel${panelOpen ? ' open' : ''}`}>
        <button className="panel-toggle" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>
          {panelOpen ? 'Hide controls' : 'Controls'}
        </button>
        {panelOpen && (
          <div className="panel-body">
            <p className="status">{status}</p>
            <p className="status">AI · {ai}</p>
            <div className="buttons">
              <button onClick={visit}>Visit once</button>
              <button onClick={() => activate(`Rough moment. Want to try telling it as ${p.name || 'you'}’s story?`, 'manual')}>Activate · reply</button>
              <button onClick={() => activate(null, 'manual')}>Activate · silent</button>
              <button onClick={newSession}>New session</button>
            </div>
            <label className="row">
              <span>Writer name</span>
              <input value={p.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="row">
              <span>Condition</span>
              <select value={p.condition} onChange={(e) => set('condition', e.target.value as Condition)}>
                {CONDITIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="row">
              <span>Reduced motion</span>
              <input type="checkbox" checked={p.reduced} onChange={(e) => set('reduced', e.target.checked)} />
            </label>
            <details>
              <summary>Parameters</summary>
              {SLIDERS.map(([k, label, min, max, step]) => (
                <label key={k} className="slider">
                  <span>{label}</span>
                  <b>{p[k] as number}</b>
                  <input type="range" min={min} max={max} step={step} value={p[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} />
                </label>
              ))}
              <button onClick={() => setP(DEFAULTS)}>Reset params</button>
            </details>
            <div className="log">
              <span>Events</span>
              {events.slice(-8).reverse().map((e, i) => (
                <div key={i}>
                  <code>{time(e.t)}</code> {e.type}
                  {e.detail ? <em> · {e.detail.slice(0, 48)}</em> : null}
                </div>
              ))}
            </div>
            <button onClick={exportJson}>Export session JSON</button>
            <button onClick={() => open('/monitor', 'monitor')}>Open monitor ↗</button>
          </div>
        )}
      </aside>
    </div>
  )
}
