// Thought map v2 (/map): chat (separate what happened / what you told yourself / what you felt, name the feeling, see it another way)
// → cards laid out on a canvas → connect them yourself → a summary built from your own cards. Greyscale on purpose.
// The AI calls go through brain.ts (checked there). If there is no key or no answer passes, the stubs below stand in.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isCrisis } from '../triggers.ts'
import { DevPanel } from './dev.tsx'
import { loops } from './graph.ts'
import { afterNaming, demoBreak, demoState, demoLines, demoMade, demoPair, MORE, norm, SCRIPT } from './demo.ts'
import { lay, makeCards, reroute } from './build.ts'
import { ai, getKey, hasServer, NEED_KEY, setDemo, setKey } from './link.ts'
import { describe, feels, fitView, freeSpot, freeSpotLinked, guessKind, LABEL, optionsFor, routeMid, routeOrtho, segments, smoothPath, summaryOf, tidyPiles, zoomAt, type Kind, type Piles, type View } from './place.ts'
import './map.css'

type Src = 'you' | 'ai' // 'ai' only exists in older saved maps
type Step = { when: string; will: string } // a Next step card: "When {when}, I will {will}."
export type Card = { id: string; text: string; src: Src; x: number; y: number; stack: string[]; kind?: Kind; names?: string[]; from?: number; step?: Step; t?: number; pile?: Kind } // pile = the pile it still lies in; from = index into msgs of the message it came from; t = last edited
export type Edge = { id: string; from: string; to: string; label?: string; by?: 'ai'; t?: number; between?: boolean; route?: [number, number][]; at?: [number, number, number, number] } // route: the line's path from the layered layout, valid while both cards stay where they were (at); by: drawn by "Lay it out for me" until the person keeps it; label: older maps only
// notes: the AI's private understanding after this reply (what material is there, the core, how they're stuck). Never shown in the chat.
export type Notes = { have: Record<string, boolean>; named?: boolean; deAsked?: number; core: string; stuck: string; help: string; ready: boolean }
export type Msg = { role: Src; text: string; propose?: boolean; declined?: boolean; notes?: Notes; options?: string[]; naming?: boolean } // propose: the AI offers a map; options: two words offered for the feeling; naming: the person's chosen words
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
// spreadAt: how many messages had been sent when the cards were made; areas: column titles; mode: how the person chose to arrange
// demo: the scripted story (/map?demo), demoStep: the next script line; piles: where the piles lie (manual layout); view: pan and zoom
export type State = { phase: Phase; msgs: Msg[]; cards: Card[]; edges: Edge[]; ended: boolean; mode?: 'auto' | 'manual'; risk?: boolean; log?: Log[]; spreadAt?: number; areas?: { name: string; x: number; y: number }[]; demo?: boolean; demoStep?: number; piles?: Piles; view?: View }
export const KEY = 'thought-map-v2'
type Set = (f: (s: State) => State) => void
type Entry = Log extends infer L ? (L extends Log ? Omit<L, 'at'> : never) : never
const logIt = (set: Set, e: Entry) => set((p) => ({ ...p, log: [...(p.log ?? []), { ...e, at: Date.now() } as Log] }))

const W = 180 // card width, px
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
  const [asking, setAsking] = useState(false) // "Before you go, is there one small thing…"
  const noKeyNag = useRef(false) // "Not now" keeps the notice away until a key is saved
  useEffect(() => {
    const on = () => !noKeyNag.current && setNeedKey(true) // never fires in demo mode (ai() is silent there)
    addEventListener(NEED_KEY, on)
    return () => removeEventListener(NEED_KEY, on)
  }, [])
  const say = (t: string) => (setToast(t), setTimeout(() => setToast(''), 2200))
  const restart = () => (setS(fresh()), setSummary(false), setFocus(null), setTalk(true), setAsking(false))
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
    set((p) => ({ ...p, ended: true, cards }))
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
  const jump = (to: 'chat' | 'piles' | 'laid' | 'summary') => {
    setS(demoState(to))
    setSummary(to === 'summary')
    setTalk(to === 'chat')
    setFocus(null)
    setAsking(false)
    setDemoMenu(false)
  }
  const finish = () => (s.risk || s.cards.some((c) => c.kind === 'NEXT') ? end() : setAsking(true))
  return (
    <div className={`tm${s.phase === 'map' ? (talk ? ' talk-open' : '') : ' solo'}`}>
      <aside className={`tm-left${talk || s.phase !== 'map' ? '' : ' shut'}`} aria-label="Conversation">
        <Chat s={s} set={set} risky={risky} onRisk={() => setCrisis(true)} say={say} ro={s.phase !== 'chat'} focus={focus} notice={s.phase === 'chat' && notice} />
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
          <span className="tm-actions">
            {s.risk && (
              <button className="solid" onClick={() => setCrisis(true)}>
                Get support
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
        {s.phase === 'map' && <MapCanvas key={JSON.stringify(s.view)} s={s} set={set} risky={risky} onOpen={openSource} />}
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
              {(['chat', 'piles', 'laid', 'summary'] as const).map((to) => (
                <button key={to} role="menuitem" onClick={() => jump(to)}>
                  {{ chat: 'Start chat', piles: 'Map — piles', laid: 'Map — laid out', summary: 'Summary' }[to]}
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
      {toast && <div className="tm-toast">{toast}</div>}
      {import.meta.env.DEV && !s.demo && <DevPanel s={s} setS={setS} openSummary={setSummary} crisis={() => setCrisis(true)} pane={setTalk} />}
    </div>
  )
}

// --- 1 · chat (left pane) ----------------------------------------------------------------------
function Chat({ s, set, risky, onRisk, say, ro, focus, notice }: { s: State; set: Set; risky: (t: string, where?: string) => boolean; onRisk: () => void; say: (t: string) => void; ro: boolean; focus: { msg: number; text: string } | null; notice?: React.ReactNode }) {
  // demo mode: the box is pre-filled with the script's next line (editable); anything else the person writes gets the program stubs
  const cur = s.demo ? (s.demoStep ?? 0) : -1
  const step = SCRIPT[cur]
  const [edited, setEdited] = useState<{ at: number; text: string } | null>(null)
  const draft = edited && edited.at === cur ? edited.text : (step?.p ?? '')
  const setDraft = (text: string) => setEdited({ at: cur, text })
  const [pick, setPick] = useState(false) // the second step: lay it out for me / I'll arrange it myself
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
    await reply(msgs, risk, text, hit && { msg: { role: 'ai', text: hit.ai, options: hit.options, propose: hit.propose }, next: cur + 1 })
  }
  // the person chose a word (or two) for the feeling: it goes in as their message, and the AI answers without any typed text
  const name = (words: string[]) => {
    if (words.some((w) => risky(w, 'naming the feeling'))) return
    const msgs: Msg[] = [...s.msgs, { role: 'you', text: words.join(', '), naming: true }]
    set((p) => ({ ...p, msgs }))
    const an = s.demo ? afterNaming(last?.text ?? '', words) : null
    void reply(msgs, !!s.risk, words.join(', '), an ? { msg: { role: 'ai', text: an.text }, next: an.next } : undefined)
  }
  // "Talk a bit more" (in the demo the AI answers from the script)
  const decline = () => {
    setPick(false)
    set((p) => ({ ...p, msgs: [...p.msgs.map((m, i) => (i === p.msgs.length - 1 ? { ...m, declined: true } : m)), ...(s.demo ? [{ role: 'ai' as const, text: MORE }] : [])] }))
  }
  const go = (mode: 'auto' | 'manual') => set((p) => ({ ...p, mode, phase: 'layout' }))
  return (
    <main className="tm-chat">
      <div className="tm-msgs">
        {!s.msgs.length && <p className="tm-empty">What’s taking up room in your head tonight?</p>}
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
        {propose && !pick && (
          <div className="tm-propose">
            Want to see it as a map?
            <span className="tm-actions">
              <button className="solid" onClick={() => setPick(true)}>
                Yes
              </button>
              <button onClick={decline}>Talk a bit more</button>
            </span>
          </div>
        )}
        {pick && !ro && !s.risk && !typing && (
          <div className="tm-propose">
            I can lay out the whole map for you, already connected — or sort the cards into piles and you place and connect them yourself.
            <span className="tm-actions">
              <button className="solid" onClick={() => go('auto')}>
                Lay it out for me
              </button>
              <button onClick={() => go('manual')}>I’ll arrange it myself</button>
              <button className="tm-quiet" onClick={() => setPick(false)}>
                Not yet
              </button>
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
          {!s.risk && s.msgs.some((m) => m.role === 'you' && !m.naming) && !propose && !pick && (
            <button className="tm-early" onClick={() => setPick(true)}>
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
      set((p) => ({ ...p, phase: 'map', ...laid, log: [...(p.log ?? []), entry, ...arrangeLog], spreadAt: p.msgs.length }))
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
function MapCanvas({ s, set, risky, onOpen }: { s: State; set: Set; risky: (t: string, where?: string) => boolean; onOpen: (c: Card) => void }) {
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
    const boxes = [...s.cards.map((c) => ({ x: c.x, y: c.y, w: W, h: h[c.id] ?? 90 })), ...s.edges.flatMap((e) => (routeOf(e) ?? []).map(([x, y]) => ({ x, y, w: 0, h: 0 })))]
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

  const groups = loops(s.edges)
  const inLoop = new Set(groups.flat())
  // every line is horizontal and vertical runs only: it keeps the route it was given (the layout's, or the router's when a card moved or a line was drawn)
  // while both its cards stay put; otherwise a quick route is worked out for it
  const boxOf = (c: Card) => ({ x: c.x, y: c.y, w: W, h: hOf(c.id) })
  const routeOf = (x: Edge) => {
    const [a, b] = [find(x.from), find(x.to)]
    return x.route && x.at && a && b && a.x === x.at[0] && a.y === x.at[1] && b.x === x.at[2] && b.y === x.at[3] ? x.route : null
  }
  const routeFor = (x: Edge) => routeOf(x) ?? routeOrtho(boxOf(card(x.from)), boxOf(card(x.to)), [], [])
  const geom = (x: Edge) => {
    const r = routeFor(x)
    return { d: smoothPath(r, 8), m: routeMid(r) }
  }
  const mid = (x: Edge) => geom(x).m
  const live = s.edges.filter((x) => find(x.from) && find(x.to))
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
  const gaps = (ro || s.risk ? [] : [
    ...s.cards.filter((c) => c.kind === 'C' && !s.edges.some((e) => e.to === c.id)).map((c) => ({ key: `c${c.id}`, text: 'What happened before this?', x: c.pile ? c.x - 12 : c.x, y: c.pile ? c.y + 10 : c.y - 34, left: !!c.pile, t: c.t ?? 0 })),
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
      <div className="tm-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
        <svg className="tm-edges" aria-hidden="true" width="6000" height="6000" viewBox="-2000 -2000 6000 6000">
          <defs>
            <marker id="tm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>
          {live.map((x) => {
            const cls = [inLoop.has(x.id) && 'loop', x.between && 'cross', breaking === x.id && 'breaking', x.by === 'ai' && 'ai'].filter(Boolean).join(' ')
            return <path key={x.id} d={geom(x).d} className={cls} markerEnd="url(#tm-arrow)" />
          })}
          {!ro &&
            live.map((x) => (
              <path key={x.id} d={geom(x).d} className="hit" onClick={() => (inLoop.has(x.id) && !s.risk ? (setOpenLoop(null), setLineMenu(null), setBreaking(x.id)) : (setBreaking(null), setLineMenu(lineMenu === x.id ? null : x.id)))}>
                <title>{inLoop.has(x.id) ? 'Write one thing you could do here' : x.by === 'ai' ? 'Drawn for you. Click to keep or remove it' : 'Click to remove this line'}</title>
              </path>
            ))}
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

        {s.cards.map((c) => (
          <div
            key={c.id}
            data-card={c.id}
            ref={(el) => void (el ? refs.current.set(c.id, el) : refs.current.delete(c.id))}
            className={`tm-card k-${c.kind ?? 'none'}${sel === c.id ? ' sel' : ''}${partner === c.id ? ' lit' : ''}${c.stack.length ? ' stacked' : ''}${drag?.kind === 'move' && drag.id === c.id ? ' dragging' : ''}`}
            style={{ left: c.x, top: c.y, width: W }}
            onPointerDown={(e) => {
              if (editCard === c.id || (e.target as HTMLElement).closest('button,input')) return
              setSel(c.id)
              if (ro) return
              const p = pt(e)
              moved.current = false
              start.current = { x: e.clientX, y: e.clientY }
              setKindMenu(null)
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
              {c.kind ? LABEL[c.kind] : 'Pick a kind'}
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

// --- 4 · summary: the person's own cards, laid out by the program (no AI sentence) ---------------
function Summary({ s, close }: { s: State; close: () => void }) {
  const sum = summaryOf(s.cards, s.edges)
  return (
    <>
      <div className="tm-dim" onClick={close} />
      <aside className="tm-summary" aria-label="Summary">
        {s.risk ? (
          <p>{SAFE}</p>
        ) : (
          <>
            {sum.hasC && (
              <>
                <span className="tm-tag">Tonight you called it</span>
                {sum.unnamed ? <p className="tm-big tm-muted-t">You left the feeling unnamed. That’s okay.</p> : <p className="tm-big">{sum.names.join(' · ')}</p>}
              </>
            )}
            {sum.rows.map((r) => (
              <div key={r.label} className="tm-srow">
                <span className="tm-tag">{r.label}</span>
                <p>{r.text}</p>
              </div>
            ))}
            {sum.de.length > 0 && (
              <div className="tm-srow">
                <span className="tm-tag">Another way to see it</span>
                {sum.de.map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </div>
            )}
            {sum.next.length > 0 && (
              <>
                <hr />
                <span className="tm-tag">Your next step</span>
                {sum.next.map((t) => (
                  <p key={t} className="tm-big2">
                    {t}
                  </p>
                ))}
              </>
            )}
            {sum.more > 0 && <p className="tm-hint">There’s {sum.more} more on your map.</p>}
            {!sum.hasC && !sum.next.length && <p className="tm-hint">Nothing was named or planned tonight, and that’s okay.</p>}
          </>
        )}
        <button className="solid" onClick={close}>
          Done for tonight
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
