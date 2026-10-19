import { useEffect, useState } from 'react'
import { CONDITIONS, command, listen, send, type Condition, type Ev, type Label, type Session, type Snapshot } from './sync.ts'
import type { Checks, Judgement } from './checks.ts'
import './monitor.css'

// M2 · Monitor: live mirror of the journal, decision cards, stats. Read-only for now (labels + override come in M4).

const FIRST_PERSON = /\b(i|i'm|i've|me|my|mine|myself)\b/gi
const fpRatio = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean).length
  return words ? (text.match(FIRST_PERSON)?.length ?? 0) / words : 0
}
const fromStorage = (): Snapshot | null => {
  try {
    const s = localStorage.getItem('journal-session-v1')
    return s ? { session: JSON.parse(s) as Session, draft: '', status: '—', params: {}, at: 0 } : null
  } catch {
    return null
  }
}
type AiData = { kind: string; ms: number; model: string; decision: string; attempts: { ai: Judgement; checks: Checks | null }[] }

// Plain-language names for the AI's fields and the rule ids it cites.
const STATE: Record<string, string> = {
  immersed_why: 'stuck in “why me”',
  distanced_judging: 'stepping back, still judging',
  distanced_meaning: 'stepping back, finding meaning',
  repeating: 'going in circles',
  none: 'nothing to respond to',
}
const RULE: Record<string, string> = {
  R1: 'stay silent by default', R2: 'receive, then invite', R3: 'no agreeing / advice / judging',
  S1: '≤ 2 sentences, 1 question', S2: 'acknowledge, don’t amplify', S3: 'invitation, not command', S4: 'reuse their words', S5: 'curious, not interrogating',
  X1: 'no agreeing with negative conclusions', X2: 'no advice', X3: 'no diagnosis', X4: 'no praise / judging the person', X5: 'no analysis words', X6: 'crisis → human help',
}

// The AI's own fields next to the program checks, one block per attempt (a failed check triggers one rewrite).
function AiBlock({ d }: { d: AiData }) {
  return (
    <div className="ai">
      {d.attempts.map(({ ai, checks }, i) => (
        <div key={i} className={`attempt${i < d.attempts.length - 1 ? ' failed' : ''}`}>
          <dl className="ai-fields">
            <dt>{i ? `AI · rewrite ${i}` : d.kind === 'pause' ? 'AI · on pause' : 'AI · on entry'}</dt>
            <dd />
            <dt>Writer seems</dt>
            <dd>{STATE[ai.user_state] ?? ai.user_state}</dd>
            <dt>Thought</dt>
            <dd className={ai.thought_complete ? '' : 'na'}>{ai.thought_complete ? 'finished' : 'unfinished → must stay silent'}</dd>
            <dt>AI wanted to</dt>
            <dd>{ai.decision === 'speak' ? 'speak' : 'stay silent'}</dd>
            <dt>Sure</dt>
            <dd>{Math.round(ai.confidence * 100)}%</dd>
            <dt>Rules cited</dt>
            <dd>
              {ai.rules_used.map((r) => (
                <span key={r} className="rule">
                  {r} {RULE[r] ?? ''}
                </span>
              ))}
            </dd>
          </dl>
          <p className="reason">{ai.reason}</p>
          {ai.comment && <p className="cand">“{ai.comment}”</p>}
          {checks && (
            <div className="gates">
              {Object.entries(checks).map(([k, c]) => (
                <span key={k} className={c.ok ? 'ok' : 'no'} title={`${RULE[k] ?? k} — ${c.note}`}>
                  {c.ok ? '✓' : '✗'} {k}
                  {k in ai.tone_self_check && ai.tone_self_check[k as keyof Judgement['tone_self_check']] !== c.ok ? ' (AI said ' + (c.ok ? '✗' : '✓') + ')' : ''}
                </span>
              ))}
            </div>
          )}
          {checks && <p className="notes">{Object.entries(checks).filter(([, c]) => !c.ok).map(([k, c]) => `${k}: ${c.note}`).join(' · ')}</p>}
        </div>
      ))}
      <p className="hint">
        {d.model} · {(d.ms / 1000).toFixed(1)}s · final: {d.decision}
      </p>
    </div>
  )
}

// Your labels: click cycles – → ✓ → ✗ → –. Tone/prohibition labels only make sense when something was said.
const TONE = ['S2', 'S5', 'X1', 'X2', 'X4'] as const
const HELP: Record<string, string> = {
  S2: 'acknowledges without amplifying',
  S5: 'curious, not interrogating',
  X1: 'does not agree with negative conclusions',
  X2: 'gives no advice',
  X4: 'no empty praise / judging the person',
  timing: 'right moment to speak / stay silent',
}
function Labels({ k, label = {}, spoke }: { k: string; label?: Label; spoke: boolean }) {
  const put = (next: Label) => command({ cmd: 'label', key: k, label: next })
  const cycle = (f: keyof Omit<Label, 'note'>) => put({ ...label, [f]: label[f] === undefined ? true : label[f] ? false : undefined })
  const mark = (v?: boolean) => (v === undefined ? '–' : v ? '✓' : '✗')
  return (
    <div className="labels">
      <span className="hint">your label</span>
      {(['timing', ...(spoke ? TONE : [])] as const).map((f) => (
        <button key={f} className={`lab ${label[f] === undefined ? '' : label[f] ? 'ok' : 'no'}`} title={HELP[f]} onClick={() => cycle(f)}>
          {mark(label[f])} {f}
        </button>
      ))}
      <input
        key={label.note ?? ''}
        defaultValue={label.note ?? ''}
        placeholder="note…"
        onBlur={(e) => e.target.value !== (label.note ?? '') && put({ ...label, note: e.target.value || undefined })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </div>
  )
}

const OUTCOME: Record<string, string> = {
  reply: 'Reply',
  silent: 'Silent',
  throttled: 'Throttled',
  referral: 'Referral',
  trigger_only: 'Trigger · no reply',
  ai: 'AI',
  control: 'Dot only',
}

// Wizard-of-Oz controls: make the dot say exactly your text now, or ask the AI about the latest entry ignoring the gap.
function Override() {
  const [text, setText] = useState('')
  return (
    <div className="override">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a margin note to show now…" rows={3} />
      <div className="row-b">
        <button disabled={!text.trim()} onClick={() => (command({ cmd: 'say', text }), setText(''))}>
          Say this now
        </button>
        <button onClick={() => command({ cmd: 'ask_ai' })}>Ask AI now</button>
      </div>
      <p className="hint">Both skip the min gap and are logged as overrides. Crisis wording still goes to the referral card only.</p>
    </div>
  )
}

export default function Monitor() {
  const [snap, setSnap] = useState<Snapshot | null>(fromStorage)
  const [, setTick] = useState(0)

  useEffect(() => {
    const off = listen((m) => m.kind === 'snapshot' && setSnap(m.snap))
    send({ kind: 'hello' })
    const id = setInterval(() => setTick((x) => x + 1), 1000)
    return () => {
      off()
      clearInterval(id)
    }
  }, [])

  if (!snap) return <div className="mon-empty">Waiting for the journal… open it in another window of this browser.</div>

  const { session, draft, status, params } = snap
  const { items, events } = session
  const start = new Date(session.started).getTime()
  const live = Date.now() - snap.at < 5000
  const clock = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  const at = (e: Ev) => clock(new Date(e.t).getTime() - start)

  const decisions = events.filter((e) => e.type === 'decision')
  const labels = session.labels ?? {}
  const timed = Object.values(labels).filter((l) => l.timing !== undefined)
  const judgements = events.filter((e) => e.type === 'ai_judgement')
  const aiFor = (entryId: unknown) => judgements.findLast((j) => j.data?.entryId === entryId)?.data as AiData | undefined
  const errFor = (entryId: unknown) => events.find((e) => e.type === 'ai_error' && e.data?.entryId === entryId)
  const whyIds = new Set(decisions.filter((d) => d.data?.why).map((d) => d.data?.entryId))
  const visited = new Set(session.visited ?? [])
  // Every reply shown until the next decision (the AI's, or yours via override).
  const repliesFor = (i: number) => {
    const out: string[] = []
    for (let j = i + 1; j < events.length && events[j].type !== 'decision'; j++) if (events[j].type === 'reply_shown' && events[j].detail) out.push(events[j].detail!)
    return out
  }
  const count = (pred: (e: Ev) => boolean) => events.filter(pred).length
  const entries = items.filter((i) => i.kind === 'entry')
  const ratios = entries.map((e) => fpRatio(e.text))
  const pct = (x: number | undefined) => (x === undefined ? '—' : `${Math.round(x * 100)}%`)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ params, ...session }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `journal-${session.started.slice(0, 19).replace(/:/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mon">
      <header className="mon-top">
        <b>Monitor</b>
        <span>{new Date(session.started).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <span>elapsed {clock(Date.now() - start)}</span>
        <span>mode · {session.mode}</span>
        <select className="cond" value={String(params.condition ?? 'ai')} onChange={(e) => command({ cmd: 'condition', value: e.target.value as Condition })}>
          {CONDITIONS.map(([v, l]) => (
            <option key={v} value={v}>
              condition · {l}
            </option>
          ))}
        </select>
        <span>ai · {String(params.ai ?? '—')}</span>
        <span className={live ? 'live' : 'off'}>{live ? '● live' : '○ not connected'}</span>
        <div className="grow" />
        <button onClick={exportJson}>Export JSON</button>
      </header>

      <main className="mon-grid">
        <section className="col mirror">
          <h2>Text mirror</h2>
          {!items.length && !draft && <p className="hint">Nothing written yet.</p>}
          {items.map((it) =>
            it.kind === 'entry' ? (
              <p
                key={it.id}
                className={`m-entry${whyIds.has(it.id) ? ' trig' : ''}${visited.has(it.id) ? ' visited' : ''}`}
                onClick={() => {
                  const card = document.getElementById(`d-${it.id}`)
                  const tl = card?.closest('.timeline')
                  if (!card || !tl) return
                  // Scroll only the middle column, not the page, so the mirror stays where you clicked.
                  tl.scrollBy({ top: card.getBoundingClientRect().top - tl.getBoundingClientRect().top - 8 })
                  card.animate([{ boxShadow: '0 0 0 3px #ff7a3d' }, { boxShadow: '0 0 0 3px transparent' }], { duration: 1600, easing: 'ease-out' })
                }}
              >
                {it.text}
              </p>
            ) : (
              <p key={it.id} className="m-reply">
                {it.text || '…holding the line'}
              </p>
            ),
          )}
          {draft && (
            <p className="m-draft">
              {draft}
              <span className="caret" />
            </p>
          )}
          <p className="legend">
            <span className="trig">trigger</span> <span className="visited">visited by the dot</span> · click an entry to jump to its decision
          </p>
        </section>

        <section className="col timeline">
          <h2>Decisions & events</h2>
          {[...events.keys()].reverse().map((i) => {
            const e = events[i]
            if (e.type === 'commit' || e.type === 'visit') return null // visits are counted, not listed
            if (e.type === 'ai_judgement' && e.data?.entryId) return null // shown inside its entry's card
            if (e.type === 'ai_error' && e.data?.entryId) return null
            if (e.type === 'ai_judgement')
              return (
                <article key={i} className={`card-d o-${e.data?.decision === 'speak' ? 'reply' : 'silent'}`}>
                  <div className="card-h">
                    <code>{at(e)}</code>
                    <span className="badge">Pause · {e.data?.decision === 'speak' ? 'reply' : 'silent'}</span>
                  </div>
                  <p className="quote">{e.detail}</p>
                  <AiBlock d={e.data as AiData} />
                  <Labels k={e.t} label={labels[e.t]} spoke={e.data?.decision === 'speak'} />
                </article>
              )
            if (e.type !== 'decision')
              return (
                <div key={i} className="ev-row">
                  <code>{at(e)}</code> {e.type.replace('_', ' ')}
                  {e.detail && e.type !== 'reply_shown' ? <em> · {e.detail.slice(0, 60)}</em> : null}
                </div>
              )
            const d = e.data ?? {}
            const replies = repliesFor(i)
            const aiD = aiFor(d.entryId)
            const err = errFor(d.entryId)
            const overridden = events.some((x, j) => j > i && x.type === 'override' && (x.data?.entryId === d.entryId || !x.data?.entryId) && !events.slice(i + 1, j).some((y) => y.type === 'decision'))
            const badge =
              (d.outcome !== 'ai' ? (OUTCOME[String(d.outcome)] ?? String(d.outcome)) : err ? 'AI · error' : !aiD ? 'AI · thinking…' : aiD.decision === 'speak' ? 'AI · reply' : 'AI · silent') +
              (overridden ? ' · overridden' : '')
            return (
              <article key={i} id={`d-${d.entryId}`} className={`card-d o-${aiD ? (aiD.decision === 'speak' ? 'reply' : 'silent') : d.outcome}`}>
                <div className="card-h">
                  <code>{at(e)}</code>
                  <span className="badge">{badge}</span>
                  {d.fromDraft ? <span className="hint">from draft</span> : null}
                </div>
                <p className="quote">{e.detail}</p>
                <div className="gates">
                  <span className={d.crisis ? 'no' : 'ok'}>{d.crisis ? '✗' : '✓'} crisis check</span>
                  <span className={d.why ? 'ok' : 'na'}>{d.why ? '✓' : '–'} why-loop trigger</span>
                  {/* the gap gate only matters once the trigger fired */}
                  <span className={!d.why && d.outcome !== 'ai' && d.outcome !== 'throttled' ? 'na' : d.gapOk === false ? 'no' : 'ok'}>
                    {!d.why && d.outcome !== 'ai' && d.outcome !== 'throttled' ? '–' : d.gapOk === false ? '✗' : '✓'} gap {d.sinceLast == null ? 'first reply' : `${d.sinceLast}s / ${d.minGap}s`}
                  </span>
                </div>
                {aiD && <AiBlock d={aiD} />}
                {err && <p className="notes">AI error · {err.detail}</p>}
                {replies.map((r, k) => (
                  <p key={k} className="reply-q">
                    {r}
                  </p>
                ))}
                {d.outcome !== 'referral' && <Labels k={String(d.entryId)} label={labels[String(d.entryId)]} spoke={replies.length > 0} />}
              </article>
            )
          })}
        </section>

        <section className="col side">
          <h2>Override</h2>
          <Override />

          <h2>Now</h2>
          <div className="tile">
            <span>Dot</span>
            <b>{status}</b>
          </div>

          <h2>Stats</h2>
          <div className="stats">
            {(
              [
                ['Entries', entries.length],
                ['Replies', count((e) => e.type === 'reply_shown')],
                ['Silent', count((e) => (e.type === 'decision' && e.data?.outcome === 'silent') || (e.type === 'ai_judgement' && e.data?.decision === 'silent'))],
                ['AI calls', count((e) => e.type === 'ai_judgement')],
                ['Timeouts', count((e) => e.type === 'hold_timeout')],
                ['Overrides', count((e) => e.type === 'override')],
                ['Timing ✓', timed.length ? `${timed.filter((l) => l.timing).length}/${timed.length}` : '—'],
                ['Triggers', count((e) => e.type === 'decision' && !!e.data?.why)],
                ['Throttled', count((e) => e.type === 'decision' && e.data?.outcome === 'throttled')],
                ['Referrals', count((e) => e.type === 'decision' && e.data?.outcome === 'referral')],
                ['Visits', session.visits ?? 0],
                ['Pauses', count((e) => e.type === 'pause_candidate')],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="stat">
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>

          <h2>First-person words per entry</h2>
          <p className="hint">
            first {pct(ratios[0])} → latest {pct(ratios.at(-1))} · fewer “I” suggests stepping back
          </p>
          <div className="bars">
            {ratios.map((r, i) => (
              <div key={i} className="bar" title={`entry ${i + 1}: ${pct(r)}`} style={{ height: `${Math.max(4, r * 300)}%` }} />
            ))}
          </div>

          <h2>Parameters</h2>
          <dl className="params">
            {(['name', 'condition', 'minGap', 'pauseSec', 'holdTimeout', 'visitEvery'] as const).map((k) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{String(params[k] ?? '—')}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  )
}
