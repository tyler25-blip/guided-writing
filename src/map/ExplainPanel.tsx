import { useState } from 'react'
import type { Kind } from './place.ts'
import type { Why } from './walk.ts'

const LABELS: { k: Kind; text: string; tag: string }[] = [
  { k: 'A', text: 'A', tag: 'What happened' },
  { k: 'B', text: 'B', tag: 'Told myself' },
  { k: 'C', text: 'C', tag: 'Felt' },
  { k: 'DE', text: 'DE', tag: 'Another way' },
  { k: 'NEXT', text: 'Next step', tag: 'Next step' },
]

// The demo presenter's explanation: always on screen, follows the current step, never blocks anything.
// `current` is the step on screen (key changes with every reply / map step); when a step has no text, the last one stays.
export function ExplainPanel({ collected, current }: { collected: Set<Kind>; current: { key: string; why: Why } | null }) {
  const [last, setLast] = useState(current)
  if (current && current.key !== last?.key) setLast(current) // adjusting state while rendering: keeps the previous text when a step has none
  const why = current ?? last
  return (
    <aside className="tm-xp" aria-label="Demo explanation">
      <span className="tm-xp-tab">Demo explanation only</span>
      <ol className="tm-xp-labels" aria-label="Collected so far">
        {LABELS.map((l) => (
          <li key={l.k} className={`k-${l.k}${collected.has(l.k) ? ' on' : ''}`} title={l.tag}>
            <b>{l.text}</b>
            {l.k === 'NEXT' ? '' : l.tag}
          </li>
        ))}
      </ol>
      {why ? (
        <div className="tm-xp-body" aria-live="polite">
          <span className="tm-tag">What just happened</span>
          <p>{why.why.what}</p>
          <span className="tm-tag">Mechanism</span>
          <p>{why.why.mech}</p>
          <span className="tm-tag">What the AI did, and didn’t</span>
          <p>{why.why.ai}</p>
        </div>
      ) : (
        <p className="tm-xp-empty">Send a message and this panel will explain what the program just did.</p>
      )}
    </aside>
  )
}
