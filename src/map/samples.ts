// Three more demo stories. The conversations, cards and lines were made by the app's real AI (src/map/brain.ts)
// talking to a second Sonnet that played the person, adapted from real posts (CC BY-SA 4.0; sources in samples.json).
// Regenerate: node --env-file=.env scripts-gen-samples.ts src/map/samples.json
// Each one plays like the Thursday demo: the person's next line is pre-filled, the AI answers from the recording.
import data from './samples.json' with { type: 'json' }
import type { Msg } from './MapApp.tsx'
import type { Kind } from './place.ts'
import type { Step, Story } from './demo.ts'

type Sample = { name: string; source: string; msgs: Msg[]; made: { text: string; kind: Kind; from: number }[]; lines: [number, number][] }

// the step the summary suggests (the recording has none: the person never reached the summary)
const NEXT: Record<string, { when: string; will: string }> = {
  'The error in the thesis': { when: 'I open the thesis file again tonight', will: 'write the first sentence I’ll say on Friday and close it' },
  '“Be more modest”': { when: 'I reread his email', will: 'send “yes, let’s meet more” and book one meeting' },
  'The deleted message': { when: 'I check when she was last online', will: 'send “it was literally a typo” and put the phone down' },
}

function toStory({ name, msgs, made, lines }: Sample): Story {
  const script: Step[] = []
  msgs.forEach((m, i) => {
    if (m.role !== 'you' || m.naming) return
    const ai = msgs[i + 1]
    const after = ai?.options && msgs[i + 2]?.naming ? msgs[i + 3]?.text : undefined
    script.push({ p: m.text, ai: ai?.text ?? '', options: ai?.options, after })
  })
  script[script.length - 1].propose = true // only the last reply offers the map; the recording's earlier offers were declined
  const cards = made.map((c, j) => ({ key: `K${j}`, text: c.text, kind: c.kind, step: c.from - 1 }))
  const nextFrom = (cards.findLast((c) => c.kind === 'A') ?? cards[0]).key
  return { name, script, cards, lines: lines.map(([a, b]) => [`K${a}`, `K${b}`]), next: NEXT[name] ?? { when: 'it comes back tonight', will: 'write one line about it and stop there' }, more: 'Of course. What else is on your mind about it?', nextFrom }
}

export const SAMPLE_STORIES = (data as unknown as Sample[]).map(toStory)
