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
  const path = entry ? [entry.from, first] : [first]
  const links = entry ? ['', entry.id] : ['']
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
  for (const e of [...links.slice(entry ? 2 : 1), close!].map((id) => ring.find((x) => x.id === id)!)) {
    const [a, b] = [by.get(e.from)!, by.get(e.to)!]
    if (b.kind === 'B' && !used.has(b.id)) options.push({ edge: e.id, kind: 'DE', label: `See “${b.text}” another way` }), used.add(b.id)
    const act = b.kind === 'A' ? b : a.kind === 'A' ? a : null
    if (act && !used.has(act.id)) options.push({ edge: e.id, kind: 'NEXT', label: `Do something other than “${act.text}”` }), used.add(act.id)
  }
  return { path, links, close, options: options.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'DE' ? -1 : 1)) }
}

// the stages after the cards: the circle closes, the person notices it, picks where to start, sees the card go in,
// confirms the other kind (the step after another way, or another way after the step), then it is done
export const stages = (p: Plan) => ({ close: p.path.length, notice: p.path.length + 1, pick: p.path.length + 2, placed: p.path.length + 3, rest: p.path.length + 4, done: p.path.length + 5, last: p.close ? p.path.length + 3 : p.path.length })

// the question on the card that has just appeared: said straight, in their own words
export function ask(card: C, i: number): string {
  const q = `“${card.text}”`
  if (i === 0) return `It started with this: ${q}, right?`
  if (card.kind === 'B') return `So you told yourself ${q}, right?`
  if (card.kind === 'C') return `And that left you feeling ${card.names?.join(' and ') || q}, right?`
  if (card.kind === 'A') return `And then ${q}, right?`
  return `And then ${q}, right?`
}
// the question on the line that closes the circle
export const askClose = (from: C, to: C) => `And “${from.text}” makes ${`“${to.text}”`} feel even truer, right?`

// the presenter's popup for each stage of the guided map
export function walkWhy(p: Plan, step: number, cards: C[]): Why | null {
  const st = stages(p)
  const card = cards.find((c) => c.id === p.path[step])
  const asks = 'Asks, does not decide. “Not quite” hands the map back to them.'
  if (step === 0) return { what: 'The map starts with what happened, in their words.', mech: 'Every card is cut from what they said. The AI adds nothing.', ai: 'Places the cards one at a time. The person only confirms.' }
  if (step < p.path.length && card?.kind === 'B') return { what: 'Confirming the line: what happened → what they told themselves.', mech: 'Separating A from B: the event and the thought about it are not the same thing.', ai: asks }
  if (step < p.path.length && card?.kind === 'C') return { what: 'Confirming the line: the thought → the feeling.', mech: 'B → C: the feeling follows the thought, not the event itself.', ai: asks }
  if (step < p.path.length) return { what: 'Confirming the line: the feeling → what they did.', mech: 'C → what they did. This is what keeps the circle turning.', ai: asks }
  if (!p.close) return null
  if (step === st.close) return { what: 'The last line goes back to the thought. The circle closes.', mech: 'The loop: what they did makes the thought feel truer.', ai: 'Uses only what they already said in the chat.' }
  if (step === st.notice) return { what: 'The AI names what the map shows.', mech: 'Seeing the loop is the first intervention. In your head it feels like being stuck; on the map it has a shape.', ai: 'Describes the circle in their words. No interpretation.' }
  if (step === st.pick) return { what: 'Where to break the circle is their choice.', mech: 'Cut at a thought → see it another way (DE). Cut at something they did → do something different (Next step).', ai: 'The options come only from what they said. No new advice.' }
  if (step === st.rest) return { what: 'The other half of the way out, from the chat.', mech: 'Another way to see it (DE) and one small step (Next step) together: a new thought, and something to do with it.', ai: 'Uses only what they already said. They confirm it, like every other card.' }
  if (step >= st.done) return { what: 'The map is complete: all five labels, in their words.', mech: 'The circle, where it breaks, and what they will do. The summary puts it into one paragraph.', ai: 'Nothing new. The summary is built by the program from their own cards.' }
  return { what: 'The chosen line fades and their own card goes in.', mech: 'The circle stays visible, but broken: “I know this circle, and how to step out of it.”', ai: 'Nothing new: the card was already theirs, from the chat.' }
}

// after breaking the circle: the kind not chosen yet, and the question on it
export const otherKind = (pick?: 'DE' | 'NEXT') => (pick === 'DE' ? 'NEXT' : pick === 'NEXT' ? 'DE' : undefined)
export const askOther = (k: 'DE' | 'NEXT', c: C) => (k === 'NEXT' ? `And one small step from there: “${c.text}”, right?` : `And the other way you found: “${c.text}”, right?`)
