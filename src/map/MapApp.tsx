// Thought map v2 (/map): chat (separate what happened / what you told yourself / what you felt, name the feeling, see it another way)
// → cards laid out on a canvas → connect them yourself → a summary built from your own cards. Greyscale on purpose.
// The AI calls go through brain.ts (checked there). If there is no key or no answer passes, the stubs below stand in.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isCrisis } from '../triggers.ts'
import { DevPanel } from './dev.tsx'
import { loops } from './graph.ts'
import { afterNaming, demoBreak, demoNewKind, demoSide, demoState, demoLines, demoMade, demoPair, MORE, NEW as DEMO_NEW, norm, SCRIPT } from './demo.ts'
import { ask, askClose, askNarrow, askOther, askWhere, candidates, insertNew, otherKind, rewire, sayCircle, stages, walkPlan, walkWhy, type Hint, type Plan, type Why } from './walk.ts'
import { arrange, lay, makeCards, reroute } from './build.ts'
import { arcMid, arcPath, quietEdges, type Arc, type Peer } from './flow.ts'
import { ai, getKey, hasServer, NEED_KEY, setDemo, setKey } from './link.ts'
import { CARD_W, describe, estH, feels, fitView, freeSpot, freeSpotLinked, guessKind, LABEL, optionsFor, routeMid, routeOrtho, segments, smoothPath, summaryOf, tidyPiles, zoomAt, layered, type Kind, type Piles, type View } from './place.ts'
import './map.css'

type Src = 'you' | 'ai' // 'ai' only exists in older saved maps
type Step = { when: string; will: string } // a Next step card: "When {when}, I will {will}."
export type Card = { id: string; text: string; src: Src; x: number; y: number; stack: string[]; kind?: Kind; names?: string[]; from?: number; step?: Step; t?: number; pile?: Kind } // pile = the pile it still lies in; from = index into msgs of the message it came from; t = last edited
export type Edge = { id: string; from: string; to: string; label?: string; by?: 'ai'; t?: number; between?: boolean; cut?: boolean; route?: [number, number][]; arc?: Arc; at?: [number, number, number, number] } // cut: the line the person chose to break the circle at; route: the line's path from the layered layout, valid while both cards stay where they were (at); by: drawn by "Lay it out for me" until the person keeps it; label: older maps only
// notes: the AI's private understanding after this reply (what material is there, the core, how they're stuck). Never shown in the chat.
export type Notes = { have: Record<string, boolean>; named?: boolean; deAsked?: number; core: string; stuck: string; help: string; ready: boolean }
export type Msg = { role: Src; text: string; propose?: boolean; declined?: boolean; notes?: Notes; options?: string[]; naming?: boolean; why?: Why } // why: the demo presenter's popup for this reply; propose: the AI offers a map; options: two words offered for the feeling; naming: the person's chosen words
type Phase = 'chat' | 'layout' | 'map'
// risk: something they wrote sounded like hopelessness or self-harm → no map, no summary; support numbers instead
// log: every AI decision on this map, for the back office (/map/admin). Stays in this browser like the map.
export type Made = { id: string; text: string; kind: string; from: number; why: string }
export type Log =
  | { t: 'cards'; at: number; notes?: Notes; made: Made[]; skipped: { text: string; why: string }[]; fallback?: boolean; since?: number }
  | { t: 'arrange'; at: number; groups: { name: string; ids: string[] }[]; lines: { id: string; from: string; to: string; label: string }[] }
  | { t: 'label'; at: number; edge: string; from: string; to: string; label: string } // older maps only
  | { t: 'stack'; at: number; pairs: { a: string; b: string }[] }
  | { t: 'loop'; at: number; edges: string[]; note: string; breakEdge: string } // older maps only
  | { t: 'break'; at: number; edge: string; question: string; example: string; card: string; what: string; when: string; where: string }
  | { t: 'summary'; at: number; restate: string; stuck: string; step: string }
  | { t: 'risk'; at: number; where: string; text: string }
  | { t: 'close'; at: number; level: Hint; how: 'tap' | 'new' | 'offered' | 'none'; from: string; to: string; guess: string } // how the circle was closed: at which hint level, and whether it matches the program's guess
// spreadAt: how many messages had been sent when the cards were made; areas: column titles; mode: how the person chose to arrange
// demo: the scripted story (/map?demo), demoStep: the next script line; piles: where the piles lie (manual layout); view: pan and zoom
// walk: the guided map is running (step = its stage, see walk.ts); pick = where the person chose to break the circle; hint = how much help closing the circle has taken so far; added = they already wrote "somewhere new" once (one is the limit, so this step always ends)
export type State = { phase: Phase; msgs: Msg[]; cards: Card[]; edges: Edge[]; ended: boolean; mode?: 'auto' | 'manual'; risk?: boolean; log?: Log[]; spreadAt?: number; areas?: { name: string; x: number; y: number }[]; demo?: boolean; demoStep?: number; piles?: Piles; view?: View; walk?: { step: number; pick?: 'DE' | 'NEXT'; hint?: Hint; added?: boolean }; peers?: Peer[] }
export const KEY = 'thought-map-v2'
type Set = (f: (s: State) => State) => void
type Entry = Log extends infer L ? (L extends Log ? Omit<L, 'at'> : never) : never
const logIt = (set: Set, e: Entry) => set((p) => ({ ...p, log: [...(p.log ?? []), { ...e, at: Date.now() } as Log] }))

const W = CARD_W // card width, px
// the short kind tag on a card (the design system's tags); LABEL stays the long name in menus and row labels
const TAG: Record<Kind, string> = { A: 'What happened', B: 'Told myself', C: 'Felt', DE: 'Another way', NEXT: 'Next step' }
const uid = () => Math.random().toString(36).slice(2, 9)
const fresh = (): State => ({ phase: 'chat', msgs: [], cards: [], edges: [], ended: false })
// /map?demo opens the scripted story, fresh; the address is tidied after the first render so a reload keeps going from the saved state
const ENTER_DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')
const load = (): State => {
  if (ENTER_DEMO) return { ...fresh(), demo: true, demoStep: 0 }
  try {
    return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return fresh()
  }
}

const plain = (cards: Card[]) => cards.map(({ id, text, kind }) => ({ id, text, kind }))
export const lastNotes = (msgs: Msg[]) => msgs.findLast((m) => m.notes)?.notes
const nextCard = (when: string, will: string, x: number, y: number): Card => {
  const [w, i] = [when, will].map((t) => t.trim().replace(/[.,;]+$/, ''))
  return { id: uid(), text: `When ${w}, I will ${i}.`, src: 'you', kind: 'NEXT', step: { when: w, will: i }, x, y, stack: [], t: Date.now() }
}

// --- stubs: used when the AI is unavailable ---------------------------------------------------
// the AI's invitations to see it another way, in order: evidence, logic, a new belief (up to three; the person says every answer themselves)
const INVITE = /doesn.t quite fit|actually look like|want them to tell themselves/
const stubReply = (msgs: Msg[]): Msg => {
  const mine = msgs.filter((m) => m.role === 'you' && !m.naming)
  const kinds = new Set(mine.flatMap((m) => m.text.split(/(?<=[.!?])\s+/).map(guessKind)))
  const offered = msgs.filter((m) => m.options?.length).length
  const asked = msgs.filter((m) => m.role === 'ai' && INVITE.test(m.text)).length
  if (msgs.at(-1)?.naming) return { role: 'ai', text: 'Thank you for putting a word to it. Is there anything about this that doesn’t quite fit that thought?' }
  // a feeling in the latest message that has no name yet → two different words to choose from
  if (feels(mine.at(-1)?.text ?? '') && offered < 2) return { role: 'ai', text: 'That sounds like the feeling underneath all this. If you put a word to it, which is closer?', options: offered ? ['afraid', 'ashamed'] : ['dread', 'overwhelmed'] }
  const lastAi = msgs.findLast((m) => m.role === 'ai')?.text ?? ''
  if (asked && INVITE.test(lastAi)) {
    if (asked === 1) return { role: 'ai', text: 'That is something that does not fit the thought, and it came from you. When you imagine it going wrong, what would that actually look like?' }
    if (asked === 2) return { role: 'ai', text: 'So that is how it would really look. If a friend had this thought, what would you want them to tell themselves?' }
    return { role: 'ai', text: 'That is a kinder way to hold it, and it is yours. I think we have enough to lay this out.', propose: true }
  }
  if (asked) return { role: 'ai', text: 'Thanks for adding that. I think we have enough to lay this out.', propose: true }
  if (kinds.has('A') && kinds.has('B') && kinds.has('C')) return { role: 'ai', text: 'There are quite a few threads here now, and they are all yours. I think we have enough to lay this out.', propose: true }
  if (!kinds.has('B')) return { role: 'ai', text: 'That is what is coming up for you. When it comes back, what goes through your mind?' }
  if (!kinds.has('C')) return { role: 'ai', text: 'So there is a thought that keeps returning. How does that leave you feeling?' }
  return { role: 'ai', text: 'Thank you. What happened right before it started?' }
}
// one card per sentence, whole sentences only (delete-only by construction); the message right after one of the AI's invitations is the person's own D/E
const stubCards = (msgs: Msg[]) => {
  let n = 0
  let de = false
  const out: { text: string; kind: Kind; from: number; why: string }[] = []
  for (const m of msgs) {
    if (m.role === 'ai') de = INVITE.test(m.text)
    else if (!m.naming) {
      n++
      for (const t of m.text.split(/(?<=[.!?。！？])\s*/).map((x) => x.trim()).filter(Boolean)) out.push({ text: t, kind: de ? 'DE' : guessKind(t), from: n, why: 'fallback: the AI was unavailable, sentences split by the program' })
      de = false
    }
  }
  return out.slice(0, 10)
}
// each A to the next B, each B to the next C, a DE to the B before it (message order)
const stubArrange = (cards: { id: string; kind?: Kind }[]) =>
  cards.flatMap((c, i) => {
    const to = (k: Kind) => cards.slice(i + 1).find((x) => x.kind === k)
    const t = c.kind === 'A' ? to('B') : c.kind === 'B' ? to('C') : undefined
    const b = c.kind === 'DE' ? cards.slice(0, i).findLast((x) => x.kind === 'B') : undefined
    return t ? [{ from: c.id, to: t.id }] : b ? [{ from: b.id, to: c.id }] : []
  })
// "Arrange for me" on the map: cards that have a line stay where the person put them; the rest are laid out in rows (A, B, C, DE, Next),
// to the right of the connected cards (or alone, when nothing is connected yet)
export function arrangeLoose(st: State, size: { w: number; h: number }): State | null {
  const linked = new Set(st.edges.flatMap((e) => [e.from, e.to]))
  const loose = st.cards.filter((c) => !linked.has(c.id))
  if (!loose.length) return null
  const fixed = st.cards.filter((c) => linked.has(c.id))
  const r = layered(loose.map((c) => ({ id: c.id, text: c.text, kind: c.kind })), [])
  const LBL = 170 // room for the row labels
  const ox = fixed.length ? Math.max(...fixed.map((c) => c.x + W)) + 120 + LBL : LBL
  const oy = fixed.length ? Math.min(...fixed.map((c) => c.y)) : 0
  const pos = Object.fromEntries(loose.map((c) => [c.id, { x: r.pos[c.id].x + ox, y: r.pos[c.id].y + oy }]))
  const cards = st.cards.map((c) => (pos[c.id] ? { ...c, ...pos[c.id], pile: undefined } : c))
  const rows = new Map<string, number>()
  for (const c of loose) rows.set(c.kind ?? 'A', Math.min(rows.get(c.kind ?? 'A') ?? Infinity, pos[c.id].y))
  const areas = [...(fixed.length ? (st.areas ?? []) : []), ...[...rows].map(([k, y]) => ({ name: LABEL[k as Kind], x: ox - LBL + 16, y }))]
  const boxes = [...cards.map((c) => ({ x: c.x, y: c.y, w: W, h: estH(c.text, c.kind) })), ...areas.map((a) => ({ x: a.x, y: a.y, w: 0, h: 0 }))]
  return { ...st, cards, areas, piles: cards.some((c) => c.pile) ? st.piles : undefined, view: { ...fitView(boxes, size.w, size.h), n: Date.now() } }
}

const SAFE = 'Something you wrote sounds really heavy. The map can wait. Please talk to someone now: the numbers are under “Get support”.'

export default function MapApp() {
  const [s, setS] = useState<State>(load)
  setDemo(!!s.demo) // before any child asks the AI: in demo mode nothing ever does
  const set = (f: (s: State) => State) => setS((p) => tidyPiles(f(p)))
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(s))
  }, [s])
  useEffect(() => {
    if (ENTER_DEMO) history.replaceState(null, '', location.pathname)
  }, [])
  const [toast, setToast] = useState('')
  const [crisis, setCrisis] = useState(false)
  const [summary, setSummary] = useState(false)
  const [talk, setTalk] = useState(() => s.phase !== 'map') // the conversation pane; shut once the map is laid out
  const [help, setHelp] = useState(false)
  const [focus, setFocus] = useState<{ msg: number; text: string } | null>(null) // the message a clicked card came from, and the card's words
  const [keyOpen, setKeyOpen] = useState(false)
  const [needKey, setNeedKey] = useState(false)
  const [demoMenu, setDemoMenu] = useState(false)
  // demo presenter's explanations: a popup after each reply and each map step (click anywhere to open it, the arrow button to go on); remembered
  const [explain, setExplainRaw] = useState(() => localStorage.getItem('tm-explain') === '1')
  const setExplain = (on: boolean) => (setExplainRaw(on), localStorage.setItem('tm-explain', on ? '1' : '0'))
  const [seen, setSeen] = useState<string[]>([]) // popups already shown
  const [why, setWhy] = useState<{ key: string; why: Why } | null>(null) // the popup on screen
  const plan = s.walk ? walkPlan(s.cards, s.edges) : null
  const pending = ((): { key: string; why: Why } | null => {
    if (!s.demo || !explain) return null
    if (s.phase === 'chat') {
      const i = s.msgs.length - 1
      const m = s.msgs[i]
      return m?.role === 'ai' && m.why ? { key: `m${i}`, why: m.why } : null
    }
    const w = plan && s.walk && walkWhy(plan, s.walk.step, s.cards, s.walk.hint)
    return w ? { key: `w${s.walk!.step}h${s.walk!.hint ?? 0}`, why: w } : null
  })()
  const due = pending && !seen.includes(pending.key) ? pending : null
  const downAt = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const down = (e: PointerEvent) => void (downAt.current = { x: e.clientX, y: e.clientY })
    addEventListener('pointerdown', down, true)
    return () => removeEventListener('pointerdown', down, true)
  }, [])
  useEffect(() => {
    if (!due && !why) return
    const go = () => (why ? (setSeen((l) => [...l, why.key]), setWhy(null)) : setWhy(due))
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('.tm-explain-off')) return (setExplain(false), setWhy(null))
      if (t.closest('.tm-demo') && !why) return // the demo menu keeps working
      if (!why && Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y) > 4) return // a drag (moving the map) is not a click
      if (!why && s.phase === 'map' && !t.closest('.tm-ask')) return // on the map only the question box opens it, so the map can still be moved
      e.preventDefault()
      e.stopPropagation()
      if (!why || t.closest('.tm-explain-next')) go() // while the popup is open, only its arrow goes on
    }
    const key = (e: KeyboardEvent) => {
      if (!(e.key === 'Enter' || e.key === ' ' || (e.key === 'ArrowRight' && why))) return
      e.preventDefault()
      e.stopPropagation()
      go()
    }
    addEventListener('click', click, true)
    addEventListener('keydown', key, true)
    return () => (removeEventListener('click', click, true), removeEventListener('keydown', key, true))
  })
  const collected = new Set(s.msgs.flatMap((m) => m.why?.got ?? []))
  const legend = s.demo && explain && (
    <ol className="tm-progress" aria-label="Collected so far">
      {(['A', 'B', 'C', 'DE', 'NEXT'] as Kind[]).map((k) => (
        <li key={k} className={collected.has(k) ? 'on' : ''}>
          <b>{k === 'NEXT' ? 'Next' : k}</b> {TAG[k]}
        </li>
      ))}
    </ol>
  )
  const [asking, setAsking] = useState(false) // "Before you go, is there one small thing…"
  const [undo, setUndo] = useState<State | null>(null) // the map as it was before "Arrange for me"
  // the conversation pane's width, dragged by its edge and remembered
  const [paneW, setPaneW] = useState(() => {
    try {
      return Number(localStorage.getItem('tm-pane-w')) || 380
    } catch {
      return 380
    }
  })
  const resize = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX
    const w0 = paneW
    let w = w0
    const move = (ev: PointerEvent) => setPaneW((w = Math.min(Math.max(280, w0 + ev.clientX - x0), innerWidth - 360)))
    const up = () => (removeEventListener('pointermove', move), removeEventListener('pointerup', up), localStorage.setItem('tm-pane-w', String(Math.round(w))))
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
  }
  const arrange = () => {
    const next = arrangeLoose(s, { w: innerWidth - (talk ? paneW : 0), h: innerHeight })
    if (!next) return say('Every card already has a line, so there is nothing to arrange.')
    setUndo(s)
    setS(next)
    logIt(set, { t: 'arrange', groups: [], lines: [] })
  }
  const noKeyNag = useRef(false) // "Not now" keeps the notice away until a key is saved
  useEffect(() => {
    const on = () => !noKeyNag.current && setNeedKey(true) // never fires in demo mode (ai() is silent there)
    addEventListener(NEED_KEY, on)
    return () => removeEventListener(NEED_KEY, on)
  }, [])
  const say = (t: string) => (setToast(t), setTimeout(() => setToast(''), 2200))
  const restart = () => (setS(s.demo ? demoState('chat') : fresh()), setSummary(false), setFocus(null), setTalk(true), setAsking(false), setUndo(null), setSeen([]))
  // any text the person writes
  const risky = (t: string, where = 'chat') => isCrisis(t) && (set((p) => ({ ...p, risk: true })), logIt(set, { t: 'risk', where: `${where} (risk words)`, text: t }), setCrisis(true), true)
  const openSource = (c: Card) => {
    if (c.from === undefined || !s.msgs[c.from]) return
    setFocus({ msg: c.from, text: c.text })
    setTalk(true)
  }
  // end the map: log what the summary shows (for the back office), then show it
  const end = (cards: Card[] = s.cards) => {
    const sum = summaryOf(cards, s.edges)
    set((p) => ({ ...p, ended: true, cards, walk: undefined }))
    logIt(set, { t: 'summary', restate: s.risk ? 'risk state: support text shown instead of a summary' : describe(sum), stuck: '', step: sum.next.join(' / ') })
    setAsking(false)
    setSummary(true)
  }
  // missing-key notice: in the chat it sits just above the input box, on the map at the top centre
  const notice = needKey && !keyOpen && (
    <div className="tm-needkey" role="status">
      The AI needs an Anthropic API key to answer.
      <button className="solid" onClick={() => setKeyOpen(true)}>
        Add your key
      </button>
      <button onClick={() => ((noKeyNag.current = true), setNeedKey(false))}>Not now</button>
    </div>
  )
  // the demo menu (any build): jump to a screen of the story
  const jump = (to: 'chat' | 'laid' | 'summary') => {
    setS(demoState(to))
    setSeen([])
    setSummary(to === 'summary')
    setTalk(to === 'chat')
    setFocus(null)
    setAsking(false)
    setDemoMenu(false)
  }
  const finish = () => (s.risk || s.cards.some((c) => c.kind === 'NEXT') ? end() : setAsking(true))
  return (
    <div className={`tm${s.phase === 'map' ? (talk ? ' talk-open' : '') : ' solo'}`}>
      <aside className={`tm-left${talk || s.phase !== 'map' ? '' : ' shut'}`} aria-label="Conversation" style={s.phase === 'map' ? { width: paneW } : undefined}>
        <Chat s={s} set={set} risky={risky} onRisk={() => setCrisis(true)} say={say} ro={s.phase !== 'chat'} focus={focus} notice={s.phase === 'chat' && notice} top={s.phase === 'chat' && legend} />
        {s.phase === 'map' && <div className="tm-resize" role="separator" aria-orientation="vertical" aria-label="Drag to resize the conversation" onPointerDown={resize} />}
      </aside>
      <div className="tm-right">
        <div className="tm-top">
          {s.phase === 'map' ? (
          <button className="tm-conv" aria-pressed={talk} onClick={() => setTalk(!talk)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M9 4v16" />
            </svg>
            Conversation
          </button>
          ) : (
            <span />
          )}
          {s.phase === 'map' && legend}
          <span className="tm-actions">
            {s.risk && (
              <button className="solid" onClick={() => setCrisis(true)}>
                Get support
              </button>
            )}
            {s.phase === 'map' && !s.ended && undo && (
              <button onClick={() => (setS(undo), setUndo(null))} title="Put the cards back where they were">
                Undo arrange
              </button>
            )}
            {s.phase === 'map' && !s.ended && !s.risk && !s.walk && (
              <button onClick={arrange} title="Cards you have connected stay put; the others are laid out for you">
                Arrange for me
              </button>
            )}
            {s.phase === 'map' && !s.ended && (
              <button className="solid" onClick={finish}>
                That’s enough for now
              </button>
            )}
            {s.phase === 'map' && s.ended && <button onClick={() => setSummary(true)}>Summary</button>}
            {(s.ended || s.phase !== 'chat') && <button onClick={restart}>New map</button>}
            <button className="tm-keybtn" onClick={() => setKeyOpen(true)} title="Your Anthropic API key">
              AI key
            </button>
          </span>
        </div>
        {s.phase === 'layout' && <Layout s={s} set={set} done={() => setTalk(false)} />}
        {s.phase === 'map' && <MapCanvas key={JSON.stringify(s.view)} s={s} set={set} risky={risky} onOpen={openSource} onPick={(c) => talk && openSource(c)} plan={plan} onFinish={(cards) => end(cards)} />}
        {s.phase === 'map' && s.ended && !summary && (
          <button className="tm-pinned" onClick={() => setSummary(true)} title="Open the summary">
            <span className="tm-tag">Tonight’s summary</span>
            {s.risk ? '…' : summaryOf(s.cards, s.edges).names.join(' · ') || 'Open'}
          </button>
        )}
        {s.phase === 'map' && (
          <button className="tm-q" aria-label="Help" aria-pressed={help} onClick={() => setHelp(!help)}>
            ?
          </button>
        )}
        {help && s.phase === 'map' && (
          <p className="tm-help">
            Drag a card to move it · drag a dot on its edge to another card to connect · drop a card onto another to stack · select a card, then the eye shows where it came from · double-click a card to edit, the canvas to add · click a line to keep or remove it · drag the canvas or scroll to pan, pinch or ⌘/Ctrl + scroll to zoom
          </p>
        )}
      </div>
      {keyOpen && <KeyPanel close={() => (setKeyOpen(false), setNeedKey(false), getKey() && (noKeyNag.current = false))} />}
      {s.phase !== 'chat' && notice}
      {asking && (
        <NextAsk
          risky={risky}
          add={(when, will) => {
            const low = s.cards.reduce((m, c) => (c.y > m.y ? c : m), s.cards[0] ?? { x: 60, y: 0 })
            const at = freeSpot(s.cards.map((c) => ({ x: c.x, y: c.y, h: 110 })), low.x, low.y)
            end([...s.cards, nextCard(when, will, at.x, at.y)])
          }}
          skip={() => end()}
        />
      )}
      {summary && <Summary s={s} close={() => setSummary(false)} />}
      {crisis && <Referral close={() => setCrisis(false)} />}
      {s.demo && (
        <div className="tm-demo">
          {demoMenu && (
            <div className="tm-demomenu" role="menu">
              <button role="menuitemcheckbox" aria-checked={explain} className={explain ? 'solid' : ''} onClick={() => (setExplain(!explain), setDemoMenu(false))}>
                Explanations: {explain ? 'on' : 'off'}
              </button>
              {(['chat', 'laid', 'summary'] as const).map((to) => (
                <button key={to} role="menuitem" onClick={() => jump(to)}>
                  {{ chat: 'Start chat', laid: 'Map — guided walk', summary: 'Summary' }[to]}
                </button>
              ))}
              <button role="menuitem" onClick={() => (setDemoMenu(false), setCrisis(true))}>
                Show crisis card
              </button>
            </div>
          )}
          <button className="tm-demotag" aria-expanded={demoMenu} onClick={() => setDemoMenu(!demoMenu)}>
            Demo
          </button>
        </div>
      )}
      {why && (
        <>
          <div className="tm-dim tm-explain-dim" />
          <div className="tm-explain" role="dialog" aria-label="What just happened">
            <span className="tm-tag">What just happened</span>
            <p>{why.why.what}</p>
            <span className="tm-tag">Mechanism</span>
            <p>{why.why.mech}</p>
            <span className="tm-tag">What the AI did, and didn’t</span>
            <p>{why.why.ai}</p>
            <span className="tm-explain-foot">
              <button className="tm-explain-off tm-quiet">Turn off explanations</button>
              <button className="tm-explain-next" aria-label="Continue">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </span>
          </div>
        </>
      )}
      {toast && <div className="tm-toast">{toast}</div>}
      {import.meta.env.DEV && !s.demo && <DevPanel s={s} setS={setS} openSummary={setSummary} crisis={() => setCrisis(true)} pane={setTalk} />}
    </div>
  )
}

// --- 1 · chat (left pane) ----------------------------------------------------------------------
function Chat({ s, set, risky, onRisk, say, ro, focus, notice, top }: { s: State; set: Set; risky: (t: string, where?: string) => boolean; onRisk: () => void; say: (t: string) => void; ro: boolean; focus: { msg: number; text: string } | null; notice?: React.ReactNode; top?: React.ReactNode }) {
  // demo mode: the box is pre-filled with the script's next line (editable); anything else the person writes gets the program stubs
  const cur = s.demo ? (s.demoStep ?? 0) : -1
  const step = SCRIPT[cur]
  const [edited, setEdited] = useState<{ at: number; text: string } | null>(null)
  const draft = edited && edited.at === cur ? edited.text : (step?.p ?? '')
  const setDraft = (text: string) => setEdited({ at: cur, text })
  const [typing, setTyping] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [s.msgs.length, typing])
  useEffect(() => {
    if (focus) document.getElementById(`tm-m-${focus.msg}`)?.scrollIntoView({ block: 'center' })
  }, [focus])
  const last = s.msgs.at(-1)
  const declines = s.msgs.filter((m) => m.declined).length
  const propose = !ro && !s.risk && !typing && last?.role === 'ai' && last.propose && !last.declined && declines < 2 // the AI offers; at most twice declined
  const chips = !ro && !s.risk && !typing && last?.role === 'ai' && last.options?.length ? last.options : null
  // ask the AI for its next reply to this chat
  const reply = async (msgs: Msg[], risk: boolean, text: string, scripted?: { msg: Msg; next: number }) => {
    setTyping(true)
    const r = s.demo ? await new Promise<null>((done) => setTimeout(() => done(null), 700)) : await ai<{ reply: string; options: string[]; propose: boolean; risk: boolean; notes?: Notes }>('reply', { msgs: msgs.map(({ role, text, declined, naming }) => ({ role, text, declined, naming })), risk })
    setTyping(false)
    if (r?.risk && !s.risk) {
      set((p) => ({ ...p, risk: true })) // the AI heard it even without the words
      logIt(set, { t: 'risk', where: 'chat (AI judged it, no risk words)', text })
      onRisk()
    }
    const out: Msg = r ? { role: 'ai', text: r.reply, propose: r.propose && !r.risk, notes: r.notes, options: r.options?.length && !r.risk ? r.options : undefined } : risk ? { role: 'ai', text: SAFE } : (scripted?.msg ?? stubReply(msgs))
    set((p) => ({ ...p, msgs: [...p.msgs, out], ...(scripted && !risk ? { demoStep: scripted.next } : {}) }))
  }
  const send = async () => {
    const text = draft.trim()
    if (!text || typing) return
    setDraft('')
    const risk = risky(text) || !!s.risk
    const msgs: Msg[] = [...s.msgs, { role: 'you', text }]
    set((p) => ({ ...p, msgs }))
    const hit = step && norm(text) === norm(step.p) ? step : undefined // the scripted line was sent as it is
    await reply(msgs, risk, text, hit && { msg: { role: 'ai', text: hit.ai, options: hit.options, propose: hit.propose, why: hit.why }, next: cur + 1 })
  }
  // the person chose a word (or two) for the feeling: it goes in as their message, and the AI answers without any typed text
  const name = (words: string[]) => {
    if (words.some((w) => risky(w, 'naming the feeling'))) return
    const msgs: Msg[] = [...s.msgs, { role: 'you', text: words.join(', '), naming: true }]
    set((p) => ({ ...p, msgs }))
    const an = s.demo ? afterNaming(last?.text ?? '', words) : null
    void reply(msgs, !!s.risk, words.join(', '), an ? { msg: { role: 'ai', text: an.text, why: an.why }, next: an.next } : undefined)
  }
  // "Talk a bit more" (in the demo the AI answers from the script)
  const decline = () => {
    set((p) => ({ ...p, msgs: [...p.msgs.map((m, i) => (i === p.msgs.length - 1 ? { ...m, declined: true } : m)), ...(s.demo ? [{ role: 'ai' as const, text: MORE }] : [])] }))
  }
  const go = () => set((p) => ({ ...p, mode: 'auto', phase: 'layout' })) // one way in: the guided map
  return (
    <main className="tm-chat">
      {top}
      <div className="tm-msgs">
        {!s.msgs.length && (
          <div className="tm-empty tm-intro">
            <p>Is something going round and round in your head? Tell me about it, and we’ll pull it apart together.</p>
            <details>
              <summary>What is this for?</summary>
              <p>For one specific thing that keeps coming back: something happened, and a thought about it won’t let go.</p>
              <p>Not for emergencies, and not a replacement for a therapist. If you are in danger, please call someone now.</p>
              <p>Your map stays on this device.</p>
            </details>
          </div>
        )}
        {s.msgs.map((m, i) =>
          m.naming ? (
            <p key={i} className="tm-pill">
              {m.text}
            </p>
          ) : (
            <p key={i} id={`tm-m-${i}`} className={`tm-msg ${m.role}${focus?.msg === i ? ' lit' : ''}`}>
              {focus?.msg === i ? segments(m.text, focus.text).map((x, k) => <span key={k} className={x.keep ? '' : 'tm-faded'}>{x.s}</span>) : m.text}
            </p>
          ),
        )}
        {typing && <p className="tm-msg ai tm-typing">…</p>}
        {chips && <NamingChips key={s.msgs.length} options={chips} confirm={name} />}
        {propose && (
          <div className="tm-propose">
            Want to see it as a map?
            <span className="tm-actions">
              <button className="solid" onClick={go}>
                Yes
              </button>
              <button onClick={decline}>Talk a bit more</button>
            </span>
          </div>
        )}
        <div ref={end} />
      </div>
      {!ro && (
        <>
          {notice}
          <div className="tm-input">
            <textarea
              id="tm-draft"
              value={draft}
              placeholder="Type…"
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && (e.preventDefault(), send())}
            />
            <div className="tm-inrow">
              <button className="tm-mic" aria-label="Voice input" onClick={() => say('Voice input is coming soon')}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              </button>
              <button className="tm-send solid" aria-label="Send" onClick={send} disabled={!draft.trim()}>
                {draft.trim() ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    <path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {!s.risk && s.msgs.some((m) => m.role === 'you' && !m.naming) && !propose && (
            <button className="tm-early" onClick={go}>
              Spread it out now
            </button>
          )}
        </>
      )}
    </main>
  )
}

// two words for the feeling + "my own word"; several can be chosen; confirming sends them as the person's message
function NamingChips({ options, confirm }: { options: string[]; confirm: (w: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([])
  const [own, setOwn] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [v, setV] = useState('')
  const toggle = (w: string) => setSel((l) => (l.includes(w) ? l.filter((x) => x !== w) : [...l, w]))
  const addOwn = () => {
    const w = v.replace(/,/g, ' ').trim().toLowerCase()
    if (w && ![...options, ...own].includes(w)) {
      setOwn((l) => [...l, w])
      setSel((l) => [...l, w])
    }
    setV('')
    setOpen(false)
  }
  return (
    <div className="tm-naming">
      <div className="tm-chips">
        {[...options, ...own].map((w) => (
          <button key={w} className={`tm-chip${sel.includes(w) ? ' on' : ''}`} aria-pressed={sel.includes(w)} onClick={() => toggle(w)}>
            {w}
          </button>
        ))}
        <button className="tm-chip" onClick={() => setOpen(true)}>
          + my own word
        </button>
      </div>
      {open && (
        <span className="tm-ownrow">
          <input id="tm-own-word" autoFocus value={v} maxLength={30} placeholder="your word" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOwn()} />
          <button onClick={addOwn} disabled={!v.trim()}>
            Add
          </button>
        </span>
      )}
      <button className="solid" disabled={!sel.length} onClick={() => confirm(sel)}>
        That’s it
      </button>
    </div>
  )
}

// --- 2 · layout: the person's own sentences become cards (delete-only), then piles on the right or a connected layout ----
function Layout({ s, set, done }: { s: State; set: Set; done: () => void }) {
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    void (async () => {
      const msgs = s.msgs.map(({ role, text, naming }) => ({ role, text, naming }))
      const scripted = s.demo ? demoMade(s.msgs) : []
      const useScript = scripted.length >= 3 // the demo story, as far as the presenter followed it
      const r = s.demo ? null : await ai<{ you: Omit<Made, 'id'>[]; skipped: { text: string; why: string }[]; risk?: boolean }>('cards', { msgs, notes: lastNotes(s.msgs) })
      if (r?.risk) return set((p) => ({ ...p, phase: 'chat', risk: true }))
      const got: { text: string; kind: string; from: number; why: string }[] = useScript ? scripted : (r?.you ?? stubCards(s.msgs))
      const cards = makeCards(s.msgs, got)
      const made: Made[] = cards.map((c, i) => ({ id: c.id, text: c.text, kind: c.kind ?? '', from: got[i].from, why: got[i].why }))
      const entry: Log = { t: 'cards', at: Date.now(), notes: lastNotes(s.msgs), made, skipped: r?.skipped ?? [], fallback: !r && !useScript }
      let lines: { from: string; to: string }[] | null = null
      if (s.mode === 'auto') {
        const a = s.demo ? null : await ai<{ lines: { from: string; to: string }[]; risk?: boolean }>('arrange', { cards: plain(cards) })
        if (a?.risk) return set((p) => ({ ...p, phase: 'chat', risk: true }))
        lines = a?.lines ?? (useScript ? demoLines(cards) : stubArrange(cards))
      }
      const laid = lay(cards, lines, { w: innerWidth, h: innerHeight })
      const arrangeLog: Log[] = lines ? [{ t: 'arrange', at: Date.now(), groups: [], lines: laid.edges.map((l) => ({ id: l.id, from: l.from, to: l.to, label: '' })) }] : []
      set((p) => ({ ...p, phase: 'map', ...laid, log: [...(p.log ?? []), entry, ...arrangeLog], spreadAt: p.msgs.length, walk: lines ? { step: 0 } : undefined }))
      done()
    })()
  })
  return <p className="tm-empty tm-wait tm-hold">{s.mode === 'auto' ? 'Laying out your map…' : 'Sorting your words into piles…'}</p>
}

// --- 3 · map -----------------------------------------------------------------------------------
type Drag = { kind: 'move'; id: string; dx: number; dy: number } | { kind: 'link'; from: string; x: number; y: number }
type Pan = { sx: number; sy: number; vx: number; vy: number }
const PICKABLE: Kind[] = ['A', 'B', 'C', 'DE']

// The canvas is a board with an inner layer that is panned and zoomed (transform); everything inside the layer is in canvas coordinates.
// onPick: a card was clicked (the app jumps the open conversation to where it came from)
function MapCanvas({ s, set, risky, onOpen, onPick, plan, onFinish }: { s: State; set: Set; risky: (t: string, where?: string) => boolean; onOpen: (c: Card) => void; onPick: (c: Card) => void; plan: Plan | null; onFinish: (cards: Card[]) => void }) {
  const board = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const [h, setH] = useState<Record<string, number>>({})
  const [view, setView] = useState<View>(() => s.view ?? { x: 0, y: 0, z: 1 })
  const [pan, setPan] = useState<Pan | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [editCard, setEditCard] = useState<string | null>(null)
  const [openStack, setOpenStack] = useState<string | null>(null)
  const [openLoop, setOpenLoop] = useState<number | null>(null)
  const [over, setOver] = useState<string | null>(null) // the card under the pointer while they choose where the open line leads
  const [beside, setBeside] = useState<{ id: string; side: 'l' | 'r' } | null>(null) // adding a card beside this one, on that side (during the guided walk)
  const [relaid, setRelaid] = useState(0) // the map was just laid out again: the cards glide to their places and the view follows
  const [breaking, setBreaking] = useState<string | null>(null) // the loop line the person clicked to write a step for
  const [lineMenu, setLineMenu] = useState<string | null>(null)
  const [kindMenu, setKindMenu] = useState<string | null>(null)
  const [naming, setNaming] = useState<string | null>(null) // the unnamed feeling card being named
  const [guide, setGuide] = useState<{ id: string; x: number; y: number } | null>(null) // a new card judged to be a thought: the "another way to see it" guide
  const [gapOff, setGapOff] = useState<string[]>([])
  const [pairs, setPairs] = useState<{ a: string; b: string }[]>([]) // AI (or the demo script): these two say the same thing
  const moved = useRef(false)
  const start = useRef({ x: 0, y: 0 })
  const added = useRef(new Set<string>()) // cards just created on the canvas, still to be sorted into a kind
  const ro = s.ended // read-only after the summary

  // the guided walk: only the cards reached so far are on the map; the line into the newest card is dashed until the person confirms it
  const walk = !ro && plan && s.walk ? { ...s.walk, plan, st: stages(plan) } : null
  const other = walk && otherKind(walk.pick)
  const shownIds = walk ? new Set([...plan!.path.slice(0, walk.step + 1), ...s.cards.filter((c) => (walk.pick && c.kind === walk.pick) || (other && walk.step >= walk.st.rest && c.kind === other)).map((c) => c.id)]) : null
  if (shownIds)
    for (let grew = true; grew; ) {
      grew = false
      for (const p of s.peers ?? [])
        if (p.own && shownIds.has(p.a) && !shownIds.has(p.b)) {
          shownIds.add(p.b) // a card they added beside a card that is on the map
          grew = true
        }
    }
  const shown = shownIds ? s.cards.filter((c) => shownIds.has(c.id)) : s.cards
  const visible = (e: Edge) => {
    if (!walk || !shownIds) return true
    if (!shownIds.has(e.from) || !shownIds.has(e.to)) return false
    const i = walk.plan.links.indexOf(e.id)
    return i > 0 ? i <= walk.step : e.id === walk.plan.close ? walk.step > walk.st.close || (walk.step === walk.st.close && walk.hint === 2) : true // the guess stays hidden until it is offered (hint 2) or the person made the line
  }
  const walkTo = (w: State['walk'], f: (st: State) => State = (x) => x) => set((st) => f({ ...st, walk: w }))
  const confirm = (edge?: string) => walkTo({ step: walk!.step + 1, pick: walk!.pick }, (st) => ({ ...st, edges: st.edges.map((e) => (e.id === edge ? { ...e, by: undefined } : e)) }))
  const breakAt = (edge: string, pick: 'DE' | 'NEXT') => {
    walkTo({ step: walk!.st.placed, pick }, (st) => ({ ...st, edges: st.edges.map((e) => (e.id === edge ? { ...e, by: undefined, cut: true } : st.cards.find((c) => c.id === e.to)?.kind === pick ? { ...e, by: undefined } : e)) }))
    if (pick === 'NEXT' && !s.cards.some((c) => c.kind === 'NEXT')) setBreaking(edge) // no step from the chat yet: write one now
  }
  const leave = () => walkTo(undefined) // the free map: every card, every tool
  // the summary right after the walk: only the cards the walk brought out stay on the map
  const finishWalk = () => {
    const keep = s.cards.filter((c) => shownIds!.has(c.id))
    set((st) => ({ ...st, walk: undefined, cards: keep, edges: st.edges.filter((e) => shownIds!.has(e.from) && shownIds!.has(e.to)) }))
    onFinish(keep)
  }
  // "Not quite" on a card: they put it in their own words, then the line turns solid and the walk goes on
  const fixCard = (id: string, text: string, edge?: string) => {
    if (risky(text, 'card')) return
    set((st) => ({ ...st, cards: st.cards.map((c) => (c.id === id ? { ...c, text, t: Date.now() } : c)) }))
    confirm(edge)
  }
  const confirmOther = () => walkTo({ step: walk!.st.done, pick: walk!.pick }, (st) => ({ ...st, edges: st.edges.map((e) => (st.cards.find((c) => c.id === e.to)?.kind === other ? { ...e, by: undefined } : e)) }))
  // "Not quite" on the line that closes the circle: no circle, the line goes
  const dropClose = () => {
    if (guess) logIt(set, { t: 'close', level: 2, how: 'none', from: guess.from, to: '', guess: guess.to })
    walkTo({ step: walk!.step }, (st) => ({ ...st, edges: st.edges.filter((e) => e.id !== walk!.plan.close) }))
  }
  // closing the circle (the hint ladder, see walk.ts): guess = the line the program expects; tail = the card with the open line
  const guess = walk && walk.step === walk.st.close ? s.edges.find((e) => e.id === walk.plan.close) : undefined
  const hint: Hint = walk?.hint ?? 0
  const choosing = !!guess && hint < 2 // the person can tap a card
  const lit = guess && hint === 1 ? candidates(walk!.plan, s.edges) : []
  const moreHelp = () => walkTo({ step: walk!.step, hint: Math.min(2, hint + 1) as Hint, added: walk!.added })
  const closedAt = (how: 'tap' | 'new' | 'offered', to: string) => guess && logIt(set, { t: 'close', level: hint, how, from: guess.from, to, guess: guess.to })
  // heights for laying out: the real one once a card has been drawn, a guess before
  const hLay = (id: string) => h[id] ?? estH(find(id)?.text ?? '', find(id)?.kind)
  // the circle is closed: its cards move onto a ring (flow.ts), and the walk goes on to where to break it
  const closed = (st: State): State => {
    const next = arrange(st, hLay)
    return { ...next, walk: { step: stages(walkPlan(next.cards, next.edges)).pick } }
  }
  const keepGuess = () => (set((st) => closed({ ...st, edges: st.edges.map((e) => (e.id === guess!.id ? { ...e, by: undefined } : e)) })), setRelaid((n) => n + 1))
  // they tapped a card: the guess → that line turns solid; another card → their line replaces the guess
  // the card on the walk's path that this card is on a level with (itself, or the card it was added beside)
  const levelOf = (id: string) => {
    const seen = new Set([id])
    for (let grew = true; grew; ) {
      grew = false
      for (const p of s.peers ?? [])
        if (p.own && seen.has(p.a) !== seen.has(p.b)) {
          seen.add(p.a).add(p.b)
          grew = true
        }
    }
    return walk?.plan.path.find((x) => seen.has(x))
  }
  const linkTo = (to: string) => {
    const main = levelOf(to)
    if (!guess || !main || main === guess.from) return
    closedAt('tap', to)
    if (to === guess.to) return keepGuess()
    // a card they added beside another: it leads on to where that one leads, so the circle can run through it
    const after = walk!.plan.path[walk!.plan.path.indexOf(main) + 1]
    const on = to !== main && after && !s.edges.some((e) => e.from === to && e.to === after) ? [{ id: uid(), from: to, to: after }] : []
    set((st) => closed({ ...st, edges: [...on, ...(rewire(st.edges, walk!.plan, to, uid()) as Edge[])] }))
    setRelaid((n) => n + 1)
  }
  // they offered the guess and the person said yes
  const takeGuess = () => (closedAt('offered', guess!.to), keepGuess())
  // they wrote somewhere new: a new card after the last one, and the open line now starts from it
  const addNew = async (text: string) => {
    if (!guess || risky(text, 'card')) return
    const kind = (s.demo ? demoNewKind(text) : (await ai<{ kind: Kind }>('kind', { text }))?.kind) ?? guessKind(text)
    closedAt('new', text)
    set((st) => {
      const id = uid()
      const cards = [...st.cards, { id, text, src: 'you' as const, kind, x: 0, y: 0, stack: [], t: Date.now() }]
      const next = arrange({ ...st, cards, edges: insertNew(st.edges, walk!.plan, id, [uid(), uid()]) as Edge[] }, hLay)
      return { ...next, walk: { step: walkPlan(next.cards, next.edges).path.length, hint: 1, added: true } } // one new card, then the question narrows: two cards light up, then the guess is offered
    })
    setRelaid((n) => n + 1)
  }
  // they added a card beside the one being placed: the same kind, the same level, following from the same card
  const addSide = (id: string, side: 'l' | 'r', text: string) => {
    const of = find(id)
    if (!of || risky(text, 'card')) return
    set((st) => {
      const nid = uid()
      let a = id // beside the outermost card already added on that side
      for (let nx = (st.peers ?? []).find((p) => p.own && p.a === a && p.side === side); nx; nx = (st.peers ?? []).find((p) => p.own && p.a === a && p.side === side)) a = nx.b
      const cards = [...st.cards, { id: nid, text, src: 'you' as const, kind: of.kind, x: of.x, y: of.y, stack: [], t: Date.now() }]
      const edges = [...st.edges, ...st.edges.filter((e) => e.to === id && e.id !== walk?.plan.close).map((e) => ({ id: uid(), from: e.from, to: nid }))]
      return arrange({ ...st, cards, edges, peers: [...(st.peers ?? []), { a, b: nid, own: true, side }] }, hLay)
    })
    setBeside(null)
    setRelaid((n) => n + 1)
  }
  useEffect(() => {
    if (!relaid) return
    const b = board.current!
    setView(fitView(shown.map((c) => ({ x: c.x, y: c.y, w: W, h: h[c.id] ?? 110 })), b.clientWidth - (walk?.step === walk?.st.pick ? 380 : 0), b.clientHeight - (walk?.step === walk?.st.pick ? 0 : 200), 60, 1)) // room for the question box (beside the circle, or under the cards); never closer than life-size
    const t = setTimeout(() => setRelaid(0), 700)
    return () => clearTimeout(t)
  }, [relaid]) // eslint-disable-line react-hooks/exhaustive-deps
  // the view follows the walk: close on the circle while it is built, wider once their card goes in
  const walkStep = walk?.step
  useEffect(() => {
    if (walkStep === undefined || (walkStep !== 0 && walkStep !== walk!.st.close && walkStep !== walk!.st.placed && walkStep !== walk!.st.rest)) return
    const b = board.current!
    const ids = walkStep === 0 ? walk!.plan.path : [...shownIds!]
    const boxes = s.cards.filter((c) => ids.includes(c.id)).map((c) => ({ x: c.x, y: c.y, w: W, h: h[c.id] ?? 110 }))
    setView(fitView(boxes, b.clientWidth, b.clientHeight - 240, 60, 1)) // room for the question box under the last card; never closer than life-size
  }, [walkStep]) // eslint-disable-line react-hooks/exhaustive-deps

  // once per visit: ask which cards repeat each other; the person stacks them by hand (or not)
  const askedStack = useRef(false)
  useEffect(() => {
    if (ro || askedStack.current || s.cards.length < 2) return
    askedStack.current = true
    const got = s.demo ? Promise.resolve({ pairs: demoPair(s.cards) }) : ai<{ pairs: { a: string; b: string }[] }>('stack', { cards: plain(s.cards) })
    got.then((r) => {
      if (!r) return
      setPairs(r.pairs)
      logIt(set, { t: 'stack', pairs: r.pairs })
    })
  })
  // while a card is held, its duplicate partner (if the AI or the demo script named one) lights up: dropping the card there stacks them
  const holding = drag?.kind === 'move' ? drag.id : null
  const pairOf = (id: string | null) => {
    const x = id ? pairs.find((p) => p.a === id || p.b === id) : undefined
    const other = x && (x.a === id ? x.b : x.a)
    return other && s.cards.some((c) => c.id === other) ? other : null
  }
  const partner = pairOf(holding)
  const hOf = (id: string) => h[id] ?? 90
  // card heights for edge geometry
  useLayoutEffect(() => {
    const next: Record<string, number> = {}
    refs.current.forEach((el, id) => (next[id] = el.offsetHeight))
    if (JSON.stringify(next) !== JSON.stringify(h)) setH(next)
  })

  // two-finger scroll pans; pinch (ctrl + wheel) or ⌘/Ctrl + wheel zooms around the cursor
  useEffect(() => {
    const el = board.current!
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const [cx, cy] = [e.clientX - r.left, e.clientY - r.top]
      if (e.ctrlKey || e.metaKey) setView((v) => zoomAt(v, v.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), cx, cy))
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  const zoomBy = (f: number) => setView((v) => zoomAt(v, v.z * f, board.current!.clientWidth / 2, board.current!.clientHeight / 2))
  const fit = () => {
    const b = board.current!
    const boxes = [...shown.map((c) => ({ x: c.x, y: c.y, w: W, h: h[c.id] ?? 90 })), ...live.flatMap((e) => (routeOf(e) ?? []).map(([x, y]) => ({ x, y, w: 0, h: 0 })))]
    setView(fitView(boxes, b.clientWidth, b.clientHeight))
  }

  // pointer → canvas coordinates
  const pt = (e: { clientX: number; clientY: number }) => {
    const r = board.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z }
  }
  const find = (id: string) => s.cards.find((c) => c.id === id)
  const card = (id: string) => find(id)!
  const center = (c: Card) => ({ x: c.x + W / 2, y: c.y + (h[c.id] ?? 48) / 2 })
  const cardsAt = (cx: number, cy: number, except: string) =>
    document
      .elementsFromPoint(cx, cy)
      .map((el) => (el as HTMLElement).closest<HTMLElement>('[data-card]')?.dataset.card)
      .filter((id, i, all): id is string => !!id && id !== except && all.indexOf(id) === i)
  const edit = (id: string, f: (c: Card) => Card) => set((st) => ({ ...st, cards: st.cards.map((c) => (c.id === id ? { ...f(c), t: Date.now() } : c)) }))

  // merge `from` into `into`; edges follow the surviving card
  const stack = (from: string, into: string) =>
    set((st) => {
      const a = st.cards.find((c) => c.id === from)!
      return {
        ...st,
        cards: st.cards.filter((c) => c.id !== from).map((c) => (c.id === into ? { ...c, stack: [...c.stack, a.text, ...a.stack], t: Date.now() } : c)),
        edges: st.edges
          .map((x) => ({ ...x, from: x.from === from ? into : x.from, to: x.to === from ? into : x.to }))
          .filter((x, i, all) => x.from !== x.to && all.findIndex((y) => y.from === x.from && y.to === x.to) === i),
      }
    })
  const restack = (into: string) => set((st) => reroute(st, { cards: [into] }, hOf))
  // moving a card: the lines touching it are rerouted as it moves (once per animation frame); on the drop every line is rerouted, so they find room around each other
  const raf = useRef(0)
  const latest = useRef({ x: 0, y: 0 })
  const moveTo = (id: string, x: number, y: number, fast: boolean) =>
    set((st) => reroute({ ...st, cards: st.cards.map((c) => (c.id === id ? { ...c, x, y, t: Date.now(), pile: undefined } : c)) }, { cards: [id], edges: fast ? [] : st.edges.map((e) => e.id) }, hOf, fast)) // leaving a pile: the rest of it tidies up
  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      const p = pt(e)
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 4) moved.current = true
      if (drag.kind === 'move') {
        if (!moved.current) return
        latest.current = { x: p.x - drag.dx, y: p.y - drag.dy }
        raf.current ||= requestAnimationFrame(() => ((raf.current = 0), moveTo(drag.id, latest.current.x, latest.current.y, true)))
      } else setDrag({ ...drag, x: p.x, y: p.y })
    }
    const up = (e: PointerEvent) => {
      cancelAnimationFrame(raf.current)
      raf.current = 0
      const under = cardsAt(e.clientX, e.clientY, drag.kind === 'move' ? drag.id : drag.from)
      if (drag.kind === 'link' && under[0] && !s.edges.some((x) => x.from === drag.from && x.to === under[0])) {
        const edge: Edge = { id: uid(), from: drag.from, to: under[0], t: Date.now() }
        set((st) => reroute({ ...st, edges: [...st.edges, edge] }, { edges: [edge.id] }, hOf))
      }
      if (drag.kind === 'move' && moved.current) {
        const p = pt(e)
        moveTo(drag.id, p.x - drag.dx, p.y - drag.dy, false)
        if (partner && under.includes(partner)) {
          stack(drag.id, partner) // only the lit partner takes a stack
          restack(partner)
        }
      }
      setDrag(null)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    return () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
    }
  })
  // drag on empty canvas = pan (a drag under 4 px is just a click)
  useEffect(() => {
    if (!pan) return
    const move = (e: PointerEvent) => setView((v) => ({ ...v, x: pan.vx + e.clientX - pan.sx, y: pan.vy + e.clientY - pan.sy }))
    const up = () => setPan(null)
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    return () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
    }
  })

  const unstack = (id: string, i: number) =>
    set((st) => {
      const c = st.cards.find((x) => x.id === id)!
      return { ...st, cards: [...st.cards.map((x) => (x.id === id ? { ...x, stack: x.stack.filter((_, j) => j !== i) } : x)), { id: uid(), text: c.stack[i], src: c.src, kind: c.kind, x: c.x + 30, y: c.y + 120, stack: [], t: Date.now() }] }
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

  // every line is horizontal and vertical runs only: it keeps the route it was given (the layout's, or the router's when a card moved or a line was drawn)
  // while both its cards stay put; otherwise a quick route is worked out for it
  const boxOf = (c: Card) => ({ x: c.x, y: c.y, w: W, h: hOf(c.id) })
  const routeOf = (x: Edge) => {
    const [a, b] = [find(x.from), find(x.to)]
    return x.route && x.at && a && b && a.x === x.at[0] && a.y === x.at[1] && b.x === x.at[2] && b.y === x.at[3] ? x.route : null
  }
  const routeFor = (x: Edge) => routeOf(x) ?? routeOrtho(boxOf(card(x.from)), boxOf(card(x.to)), [], [])
  const geom = (x: Edge) => {
    const [a, b] = [find(x.from), find(x.to)]
    if (x.arc && x.at && a && b && a.x === x.at[0] && a.y === x.at[1] && b.x === x.at[2] && b.y === x.at[3]) return { d: arcPath(x.arc), m: arcMid(x.arc) } // a line round the ring
    const r = routeFor(x)
    return { d: smoothPath(r, 8), m: routeMid(r) }
  }
  const mid = (x: Edge) => geom(x).m
  const live = s.edges.filter((x) => find(x.from) && find(x.to) && visible(x))
  // cards side by side share one arrow: the others' lines are not drawn, a dotted-end line joins them instead
  const quiet = quietEdges(s.edges, s.peers ?? [])
  const drawn = live.filter((x) => !quiet.has(x.id))
  const isShown = (id: string) => !shownIds || shownIds.has(id)
  const joins = (s.peers ?? []).flatMap((p) => {
    const [a, b] = [find(p.a), find(p.b)]
    if (!a || !b || !isShown(a.id) || !isShown(b.id)) return []
    const [l, r] = a.x <= b.x ? [a, b] : [b, a]
    const mid = Math.min(hOf(l.id), hOf(r.id)) / 2 // level with each other, however tall each card is
    return [{ key: `${p.a}-${p.b}`, kind: b.kind, x1: l.x + W, y1: l.y + mid, x2: r.x, y2: r.y + mid }]
  })
  const groups = loops(live)
  const inLoop = new Set(groups.flat())
  const loopOf = (edge: string) => groups.find((g) => g.includes(edge)) ?? []
  const keepLine = (id: string) => set((st) => ({ ...st, edges: st.edges.map((x) => (x.id === id ? { ...x, by: undefined } : x)) }))
  const dropLine = (id: string) => set((st) => ({ ...st, edges: st.edges.filter((x) => x.id !== id) }))
  // the visible part of the canvas, in canvas coordinates; a popover that would run off it flips above its card
  const guideAt = (c: Card, ch: number) => {
    const b = board.current
    const [x0, y0] = [-view.x / view.z, -view.y / view.z]
    const [x1, y1] = [x0 + (b?.clientWidth ?? 900) / view.z, y0 + (b?.clientHeight ?? 600) / view.z]
    const [gw, gh] = [260, 200]
    return { x: Math.max(x0, Math.min(c.x, x1 - gw)), y: c.y + ch + 10 + gh > y1 ? Math.max(y0, c.y - gh - 10) : c.y + ch + 10 }
  }
  const boxes = () => s.cards.map((c) => ({ x: c.x, y: c.y, h: h[c.id] ?? 90 })) // measured heights
  // a new card that will be joined to a card by a line: clear of every card, and the line crosses no card and no line (a tall new card gets a generous height)
  const spotFor = (sx: number, sy: number, sh: number, text: string) =>
    freeSpotLinked(
      boxes(),
      live.map((x) => routeFor(x)),
      { x: sx, y: sy, h: sh },
      W,
      22 * Math.ceil(text.length / 24) + 60,
    )
  // "When ___, I will ___" from a loop line → a Next step card at a free spot, joined from the line's first card
  const addStep = (edge: Edge, when: string, will: string, g: { question: string; when_example: string; will_example: string }) => {
    if ([when, will].some((t) => risky(t, 'next step'))) return setBreaking(null)
    const m = mid(edge)
    const c = nextCard(when, will, 0, 0)
    const src = find(edge.from) ?? { x: m.x, y: m.y, id: '' }
    const at = spotFor(src.x, src.y, h[edge.from] ?? 90, c.text)
    c.x = at.x
    c.y = at.y
    logIt(set, { t: 'break', edge: edge.id, question: g.question, example: `${g.when_example} / ${g.will_example}`, card: c.id, what: c.step!.will, when: c.step!.when, where: '' })
    const link: Edge = { id: uid(), from: edge.from, to: c.id }
    set((st) => reroute({ ...st, cards: [...st.cards, c], edges: [...st.edges, link] }, { edges: [link.id] }, hOf))
    setBreaking(null)
    setOpenLoop(null)
  }
  // a card the person added: the AI (or a keyword guess) says what kind it is; a thought gets the "another way to see it" guide
  const sort = async (id: string, text: string) => {
    const r = s.demo ? null : await ai<{ kind: Kind }>('kind', { text })
    const kind = r?.kind ?? guessKind(text)
    edit(id, (c) => ({ ...c, kind }))
    const card = find(id)
    if (kind === 'B' && card) setGuide({ id, ...guideAt(card, h[id] ?? 60) })
  }
  const addDE = (b: Card, fit: string, other: string) => {
    if ([fit, other].some((t) => risky(t, 'another way to see it'))) return setGuide(null)
    const text = [fit.trim().replace(/[.]+$/, ''), other.trim()].filter(Boolean).join('. ')
    const id = uid()
    const at = spotFor(b.x, b.y, h[b.id] ?? 90, text)
    const lid = uid()
    set((st) => reroute({ ...st, cards: [...st.cards, { id, text, src: 'you', kind: 'DE', x: at.x, y: at.y, stack: [], t: Date.now() }], edges: [...st.edges, { id: lid, from: b.id, to: id, t: Date.now() }] }, { edges: [lid] }, hOf))
    setGuide(null)
  }
  const nameIt = (id: string, names: string[]) => {
    if (names.some((w) => risky(w, 'naming the feeling'))) return setNaming(null)
    edit(id, (c) => ({ ...c, names }))
    setNaming(null)
  }

  // one gap hint at a time, from the program: a feeling nothing leads into; a line straight from what happened to a feeling
  // the hint about the newest card or line comes first; a card that lies in a pile gets its hint to the left of the pile, clear of the pile label
  const gaps = (ro || s.risk || walk ? [] : [
    ...shown.filter((c) => c.kind === 'C' && !s.edges.some((e) => e.to === c.id)).map((c) => ({ key: `c${c.id}`, text: 'What happened before this?', x: c.pile ? c.x - 12 : c.x, y: c.pile ? c.y + 10 : c.y - 34, left: !!c.pile, t: c.t ?? 0 })),
    ...live.filter((e) => card(e.from).kind === 'A' && card(e.to).kind === 'C').map((e) => ({ key: `e${e.id}`, text: 'What did you tell yourself in between?', x: mid(e).x - 110, y: mid(e).y - 44, left: false, t: e.t ?? 0 })),
  ])
    .filter((g) => !gapOff.includes(g.key))
    .sort((a, b) => b.t - a.t)
  const gap = gaps[0]
  const open = openLoop !== null ? groups[openLoop] : undefined

  return (
    <main
      className={`tm-board${ro ? ' ro' : ''}${pan ? ' panning' : ''}`}
      ref={board}
      onPointerDown={(e) => {
        if (e.target !== board.current) return
        setSel(null)
        setOpenLoop(null)
        setLineMenu(null)
        setKindMenu(null)
        if (e.button === 0) setPan({ sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y })
      }}
      onDoubleClick={(e) => {
        if (ro || e.target !== board.current) return
        const p = pt(e)
        const id = uid()
        added.current.add(id)
        set((st) => ({ ...st, cards: [...st.cards, { id, text: '', src: 'you', x: p.x - W / 2, y: p.y - 20, stack: [], t: Date.now() }] }))
        setEditCard(id)
      }}
    >
      <div className={`tm-layer${relaid ? ' relaid' : ''}`} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
        <svg className="tm-edges" aria-hidden="true" width="6000" height="6000" viewBox="-2000 -2000 6000 6000">
          <defs>
            <marker id="tm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
            <marker id="tm-arrow-de" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--another)" />
            </marker>
            <marker id="tm-arrow-next" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--told)" />
            </marker>
          </defs>
          {drawn.map((x) => {
            // three kinds of line: black arrows (cause and effect), coloured arrows (to another way, to a next step), dotted-end lines (same level, below);
            // two states: solid, or dashed (not kept yet, or the line the person broke)
            const to = card(x.to).kind === 'DE' ? 'de' : card(x.to).kind === 'NEXT' ? 'next' : ''
            const cls = [to, breaking === x.id && 'breaking', (x.by === 'ai' || x.cut) && 'dash'].filter(Boolean).join(' ')
            return <path key={x.id} d={geom(x).d} className={cls} markerEnd={`url(#tm-arrow${to ? `-${to}` : ''})`} />
          })}
          {joins.map((j) => (
            <g key={j.key} className={`join${j.kind === 'DE' ? ' de' : j.kind === 'NEXT' ? ' next' : ''}`}>
              <line x1={j.x1} y1={j.y1} x2={j.x2} y2={j.y2} />
              <circle cx={j.x1} cy={j.y1} r="3.5" />
              <circle cx={j.x2} cy={j.y2} r="3.5" />
            </g>
          ))}
          {!ro &&
            !walk &&
            drawn.map((x) => (
              <path key={x.id} d={geom(x).d} className="hit" onClick={() => (inLoop.has(x.id) && !s.risk ? (setOpenLoop(null), setLineMenu(null), setBreaking(x.id)) : (setBreaking(null), setLineMenu(lineMenu === x.id ? null : x.id)))}>
                <title>{inLoop.has(x.id) ? 'Write one thing you could do here' : x.by === 'ai' ? 'Drawn for you. Click to keep or remove it' : 'Click to remove this line'}</title>
              </path>
            ))}
          {choosing && find(guess!.from) && (() => {
            const t = find(guess!.from)!
            const [x, y] = [t.x + W / 2, t.y + hOf(t.id)]
            // over a card that can be tapped: the open line reaches for it, so it is clear what a tap will do
            const to = over && over !== t.id && levelOf(over) !== t.id ? find(over) : undefined
            const round = shown.filter((c) => c.id !== t.id && c.id !== to?.id).map(boxOf) // round the cards in between, clear of the lines already there
            if (to) return <path d={smoothPath(routeOrtho(boxOf(t), boxOf(to), round, drawn.map((e) => routeOf(e)).filter((r): r is [number, number][] => !!r)), 8)} className="open reach" markerEnd="url(#tm-arrow-next)" />
            return <path d={`M${x},${y} L${x},${y + 44}`} className="open" markerEnd="url(#tm-arrow)" />
          })()}
          {drag?.kind === 'link' && (() => {
            const a = center(card(drag.from))
            return <line x1={a.x} y1={a.y} x2={drag.x} y2={drag.y} className="temp" />
          })()}
        </svg>

        {!ro &&
          lineMenu &&
          live
            .filter((x) => x.id === lineMenu)
            .map((x) => (
              <span key={x.id} className="tm-linepop" style={{ left: mid(x).x, top: mid(x).y }}>
                {x.by === 'ai' && <button onClick={() => (keepLine(x.id), setLineMenu(null))}>Keep</button>}
                <button onClick={() => (dropLine(x.id), setLineMenu(null))}>Remove</button>
                <button aria-label="Close" onClick={() => setLineMenu(null)}>
                  ×
                </button>
              </span>
            ))}

        {(s.areas ?? []).map((a, i) => (
          <span key={i} className="tm-area" style={{ left: a.x, top: a.y }}>
            {a.name}
          </span>
        ))}
        {(Object.entries(s.piles ?? {}) as [Kind, { x: number; y: number }][]).map(([k, o]) => {
          const n = s.cards.filter((c) => c.pile === k).length
          return n ? (
            <span key={k} className="tm-area" style={{ left: o.x, top: o.y - 26 }}>
              {LABEL[k]} · {n}
            </span>
          ) : null
        })}

        {groups.map((g, i) => {
          if (walk || g.some((id) => s.edges.find((x) => x.id === id)?.cut)) return null // no chip while walking, or once the person broke the circle
          const ms = g.map((id) => mid(s.edges.find((x) => x.id === id)!))
          const c = { x: ms.reduce((t, m) => t + m.x, 0) / ms.length, y: ms.reduce((t, m) => t + m.y, 0) / ms.length }
          return (
            <button key={g.join()} className="tm-loop" style={{ left: c.x, top: c.y }} onClick={() => (setBreaking(null), setOpenLoop(openLoop === i ? null : i))}>
              loop
            </button>
          )
        })}

        {gap && (
          <span className={`tm-gap${gap.left ? ' left' : ''}`} style={{ left: gap.x, top: gap.y }}>
            {gap.text}
            <button aria-label="Dismiss" onClick={() => setGapOff((l) => [...l, gap.key])}>
              ×
            </button>
          </span>
        )}
        {partner && find(partner) && (
          <span className="tm-droplabel" style={{ left: find(partner)!.x, top: find(partner)!.y - 28 }}>
            Drop here to stack
          </span>
        )}

        {walk && walk.step < walk.plan.path.length && find(walk.plan.path[walk.step]) &&
          (['l', 'r'] as const).map((side) => {
            // the card being placed: its left and right points glow, there may be more on this level
            const c = find(walk.plan.path[walk.step])!
            return <button key={side} className={`tm-side ${side}`} style={{ left: c.x + (side === 'r' ? W : 0), top: c.y + hOf(c.id) / 2 }} aria-label="Add a card beside this one" title="Add a card beside this one" onClick={() => setBeside({ id: c.id, side })} />
          })}
        {shown.map((c) => (
          <div
            key={c.id}
            data-card={c.id}
            ref={(el) => void (el ? refs.current.set(c.id, el) : refs.current.delete(c.id))}
            className={`tm-card k-${c.kind ?? 'none'}${walk && ((walk.step < walk.plan.path.length && c.id === walk.plan.path[walk.step]) || (walk.step === walk.st.rest && c.kind === other)) ? ' ghost' : ''}${choosing && c.id !== guess!.from && levelOf(c.id) !== guess!.from ? ` pickable${hint === 0 ? ' tappable' : ''}` : ''}${choosing && c.id === guess!.from ? ' tail' : ''}${lit.includes(c.id) ? ' cand' : ''}${sel === c.id ? ' sel' : ''}${partner === c.id ? ' lit' : ''}${c.stack.length ? ' stacked' : ''}${drag?.kind === 'move' && drag.id === c.id ? ' dragging' : ''}`}
            style={{ left: c.x, top: c.y, width: W }}
            onPointerDown={(e) => {
              if (editCard === c.id || (e.target as HTMLElement).closest('button,input')) return
              setSel(c.id)
              onPick(c)
              if (ro) return
              const p = pt(e)
              moved.current = false
              start.current = { x: e.clientX, y: e.clientY }
              setKindMenu(null)
              setDrag({ kind: 'move', id: c.id, dx: p.x - c.x, dy: p.y - c.y })
            }}
            onPointerEnter={() => choosing && setOver(c.id)}
            onPointerLeave={() => setOver((o) => (o === c.id ? null : o))}
            onClick={() => choosing && !moved.current && (setOver(null), linkTo(c.id))}
            onDoubleClick={() => !ro && !choosing && setEditCard(c.id)}
          >
            {editCard === c.id ? (
              <textarea
                autoFocus
                defaultValue={c.text}
                onBlur={(e) => {
                  const t = e.target.value.trim()
                  risky(t, 'card')
                  if (t) {
                    edit(c.id, (x) => ({ ...x, text: t }))
                    if (added.current.delete(c.id)) void sort(c.id, t)
                  } else remove(c.id) // an empty new card disappears
                  setEditCard(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), e.currentTarget.blur())}
              />
            ) : (
              <span className="tm-text">{c.text}</span>
            )}
            {c.kind === 'C' && (
              <span className="tm-names">
                {(c.names ?? []).map((n) => (
                  <span key={n} className="tm-name">
                    {n}
                  </span>
                ))}
                {!c.names?.length && !ro && (
                  <button className="tm-nameit" onClick={() => setNaming(naming === c.id ? null : c.id)}>
                    + name it
                  </button>
                )}
              </span>
            )}
            {naming === c.id && <NameIt options={optionsFor(s.msgs, c.from ?? -1)} save={(w) => nameIt(c.id, w)} />}
            <button className="tm-kind" disabled={ro || c.kind === 'NEXT'} onClick={() => setKindMenu(kindMenu === c.id ? null : c.id)} title={c.kind === 'NEXT' ? undefined : 'Change what kind of card this is'}>
              {c.kind ? TAG[c.kind] : 'Pick a kind'}
            </button>
            {kindMenu === c.id && (
              <div className="tm-kindmenu">
                {PICKABLE.map((k) => (
                  <button key={k} className={k === c.kind ? 'solid' : ''} onClick={() => (edit(c.id, (x) => ({ ...x, kind: k, pile: undefined, names: k === 'C' ? x.names : undefined })), setKindMenu(null))}>
                    {LABEL[k]}
                  </button>
                ))}
              </div>
            )}
            {sel === c.id && c.from !== undefined && editCard !== c.id && s.msgs[c.from] && (
              <button className="tm-eye" aria-label="Show where this came from" title="Show where this came from" onClick={() => onOpen(c)}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
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
                    moved.current = true
                    const p = pt(e)
                    setDrag({ kind: 'link', from: c.id, x: p.x, y: p.y })
                  }}
                />
              ))}
          </div>
        ))}

        {guide && find(guide.id) && !ro && <Guide at={guide} add={(a, b) => addDE(find(guide.id)!, a, b)} cancel={() => setGuide(null)} />}
      </div>

      {open && (
        <div className="tm-pop">
          <p>This kind of circle is very common. Which of these links do you have the most power to cut? Tap that line.</p>
          <span className="tm-actions">
            <button onClick={() => setOpenLoop(null)}>Close</button>
          </span>
        </div>
      )}
      {breaking && live.some((x) => x.id === breaking) && (
        <Breaker
          key={breaking}
          s={s}
          edge={s.edges.find((x) => x.id === breaking)!}
          loop={loopOf(breaking)}
          done={addStep}
          cancel={() => setBreaking(null)}
          keep={() => (keepLine(breaking), setBreaking(null))}
          drop={() => (dropLine(breaking), setBreaking(null))}
        />
      )}
      {walk &&
        (() => {
          // the question sits on the map: under the card that just appeared, on the line that closes the circle, or just below the circle
          const cs = walk.plan.path.map((id) => find(id)).filter((c): c is Card => !!c)
          const now = walk.step < walk.plan.path.length ? find(walk.plan.path[walk.step]) : walk.step === walk.st.rest && other ? s.cards.find((c) => c.kind === other) : undefined
          const closing = walk.step === walk.st.close && live.find((x) => x.id === walk.plan.close)
          const tail = choosing ? find(guess!.from) : undefined
          const p = now ? { x: now.x, y: now.y + hOf(now.id) + 14 } : tail ? { x: tail.x, y: tail.y + hOf(tail.id) + 62 } : closing ? { x: find(closing.from)!.x + W + 36, y: find(closing.from)!.y - 24 } : walk.step === walk.st.pick && walk.plan.close ? { x: Math.max(...shown.map((c) => c.x + W)) + 40, y: Math.min(...cs.map((c) => c.y)) } : { x: Math.min(...cs.map((c) => c.x)), y: Math.max(...shown.map((c) => c.y + hOf(c.id))) + (walk.plan.close ? 64 : 24) } // where to break the circle: beside it, so the whole circle stays in view
          const b = board.current
          const at = { left: Math.max(8, Math.min(view.x + p.x * view.z, (b?.clientWidth ?? 900) - 340)), top: Math.max(8, Math.min(view.y + p.y * view.z, (b?.clientHeight ?? 600) - (walk.step === walk.st.pick ? 150 + 62 * (walk.plan.options.length + 1) : 240))) } // the box where to break the circle is taller: one row per option
          return <WalkStep key={`${walk.step}-${hint}`} s={s} walk={walk} at={at} hint={hint} lit={lit.length} moreHelp={moreHelp} takeGuess={takeGuess} addNew={addNew} beside={beside} setBeside={setBeside} addSide={addSide} confirm={confirm} confirmOther={confirmOther} fixCard={fixCard} dropClose={dropClose} breakAt={breakAt} leave={leave} finish={finishWalk} />
        })()}
      {!s.cards.length && <p className="tm-empty board">Double-click anywhere to add a card.</p>}
      <div className="tm-zoom" role="group" aria-label="Zoom">
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
          −
        </button>
        <button className="pct" aria-label="Reset zoom to 100%" onClick={() => setView((v) => zoomAt(v, 1, board.current!.clientWidth / 2, board.current!.clientHeight / 2))}>
          {Math.round(view.z * 100)}%
        </button>
        <button aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
          +
        </button>
        <button onClick={fit}>Fit</button>
      </div>
    </main>
  )
}

// the guided walk's question box: one stage at a time (see walk.ts for the order)
type Walking = { step: number; pick?: 'DE' | 'NEXT'; added?: boolean; plan: Plan; st: ReturnType<typeof stages> }
function WalkStep({ s, walk, at, hint, lit, moreHelp, takeGuess, addNew, beside, setBeside, addSide, confirm, confirmOther, fixCard, dropClose, breakAt, leave, finish }: { s: State; walk: Walking; at: { left: number; top: number }; hint: Hint; lit: number; moreHelp: () => void; takeGuess: () => void; addNew: (text: string) => void; beside: { id: string; side: 'l' | 'r' } | null; setBeside: (b: { id: string; side: 'l' | 'r' } | null) => void; addSide: (id: string, side: 'l' | 'r', text: string) => void; confirm: (edge?: string) => void; confirmOther: () => void; fixCard: (id: string, text: string, edge?: string) => void; dropClose: () => void; breakAt: (edge: string, pick: 'DE' | 'NEXT') => void; leave: () => void; finish: () => void }) {
  const { step, plan, st } = walk
  const card = (id?: string) => s.cards.find((c) => c.id === id)
  const back = card(s.edges.find((e) => e.id === plan.close)?.to)
  const end = (text: string) => (
    <>
      <p>{text}</p>
      <span className="tm-actions">
        <button className="solid" onClick={finish}>
          See the summary
        </button>
        <button onClick={leave}>Keep looking</button>
      </span>
    </>
  )
  const [fix, setFix] = useState(false)
  const [fresh, setFresh] = useState(false) // writing "somewhere new"
  let body: React.ReactNode
  if (step < plan.path.length && beside) {
    const c = card(beside.id)!
    const pre = s.demo ? demoSide(c.text, s.cards) : ''
    const save = (t: string) => t.trim() && addSide(beside.id, beside.side, t.trim())
    body = (
      <>
        <p>What else was there, beside this? Put it in your own words.</p>
        <textarea autoFocus defaultValue={pre} rows={2} id="tm-side" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), save(e.currentTarget.value))} />
        <span className="tm-actions">
          <button className="solid" onClick={() => save((document.getElementById('tm-side') as HTMLTextAreaElement).value)}>
            Add it
          </button>
          <button className="tm-quiet" onClick={() => setBeside(null)}>
            Back
          </button>
        </span>
      </>
    )
  } else if (step < plan.path.length && fix) {
    const c = card(plan.path[step])!
    const save = (t: string) => t.trim() && fixCard(c.id, t.trim(), plan.links[step] || undefined)
    body = (
      <>
        <p>How would you put it, in your own words?</p>
        <textarea autoFocus defaultValue={c.text} rows={2} id="tm-fix" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), save(e.currentTarget.value))} />
        <span className="tm-actions">
          <button className="solid" onClick={() => save((document.getElementById('tm-fix') as HTMLTextAreaElement).value)}>
            That’s it
          </button>
          <button className="tm-quiet" onClick={() => setFix(false)}>
            Back
          </button>
        </span>
      </>
    )
  } else if (step < plan.path.length)
    body = (
      <>
        <p>{ask(card(plan.path[step])!, step)}</p>
        <span className="tm-actions">
          <button className="solid" onClick={() => confirm(plan.links[step] || undefined)}>
            Yes
          </button>
          <button onClick={() => setFix(true)}>Not quite</button>
        </span>
      </>
    )
  else if (!plan.close) body = end('That’s the map of tonight, in your own words.')
  else if (step === st.close && fresh) {
    const save = (t: string) => t.trim() && addNew(t.trim())
    body = (
      <>
        <p>Where does it take you? Put it in your own words.</p>
        <textarea autoFocus defaultValue={s.demo && !s.cards.some((c) => norm(c.text) === norm(DEMO_NEW.text)) ? DEMO_NEW.text : ''} rows={2} id="tm-new" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), save(e.currentTarget.value))} />
        <span className="tm-actions">
          <button className="solid" onClick={() => save((document.getElementById('tm-new') as HTMLTextAreaElement).value)}>
            Add it
          </button>
          <button className="tm-quiet" onClick={() => setFresh(false)}>
            Back
          </button>
        </span>
      </>
    )
  } else if (step === st.close && hint < 2)
    body = (
      <>
        <p>{hint === 0 || !lit ? askWhere(card(s.edges.find((e) => e.id === plan.close)?.from)!) : askNarrow}</p>
        <p className="tm-how">{hint === 0 || !lit ? 'Tap one of the glowing cards.' : 'Tap one of the two glowing cards, or any other card.'}</p>
        <span className="tm-actions">
          {!walk.added && <button onClick={() => setFresh(true)}>Somewhere new</button>}
          <button className="tm-quiet" onClick={moreHelp}>
            I’m not sure
          </button>
        </span>
      </>
    )
  else if (step === st.close)
    body = (
      <>
        <p>{askClose(card(s.edges.find((e) => e.id === plan.close)?.from)!, back!)}</p>
        <span className="tm-actions">
          <button className="solid" onClick={takeGuess}>
            Yes
          </button>
          <button onClick={dropClose}>Not quite</button>
        </span>
      </>
    )
  else if (step === st.pick)
    body = (
      <>
        <p>{sayCircle(card(plan.path[0])!, back!)}</p>
        <p>If you wanted this circle to stop, where would you start?</p>
        <span className="tm-actions tm-options">
          {plan.options.map((o) => (
            <button key={o.edge + o.kind} onClick={() => breakAt(o.edge, o.kind)}>
              {o.label}
            </button>
          ))}
          <button className="tm-quiet" onClick={() => confirm()}>
            I’m not sure yet
          </button>
        </span>
      </>
    )
  else {
    const other = otherKind(walk.pick)
    const more = other && s.cards.find((c) => c.kind === other)
    const said = walk.pick === 'DE' ? 'Here’s the other way you found yourself. The circle is still there, but this line is broken.' : 'Here’s the small step you came up with. The circle is still there, but this line is broken.'
    if (!walk.pick) body = end('That’s okay. Seeing the circle is already a step.')
    else if (step === st.placed && more)
      body = (
        <>
          <p>{said}</p>
          <span className="tm-actions">
            <button className="solid" onClick={() => confirm()}>
              Continue
            </button>
          </span>
        </>
      )
    else if (step === st.rest && more)
      body = (
        <>
          <p>{askOther(other, more)}</p>
          <span className="tm-actions">
            <button className="solid" onClick={confirmOther}>
              Yes
            </button>
            <button onClick={() => confirm()}>Not now</button>
          </span>
        </>
      )
    else body = end(step >= st.done ? 'That’s the whole map: what happened, what you told yourself, how it felt, where the circle breaks, and what you’ll do.' : said)
  }
  return (
    <div className={`tm-ask${step < plan.path.length || step === st.rest ? ' on-card' : ''}`} style={at} role="dialog" aria-label="Building the map together">
      {body}
    </div>
  )
}

// "+ name it" on a feeling card nobody named yet: the two words from the chat (if there were any) or an own word
function NameIt({ options, save }: { options: string[]; save: (w: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([])
  const [v, setV] = useState('')
  const all = [...options, ...sel.filter((w) => !options.includes(w))]
  const toggle = (w: string) => setSel((l) => (l.includes(w) ? l.filter((x) => x !== w) : [...l, w]))
  const addOwn = () => {
    const w = v.replace(/,/g, ' ').trim().toLowerCase()
    if (w && !sel.includes(w)) setSel((l) => [...l, w])
    setV('')
  }
  return (
    <div className="tm-nameprompt">
      <span className="tm-chips">
        {all.map((w) => (
          <button key={w} className={`tm-chip${sel.includes(w) ? ' on' : ''}`} aria-pressed={sel.includes(w)} onClick={() => toggle(w)}>
            {w}
          </button>
        ))}
      </span>
      <span className="tm-ownrow">
        <input id="tm-nameit-word" value={v} maxLength={30} placeholder="my own word" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOwn()} />
        <button onClick={addOwn} disabled={!v.trim()}>
          Add
        </button>
      </span>
      <button className="solid" disabled={!sel.length} onClick={() => save(sel)}>
        Save
      </button>
    </div>
  )
}

// A new card judged to be a thought: two blanks the person can fill (or not); the result is their own "another way to see it" card.
function Guide({ at, add, cancel }: { at: { x: number; y: number }; add: (fit: string, other: string) => void; cancel: () => void }) {
  const [fit, setFit] = useState('')
  const [other, setOther] = useState('')
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => first.current?.focus(), [])
  return (
    <div className="tm-guide" style={{ left: at.x, top: at.y }} onPointerDown={(e) => e.stopPropagation()}>
      <label className="tm-field">
        <span>One thing that doesn’t quite fit:</span>
        <input id="tm-guide-fit" ref={first} autoFocus value={fit} onChange={(e) => setFit(e.target.value)} />
      </label>
      <label className="tm-field">
        <span>Another way to see it:</span>
        <input id="tm-guide-other" value={other} onChange={(e) => setOther(e.target.value)} />
      </label>
      <span className="tm-actions">
        <button className="solid" disabled={!fit.trim() && !other.trim()} onClick={() => add(fit, other)}>
          Add
        </button>
        <button onClick={cancel}>Not now</button>
      </span>
    </div>
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

// "When ___, I will ___" fields, shared by the loop breaker and the "before you go" invitation
function WhenWill({ whenHint, willHint, go, label, no, cancel, extra }: { whenHint: string; willHint: string; go: (when: string, will: string) => void; label: string; no: string; cancel: () => void; extra?: React.ReactNode }) {
  const [when, setWhen] = useState('')
  const [will, setWill] = useState('')
  return (
    <>
      <div className="tm-row">
        <label className="tm-field">
          <span>When</span>
          <input id="tm-step-when" value={when} placeholder={whenHint} onChange={(e) => setWhen(e.target.value)} autoFocus />
        </label>
        <label className="tm-field">
          <span>I will</span>
          <input id="tm-step-will" value={will} placeholder={willHint} onChange={(e) => setWill(e.target.value)} />
        </label>
      </div>
      <span className="tm-actions">
        <button className="solid" disabled={!when.trim() || !will.trim()} onClick={() => go(when, will)}>
          {label}
        </button>
        <button onClick={cancel}>{no}</button>
        {extra}
      </span>
    </>
  )
}

// Click a line in a loop → one guiding question → "When ___ / I will ___" → a Next step card next to that line.
type Ask = { question: string; when_example: string; will_example: string }
function Breaker({ s, edge, loop, done, cancel, keep, drop }: { s: State; edge: Edge; loop: string[]; done: (e: Edge, when: string, will: string, g: Ask) => void; cancel: () => void; keep: () => void; drop: () => void }) {
  const name = (id: string) => s.cards.find((c) => c.id === id)?.text ?? ''
  const [g, setG] = useState<Ask | null>(() => (s.demo ? demoBreak(name(edge.from), name(edge.to)) : null))
  useEffect(() => {
    if (s.demo) return // the script already answered
    let on = true
    ai<Ask>('break', { cards: plain(s.cards), edge, loop: loop.map((id) => s.edges.find((x) => x.id === id)!) }).then(
      (r) => on && setG(r ?? { question: `Between “${name(edge.from)}” and “${name(edge.to)}”, what is one small thing you could do once, soon?`, when_example: '', will_example: '' }),
    )
    return () => void (on = false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="tm-pop tm-break" role="dialog" aria-label="Write one thing you could do">
      <span className="tm-tag">
        {name(edge.from)} → {name(edge.to)}
      </span>
      <p>{g ? g.question : '…'}</p>
      <WhenWill
        whenHint={g?.when_example || 'the moment it starts'}
        willHint={g?.will_example || 'one small thing'}
        go={(when, will) => done(edge, when, will, g ?? { question: '', when_example: '', will_example: '' })}
        label="Put it on the map"
        no="Not now"
        cancel={cancel}
        extra={
          edge.by === 'ai' && (
            <>
              <button onClick={keep}>Keep line</button>
              <button onClick={drop}>Remove line</button>
            </>
          )
        }
      />
    </div>
  )
}

// "That's enough for now" with no Next step on the map yet: one invitation, can be skipped
function NextAsk({ risky, add, skip }: { risky: (t: string, where?: string) => boolean; add: (when: string, will: string) => void; skip: () => void }) {
  return (
    <>
      <div className="tm-dim" />
      <div className="tm-pop tm-center" role="dialog" aria-label="One small thing">
        <p>Before you go, is there one small thing you could do next?</p>
        <WhenWill whenHint="the moment it starts" willHint="one small thing" go={(w, i) => (risky(w, 'next step') || risky(i, 'next step') ? skip() : add(w, i))} label="Add it" no="Skip" cancel={skip} />
      </div>
    </>
  )
}

// --- 4 · summary: the person's own cards, put together by the program (no AI sentence) ---------
// "Tonight's map": the circle told in their words, the other way they found, their step, and one question to take with them.
// What CBT is stays folded away: only for those who want to know.
const ROLE: Record<Kind, string> = { A: 'what happened', B: 'what you told yourself', C: 'what you felt', DE: 'another way', NEXT: 'next step' }
function Summary({ s, close }: { s: State; close: () => void }) {
  const p = walkPlan(s.cards, s.edges)
  const card = (id?: string) => s.cards.find((c) => c.id === id)
  const say = (c: Card) => (c.kind === 'C' && c.names?.length ? c.names.join(' and ') : `“${c.text}”`)
  const path = p.path.map((id) => card(id)!).filter(Boolean)
  const back = card(s.edges.find((e) => e.id === p.close)?.to)
  const de = s.cards.filter((c) => c.kind === 'DE')
  const next = s.cards.filter((c) => c.kind === 'NEXT')
  return (
    <>
      <div className="tm-dim" onClick={close} />
      <aside className="tm-summary" aria-label="Summary">
        <h2>Tonight’s map</h2>
        {s.risk ? (
          <p>{SAFE}</p>
        ) : path.length ? (
          <>
            <p className="tm-story">
              {path.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ' → '}
                  {say(c)} <span className="tm-role">({i > 0 && c.kind === 'A' ? 'what you did' : ROLE[c.kind ?? 'A']})</span>
                </span>
              ))}
              {back ? <> → and back to “{back.text}”.</> : '.'}
            </p>
            {de.length > 0 && (
              <section className="tm-sgroup k-DE">
                <span className="tm-kind">The other way you found</span>
                {de.map((c) => (
                  <p key={c.id}>{c.text}</p>
                ))}
              </section>
            )}
            {next.length > 0 && (
              <section className="tm-sgroup k-NEXT">
                <span className="tm-kind">Your next step</span>
                {next.map((c) => (
                  <p key={c.id}>{c.text}</p>
                ))}
              </section>
            )}
            <p className="tm-takeaway">
              Often it isn’t what happened that keeps us stuck, but the sentence we tell ourselves in between. Next time it starts going round, try asking: <b>what did I just tell myself?</b>
            </p>
            <details className="tm-method">
              <summary>What is this method?</summary>
              <p>It follows the ABC model from cognitive behavioural therapy (CBT): A, what happened; B, what you told yourself about it; C, what you felt.</p>
              <p>Then D and E: questioning that thought, and finding a more accurate one in your own words. The next step at the end is our own addition.</p>
            </details>
          </>
        ) : (
          <p className="tm-hint">Nothing was put on the map tonight, and that’s okay.</p>
        )}
        <button className="solid" onClick={close}>
          That’s it
        </button>
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
