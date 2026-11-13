// The scripted demo story (open /map?demo): every AI step is answered from this script, so the prototype can be shown without a key.
// One story: a dinner they weren't invited to. Eight turns; the five labels come up along the way, not in order.
// The person's lines contain fillers on purpose, so the delete-only trimming is visible.
import type { Msg, State } from './MapApp.tsx'
import { arrange, lay, makeCards } from './build.ts'
import type { Kind } from './place.ts'
import { walkPlan, type Why } from './walk.ts'

export type Step = { p: string; ai: string; options?: string[]; after?: string; propose?: boolean; why?: Why; afterWhy?: Why }
// p = the person's line (pre-filled in the box), ai = the scripted reply; after = what the AI says once the person has named the feeling
export const SCRIPT: Step[] = [
  {
    p: 'Honestly, I just feel kind of pathetic tonight.',
    ai: 'That sounds like a heavy evening. If you put a word to the feeling, which is closer?',
    options: ['left out', 'hurt'],
    why: { what: 'They opened with a feeling, not with what happened.', mech: 'C · name the feeling. Real conversations rarely start at A.', ai: 'Offered two different words to choose from. Did not ask why, did not comfort.' },
    after: '{names}. Thank you for putting a word to it. Something must have brought it on tonight. What happened?',
    afterWhy: { what: 'They wrote their own word instead of picking one.', mech: 'C collected, in their word. Now looking for A: the concrete event.', ai: 'Asked what happened. Did not guess the cause.', got: ['C'] },
  },
  {
    p: 'I was scrolling through stories and saw my friends all had dinner together on Saturday, and nobody asked me.',
    ai: 'So on Saturday your friends had dinner together, and you found out from their stories that nobody asked you. When you saw that, what went through your mind?',
    why: { what: 'A concrete event: the dinner on Saturday, nobody asked them.', mech: 'A collected. Now looking for B: what they told themselves.', ai: 'Said it back in their words, then asked what went through their mind.', got: ['A'] },
  },
  {
    p: 'Like, they don’t actually like me that much. I’m just the extra one.',
    ai: 'So the thought was that they don’t actually like you that much, that you’re the extra one. When that thought is there, what do you feel like doing?',
    why: { what: 'The thought under the feeling.', mech: 'B collected: the event did not say “they don’t like me”, the thought did.', ai: 'Did not argue with the thought. Asked what it makes them want to do.', got: ['B'] },
  },
  {
    p: 'Should I just ask them why they didn’t invite me?',
    ai: 'That’s yours to decide, and it might help. Before that: if you did ask, what are you most afraid you’d hear?',
    why: { what: 'They asked for advice.', mech: 'Off the path. The AI does not give advice.', ai: 'Turned the question back to them, which brings out more of B.' },
  },
  {
    p: 'That they’d rather hang out without me. So I just haven’t texted anyone all week.',
    ai: 'So the fear is that they’d rather hang out without you, and since Saturday you haven’t texted anyone. Is there anything about Saturday that doesn’t quite fit the thought that they don’t like you?',
    why: { what: 'The fear, and what they did: no texts all week.', mech: 'What they did feeds the circle. Now inviting D: questioning the thought.', ai: 'Asked for anything that does not fit the thought. It asks for evidence, never supplies it.' },
  },
  {
    p: 'Well, Amy planned it last minute, and I’d told everyone I was busy that week. And last month I was the one who set up dinner.',
    ai: 'That doesn’t fit the thought, and it came from you. If a friend saw those photos and thought the same, what would you want them to tell themselves?',
    why: { what: 'Evidence, from them: Amy planned it last minute; they set up dinner last month.', mech: 'DE · D, questioning the thought.', ai: 'Pointed out it came from them. Invited a new way to say it: “what would you tell a friend?”', got: ['DE'] },
  },
  {
    p: 'Probably that one dinner doesn’t mean they don’t want you around.',
    ai: 'That’s a kinder way to hold it, and it’s yours. Is there one small thing you could do this week?',
    why: { what: 'A new sentence, in their words.', mech: 'DE · E, the new belief. Not positive thinking: more accurate.', ai: 'Moved on to one small step for this week.' },
  },
  {
    p: 'Text Mia and ask if she wants to get food on Thursday.',
    ai: 'That’s a clear, small step. I think we have enough to lay this out.',
    propose: true,
    why: { what: 'A concrete step: text Mia about Thursday.', mech: 'Next step collected. All five labels are in.', ai: 'Offers to lay it out as a map. They can say “talk a bit more”.', got: ['NEXT'] },
  },
]
export const MORE = 'Of course. What else is on your mind about Saturday?'
export const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
// the AI's reply after the person put a word to the feeling (the options step it answers is found by its text)
export const afterNaming = (lastAi: string, names: string[]) => {
  const i = SCRIPT.findIndex((s) => s.ai === lastAi)
  const joined = names.join(' and ')
  return i < 0 || !SCRIPT[i].after ? null : { text: SCRIPT[i].after!.replace('{names}', joined.charAt(0).toUpperCase() + joined.slice(1)), why: whyNamed(SCRIPT[i], names), next: i + 1 }
}

// the popup after naming says whether they picked one of the two words or wrote their own
const whyNamed = (st: Step, names: string[]): Why | undefined =>
  st.afterWhy && (names.every((n) => st.options?.includes(n)) ? { ...st.afterWhy, what: `They picked “${names.join('” and “')}” from the two words offered.`, mech: st.afterWhy.mech.replace(', in their word', '') } : st.afterWhy)

export type StoryCard = { key: string; text: string; kind: Kind; step: number }
// the scripted "AI cut": delete-only trims of the lines above (checked by trimmed() in demo.check.ts)
export const CARDS: StoryCard[] = [
  { key: 'C1', text: 'I just feel kind of pathetic tonight', kind: 'C', step: 0 },
  { key: 'A1', text: 'my friends all had dinner together on Saturday, and nobody asked me', kind: 'A', step: 1 },
  { key: 'B1', text: 'they don’t actually like me that much', kind: 'B', step: 2 },
  { key: 'A2', text: 'I just haven’t texted anyone all week', kind: 'A', step: 4 },
  { key: 'DE1', text: 'Amy planned it last minute, and I’d told everyone I was busy that week', kind: 'DE', step: 5 },
  { key: 'DE2', text: 'last month I was the one who set up dinner', kind: 'DE', step: 5 },
  { key: 'DE3', text: 'one dinner doesn’t mean they don’t want you around', kind: 'DE', step: 6 },
  { key: 'NX', text: 'Text Mia and ask if she wants to get food on Thursday', kind: 'NEXT', step: 7 },
]
// the circle: they don't like me → embarrassed → no texts → (no contact makes it feel truer) → they don't like me
const LINES = [['A1', 'B1'], ['B1', 'C1'], ['C1', 'A2'], ['A2', 'B1'], ['B1', 'DE1'], ['B1', 'DE2'], ['B1', 'DE3'], ['A2', 'NX']]
export const NEXT = { when: 'I open their stories again', will: 'text Mia instead' }
// closing the circle, "somewhere new": what the presenter can add between "no texts all week" and "they don't like me" (pre-filled in the box)
export const NEW: { text: string; kind: Kind } = { text: 'if they care about me then they will text me', kind: 'B' }
// a card the presenter can add beside the one being placed (pre-filled once): the second thought in the same message
export const SIDE: Record<string, string> = { B1: 'I’m just the extra one' }
export const demoSide = (of: string, cards: { text: string }[]) => {
  const t = SIDE[CARDS.find((c) => c.text === of)?.key ?? ''] ?? ''
  return cards.some((c) => norm(c.text) === norm(t)) ? '' : t
}
export const demoNewKind = (text: string): Kind | undefined => (norm(text) === norm(NEW.text) ? NEW.kind : undefined)

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
  return LINES.flatMap(([a, b]) => (id(a) && id(b) ? [{ from: id(a)!, to: id(b)! }] : []))
}
// no two cards in this story say the same thought
export const demoPair = (_cards: { id: string; text: string }[]): { a: string; b: string }[] => []
export const demoBreak = (from: string, to: string) => ({ question: `Between “${from}” and “${to}”, what is one small thing you could do at that moment?`, when_example: NEXT.when, will_example: NEXT.will })

// the whole chat as the presenter would play it (the feeling named in their own word)
export function demoMsgs(): Msg[] {
  return SCRIPT.flatMap((s): Msg[] => {
    const out: Msg[] = [{ role: 'you', text: s.p }, { role: 'ai', text: s.ai, options: s.options, propose: s.propose, why: s.why }]
    const an = s.after ? afterNaming(s.ai, ['embarrassed'])! : null
    return an ? [...out, { role: 'you', text: 'embarrassed', naming: true }, { role: 'ai', text: an.text, why: an.why }] : out
  })
}
// states for the demo menu's jump buttons: the chat from the start, the map at the start of the guided walk, the map after it (summary open)
export function demoState(to: 'chat' | 'laid' | 'summary', size = { w: innerWidth, h: innerHeight }): State {
  const base: State = { phase: 'chat', msgs: [], cards: [], edges: [], ended: false, demo: true, demoStep: 0 }
  if (to === 'chat') return base
  const msgs = demoMsgs()
  const cards = makeCards(msgs, demoMade(msgs))
  const st: State = { ...base, phase: 'map', msgs, ...lay(cards, demoLines(cards), size), mode: 'auto', demoStep: SCRIPT.length, spreadAt: msgs.length }
  if (to === 'laid') return { ...st, walk: { step: 0 } }
  // after the walk: every line kept, the person chose to see the thought another way
  const cut = walkPlan(st.cards, st.edges).options.find((o) => o.kind === 'DE')?.edge
  return arrange({ ...st, edges: st.edges.map((e) => ({ ...e, by: undefined, cut: e.id === cut || undefined })), ended: true }) // the circle is closed: its cards lie on the ring
}
