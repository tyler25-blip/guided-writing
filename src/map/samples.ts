// Three sample sessions for the dev panel. The conversations, cards and lines were made by the app's real AI (src/map/brain.ts)
// talking to a second Sonnet that played the person, from real posts (CC BY-SA 4.0, adapted; sources in samples.json).
// Regenerate: node --env-file=.env scripts-gen-samples.ts src/map/samples.json
import data from './samples.json'
import { lay, makeCards } from './build.ts'
import type { Msg, State } from './MapApp.tsx'

type Sample = { name: string; source: string; msgs: Msg[]; made: { text: string; kind: string; from: number }[]; lines: [number, number][] }
export const SAMPLES = data as unknown as Sample[]

export function sampleState(i: number, to: 'chat' | 'piles' | 'laid', size = { w: innerWidth, h: innerHeight }): State {
  const { msgs, made, lines } = SAMPLES[i]
  if (to === 'chat') return { phase: 'chat', msgs, cards: [], edges: [], ended: false }
  const cards = makeCards(msgs, made)
  const laid = lay(cards, to === 'laid' ? lines.map(([a, b]) => ({ from: cards[a].id, to: cards[b].id })) : null, size)
  return { phase: 'map', msgs, ...laid, ended: false, mode: to === 'laid' ? 'auto' : 'manual', spreadAt: msgs.length }
}
