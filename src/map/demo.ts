// The scripted demo story (open /map?demo): every AI step of the design is answered from this script, so the prototype can be shown without a key.
// The story is ours. The person's lines contain fillers on purpose, so the delete-only trimming is visible.
import type { Card, Msg, State } from './MapApp.tsx'
import { lay, makeCards } from './build.ts'
import { freeSpot, type Kind } from './place.ts'
import { SAMPLE_STORIES } from './samples.ts'

export type Step = { p: string; ai: string; options?: string[]; after?: string; skipIfNamed?: boolean; propose?: boolean }
// P = the person's line (pre-filled in the box), ai = the scripted reply; after = what the AI says once the person has named the feeling
const THURSDAY_SCRIPT: Step[] = [
  { p: 'Um, so I have a presentation on Thursday, and I just, like, can’t stop thinking about it.', ai: 'There’s what’s coming up: the presentation on Thursday. And it sounds like it keeps coming back to you, even when you’re not working on it. When it comes back, what goes through your mind?' },
  { p: 'I keep thinking I’m going to totally mess it up, you know, in front of everyone.', ai: 'So alongside the presentation itself, there’s a thought that keeps repeating: that you’ll totally mess it up, in front of everyone. How does that leave you feeling?' },
  { p: 'I feel like I’m just not good enough for this job.', ai: '“Not good enough” sounds heavy. Is that more something you find yourself telling yourself, or more a feeling that’s sitting in you right now?' },
  {
    p: 'I guess it’s more what I tell myself. What I feel is my chest getting really tight.',
    ai: 'So “not good enough” is something you tell yourself, and underneath it there’s that tightness in your chest. If you put a word to the feeling, which is closer?',
    options: ['dread', 'overwhelmed'],
    after: '{names}. Thank you for putting a word to it. What happens after that tightness shows up?',
  },
  { p: 'Then I lie awake half the night, and I’ll be too tired to present well.', ai: 'So the tightness turns into lying awake half the night, and then a new thought joins in: that you’ll be too tired to present well. How does that one sit with you?' },
  {
    p: 'Honestly I’m kind of scared. I’m going to screw this up.',
    ai: 'There’s fear in that, and the same thought again, that you’re going to screw this up. If you put a word to this feeling, which is closer?',
    options: ['afraid', 'ashamed'],
    after: '{names}. Looking at that thought again, that you’ll mess it up: is there anything about Thursday that doesn’t quite fit it?',
  },
  { p: 'I don’t know what to call it.', ai: 'That’s okay, it doesn’t need a name tonight. Looking at that thought again, that you’ll mess it up: is there anything about Thursday that doesn’t quite fit it?', skipIfNamed: true },
  { p: 'Well, maybe last time I prepared properly, it actually went okay.', ai: 'That’s something that doesn’t fit the thought, and it came from you. When you say “totally mess it up”, what would that actually look like?' },
  { p: 'Probably I’d stumble on a slide or two, but that’s not the whole thing falling apart.', ai: 'So a stumble or two, not the whole thing falling apart. If a friend had this thought the night before their talk, what would you want them to tell themselves?' },
  { p: 'That I can be nervous and still get through it.', ai: 'That’s a kinder way to hold it, and it’s yours. I think we have enough to lay this out.', propose: true },
]
export const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
// the AI's reply after the person put a word to the feeling (the options step it answers is found by its text)
export const afterNaming = (lastAi: string, names: string[]) => {
  const i = SCRIPT.findIndex((s) => s.ai === lastAi)
  const joined = names.join(' and ')
  return i < 0 || !SCRIPT[i].after ? null : { text: SCRIPT[i].after!.replace('{names}', joined.charAt(0).toUpperCase() + joined.slice(1)), next: SCRIPT[i + 1]?.skipIfNamed ? i + 2 : i + 1 }
}

// the scripted "AI cut": delete-only trims of the lines above (checked by trimmed() in demo.check.ts)
const THURSDAY_CARDS: StoryCard[] = [
  { key: 'A1', text: 'I have a presentation on Thursday', kind: 'A', step: 0 },
  { key: 'B1', text: 'I keep thinking I’m going to totally mess it up in front of everyone', kind: 'B', step: 1 },
  { key: 'B2', text: 'I’m just not good enough for this job', kind: 'B', step: 2 },
  { key: 'C1', text: 'my chest getting really tight', kind: 'C', step: 3 },
  { key: 'A2', text: 'I lie awake half the night', kind: 'A', step: 4 },
  { key: 'B3', text: 'I’ll be too tired to present well', kind: 'B', step: 4 },
  { key: 'C2', text: 'I’m kind of scared', kind: 'C', step: 5 },
  { key: 'B4', text: 'I’m going to screw this up', kind: 'B', step: 5 },
  { key: 'DE1', text: 'maybe last time I prepared properly, it actually went okay', kind: 'DE', step: 7 },
  { key: 'DE2', text: 'Probably I’d stumble on a slide or two, but that’s not the whole thing falling apart', kind: 'DE', step: 8 },
  { key: 'DE3', text: 'I can be nervous and still get through it', kind: 'DE', step: 9 },
]
const THURSDAY_LINES = [['A1', 'B1'], ['A1', 'B2'], ['B1', 'C1'], ['B2', 'C1'], ['C1', 'A2'], ['A2', 'B3'], ['B3', 'C2'], ['B4', 'C2'], ['C2', 'A2'], ['B1', 'DE1'], ['B1', 'DE2'], ['B2', 'DE3']]

export type StoryCard = { key: string; text: string; kind: Kind; step: number }
// one scripted story: the person's lines and the AI's replies, the AI's cut into cards, its lines, and a next step for the summary
export type Story = { name: string; script: Step[]; cards: StoryCard[]; lines: string[][]; next: { when: string; will: string }; more: string; pair?: [string, string]; nextFrom: string }
const THURSDAY: Story = {
  name: 'Thursday presentation (our story)',
  script: THURSDAY_SCRIPT,
  cards: THURSDAY_CARDS,
  lines: THURSDAY_LINES,
  next: { when: 'it’s 11 pm and I’m still replaying Thursday', will: 'write the one step left on a card and close the laptop' },
  more: 'Of course. What else is on your mind about Thursday?',
  pair: ['B1', 'B4'],
  nextFrom: 'A2',
}
export const STORIES: Story[] = [THURSDAY, ...SAMPLE_STORIES]
// ponytail: the running story is swapped in as live module bindings (one story at a time); pass a story around if two ever need to coexist
let story = THURSDAY
export let SCRIPT = THURSDAY.script
export let CARDS = THURSDAY.cards
export let NEXT = THURSDAY.next
export let MORE = THURSDAY.more
export function setStory(i = 0) {
  story = STORIES[i] ?? THURSDAY
  ;({ script: SCRIPT, cards: CARDS, next: NEXT, more: MORE } = story)
}

// cards for the messages the person actually sent (from = their message number); fewer than 3 → the caller uses the program stubs
export function demoMade(msgs: Msg[]) {
  const mine = msgs.filter((m) => m.role === 'you' && !m.naming)
  return CARDS.flatMap((c) => {
    const i = mine.findIndex((m) => norm(m.text) === norm(SCRIPT[c.step].p))
    return i < 0 ? [] : [{ text: c.text, kind: c.kind as string, from: i + 1, why: 'demo script: the scripted cut of this line' }]
  })
}
const keyOf = (text: string) => CARDS.find((c) => c.text === text)?.key
// the scripted lines between the cards that exist
export function demoLines(cards: { id: string; text: string }[]) {
  const id = (k: string) => cards.find((c) => keyOf(c.text) === k)?.id
  return story.lines.flatMap(([a, b]) => (id(a) && id(b) ? [{ from: id(a)!, to: id(b)! }] : []))
}
// B1 and B4 say the same thought
export function demoPair(cards: { id: string; text: string }[]) {
  if (!story.pair) return []
  const [a, b] = story.pair.map((k) => cards.find((c) => keyOf(c.text) === k)?.id)
  return a && b ? [{ a, b }] : []
}
export const demoBreak = (from: string, to: string) => ({ question: `Between “${from}” and “${to}”, what is one small thing you could do at that moment?`, when_example: NEXT.when, will_example: NEXT.will })

// states for the dev panel's jump buttons
export function demoState(to: 'chat' | 'piles' | 'laid' | 'summary', size = { w: innerWidth, h: innerHeight }, i = 0): State {
  setStory(i)
  const base: State = { phase: 'chat', msgs: [], cards: [], edges: [], ended: false, demo: true, demoStep: 0, story: i }
  if (to === 'chat') return base
  const msgs: Msg[] = []
  SCRIPT.forEach((s) => {
    if (s.skipIfNamed) return // the jump names every feeling, so the "I don’t know what to call it" branch is skipped
    msgs.push({ role: 'you', text: s.p }, { role: 'ai', text: s.ai, options: s.options, propose: s.propose })
    if (s.options && s.after) {
      const an = afterNaming(s.ai, [s.options[0]])!
      msgs.push({ role: 'you', text: s.options[0], naming: true }, { role: 'ai', text: an.text })
    }
  })
  const cards = makeCards(msgs, demoMade(msgs))
  const auto = to !== 'piles'
  const laid = lay(cards, auto ? demoLines(cards) : null, size)
  const st: State = { ...base, phase: 'map', msgs, ...laid, mode: auto ? 'auto' : 'manual', demoStep: SCRIPT.length, spreadAt: msgs.length }
  if (to !== 'summary') return st
  if (st.cards.some((c) => c.kind === 'NEXT')) return { ...st, ended: true } // the person already named their step in the chat
  const a2 = st.cards.find((c) => keyOf(c.text) === story.nextFrom) ?? st.cards[0]
  const at = freeSpot(st.cards.map((c) => ({ x: c.x, y: c.y, h: 120 })), a2.x, a2.y)
  const next: Card = { id: 'next1', text: `When ${NEXT.when}, I will ${NEXT.will}.`, src: 'you', kind: 'NEXT', step: NEXT, x: at.x, y: at.y, stack: [], t: Date.now() }
  return { ...st, cards: [...st.cards, next], edges: [...st.edges, { id: 'next1e', from: a2.id, to: next.id }], ended: true }
}
