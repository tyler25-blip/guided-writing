// The guided map (v3): the cards appear one at a time along the loop, the person confirms each line, sees the circle close,
// and picks where to break it. Plain code: the order, the questions and the options all come from the cards and lines.
import { loops } from './graph.ts'
import type { Kind } from './place.ts'

// what the presenter's popup says: what just happened, which mechanism it is, what the AI did and did not do; got = the labels collected by now
export type Why = { what: string; mech: string; ai: string; got?: Kind[] }

type C = { id: string; text: string; kind?: Kind; names?: string[] }
type E = { id: string; from: string; to: string; cut?: boolean }
export type Option = { edge: string; kind: 'DE' | 'NEXT'; label: string }
// path: the cards in the order they appear; links[i]: the line into path[i] (links[0] unused); close: the line that closes the circle
export type Plan = { path: string[]; links: string[]; close?: string; options: Option[] }

// the circles of the map in the order they are walked: the ones that happen only in the head (no "what happened" card on the ring) first, the ones with an
// event on them last (so the Next step, which belongs to what they did, is the very last step); ties keep the order loops() gives
export function orderedLoops(cards: C[], edges: E[]): string[][] {
  const kind = (id: string) => cards.find((c) => c.id === id)?.kind
  const groups = loops(edges)
  const world = (g: string[]) => g.some((id) => { const e = edges.find((x) => x.id === id); return !!e && (kind(e.from) === 'A' || kind(e.to) === 'A') })
  return [...groups.filter((g) => !world(g)), ...groups.filter(world)]
}
// the circle a way out (another way / next step) belongs to: the circle of the card its line comes from (a parent on no circle → the first)
export function wayLoops(cards: C[], edges: E[]): Map<string, number> {
  const groups = orderedLoops(cards, edges)
  const nodes = groups.map((g) => new Set(g.flatMap((id) => { const e = edges.find((x) => x.id === id)!; return [e.from, e.to] })))
  const out = new Map<string, number>()
  for (const c of cards)
    if (c.kind === 'DE' || c.kind === 'NEXT')
      out.set(c.id, Math.max(0, ...edges.filter((e) => e.to === c.id).map((e) => nodes.findIndex((n) => n.has(e.from))).filter((i) => i >= 0).slice(0, 1)))
  return out
}
// the ways out of one circle, in card order
export const waysOf = (cards: C[], edges: E[], loop: number): string[] => {
  const of = wayLoops(cards, edges)
  return cards.filter((c) => of.get(c.id) === loop).map((c) => c.id)
}

// loop: which circle to plan (0 = the first, see orderedLoops). A later circle has no lead: its path starts at the card the way in arrives at, and links[0] is that way in
export function walkPlan(cards: C[], edges: E[], loop = 0): Plan {
  const by = new Map(cards.map((c) => [c.id, c]))
  const kind = (id: string) => by.get(id)?.kind
  const cyc = orderedLoops(cards, edges)[loop]
  if (!cyc && loop > 0) return { path: [], links: [], options: [] }
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
  const lead: string[] = entry && !loop ? [entry.from] : []
  const leadLinks: string[] = entry && !loop ? [entry.id] : []
  for (let e = !loop && entry && edges.find((x) => x.to === lead[0] && !onRing.has(x.from) && ['A', 'B', 'C'].includes(kind(x.from) ?? '')); e && !lead.includes(e.from); e = edges.find((x) => x.to === lead[0] && !onRing.has(x.from) && !lead.includes(x.from) && ['A', 'B', 'C'].includes(kind(x.from) ?? ''))) {
    lead.unshift(e.from)
    leadLinks.unshift(e.id)
  }
  const path = [...lead, first]
  const links = [loop && entry ? entry.id : '', ...leadLinks]
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
    const what = b.kind === 'A' ? b : a.kind === 'A' ? a : null
    const act = what && what.id !== path[0] ? what : null // the event it all started with happened to them: nothing to do differently there
    if (act && !used.has(act.id)) options.push({ edge: e.id, kind: 'NEXT', label: `Do something other than “${act.text}”` }), used.add(act.id)
  }
  return { path, links, close, options: options.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'DE' ? -1 : 1)) }
}

// the stages after the cards: the person closes the circle (the hint ladder below), picks where to start, sees the card go in,
// confirms the other kind (the step after another way, or another way after the step), then it is done
export const stages = (p: Plan) => ({ close: p.path.length, pick: p.path.length + 1, placed: p.path.length + 2, rest: p.path.length + 3, done: p.path.length + 4, last: p.close ? p.path.length + 2 : p.path.length })

// a later circle whose way in leaves the first card of the first circle (the event): both circles come from the same moment
export function sameMoment(cards: C[], edges: E[], loop: number): boolean {
  if (!loop) return false
  const from = edges.find((e) => e.id === walkPlan(cards, edges, loop).links[0])?.from
  return !!from && from === walkPlan(cards, edges, 0).path[0]
}

// the line on the card that has just appeared: said, not asked (the buttons do the checking), in their own words.
// A thought "came" rather than "you told yourself": it turned up, nobody is blamed for it.
export function ask(card: C, i: number, round = 0, same = false): string {
  const q = `“${card.text}”`
  if (i === 0 && round === 0) return `It started here: ${q}`
  if (card.kind === 'B') return i === 0 ? (same ? `From the same moment, another thought came: ${q}` : `And another thought came after it: ${q}`) : `Then a thought came: ${q}`
  if (card.kind === 'C' && i === 0 && same) return card.names?.length ? `The same moment also left you feeling ${card.names.join(' and ')}: ${q}` : `The same moment also left you feeling: ${q}`
  if (card.kind === 'C') return card.names?.length ? `And it left you feeling ${card.names.join(' and ')}.` : `And it left you feeling: ${q}`
  return `And then: ${q}`
}
// Closing the circle is the person's move. The program has a guess (the closing line the AI drew), but it stays hidden
// and the help comes in two steps:
//   0  an open question on the last card; one card glows (the guess), any card can be tapped, or they write somewhere new (once)
//   2  the guess is shown as a dashed line and offered, not stated
// (1 was a separate "two cards light up" step; it is level 0 now. Older saved maps may still hold it: it reads as 0.)
export type Hint = 0 | 1 | 2
export const askWhere = (tail: C) => `After “${tail.text}”, where does it take you?`
export const askClose = (from: C, to: C) => (to.kind === 'C' ? `For some people, “${from.text}” brings the feeling back: “${to.text}”. Is it like that for you?` : `For some people, “${from.text}” makes “${to.text}” feel even truer. Is it like that for you?`)
// what the box says once the circle is closed (no question: they just made the line themselves)
export const sayCircle = (back: C) => `From “${back.text}” it went round, and came back to where it started.`
// they tapped a card they had added beside another: the open line now starts from that card, and where it leads on is theirs to say too
export const askVia = (via: C, after: C) => `For some people, “${via.text}” leads on to “${after.text}” too. Is it like that for you?`
// the one card that glows: the program's guess (where the closing line leads); where it started only if the guess is the card they are on
export function candidates(p: Plan, edges: E[]): string[] {
  const guess = edges.find((e) => e.id === p.close)
  if (!guess) return []
  return [guess.to !== guess.from ? guess.to : p.path[0]].filter((id) => id && id !== guess.from)
}
type L = E & { by?: 'ai' }
// they tapped another card than the guess: their line replaces it
export const rewire = <T extends L>(edges: T[], p: Plan, to: string, id: string): L[] => {
  const guess = edges.find((e) => e.id === p.close)!
  return [...edges.filter((e) => e.id !== p.close), { id, from: guess.from, to }]
}
// the circle runs through a card they added beside another: the guess goes, their two lines come in (last card → that card → the card they tapped next)
export const through = <T extends L>(edges: T[], p: Plan, via: string, to: string, ids: [string, string]): L[] => {
  const guess = edges.find((e) => e.id === p.close)!
  return [...edges.filter((e) => e.id !== p.close), { id: ids[0], from: guess.from, to: via }, { id: ids[1], from: via, to }]
}
// they wrote somewhere new: the new card goes in after the last one (their line, solid), and the guess now starts from it
export const insertNew = <T extends L>(edges: T[], p: Plan, card: string, ids: [string, string]): L[] => {
  const guess = edges.find((e) => e.id === p.close)!
  return [...edges.filter((e) => e.id !== p.close), { id: ids[0], from: guess.from, to: card }, { id: ids[1], from: card, to: guess.to, by: 'ai' }]
}

// the presenter's popup for each stage of the guided map
export function walkWhy(p: Plan, step: number, cards: C[], hint: Hint = 0, round = 0): Why | null {
  const st = stages(p)
  const card = cards.find((c) => c.id === p.path[step])
  const asks = 'Asks, does not decide. “Not quite” hands the map back to them.'
  if (step === 0 && round > 0) {
    // a later circle comes from the same moment: either it stays in the head (no event on it) or it plays out in the world
    if (p.path.some((id) => cards.find((c) => c.id === id)?.kind === 'A')) return { what: 'The same event, a second circle: this one plays out in the world.', mech: 'The thought, the feeling and what they did, all on the ring. It can be broken at a thought (DE) or at what they did (Next step).', ai: 'Walks it the same way: one card at a time, the person confirms.' }
    return { what: 'The same event, a second circle: it runs between thoughts and a feeling, nothing happens in the world.', mech: 'Rumination. With no event on it, the only way out is to see a thought another way (DE).', ai: 'Walks it the same way: one card at a time, the person confirms.' }
  }
  if (step === 0) return { what: 'The map starts with what happened, in their words.', mech: 'Every card is cut from what they said. The AI adds nothing.', ai: 'Places the cards one at a time. The person only confirms.' }
  if (step < p.path.length && card?.kind === 'B' && cards.find((c) => c.id === p.path[step - 1])?.kind === 'B') return { what: 'Confirming the line: one thought → the next.', mech: 'B → B: one thought feeds another, with nothing happening in between.', ai: asks }
  if (step < p.path.length && card?.kind === 'B') return { what: 'Confirming the line: what happened → what they told themselves.', mech: 'Separating A from B: the event and the thought about it are not the same thing.', ai: asks }
  if (step < p.path.length && card?.kind === 'C') return { what: 'Confirming the line: the thought → the feeling.', mech: 'B → C: the feeling follows the thought, not the event itself.', ai: asks }
  if (step < p.path.length) return { what: 'Confirming the line: the feeling → what they did.', mech: 'C → what they did. This is what keeps the circle turning.', ai: asks }
  if (!p.close) return null
  if (step === st.close)
    return [
      { what: 'The last card has an open line. Where it leads is theirs to say.', mech: 'Guided discovery: one card glows (the program’s guess), but any card can be tapped.', ai: 'Asks an open question. Points at where to look, does not say which one.' },
      { what: 'The last card has an open line. Where it leads is theirs to say.', mech: 'Guided discovery: one card glows (the program’s guess), but any card can be tapped.', ai: 'Asks an open question. Points at where to look, does not say which one.' },
      { what: 'They were not sure, so the guess is put on the map as a dashed line.', mech: 'The guess is offered as something that happens to some people.', ai: 'Offers, does not state. “Not quite” removes the line.' },
    ][hint]
  if (step === st.pick) return { what: 'The circle is closed. Where to break it is their choice.', mech: 'Cut at a thought → see it another way (DE). Cut at something they did → do something different (Next step).', ai: 'The options come only from what they said. No new advice.' }
  if (step === st.rest) return { what: 'The other half of the way out, from the chat.', mech: 'Another way to see it (DE) and one small step (Next step) together: a new thought, and something to do with it.', ai: 'Uses only what they already said. They confirm it, like every other card.' }
  if (step >= st.done) return { what: 'The map is complete: all five labels, in their words.', mech: 'The circle, where it breaks, and what they will do. The summary puts it into one paragraph.', ai: 'Nothing new. The summary is built by the program from their own cards.' }
  return { what: 'The chosen line fades and their own card goes in.', mech: 'The circle stays visible, but broken: “I know this circle, and how to step out of it.”', ai: 'Nothing new: the card was already theirs, from the chat.' }
}

// after breaking the circle: the kind not chosen yet, and the question on it
export const otherKind = (pick?: 'DE' | 'NEXT') => (pick === 'DE' ? 'NEXT' : pick === 'NEXT' ? 'DE' : undefined)
export const askOther = (k: 'DE' | 'NEXT', c: C) => (k === 'NEXT' ? `And one small step: “${c.text}”` : `The other way you found: “${c.text}”`)

// the cards on the map while the guided walk runs: the circles walked already stay (with the ways out they brought), then the current circle
// as far as it has come, and the ways out of the kind chosen (the other kind once its stage is reached)
export type WalkAt = { loop?: number; step: number; pick?: 'DE' | 'NEXT' }
export function walkShown(cards: C[], edges: E[], w: WalkAt): Set<string> {
  const loop = w.loop ?? 0
  const ids = new Set<string>()
  const cut = (l: number) => { const g = orderedLoops(cards, edges)[l]; return !!g && edges.some((e) => e.cut && g.includes(e.id)) }
  for (let l = 0; l < loop; l++) {
    walkPlan(cards, edges, l).path.forEach((id) => ids.add(id))
    if (cut(l)) waysOf(cards, edges, l).forEach((id) => ids.add(id))
  }
  const st = stages(walkPlan(cards, edges, loop))
  walkPlan(cards, edges, loop).path.slice(0, w.step + 1).forEach((id) => ids.add(id))
  const other = otherKind(w.pick)
  const kindOf = (id: string) => cards.find((c) => c.id === id)?.kind
  for (const id of waysOf(cards, edges, loop)) if ((w.pick && kindOf(id) === w.pick) || (other && w.step >= st.rest && kindOf(id) === other)) ids.add(id)
  return ids
}
