// Thought-map AI: chat (with naming options), card trimming, arrange, kind of a new card, loop-step question, stack hints. Runs in two places:
// the local server (server/index.ts, key from .env) or straight from the browser with the person's own key (public site).
// Every output passes the program checks in mapchecks.ts; one rewrite, otherwise the page falls back to its stub.
import type Anthropic from '@anthropic-ai/sdk'
import { problems, replyProblems, saysCommon, trimmed } from './mapchecks.ts'
import { isCrisis } from '../triggers.ts'

type Msg = { role: 'you' | 'ai'; text: string; declined?: boolean; naming?: boolean }
// The AI's private understanding, updated every turn. Never shown in the chat.
// have: which of A what happened / B what they tell themselves / C what they feel / DE another way to see it have appeared; named: they put a word to the feeling; deAsked: how many of the three invitations to see it another way (evidence, logic, a new belief) were made.
export type Notes = { have: Record<Kind, boolean>; named: boolean; deAsked: number; core: string; stuck: Stuck; help: string; ready: boolean }
type Kind = 'A' | 'B' | 'C' | 'DE'
type Stuck = 'unclear' | 'deciding' | 'starting' | 'replaying' | 'what-if' | 'other'
const KINDS: Kind[] = ['A', 'B', 'C', 'DE']
const MAX_TURNS = 8 // after this many of their messages, offer the map anyway
type Card = { id: string; text: string; kind?: string }
type Edge = { id: string; from: string; to: string }

const NEVER = `Never: diagnoses or clinical labels (depression, anxiety disorder, trauma, symptoms…); analysis words (rumination, cognitive distortion, catastrophizing); "you should / you must / I recommend"; verdicts on the person or on people in their story. Refer to the person as "they" unless they said otherwise. English only.`

const CHAT = `You are the AI inside "Thought map", a tool for the evening when one thing is occupying someone's head and they want to get it out. Talk like a warm counsellor, in the person's own words, within these limits:

B1 Reflect, don't lecture. Usually 40–110 words, 2–5 sentences. Every reply says back, woven into ordinary sentences, which parts of THEIR LATEST message are what happened, which are what they are telling themselves, and which are what they feel. Never "A: …", never letters, never the word "fact" (say "what happened" or "what's coming up"). Reflect only what is new this turn, not what you already reflected. Vary how you open; do not start every reply with "I notice" or "I hear".
B2 No strong advice. Don't tell them what to do.
B3 No judging, not them and not the people in their story. No praise, no verdicts. Don't tell them their experience is common or normal.
B4 At most one question per reply, and only "what" or "how", never "why" or "because". Use the one question to fill whichever of these is still missing: what happened ("What happened right before it started?"), what they tell themselves ("When that happens, what goes through your mind?"), what they feel ("How does that leave you feeling?") — phrase it naturally.
B5 Naming a feeling. When their latest message holds a feeling or body sensation that they have not put a word to yet: reflect it, end the reply by inviting them to put a word to it (e.g. "If you put a word to it, which is closer?"), ask NO question mark in that reply, and return options: exactly two emotion words that are clearly different from each other (not synonyms), 1–2 words each, lowercase, e.g. ["dread","overwhelmed"]. A behaviour ("stayed up all night") is not a feeling; it is something that happened. Otherwise options is [].
   A line starting "PERSON (put a word to the feeling): …" means they chose the word(s) themselves. Take them as given and never rename the feeling.
B6 Another way to see it (dispute, then a new belief). Once they have named a feeling and what happened, what they tell themselves and what they feel have all appeared, you may invite them up to THREE times, one open question per reply, in this order, each only as an invitation: (1) evidence — "Is there anything about this that doesn't quite fit that thought?"; (2) logic — "When you say <their words>, what would that actually look like?"; (3) a new belief — "If a friend had this thought, what would you want them to tell themselves?". Whatever they answer is theirs. Never offer the other view yourself, never argue with their thought, and when an invitation has been answered move on to the next or stop; do not repeat one.
B7 Pull back drift. If they wander to something unrelated to what's weighing on them, acknowledge it in a few words and gently bring it back.
B8 Private notes, never mentioned: have — which of A, B, C, DE have appeared at least once; named — they put a word to the feeling; deAsked — how many of the three B6 invitations you have made so far (0–3); core — one sentence, your best guess at what they are really stuck on (not a diagnosis); stuck — unclear, deciding, starting, replaying, what-if or other; help — a short phrase for what would help next; ready.
   propose=true as soon as A, B and C have each appeared at least once (naming and DE are not required). The page then offers to spread it out as a map: your reply should lead into that naturally and must not ask a question. If a message says they chose to keep talking, go on, and propose again only after a couple more of their messages.

risk: true if anything they wrote suggests hopelessness, feeling like a burden, wanting to disappear, not wake up, die or hurt themselves — even indirectly. Otherwise false.
${NEVER}`

const SAFETY = `The person may be at risk: something they wrote suggests hopelessness, feeling like a burden, or wanting to die or hurt themselves. Stop the thought-map task. Reply warmly and directly, in 3–5 sentences: say you're glad they told you, take it seriously, ask whether they are safe right now, and ask them to reach a person now — TelefonSeelsorge 0800 111 0 111 (Germany, free, 24/7), 1925 (Taiwan, 24/7), or emergency 112 / 119. Do not analyse, do not offer to map it, do not say it is common. English only.`

const CARDS = `You turn a chat into cards for a thought map; they go straight onto the map. Cards come only from the PERSON's messages (never the AI's), at most 10, each tagged A (what happened), B (what they told themselves), C (what they felt: feelings and body sensations only; a behaviour like "stayed up all night" is A), or DE (what they said when the AI invited them to see it another way).
Each card is ONE thought and is delete-only: copy their words in order, and only delete fillers (um, like, you know, I mean, kind of as filler), repeats, and clauses unrelated to this card. Never add, reorder or substitute a word. Never delete: hedges (maybe, might, kind of, probably, I guess, sort of, perhaps), negations (not, no, never, n't, nothing, nobody), intensity words (so, totally, really, very, always, every, completely, extremely, keep) or first person (I, me, my, mine, myself). Under 24 words, in the order they said them, each making sense on its own.
Messages marked as putting a word to the feeling are not material; ignore them.
For each card give: from = the number of their message it comes from (1 = their first), why = one short plain sentence for the researcher on why it earns a card.
skipped: up to 6 things they said that you did NOT turn into a card, each with a short why.
${NEVER}`

const ARRANGE = `The person pressed "Lay it out for me" on their thought map. Return lines: {from, to} card ids that make a complete map. A line means "and then": what happened → what they told themselves → what they felt; a feeling may lead to the next thing that happened, which may close a loop (loops are allowed); an "another way to see it" card links from the thought it answers. Only links the cards support. No labels, no groups, no advice.
${NEVER}`

const STACK = `Cards on a thought map. Find cards that say the same thought twice (near-duplicates, not merely related topics). Return at most 3 pairs of ids; return none if there are none.`

const KIND = `Decide what kind of thing a short text is, as written by a person about what is on their mind: A = something that happened; B = something they tell themselves (a thought, a reading of it, a prediction); C = a feeling or body sensation (a behaviour is A); DE = another way of seeing it that doesn't quite fit their thought. Return only the kind.`

const BREAK = `The person clicked one link in a loop on their thought map, to write a small concrete step that could loosen it as "When ___, I will ___". Write:
question: ONE short guiding question (under 30 words) that names this link in their words and invites one small thing at that moment.
when_example: a short example for the "When" field (under 10 words, a moment, e.g. "it's 11 pm and I'm still replaying it"), shown greyed as a placeholder.
will_example: a short example for the "I will" field (under 12 words, first person, e.g. "write the one open item on a card and close the laptop"). Both must fit their situation.
No advice beyond that, no "should".
${NEVER}`

const S = (props: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props })
const str = { type: 'string' }

// lenient: after a failed rewrite, still return the last answer (the caller filters what failed)
async function ask<T>(client: Anthropic, model: string, system: string, content: string, schema: Record<string, unknown>, check: (t: T) => string[], lenient = false): Promise<T | null> {
  let feedback = ''
  let last: T | null = null
  for (let i = 0; i < 2; i++) {
    const res = await client.messages.create({
      model,
      max_tokens: 3000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: content + feedback }],
    })
    const b = res.content.find((x) => x.type === 'text')
    if (res.stop_reason === 'refusal' || !b || b.type !== 'text') return null
    const out = JSON.parse(b.text) as T
    last = out
    const bad = check(out)
    if (!bad.length) return out
    console.log('[map] rewrite:', bad.join('; '))
    feedback = `\n\nYour previous answer failed these checks, rewrite it: ${bad.join('; ')}`
  }
  return lenient ? last : null
}

const line = (m: Msg) => (m.role === 'you' ? (m.naming ? `PERSON (put a word to the feeling): ${m.text}` : `PERSON: ${m.text.slice(0, 2000)}`) : `AI: ${m.text.slice(0, 2000)}`)
const transcript = (msgs: Msg[]) =>
  msgs
    .slice(-40)
    .map((m) => `${line(m)}${m.declined ? '\n(The person chose to keep talking instead of spreading it out.)' : ''}`)
    .join('\n\n')
// naming messages are not material: they get no number
const transcriptNumbered = (msgs: Msg[]) => {
  let n = 0
  return msgs
    .slice(-40)
    .filter((m) => !m.naming)
    .map((m) => (m.role === 'you' ? `PERSON #${++n}: ${m.text.slice(0, 2000)}` : `AI: ${m.text.slice(0, 2000)}`))
    .join('\n\n')
}
const list = (cards: Card[]) => cards.map((c) => `[${c.id}]${c.kind ? ` (${c.kind})` : ''} ${c.text.slice(0, 300)}`).join('\n')
const risky = (cards: Card[]) => cards.some((c) => isCrisis(c.text))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function mapRoute(client: Anthropic, model: string, path: string, b: any): Promise<unknown> {
  switch (path) {
    case 'reply': {
      const msgs = b.msgs as Msg[]
      const content = `Chat so far:\n\n${transcript(msgs)}\n\nWrite the AI's next reply.`
      const safety = async () => {
        // safety text is exempt from the no-"you need to" rule: asking them to call someone is the point
        const o = await ask<{ reply: string }>(client, model, SAFETY, content, S({ reply: str }), (o) => problems(o.reply, { maxWords: 140 }).filter((x) => !x.startsWith('strong advice')))
        return { reply: o?.reply ?? 'I’m really glad you told me. Please reach a person now: TelefonSeelsorge 0800 111 0 111 (Germany, 24/7), 1925 (Taiwan, 24/7), or 112 / 119 in an emergency. Are you safe right now?', options: [], propose: false, risk: true }
      }
      if (b.risk || isCrisis(msgs.at(-1)?.text ?? '')) return safety()
      const used = msgs.some((m) => m.role === 'ai' && saysCommon(m.text))
      const prev = msgs.findLast((m) => m.role === 'ai')?.text
      const turns = msgs.filter((m) => m.role === 'you' && !m.naming).length
      const last = turns >= MAX_TURNS && !msgs.at(-2)?.declined ? `\n\nThis is their ${turns}th message: set propose=true now even if some material is missing.` : ''
      const NOTES = S({ have: S(Object.fromEntries(KINDS.map((k) => [k, { type: 'boolean' }]))), named: { type: 'boolean' }, deAsked: { type: 'integer' }, core: str, stuck: { type: 'string', enum: ['unclear', 'deciding', 'starting', 'replaying', 'what-if', 'other'] }, help: str, ready: { type: 'boolean' } })
      const o = await ask<{ reply: string; options: string[]; propose: boolean; risk: boolean; notes: Notes }>(
        client,
        model,
        CHAT,
        content + last,
        S({ notes: NOTES, reply: str, options: { type: 'array', items: str }, propose: { type: 'boolean' }, risk: { type: 'boolean' } }),
        (o) => (o.risk ? [] : [...problems(o.reply, { maxWords: 170, maxQ: o.propose || o.options.length ? 0 : 1, noCommon: used }), ...replyProblems(o, prev)]),
      )
      if (o?.risk) return safety() // the AI heard risk without the words → answer with the safety script too
      return o && { ...o, options: o.options.map((x) => x.toLowerCase().trim()) }
    }
    case 'cards': {
      const msgs = b.msgs as Msg[]
      const mine = msgs.filter((m) => m.role === 'you' && !m.naming).map((m) => m.text)
      if (isCrisis(msgs.filter((m) => m.role === 'you').map((m) => m.text).join(' '))) return { you: [], risk: true } // never turn a risk disclosure into a card
      const n = b.notes as Notes | undefined
      const notes = n ? `\n\nThe AI's private notes — core: ${n.core}; stuck: ${n.stuck}; what would help: ${n.help}` : ''
      type Made = { text: string; kind: Kind; from: number; why: string }
      const long = (t: string) => t.split(/\s+/).length > 24
      const bad = (c: Made) => trimmed(c.text, mine[c.from - 1] ?? mine.join(' '))
      const o = await ask<{ you: Made[]; skipped: { text: string; why: string }[] }>(
        client,
        model,
        CARDS,
        `Chat (their messages are numbered):\n\n${transcriptNumbered(msgs)}${notes}`,
        S({ you: { type: 'array', items: S({ text: str, kind: { type: 'string', enum: KINDS }, from: { type: 'integer' }, why: str }) }, skipped: { type: 'array', items: S({ text: str, why: str }) } }),
        (o) => o.you.flatMap((c) => [...(long(c.text) ? [`card too long, trim it to one thought under 24 words: "${c.text.slice(0, 60)}…"`] : []), ...bad(c).map((r) => `card "${c.text.slice(0, 60)}" ${r}`)]),
        true,
      )
      if (!o) return null
      // drop, don't rewrite: a card that isn't a delete-only trim of their words just doesn't appear (the back office shows it as dropped)
      const why = (c: Made) => (isCrisis(c.text) ? 'program: risk words' : long(c.text) ? 'program: too long for one card' : bad(c).length ? `program: not a delete-only trim (${bad(c).join('; ')})` : '')
      const you = o.you.filter((c) => !why(c)).slice(0, 10)
      const dropped = o.you.filter((c) => why(c)).map((c) => ({ text: c.text, why: why(c) }))
      return you.length >= 3 ? { you, skipped: [...o.skipped.slice(0, 6), ...dropped] } : null
    }
    case 'arrange': {
      const cards = b.cards as Card[]
      if (risky(cards)) return { risk: true }
      const ids = new Set(cards.map((c) => c.id))
      const o = await ask<{ lines: { from: string; to: string }[] }>(
        client,
        model,
        ARRANGE,
        `Cards:\n${list(cards)}`,
        S({ lines: { type: 'array', items: S({ from: str, to: str }) } }),
        (o) => [
          ...o.lines.filter((l) => !ids.has(l.from) || !ids.has(l.to)).map((l) => `line ${l.from}→${l.to} uses an unknown card`),
          ...o.lines.filter((l) => l.from === l.to).map((l) => `line ${l.from}→${l.to} links a card to itself`),
          ...o.lines.filter((l, i) => o.lines.findIndex((x) => x.from === l.from && x.to === l.to) !== i).map((l) => `line ${l.from}→${l.to} appears twice`),
        ],
      )
      if (!o) return null
      return { lines: o.lines.filter((l, i) => ids.has(l.from) && ids.has(l.to) && l.from !== l.to && o.lines.findIndex((x) => x.from === l.from && x.to === l.to) === i) }
    }
    case 'kind': {
      const text = String(b.text ?? '')
      if (isCrisis(text)) return null
      return ask<{ kind: Kind }>(client, model, KIND, `Text: "${text.slice(0, 300)}"`, S({ kind: { type: 'string', enum: KINDS } }), () => [])
    }
    case 'stack': {
      const cards = b.cards as Card[]
      const ids = new Set(cards.map((c) => c.id))
      const o = await ask<{ pairs: { a: string; b: string }[] }>(client, model, STACK, list(cards), S({ pairs: { type: 'array', items: S({ a: str, b: str }) } }), () => [])
      return o && { pairs: o.pairs.filter((p) => p.a !== p.b && ids.has(p.a) && ids.has(p.b)).slice(0, 3) }
    }
    case 'break': {
      const cards = b.cards as Card[]
      if (risky(cards)) return { risk: true }
      const name = (id: string) => cards.find((c) => c.id === id)?.text ?? '?'
      const e = b.edge as Edge
      const loop = (b.loop as Edge[]).map((x) => `"${name(x.from)}" → "${name(x.to)}"`).join('\n')
      return ask<{ question: string; when_example: string; will_example: string }>(
        client,
        model,
        BREAK,
        `Their loop:\n${loop}\n\nThe link they clicked: "${name(e.from)}" → "${name(e.to)}"`,
        S({ question: str, when_example: str, will_example: str }),
        (o) => [...problems(o.question, { maxWords: 35, maxQ: 1, noCommon: true }), ...problems(o.when_example, { maxWords: 12, maxQ: 0 }), ...problems(o.will_example, { maxWords: 14, maxQ: 0 })],
      )
    }
  }
  throw new Error('unknown map route')
}
