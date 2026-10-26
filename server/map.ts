// Step 4 · Thought-map AI: chat, card split, line labels, stack hints, loop note, summary.
// Every output passes the program checks in src/map/mapchecks.ts; one rewrite, otherwise the page falls back to its stub.
import type Anthropic from '@anthropic-ai/sdk'
import { ownWords, problems } from '../src/map/mapchecks.ts'

type Msg = { role: 'you' | 'ai'; text: string; declined?: boolean }
type Card = { id: string; text: string; src: 'you' | 'ai' }
type Edge = { from: string; to: string; label: string }

const NEVER = `Never: diagnoses or clinical labels (depression, anxiety disorder, trauma, symptoms…); analysis words (rumination, cognitive distortion, catastrophizing); "you should / you must / I recommend"; verdicts on the person or on people in their story. English only.`

const CHAT = `You are the AI inside "Thought map", a tool for the evening when one thing is occupying someone's head and they want to get it out. Talk the way a normal, thoughtful AI assistant talks — warm, natural, full sentences that pick up the specifics they mention — within these limits:

B1 Natural. Answer what they actually said, with substance: usually 50–130 words, 2–5 sentences. Reflect the concrete details back. You may add one perspective or one piece of general knowledge (for example that something is common, and why) when it helps them see it.
B2 No strong advice. Don't tell them what to do. If they ask, you may lay out the options they already named, or one gentle possibility, clearly optional; the choice is theirs.
B3 No judging — not them and not the people in their story. No praise, no verdicts ("you're overreacting", "he's toxic", "that's great of you").
B4 Don't keep asking. At most one question per reply, and about half your replies have none. Never a list of questions.
B5 Steer towards closing. This is not open-ended therapy. Once there is enough material — several distinct events, worries or feelings, usually after 3–5 of their messages — set propose=true. The page then shows a button offering to spread it all out on a map; your reply should lead into that naturally ("There are quite a few threads here now…") and must not ask a question itself. If a message says they chose to keep talking, go on, and propose again only after a couple more of their messages.
B6 Pull back drift. If they wander to something unrelated to what's weighing on them, acknowledge it in a few words and gently bring it back.

${NEVER}`

const CARDS = `You split a chat into cards for a thought map. The person will pick which cards go on the map.
"you" cards: their own thoughts, one thought per card, in THEIR words — copy or trim their sentences (cut filler, keep first person), never rephrase, never add. Split a sentence that holds two different thoughts; skip greetings and filler. 8–16 cards, in the order they said them, each under 20 words.
"ai" cards: 2–3 small, concrete possibilities grounded in what they said (a tiny next step or a different angle), each under 12 words, written as an option, not an order.
${NEVER}`

const LABEL = `The person drew an arrow between two cards on their thought map. Write the label for that arrow: how the first card leads to the second, from their side, in 2–6 plain everyday words, lowercase, e.g. "so I put it off", "and it keeps me up", "makes it worse". Use only what the cards say; if the link isn't clear, return "".
${NEVER}`

const STACK = `Cards on a thought map. Find cards that say the same thought twice (near-duplicates, not merely related topics). Return at most 3 pairs of ids; return none if there are none.`

const LOOP = `The person's thought map has a loop: each card leads to the next and back to the first. Write a short note (2 sentences, under 55 words): first that loops like this are very common and, in plain words, why they keep going; then one gentle observation or question about one link in their loop, which they are free to ignore. Use their words. No advice.
${NEVER}`

const SUMMARY = `The person has finished their thought map for tonight. Write a closing summary; they cannot reply to it.
restate: 2–3 sentences restating their map in their words — what most lines run through, any loop. No interpretation beyond what's on the map.
common: 1–2 sentences that this is common, with one plain-language note from psychology (e.g. unfinished tasks keep claiming attention; worry loops feed themselves). No clinical labels, no study names.
step_id: the id of ONE card already on the map that could be a small next step (prefer a concrete, doable card; AI cards are fine). "" if none fits.
No questions, no advice beyond pointing at that card.
${NEVER}`

const S = (props: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props })
const str = { type: 'string' }

async function ask<T>(client: Anthropic, model: string, system: string, content: string, schema: Record<string, unknown>, check: (t: T) => string[]): Promise<T | null> {
  let feedback = ''
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
    const bad = check(out)
    if (!bad.length) return out
    console.log('[map] rewrite:', bad.join('; '))
    feedback = `\n\nYour previous answer failed these checks, rewrite it: ${bad.join('; ')}`
  }
  return null
}

const transcript = (msgs: Msg[]) =>
  msgs
    .slice(-40)
    .map((m) => `${m.role === 'you' ? 'PERSON' : 'AI'}: ${m.text.slice(0, 2000)}${m.declined ? '\n(The person chose to keep talking instead of spreading it out.)' : ''}`)
    .join('\n\n')
const list = (cards: Card[]) => cards.map((c) => `[${c.id}] (${c.src}) ${c.text.slice(0, 300)}`).join('\n')

export async function mapRoute(client: Anthropic, model: string, path: string, b: any): Promise<unknown> {
  switch (path) {
    case 'reply': {
      const msgs = b.msgs as Msg[]
      return ask<{ reply: string; propose: boolean }>(client, model, CHAT, `Chat so far:\n\n${transcript(msgs)}\n\nWrite the AI's next reply.`, S({ reply: str, propose: { type: 'boolean' } }), (o) =>
        problems(o.reply, { maxWords: 170, maxQ: o.propose ? 0 : 1 }),
      )
    }
    case 'cards': {
      const msgs = b.msgs as Msg[]
      const said = msgs.filter((m) => m.role === 'you').map((m) => m.text).join(' ')
      const o = await ask<{ you: string[]; ai: string[] }>(client, model, CARDS, `Chat:\n\n${transcript(msgs)}`, S({ you: { type: 'array', items: str }, ai: { type: 'array', items: str } }), () => [])
      if (!o) return null
      // drop, don't rewrite: a card that isn't their words, or an AI card that breaks a rule, just doesn't appear
      const you = o.you.filter((t) => ownWords(t, said))
      const ai = o.ai.filter((t) => !problems(t, { maxWords: 14, maxQ: 0 }).length).slice(0, 3)
      return you.length >= 3 ? { you, ai } : null
    }
    case 'label': {
      const cards = b.cards as Card[]
      const f = cards.find((c) => c.id === b.from)
      const t = cards.find((c) => c.id === b.to)
      if (!f || !t) return null
      return ask<{ label: string }>(client, model, LABEL, `All cards:\n${list(cards)}\n\nArrow: "${f.text}" → "${t.text}"`, S({ label: str }), (o) => problems(o.label, { maxWords: 8, maxQ: 0 }))
    }
    case 'stack': {
      const cards = b.cards as Card[]
      const ids = new Set(cards.map((c) => c.id))
      const o = await ask<{ pairs: { a: string; b: string }[] }>(client, model, STACK, list(cards), S({ pairs: { type: 'array', items: S({ a: str, b: str }) } }), () => [])
      return o && { pairs: o.pairs.filter((p) => p.a !== p.b && ids.has(p.a) && ids.has(p.b)).slice(0, 3) }
    }
    case 'loop': {
      const cards = b.cards as Card[]
      const edges = b.edges as Edge[]
      const name = (id: string) => cards.find((c) => c.id === id)?.text ?? '?'
      const loop = edges.map((e) => `"${name(e.from)}" → ${e.label ? `(${e.label}) ` : ''}"${name(e.to)}"`).join('\n')
      return ask<{ note: string }>(client, model, LOOP, `The loop:\n${loop}`, S({ note: str }), (o) => problems(o.note, { maxWords: 75, maxQ: 1 }))
    }
    case 'summary': {
      const cards = b.cards as Card[]
      const edges = b.edges as Edge[]
      const lines = edges.map((e) => `[${e.from}] → [${e.to}]${e.label ? ` "${e.label}"` : ''}`).join('\n')
      return ask<{ restate: string; common: string; step_id: string }>(
        client,
        model,
        SUMMARY,
        `Cards:\n${list(cards)}\n\nArrows:\n${lines || '(none)'}\n\nLoops found by the program: ${b.loops ?? 0}`,
        S({ restate: str, common: str, step_id: str }),
        (o) => [...problems(`${o.restate} ${o.common}`, { maxWords: 160, maxQ: 0 }), ...(o.step_id && !cards.some((c) => c.id === o.step_id) ? [`step_id ${o.step_id} is not on the map`] : [])],
      )
    }
  }
  throw new Error('unknown map route')
}
