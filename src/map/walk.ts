// The guided map (v3): the cards appear one at a time along the loop, the person confirms each line, sees the circle close,
// and picks where to break it. Plain code: the order, the questions and the options all come from the cards and lines.
import { loops } from './graph.ts'
import type { Kind } from './place.ts'

// what the presenter's popup says: what just happened, which mechanism it is, what the AI did and did not do; got = the labels collected by now
export type Why = { what: string; mech: string; ai: string; got?: Kind[] }

type C = { id: string; text: string; kind?: Kind; names?: string[] }
type E = { id: string; from: string; to: string }
export type Option = { edge: string; kind: 'DE' | 'NEXT'; label: string }
// path: the cards in the order they appear; links[i]: the line into path[i] (links[0] unused); close: the line that closes the circle
export type Plan = { path: string[]; links: string[]; close?: string; options: Option[] }

export function walkPlan(cards: C[], edges: E[]): Plan {
  const by = new Map(cards.map((c) => [c.id, c]))
  const kind = (id: string) => by.get(id)?.kind
  const cyc = loops(edges)[0]
  if (!cyc) {
    // no circle: follow the lines from the first A (A → B → C …) as far as they go
    const start = cards.find((c) => c.kind === 'A') ?? cards[0]
    if (!start) return { path: [], links: [], options: [] }
    const path = [start.id]
    const links = ['']
    const chain = (x: E) => ['A', 'B', 'C'].includes(kind(x.to) ?? '') // the walk only follows the circle's kinds, never into DE / Next step
    for (let e = edges.find((x) => x.from === start.id && chain(x)); e && !path.includes(e.to); e = edges.find((x) => x.from === path.at(-1) && chain(x))) path.push(e.to), links.push(e.id)
    return { path, links, options: [] }
  }
  const ring = edges.filter((e) => cyc.includes(e.id))
  const onRing = new Set(ring.map((e) => e.from))
  // the way in: a line from outside the circle, from what happened if there is one
  const ins = edges.filter((e) => onRing.has(e.to) && !onRing.has(e.from))
  const entry = ins.find((e) => kind(e.from) === 'A') ?? ins[0]
  const first = entry?.to ?? ring.find((e) => kind(e.from) === 'A')?.from ?? ring[0].from
  // the way in can be longer than one card (when the person closed the circle further along than the first thought): walk it back
  const lead: string[] = entry ? [entry.from] : []
  const leadLinks: string[] = entry ? [entry.id] : []
  for (let e = entry && edges.find((x) => x.to === lead[0] && !onRing.has(x.from) && ['A', 'B', 'C'].includes(kind(x.from) ?? '')); e && !lead.includes(e.from); e = edges.find((x) => x.to === lead[0] && !onRing.has(x.from) && !lead.includes(x.from) && ['A', 'B', 'C'].includes(kind(x.from) ?? ''))) {
    lead.unshift(e.from)
    leadLinks.unshift(e.id)
  }
  const path = [...lead, first]
  const links = ['', ...leadLinks]
  let close: string | undefined
  for (let at = first; ; ) {
    const e = ring.find((x) => x.from === at)!
    if (e.to === first || path.includes(e.to)) {
      close = e.id
      break
    }
    path.push(e.to)
    links.push(e.id)
    at = e.to
  }
  // where the circle could stop: a line into a thought → see it another way; a line at something they did → a next step
  const options: Option[] = []
  const used = new Set<string>()
  for (const e of [...links.slice(lead.length + 1), close!].map((id) => ring.find((x) => x.id === id)!)) {
    const [a, b] = [by.get(e.from)!, by.get(e.to)!]
    if (b.kind === 'B' && !used.has(b.id)) options.push({ edge: e.id, kind: 'DE', label: `See “${b.text}” another way` }), used.add(b.id)
    const act = b.kind === 'A' ? b : a.kind === 'A' ? a : null
    if (act && !used.has(act.id)) options.push({ edge: e.id, kind: 'NEXT', label: `Do something other than “${act.text}”` }), used.add(act.id)
  }
  return { path, links, close, options: options.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'DE' ? -1 : 1)) }
}

// the stages after the cards: the person closes the circle (the hint ladder below), picks where to start, sees the card go in,
// confirms the other kind (the step after another way, or another way after the step), then it is done
export const stages = (p: Plan) => ({ close: p.path.length, pick: p.path.length + 1, placed: p.path.length + 2, rest: p.path.length + 3, done: p.path.length + 4, last: p.close ? p.path.length + 2 : p.path.length })

// the question on the card that has just appeared: said straight, in their own words
export function ask(card: C, i: number): string {
  const q = `“${card.text}”`
  if (i === 0) return `It started with this: ${q}, right?`
  if (card.kind === 'B') return `So you told yourself ${q}, right?`
  if (card.kind === 'C') return `And that left you feeling ${card.names?.join(' and ') || q}, right?`
  if (card.kind === 'A') return `And then ${q}, right?`
  return `And then ${q}, right?`
}
// Closing the circle is the person's move. The program has a guess (the closing line the AI drew), but it stays hidden
// and the help comes in steps, least first:
//   0  an open question on the last card: they tap the card it leads to, or write somewhere new
//   1  two or three cards light up: "could it lead back to one of these?"
//   2  the guess is shown as a dashed line and offered, not stated
export type Hint = 0 | 1 | 2
export const askWhere = (tail: C) => `After “${tail.text}”, where does it take you?`
export const askNarrow = 'Could it lead back to one of these?'
export const askClose = (from: C, to: C) => `For some people, “${from.text}” makes “${to.text}” feel even truer. Is it like that for you?`
// what the box says once the circle is closed (no question: they just made the line themselves)
export const sayCircle = (first: C, back: C) => `It started with “${first.text}”, went round, and came back to ${first.id === back.id ? 'where it started' : `“${back.text}”`}.`
// level 1: the guess and where it all started (and the card after that, if those are the same one); never the card they are on
export function candidates(p: Plan, edges: E[]): string[] {
  const guess = edges.find((e) => e.id === p.close)
  if (!guess) return []
  return [...new Set([guess.to, p.path[0], p.path[1]])].filter((id) => id && id !== guess.from).slice(0, 2)
}
type L = E & { by?: 'ai' }
// they tapped another card than the guess: their line replaces it
export const rewire = <T extends L>(edges: T[], p: Plan, to: string, id: string): L[] => {
  const guess = edges.find((e) => e.id === p.close)!
  return [...edges.filter((e) => e.id !== p.close), { id, from: guess.from, to }]
}
// they wrote somewhere new: the new card goes in after the last one (their line, solid), and the guess now starts from it
export const insertNew = <T extends L>(edges: T[], p: Plan, card: string, ids: [string, string]): L[] => {
  const guess = edges.find((e) => e.id === p.close)!
  return [...edges.filter((e) => e.id !== p.close), { id: ids[0], from: guess.from, to: card }, { id: ids[1], from: card, to: guess.to, by: 'ai' }]
}

// the presenter's popup for each stage of the guided map
export function walkWhy(p: Plan, step: number, cards: C[], hint: Hint = 0): Why | null {
  const st = stages(p)
  const card = cards.find((c) => c.id === p.path[step])
  const asks = 'Asks, does not decide. “Not quite” hands the map back to them.'
  if (step === 0) return { what: 'The map starts with what happened, in their words.', mech: 'Every card is cut from what they said. The AI adds nothing.', ai: 'Places the cards one at a time. The person only confirms.' }
  if (step < p.path.length && card?.kind === 'B') return { what: 'Confirming the line: what happened → what they told themselves.', mech: 'Separating A from B: the event and the thought about it are not the same thing.', ai: asks }
  if (step < p.path.length && card?.kind === 'C') return { what: 'Confirming the line: the thought → the feeling.', mech: 'B → C: the feeling follows the thought, not the event itself.', ai: asks }
  if (step < p.path.length) return { what: 'Confirming the line: the feeling → what they did.', mech: 'C → what they did. This is what keeps the circle turning.', ai: asks }
  if (!p.close) return null
  if (step === st.close)
    return [
      { what: 'The last card has an open line. Where it leads is theirs to say.', mech: 'Guided discovery, least help first. The program has a guess but keeps it hidden.', ai: 'Asks an open question. They tap a card, or write somewhere new.' },
      { what: 'They were not sure, so the question gets narrower.', mech: 'Hint ladder, level 1: two cards light up. The answer is still theirs.', ai: 'Points at where to look. Does not say which one.' },
      { what: 'Still not sure, so the guess is put on the map as a dashed line.', mech: 'Hint ladder, level 2: the guess is offered as something that happens to some people.', ai: 'Offers, does not state. “Not quite” removes the line.' },
    ][hint]
  if (step === st.pick) return { what: 'The circle is closed. Where to break it is their choice.', mech: 'Cut at a thought → see it another way (DE). Cut at something they did → do something different (Next step).', ai: 'The options come only from what they said. No new advice.' }
  if (step === st.rest) return { what: 'The other half of the way out, from the chat.', mech: 'Another way to see it (DE) and one small step (Next step) together: a new thought, and something to do with it.', ai: 'Uses only what they already said. They confirm it, like every other card.' }
  if (step >= st.done) return { what: 'The map is complete: all five labels, in their words.', mech: 'The circle, where it breaks, and what they will do. The summary puts it into one paragraph.', ai: 'Nothing new. The summary is built by the program from their own cards.' }
  return { what: 'The chosen line fades and their own card goes in.', mech: 'The circle stays visible, but broken: “I know this circle, and how to step out of it.”', ai: 'Nothing new: the card was already theirs, from the chat.' }
}

// after breaking the circle: the kind not chosen yet, and the question on it
export const otherKind = (pick?: 'DE' | 'NEXT') => (pick === 'DE' ? 'NEXT' : pick === 'NEXT' ? 'DE' : undefined)
export const askOther = (k: 'DE' | 'NEXT', c: C) => (k === 'NEXT' ? `And one small step from there: “${c.text}”, right?` : `And the other way you found: “${c.text}”, right?`)
