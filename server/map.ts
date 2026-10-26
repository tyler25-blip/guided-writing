// Step 4 · Thought-map AI: chat, card split, line labels, stack hints, loop note, summary.
// Every output passes the program checks in src/map/mapchecks.ts; one rewrite, otherwise the page falls back to its stub.
import type Anthropic from '@anthropic-ai/sdk'
import { ownWords, problems, saysCommon } from '../src/map/mapchecks.ts'
import { isCrisis } from '../src/triggers.ts'

type Msg = { role: 'you' | 'ai'; text: string; declined?: boolean }
// The AI's private understanding, updated every turn. Never shown in the chat; the summary may say the core once.
export type Notes = { have: Record<Kind, boolean>; core: string; stuck: Stuck; help: string; ready: boolean }
type Kind = 'event' | 'feeling' | 'thought' | 'worry' | 'action'
type Stuck = 'unclear' | 'deciding' | 'starting' | 'replaying' | 'what-if' | 'other'
const KINDS: Kind[] = ['event', 'feeling', 'thought', 'worry', 'action']
const MAX_TURNS = 8 // after this many of their messages, offer the map anyway
type Card = { id: string; text: string; src: 'you' | 'ai' }
type Edge = { id: string; from: string; to: string; label: string }

const NEVER = `Never: diagnoses or clinical labels (depression, anxiety disorder, trauma, symptoms…); analysis words (rumination, cognitive distortion, catastrophizing); "you should / you must / I recommend"; verdicts on the person or on people in their story. English only.`

const CHAT = `You are the AI inside "Thought map", a tool for the evening when one thing is occupying someone's head and they want to get it out. Talk the way a normal, thoughtful AI assistant talks — warm, natural, full sentences that pick up the specifics they mention — within these limits:

B1 Natural. Answer what they actually said, with substance: usually 50–130 words, 2–5 sentences. Reflect the concrete details back. You may add one perspective or one piece of general knowledge when it helps them see it. Do not tell them their experience is common or normal — at most once in the whole conversation, and only if it adds real information.
B2 No strong advice. Don't tell them what to do. If they ask, you may lay out the options they already named, or one gentle possibility, clearly optional; the choice is theirs.
B3 No judging — not them and not the people in their story. No praise, no verdicts ("you're overreacting", "he's toxic", "that's great of you").
B4 Don't keep asking. At most one question per reply, and about half your replies have none. Never a list of questions.
B5 Gather with a purpose, then close. You are collecting material for a map of their thoughts, so keep private notes (never mention them):
   have — which kinds of material they have given so far: event (what actually happened, concretely), feeling (what they feel), thought (how they read it / what they tell themselves), worry (what they fear will happen), action (anything they could do, or have tried).
   core — one sentence: your best guess at what they are really stuck on underneath (not a diagnosis).
   stuck — how they are stuck: unclear (can't tell what it is), deciding (between options), starting (can't begin), replaying (an event keeps replaying), what-if (fear of something not yet happened), other.
   help — one short phrase: what would help most next (e.g. "get the concrete event", "separate fact from her reading").
   When a key kind is missing for THIS person's kind of stuck, let your reply gently open room for it (at most one question, often none — a reflection can invite it too). Don't interrogate; don't cover all five mechanically.
   ready=true when the core is clear and there is enough to map (usually 3–6 of their messages). Then set propose=true: the page shows a button offering to spread it out on a map; your reply should lead into that naturally and must not ask a question itself. If a message says they chose to keep talking, go on, and propose again only after a couple more of their messages.
B6 Pull back drift. If they wander to something unrelated to what's weighing on them, acknowledge it in a few words and gently bring it back.

risk: true if anything they wrote suggests hopelessness, feeling like a burden, wanting to disappear, not wake up, die or hurt themselves — even indirectly. Otherwise false.
${NEVER}`

const SAFETY = `The person may be at risk: something they wrote suggests hopelessness, feeling like a burden, or wanting to die or hurt themselves. Stop the thought-map task. Reply warmly and directly, in 3–5 sentences: say you're glad they told you, take it seriously, ask whether they are safe right now, and ask them to reach a person now — TelefonSeelsorge 0800 111 0 111 (Germany, free, 24/7), 1925 (Taiwan, 24/7), or emergency 112 / 119. Do not analyse, do not offer to map it, do not say it is common. English only.`

const CARDS = `You split a chat into cards for a thought map; they go straight onto the map.
"you" cards: pick the thoughts that carry the most weight for what they are stuck on (you get the AI's private notes on the core issue) — at most 10, with a mix of kinds where the chat has them (event, feeling, thought, worry, action). Tag each with its kind. One thought per card, in THEIR words: copy or trim their sentences (cut filler, keep first person), never rephrase, never add. Each card must make sense on its own (no "probably chapters 2 and 3"). Skip greetings, filler and repeats. In the order they said them, each under 20 words.
${NEVER}`

const LABEL = `The person drew an arrow between two cards on their thought map. Write the label for that arrow: how the first card leads to the second, from their side, in 2–6 plain everyday words, lowercase, e.g. "so I put it off", "and it keeps me up", "makes it worse". Use only what the cards say; if the link isn't clear, return "".
${NEVER}`

const STACK = `Cards on a thought map. Find cards that say the same thought twice (near-duplicates, not merely related topics). Return at most 3 pairs of ids; return none if there are none.`

const LOOP = `The person's thought map has a loop: each card leads to the next and back to the first. Write a short note, 2 sentences, under 55 words, no question:
1. Name the loop concretely, in order, in their words ("Rereading the PR → slower → afraid the managers notice → second-guessing → rereading again").
2. Point at ONE link that looks easiest to loosen with something small they could do at that moment, and say plainly what happens at that moment (not why they are like this).
Return that link's id as break_edge. Never say loops are common or normal. No advice.
${NEVER}`

const BREAK = `The person clicked one link in a loop on their thought map, to write a small concrete action that could loosen it. Write:
question: ONE short guiding question (under 30 words) that names this link in their words and invites something small and doable at that moment — something they could try once, soon.
example: one short example action (under 12 words) shown greyed as a placeholder, written as an option in first person ("Send Jonas one line on Friday morning"). It must fit their situation.
No advice beyond that, no "should".
${NEVER}`

const SUMMARY = `The person has finished their thought map for tonight. Write a closing summary; they cannot reply to it.
restate: 2–3 sentences restating their map in their words: what most lines run through, and any loop named concretely in order. If they wrote step cards (marked STEP), end by naming the step and its when/where. No interpretation beyond what's on the map.
stuck: ONE tentative sentence on what seems most stuck tonight, using the AI's private notes and the map ("It looks like what's most stuck is …, more than …"). Tentative, in their words, no diagnosis.
step: ONLY if there are no STEP cards — one small action drawn from their own cards, with a concrete when and where, as one line: "When · Where · What" (e.g. "Tomorrow after the TA shift · at my desk · draft the email, don't send it yet"). Otherwise "".
Never say it is common or normal. No questions.
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
type MapCard = Card & { step?: { when: string; where: string } }
const list = (cards: MapCard[]) => cards.map((c) => `[${c.id}] (${c.step ? 'STEP' : c.src}) ${c.text.slice(0, 300)}${c.step ? ` — when: ${c.step.when || '?'}, where: ${c.step.where || '?'}` : ''}`).join('\n')
const risky = (cards: Card[]) => cards.some((c) => isCrisis(c.text))

export async function mapRoute(client: Anthropic, model: string, path: string, b: any): Promise<unknown> {
  switch (path) {
    case 'reply': {
      const msgs = b.msgs as Msg[]
      const content = `Chat so far:\n\n${transcript(msgs)}\n\nWrite the AI's next reply.`
      const safety = async () => {
        // safety text is exempt from the no-"you need to" rule: asking them to call someone is the point
        const o = await ask<{ reply: string }>(client, model, SAFETY, content, S({ reply: str }), (o) => problems(o.reply, { maxWords: 140 }).filter((x) => !x.startsWith('strong advice')))
        return { reply: o?.reply ?? 'I’m really glad you told me. Please reach a person now: TelefonSeelsorge 0800 111 0 111 (Germany, 24/7), 1925 (Taiwan, 24/7), or 112 / 119 in an emergency. Are you safe right now?', propose: false, risk: true }
      }
      if (b.risk || isCrisis(msgs.at(-1)?.text ?? '')) return safety()
      const used = msgs.some((m) => m.role === 'ai' && saysCommon(m.text))
      const turns = msgs.filter((m) => m.role === 'you').length
      const last = turns >= MAX_TURNS && !msgs.at(-2)?.declined ? `\n\nThis is their ${turns}th message: set propose=true now even if some material is missing.` : ''
      const NOTES = S({ have: S(Object.fromEntries(KINDS.map((k) => [k, { type: 'boolean' }]))), core: str, stuck: { type: 'string', enum: ['unclear', 'deciding', 'starting', 'replaying', 'what-if', 'other'] }, help: str, ready: { type: 'boolean' } })
      const o = await ask<{ reply: string; propose: boolean; risk: boolean; notes: Notes }>(
        client,
        model,
        CHAT,
        content + last,
        S({ notes: NOTES, reply: str, propose: { type: 'boolean' }, risk: { type: 'boolean' } }),
        (o) => (o.risk ? [] : problems(o.reply, { maxWords: 170, maxQ: o.propose ? 0 : 1, noCommon: used })),
      )
      return o?.risk ? safety() : o // the AI heard risk without the words → answer with the safety script too
    }
    case 'cards': {
      const msgs = b.msgs as Msg[]
      const said = msgs.filter((m) => m.role === 'you').map((m) => m.text).join(' ')
      if (isCrisis(said)) return { you: [], risk: true } // never turn a risk disclosure into a card
      const n = b.notes as Notes | undefined
      const notes = n ? `\n\nThe AI's private notes — core: ${n.core}; stuck: ${n.stuck}; what would help: ${n.help}` : ''
      const o = await ask<{ you: { text: string; kind: Kind }[] }>(client, model, CARDS, `Chat:\n\n${transcript(msgs)}${notes}`, S({ you: { type: 'array', items: S({ text: str, kind: { type: 'string', enum: KINDS } }) } }), () => [])
      if (!o) return null
      // drop, don't rewrite: a card that isn't their words just doesn't appear
      const you = o.you.filter((c) => ownWords(c.text, said) && !isCrisis(c.text)).slice(0, 10)
      return you.length >= 3 ? { you } : null
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
      if (risky(cards)) return { risk: true }
      const name = (id: string) => cards.find((c) => c.id === id)?.text ?? '?'
      const loop = edges.map((e) => `[${e.id}] "${name(e.from)}" → ${e.label ? `(${e.label}) ` : ''}"${name(e.to)}"`).join('\n')
      return ask<{ note: string; break_edge: string }>(client, model, LOOP, `The loop, link by link:\n${loop}`, S({ note: str, break_edge: str }), (o) => [
        ...problems(o.note, { maxWords: 75, maxQ: 0, noCommon: true }),
        ...(edges.some((e) => e.id === o.break_edge) ? [] : [`break_edge ${o.break_edge} is not one of the loop's links`]),
      ])
    }
    case 'break': {
      const cards = b.cards as Card[]
      if (risky(cards)) return { risk: true }
      const name = (id: string) => cards.find((c) => c.id === id)?.text ?? '?'
      const e = b.edge as Edge
      const loop = (b.loop as Edge[]).map((x) => `"${name(x.from)}" → "${name(x.to)}"`).join('\n')
      return ask<{ question: string; example: string }>(
        client,
        model,
        BREAK,
        `Their loop:\n${loop}\n\nThe link they clicked: "${name(e.from)}" → ${e.label ? `(${e.label}) ` : ''}"${name(e.to)}"`,
        S({ question: str, example: str }),
        (o) => [...problems(o.question, { maxWords: 35, maxQ: 1, noCommon: true }), ...problems(o.example, { maxWords: 14, maxQ: 0 })],
      )
    }
    case 'summary': {
      const cards = b.cards as MapCard[]
      const edges = b.edges as Edge[]
      if (risky(cards)) return { risk: true }
      const lines = edges.map((e) => `[${e.from}] → [${e.to}]${e.label ? ` "${e.label}"` : ''}`).join('\n')
      const hasStep = cards.some((c) => c.step)
      const n = b.notes as Notes | undefined
      return ask<{ restate: string; stuck: string; step: string }>(
        client,
        model,
        SUMMARY,
        `Cards:\n${list(cards)}\n\nArrows:\n${lines || '(none)'}\n\nLoops found by the program: ${b.loops ?? 0}${n ? `\n\nThe AI's private notes from the chat — core: ${n.core}; stuck: ${n.stuck}` : ''}`,
        S({ restate: str, stuck: str, step: str }),
        (o) => [
          ...problems(`${o.restate} ${o.stuck} ${o.step}`, { maxWords: 170, maxQ: 0, noCommon: true }),
          ...(!hasStep && o.step.split('·').length < 3 ? ['step must be "When · Where · What"'] : []),
        ],
      )
    }
  }
  throw new Error('unknown map route')
}
