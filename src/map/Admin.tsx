// Back office for the thought map (/map/admin): how the AI read the chat, why each card exists, what it did on the map.
// Reads the map saved in this browser (live: updates when the map tab changes it) or an exported JSON file.
import { Fragment, useEffect, useState } from 'react'
import { loops } from './graph.ts'
import { KEY, lastNotes, type Log, type Made, type Notes, type State } from './MapApp.tsx'
import './admin.css'

const KINDS = ['A', 'B', 'C', 'DE'] as const
const KIND: Record<string, string> = { A: 'what happened', B: 'what they told themselves', C: 'what they felt', DE: 'another way to see it', NEXT: 'next step' }
const STUCK: Record<string, string> = {
  unclear: 'can’t tell what it is',
  deciding: 'stuck between options',
  starting: 'can’t begin',
  replaying: 'an event keeps replaying',
  'what-if': 'fear of something not yet happened',
  other: 'other',
}
const read = (): State | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

export default function Admin() {
  const [s, setS] = useState<State | null>(read)
  const [file, setFile] = useState('')
  useEffect(() => {
    const on = (e: StorageEvent) => e.key === KEY && !file && setS(read())
    addEventListener('storage', on)
    return () => removeEventListener('storage', on)
  }, [file])
  const open = async (f?: File) => {
    if (!f) return
    try {
      setS(JSON.parse(await f.text()))
      setFile(f.name)
    } catch {
      alert('That file is not a thought-map export.')
    }
  }
  const save = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }))
    a.download = `thought-map-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`
    a.click()
  }

  return (
    <div className="ad">
      <header className="ad-bar">
        <span className="ad-title">Thought map · back office</span>
        <span className="ad-src">{file ? `file: ${file}` : 'live: the map saved in this browser'}</span>
        <span className="ad-actions">
          {file && <button onClick={() => (setFile(''), setS(read()))}>Back to live</button>}
          <label className="ad-btn">
            Open JSON…
            <input id="ad-open" type="file" accept="application/json,.json" hidden onChange={(e) => open(e.target.files?.[0])} />
          </label>
          <button disabled={!s} onClick={save}>
            Export JSON
          </button>
          <a className="ad-btn" href={`${import.meta.env.BASE_URL}map`} target="_blank" rel="noreferrer">
            Open the map ↗
          </a>
        </span>
      </header>
      {!s || !s.msgs?.length ? (
        <p className="ad-empty">Nothing yet. Open the map (or load a sample from its dev panel) and this page fills in as you go.</p>
      ) : (
        <Report s={s} />
      )}
    </div>
  )
}

function Report({ s }: { s: State }) {
  const log = s.log ?? []
  const you = s.msgs.filter((m) => m.role === 'you')
  const spreads = log.filter((l): l is Extract<Log, { t: 'cards' }> => l.t === 'cards')
  const cardsLog = spreads[0]
  const steps = s.cards.filter((c) => c.step)
  const ls = loops(s.edges)
  const name = (id: string) => s.cards.find((c) => c.id === id)?.text ?? spreads.flatMap((x) => x.made).find((c) => c.id === id)?.text ?? '(removed card)'
  return (
    <main className="ad-main">
      <section className="ad-facts" aria-label="This session">
        <Fact n={you.length} label="their messages" />
        <Fact n={s.cards.length} label="cards on the map" />
        <Fact n={s.edges.length} label="lines" />
        <Fact n={ls.length} label="loops" />
        <Fact n={steps.length} label="step cards" />
        <span className={`ad-state${s.risk ? ' risk' : ''}`}>{s.risk ? 'Risk state on' : s.ended ? 'Ended with a summary' : s.phase === 'map' ? 'On the map' : 'In the chat'}</span>
      </section>

      <Section n="1" title="Chat: what the AI understood, turn by turn" note="After every reply the AI updates private notes: which kinds of material it has, its guess at the core, how the person is stuck and what would help next. The person never sees these.">
        <Turns s={s} />
      </Section>

      <Section n="2" title="From the chat to the cards" note="The AI picks at most 10 of the person’s own sentences, centred on its last guess at the core. The program then drops any card that isn’t ≥ 75% their words, is too long, or holds risk words.">
        {cardsLog ? (
          spreads.map((e, i) => (
            <div key={i} className="ad-spread">
              {spreads.length > 1 && <h3>{e.since ? `Added later from the continued conversation (after their message #${e.since})` : 'When the chat was spread out'}</h3>}
              <Cards s={s} entry={e} you={you.map((m) => m.text)} />
            </div>
          ))
        ) : (
          <p className="ad-muted">The chat hasn’t been spread out yet.</p>
        )}
      </Section>

      <Section n="3" title="On the map" note="The person moves, connects and stacks. The AI labels lines, points at near-duplicates, describes loops when clicked, asks one guiding question when a loop line is clicked, and arranges only when asked (“Arrange for me”).">
        <MapLog s={s} log={log} name={name} />
      </Section>

      <Section n="4" title="Summary">
        {(() => {
          const sum = log.filter((l): l is Extract<Log, { t: 'summary' }> => l.t === 'summary').at(-1)
          return sum ? (
            <dl className="ad-dl">
              <dt>Restates the map</dt>
              <dd>{sum.restate}</dd>
              <dt>What seems most stuck</dt>
              <dd>{sum.stuck || '—'}</dd>
              <dt>Next step</dt>
              <dd>{steps.length ? steps.map((c) => `${c.text} · ${c.step!.when || 'when?'} · ${c.step!.will || 'will?'}`).join(' / ') : sum.step || '—'}</dd>
            </dl>
          ) : (
            <p className="ad-muted">No summary yet.</p>
          )
        })()}
      </Section>

      {log.some((l) => l.t === 'risk') && (
        <Section n="!" title="Risk events">
          <ul className="ad-list">
            {log
              .filter((l): l is Extract<Log, { t: 'risk' }> => l.t === 'risk')
              .map((l, i) => (
                <li key={i}>
                  <b>{l.where}</b> · “{l.text}” <span className="ad-muted">{time(l.at)}</span>
                </li>
              ))}
          </ul>
        </Section>
      )}
    </main>
  )
}

const time = (at: number) => (at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
const Fact = ({ n, label }: { n: number; label: string }) => (
  <span className="ad-fact">
    <b>{n}</b>
    {label}
  </span>
)
function Section({ n, title, note, children }: { n: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="ad-sec">
      <h2>
        <span className="ad-n">{n}</span>
        {title}
      </h2>
      {note && <p className="ad-note">{note}</p>}
      {children}
    </section>
  )
}

function Material({ n }: { n: Notes }) {
  return (
    <span className="ad-chips">
      {KINDS.map((k) => (
        <span key={k} className={`ad-chip${n.have?.[k] ? ' on' : ''}`} title={KIND[k]}>
          {k}
        </span>
      ))}
    </span>
  )
}

function Turns({ s }: { s: State }) {
  let n = 0
  let prevCore = ''
  return (
    <ol className="ad-turns">
      {s.msgs.map((m, i) => {
        if (m.role === 'you')
          return (
            <li key={i} className="ad-you">
              <span className="ad-who">#{++n}</span>
              <p>{m.text}</p>
            </li>
          )
        const notes = m.notes
        const changed = notes && prevCore && notes.core !== prevCore
        if (notes) prevCore = notes.core
        return (
          <li key={i} className="ad-ai">
            <span className="ad-who">AI</span>
            <div>
              <details>
                <summary>{m.text}</summary>
                <p>{m.text}</p>
              </details>
              {notes ? (
                <div className="ad-notes">
                  <div className="ad-row">
                    <Material n={notes} />
                    <span className="ad-tag">stuck: {STUCK[notes.stuck] ?? notes.stuck}</span>
                    {notes.ready && <span className="ad-tag dark">ready to map</span>}
                    {m.propose && <span className="ad-tag dark">offered the map</span>}
                    {m.declined && <span className="ad-tag">they kept talking</span>}
                  </div>
                  <p>
                    <b>Core{changed ? ' (changed)' : ''}:</b> {notes.core}
                  </p>
                  <p>
                    <b>Next, it tries to:</b> {notes.help}
                  </p>
                </div>
              ) : (
                <p className="ad-muted">No notes on this reply (stub, safety script, or an older session).</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function status(s: State, c: Made) {
  const now = s.cards.find((x) => x.id === c.id)
  if (now) return now.text === c.text ? { t: 'on the map', cls: '' } : { t: `edited → “${now.text}”`, cls: 'warn' }
  const into = s.cards.find((x) => x.stack.includes(c.text))
  if (into) return { t: `stacked into “${into.text}”`, cls: '' }
  return { t: 'removed by the person', cls: 'warn' }
}

function Cards({ s, entry, you }: { s: State; entry: Extract<Log, { t: 'cards' }>; you: string[] }) {
  const n = entry.notes ?? lastNotes(s.msgs)
  const count = Object.fromEntries(KINDS.map((k) => [k, entry.made.filter((c) => c.kind === k).length]))
  return (
    <>
      {n && (
        <dl className="ad-dl">
          <dt>Core it centred on</dt>
          <dd>{n.core}</dd>
          <dt>How they’re stuck</dt>
          <dd>{STUCK[n.stuck] ?? n.stuck}</dd>
          <dt>Kinds of cards</dt>
          <dd>
            {KINDS.map((k) => `${count[k]} ${k}`).join(' · ')}
            {entry.fallback && ' · (AI unavailable: the program split sentences)'}
          </dd>
        </dl>
      )}
      <div className="ad-scroll">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Card</th>
              <th>Kind</th>
              <th>From</th>
              <th>Why the AI made it a card</th>
              <th>Now</th>
            </tr>
          </thead>
          <tbody>
            {entry.made.map((c) => {
              const st = status(s, c)
              return (
                <tr key={c.id}>
                  <td>{c.text}</td>
                  <td>
                    <span className="ad-tag" title={KIND[c.kind]}>
                      {c.kind || '—'}
                    </span>
                  </td>
                  <td title={you[c.from - 1] ?? ''}>{c.from ? `#${c.from}` : '—'}</td>
                  <td>{c.why}</td>
                  <td className={st.cls}>{st.t}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {entry.skipped.length > 0 && (
        <>
          <h3>Said, but not made into a card</h3>
          <ul className="ad-list">
            {entry.skipped.map((x, i) => (
              <li key={i}>
                “{x.text}” <span className={x.why.startsWith('program') ? 'ad-tag dark' : 'ad-muted'}>{x.why}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function MapLog({ s, log, name }: { s: State; log: Log[]; name: (id: string) => string }) {
  const labels = log.filter((l): l is Extract<Log, { t: 'label' }> => l.t === 'label')
  const stacks = log.filter((l): l is Extract<Log, { t: 'stack' }> => l.t === 'stack').at(-1)
  const loopNotes = log.filter((l): l is Extract<Log, { t: 'loop' }> => l.t === 'loop')
  const breaks = log.filter((l): l is Extract<Log, { t: 'break' }> => l.t === 'break')
  const arranges = log.filter((l): l is Extract<Log, { t: 'arrange' }> => l.t === 'arrange')
  return (
    <>
      {arranges.map((a, i) => (
        <div key={i} className="ad-loop">
          <p className="ad-path">“Arrange for me” pressed {time(a.at)}</p>
          <dl className="ad-dl">
            {a.groups.map((g, j) => (
              <Fragment key={j}>
                <dt>Group “{g.name}”</dt>
                <dd>{g.ids.map(name).join(' · ')}</dd>
              </Fragment>
            ))}
            {a.lines.map((l) => {
              const e = s.edges.find((x) => x.id === l.id)
              const now = !e ? 'deleted by the person' : e.by === 'ai' ? 'kept as the AI drew it' : `taken over: “${e.label}”`
              return (
                <Fragment key={l.id}>
                  <dt>AI line</dt>
                  <dd>
                    {name(l.from)} → {name(l.to)} “{l.label}” <span className="ad-muted">{now}</span>
                  </dd>
                </Fragment>
              )
            })}
          </dl>
        </div>
      ))}
      <h3>Line labels</h3>
      {labels.length ? (
        <div className="ad-scroll">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Line the person drew</th>
                <th>AI label</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((l) => {
                const e = s.edges.find((x) => x.id === l.edge)
                const now = !e ? 'line removed' : e.label === l.label ? 'kept' : e.label ? `rewritten → “${e.label}”` : 'cleared'
                return (
                  <tr key={l.edge}>
                    <td>
                      {name(l.from)} → {name(l.to)}
                    </td>
                    <td>{l.label ? `“${l.label}”` : <span className="ad-muted">left blank (unclear, or failed the checks)</span>}</td>
                    <td className={now === 'kept' ? '' : 'warn'}>{now}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ad-muted">No lines yet.</p>
      )}

      <h3>Near-duplicates the AI pointed at</h3>
      {stacks?.pairs.length ? (
        <ul className="ad-list">
          {stacks.pairs.map((p, i) => {
            const stacked = s.cards.some((c) => (c.id === p.a && c.stack.includes(name(p.b))) || (c.id === p.b && c.stack.includes(name(p.a))))
            return (
              <li key={i}>
                “{name(p.a)}” ≈ “{name(p.b)}” <span className="ad-muted">{stacked ? 'the person stacked them' : 'not stacked'}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="ad-muted">None.</p>
      )}

      <h3>Loops</h3>
      {loopNotes.length ? (
        loopNotes.map((l, i) => {
          const es = l.edges.map((id) => s.edges.find((e) => e.id === id)).filter(Boolean)
          const dash = s.edges.find((e) => e.id === l.breakEdge)
          return (
            <div key={i} className="ad-loop">
              <p className="ad-path">{es.map((e) => name(e!.from)).join(' → ')} → (back)</p>
              <p>{l.note}</p>
              {dash && (
                <p>
                  <b>Dashed as easiest to loosen:</b> {name(dash.from)} → {name(dash.to)}
                </p>
              )}
            </div>
          )
        })
      ) : (
        <p className="ad-muted">{loops(s.edges).length ? 'Loops are on the map; their notes appear here once the person clicks “loop”.' : 'No loops.'}</p>
      )}

      <h3>Step cards (from clicking a loop line)</h3>
      {breaks.length ? (
        breaks.map((b, i) => {
          const e = s.edges.find((x) => x.id === b.edge)
          return (
            <dl key={i} className="ad-dl">
              <dt>Line</dt>
              <dd>{e ? `${name(e.from)} → ${name(e.to)}` : '(removed)'}</dd>
              <dt>AI asked</dt>
              <dd>
                {b.question} <span className="ad-muted">example shown: “{b.example}”</span>
              </dd>
              <dt>They wrote</dt>
              <dd>
                {b.what} · <b>when</b> {b.when || '—'} · <b>where</b> {b.where || '—'}
              </dd>
            </dl>
          )
        })
      ) : (
        <p className="ad-muted">None yet.</p>
      )}
    </>
  )
}
