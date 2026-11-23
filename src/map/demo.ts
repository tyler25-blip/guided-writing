// The scripted demo story (open /map?demo): every AI step is answered from this script, so the prototype can be shown without a key.
// One story: a group project partner who said no (adapted from the University of Toledo Counseling Center's cross-sectional formulation example).
// Two circles from the same moment (Mia said no): one in the world (what happened → thought → feeling → what they did), one only in the head (two thoughts and a feeling, nothing happens). Ten turns.
// The person's lines contain fillers on purpose, so the delete-only trimming is visible.
import type { Msg, State } from './MapApp.tsx'
import { arrange, lay, makeCards } from './build.ts'
import type { Kind } from './place.ts'
import { walkPlan, type Why } from './walk.ts'

export type Step = { p: string; ai: string; options?: string[]; after?: string; propose?: boolean; why?: Why; afterWhy?: Why }
// p = the person's line (pre-filled in the box), ai = the scripted reply; after = what the AI says once the person has named the feeling
export const SCRIPT: Step[] = [
  {
    p: 'Honestly, I just feel really small today.',
    ai: 'That sounds like a hard day. If you put a word to the feeling, which is closer?',
    options: ['rejected', 'ashamed'],
    why: { what: 'They opened with a feeling, not with what happened.', mech: 'C · name the feeling. Real conversations rarely start at A.', ai: 'Offered two different words to choose from. Did not ask why, did not comfort.' },
    after: '{names}. Thank you for putting a word to it. Something must have brought it on today. What happened?',
    afterWhy: { what: 'They wrote their own word instead of picking one.', mech: 'C collected, in their word. Now looking for A: the concrete event.', ai: 'Asked what happened. Did not guess the cause.', got: ['C'] },
  },
  {
    p: 'I asked Mia to be my partner for the group project, and she said no.',
    ai: 'So you asked Mia to be your partner for the group project, and she said no. When she said no, what went through your mind?',
    why: { what: 'A concrete event: they asked Mia, she said no.', mech: 'A collected. Now looking for B: what they told themselves.', ai: 'Said it back in their words, then asked what went through their mind.', got: ['A'] },
  },
  {
    p: 'Like, I knew I shouldn’t have asked her. She’s way smarter than me and she knows it.',
    ai: 'So the thought was that she’s way smarter than you, and she knows it. When that thought is there, what do you do?',
    why: { what: 'The thought under the feeling.', mech: 'B collected: the event did not say “she’s smarter than me”, the thought did.', ai: 'Did not argue with the thought. Asked what it makes them do.', got: ['B'] },
  },
  {
    p: 'I just left class early. And I haven’t asked anyone else since.',
    ai: 'So you left early, and you haven’t asked anyone else since. And at night, when you think back to it, where does your mind go?',
    why: { what: 'What they did: left early, asked no one else.', mech: 'What they did feeds the first circle: no new ask, so nothing contradicts the thought.', ai: 'Said it back, then asked where the mind goes at night. That is the way into the second circle.' },
  },
  {
    p: 'I keep replaying it and thinking, I’m so stupid. She only makes friends with smart people.',
    ai: 'So two thoughts keep coming back: that you’re stupid, and that she only makes friends with smart people. When they go round like that, where do they take you?',
    why: { what: 'Two thoughts that go round at night, with no event on them.', mech: 'A circle only in the head: thoughts feeding a feeling, nothing happens in the world.', ai: 'Said both thoughts back, then asked where they take them.' },
  },
  {
    p: 'Like I’m not smart enough, I’m not worth anyone choosing me. I just feel worthless.',
    ai: 'That sounds really heavy. Is there anything about that day that doesn’t quite fit the thought that she only makes friends with smart people?',
    why: { what: 'One more thought, and the feeling it leaves.', mech: 'The circle in the head: “I’m so stupid” → “not worth anyone choosing me” → worthless → “she only makes friends with smart people” → back to “I’m so stupid”. With no event on it, the way out is to question a thought: D.', ai: 'Named it as heavy, then asked for anything that does not fit the thought. Asks for evidence, never supplies it.' },
  },
  {
    p: 'Well, she did say sorry, and that she’d ask around who still needs someone.',
    ai: 'That doesn’t fit the thought, and it came from you. And the thought that you’re not worth anyone choosing you: is there anything that doesn’t fit that one?',
    why: { what: 'Evidence, from them: she said sorry and offered to ask around.', mech: 'DE · D, questioning the thought.', ai: 'Pointed out it came from them. Went on to the first circle’s thought.', got: ['DE'] },
  },
  {
    p: 'She’d already promised Tom. And Jonas asked me to study together last term.',
    ai: 'Two things, and both are yours. If a friend told you this story, what would you want them to tell themselves?',
    why: { what: 'More evidence, from them: she had promised Tom; Jonas asked them last term.', mech: 'DE · D again, on the first circle’s thought.', ai: 'Pointed out both came from them. Invited a new way to say it: “what would you tell a friend?”' },
  },
  {
    p: 'Probably that one no is about her plans, not about me.',
    ai: 'That’s a kinder way to hold it, and it’s yours. Is there one small thing you could do this week?',
    why: { what: 'A new sentence, in their words.', mech: 'DE · E, the new belief. Not positive thinking: more accurate.', ai: 'Moved on to one small step for this week.' },
  },
  {
    p: 'Ask Jonas after Thursday’s lecture if he has a group.',
    ai: 'That’s a clear, small step. I think we have enough to lay this out.',
    propose: true,
    why: { what: 'A concrete step: ask Jonas after Thursday’s lecture.', mech: 'Next step collected. All five labels are in.', ai: 'Offers to lay it out as a map. They can say “talk a bit more”.', got: ['NEXT'] },
  },
]
export const MORE = 'Of course. What else is on your mind about the group project?'
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
  { key: 'C1', text: 'I just feel really small today', kind: 'C', step: 0 },
  { key: 'A1', text: 'I asked Mia to be my partner for the group project, and she said no', kind: 'A', step: 1 },
  { key: 'B1', text: 'She’s way smarter than me and she knows it', kind: 'B', step: 2 },
  { key: 'A2', text: 'I haven’t asked anyone else since', kind: 'A', step: 3 },
  { key: 'B2', text: 'I’m so stupid', kind: 'B', step: 4 },
  { key: 'B3', text: 'She only makes friends with smart people', kind: 'B', step: 4 },
  { key: 'B4', text: 'I’m not worth anyone choosing me', kind: 'B', step: 5 },
  { key: 'C2', text: 'I just feel worthless', kind: 'C', step: 5 },
  { key: 'DH1', text: 'she did say sorry, and that she’d ask around who still needs someone', kind: 'DE', step: 6 },
  { key: 'DE1', text: 'She’d already promised Tom', kind: 'DE', step: 7 },
  { key: 'DE2', text: 'Jonas asked me to study together last term', kind: 'DE', step: 7 },
  { key: 'DE3', text: 'one no is about her plans, not about me', kind: 'DE', step: 8 },
  { key: 'NX', text: 'Ask Jonas after Thursday’s lecture if he has a group', kind: 'NEXT', step: 9 },
]
// circle in the world (walked last): she said no → small → I haven’t asked anyone → I’m not worth anyone choosing me → (and that leaves me feeling small again) → small
// circle only in the head (walked first): comes from the same moment, by its own line (A1 → B2; A1 is on no cycle, so the two stay separate loops): I’m so stupid → she only makes friends with smart people → worthless → she’s way smarter than me → back to I’m so stupid
const LINES = [['A1', 'C1'], ['B4', 'C1'], ['C1', 'A2'], ['A2', 'B4'], ['A1', 'B2'], ['B2', 'B3'], ['B3', 'C2'], ['C2', 'B1'], ['B1', 'B2'], ['B4', 'DE1'], ['B4', 'DE2'], ['B4', 'DE3'], ['B3', 'DH1'], ['A2', 'NX']]
export const NEXT = { when: 'I think about the group project', will: 'ask Jonas after the lecture' }
// closing the circle, "somewhere new": what the presenter can add between "I haven't asked anyone else" and "she's smarter than me" (pre-filled in the box)
export const NEW: { text: string; kind: Kind } = { text: 'nobody wants to work with me', kind: 'B' }
// a card the presenter can add beside the one being placed (pre-filled once): the second thought in the same message
export const SIDE: Record<string, string> = { B1: 'I knew I shouldn’t have asked her' }
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
  // after the walk: every line kept, the person chose to see the thought another way in both circles
  const cut = [0, 1].map((l) => walkPlan(st.cards, st.edges, l).options.find((o) => o.kind === 'DE')?.edge)
  return arrange({ ...st, pick: 'DE', edges: st.edges.map((e) => ({ ...e, by: undefined, cut: cut.includes(e.id) || undefined, pick: cut.includes(e.id) ? ('DE' as const) : undefined })), ended: true }) // the circles are closed: their cards lie on rings
}
