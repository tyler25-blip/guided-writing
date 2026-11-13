// Turning the person's words into cards and putting them on the canvas (plain code, no AI). Shared by the layout step and the demo's jump buttons.
import type { Card, Edge, Msg, State } from './MapApp.tsx'
import { flow, type Peer } from './flow.ts'
import { CARD_W, estH, fitView, hitsBox, namesFor, personIdx, pilesLayout, routeOrtho, type Box, type Kind } from './place.ts'

const uid = () => Math.random().toString(36).slice(2, 9)

// from = the person's message number (1 = first ordinary message); a feeling card gets the names the person chose after that message
export function makeCards(msgs: Msg[], got: { text: string; kind: string; from: number }[]): Card[] {
  const pi = personIdx(msgs)
  const now = Date.now()
  return got.map((c) => {
    const from = pi[c.from - 1]
    const names = c.kind === 'C' && from !== undefined ? namesFor(msgs, from) : []
    return { id: uid(), text: c.text, src: 'you', kind: c.kind as Kind, from, names: names.length ? names : undefined, x: 0, y: 0, stack: [], t: now }
  })
}

type Laid = Pick<State, 'cards' | 'edges' | 'areas' | 'piles' | 'view' | 'peers'>
// Put the cards where cause and effect put them (flow.ts) and draw the lines again. hOf: the cards' real heights once they have been drawn.
export function arrange<T extends Pick<State, 'cards' | 'edges' | 'peers'>>(st: T, hOf?: (id: string) => number): T {
  const f = flow(st.cards, st.edges, (st.peers ?? []).filter((p) => p.own), hOf && ((c) => hOf(c.id)))
  const cards = st.cards.map((c) => ({ ...c, ...f.pos[c.id], pile: undefined }))
  const at = (id: string) => f.pos[id]
  const edges = st.edges.map((e) => ({ ...e, between: undefined, route: f.routes[e.id], arc: f.arcs[e.id], at: at(e.from) && at(e.to) ? ([at(e.from).x, at(e.from).y, at(e.to).x, at(e.to).y] as [number, number, number, number]) : undefined }))
  return { ...st, cards, edges, peers: f.peers as Peer[] }
}
// lines null = "I'll arrange it myself" (piles on the right); otherwise the map is laid out (flow.ts) with the AI's lines
export function lay(cards: Card[], lines: { from: string; to: string }[] | null, size: { w: number; h: number }): Laid {
  if (!lines) {
    const p = pilesLayout(cards, size.w, size.h)
    return { cards: cards.map((c) => ({ ...c, pile: c.kind ?? 'A' })), edges: [], areas: [], piles: p.piles, view: { ...p.view, n: Date.now() } }
  }
  const edges: Edge[] = lines.map((l) => ({ id: uid(), from: l.from, to: l.to, by: 'ai' as const }))
  const st = arrange({ cards, edges, peers: [] as Peer[] })
  const boxes = st.cards.map((c) => ({ x: c.x, y: c.y, w: CARD_W, h: estH(c.text, c.kind) }))
  return { ...st, areas: [], piles: undefined, view: { ...fitView(boxes, size.w, size.h), n: Date.now() } }
}

// Reroute (orthogonally) the lines touching the given cards, and any named lines, round the cards as they now lie and past the other lines.
// fast = while a card is being dragged: one quick pass; when it is dropped the full search runs.
export function reroute(st: State, who: { cards?: string[]; edges?: string[] }, hOf: (id: string) => number, fast = false): State {
  const byId = new Map(st.cards.map((c) => [c.id, c]))
  const box = (c: Card): Box => ({ x: c.x, y: c.y, w: CARD_W, h: hOf(c.id) })
  // a moved card can land on other lines: those get rerouted too, not only the lines touching it
  const moved = (who.cards ?? []).map((id) => byId.get(id)).filter((c): c is Card => !!c).map(box)
  const under = (e: Edge) => !!e.route && e.route.some((p, i) => i + 1 < e.route!.length && moved.some((m) => hitsBox(p, e.route![i + 1], m)))
  const todo = st.edges.filter((e) => who.edges?.includes(e.id) || who.cards?.includes(e.from) || who.cards?.includes(e.to) || under(e)).map((e) => e.id)
  if (!todo.length) return st
  let edges = st.edges
  for (const id of todo) {
    const e = edges.find((x) => x.id === id)!
    const [a, b] = [byId.get(e.from), byId.get(e.to)]
    if (!a || !b) continue
    const keep = edges.filter((x) => x.id !== id && !todo.includes(x.id) && x.route && x.at && [byId.get(x.from), byId.get(x.to)].every((c, i) => c && c.x === x.at![i * 2] && c.y === x.at![i * 2 + 1])).map((x) => x.route!)
    const done = edges.filter((x) => todo.includes(x.id) && x.id !== id && x.route).map((x) => x.route!)
    const route = routeOrtho(box(a), box(b), st.cards.filter((c) => c.id !== a.id && c.id !== b.id).map(box), [...keep, ...done], fast)
    edges = edges.map((x) => (x.id === id ? { ...x, route, arc: undefined, at: [a.x, a.y, b.x, b.y] as [number, number, number, number] } : x))
  }
  return { ...st, edges }
}
