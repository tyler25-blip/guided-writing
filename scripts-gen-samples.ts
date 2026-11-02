// Generates the dev-panel samples: a Sonnet plays the person (from a real story, adapted), the app's real AI answers (src/map/brain.ts).
// Run: node --env-file=.env scripts-gen-samples.ts src/map/samples.json (then check the person's lines for leaked <think> tags)
import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync } from 'node:fs'
import { mapRoute } from './src/map/brain.ts'

const client = new Anthropic()
const MODEL = 'claude-sonnet-5-5'
type M = { role: 'you' | 'ai'; text: string; naming?: boolean; declined?: boolean; options?: string[]; propose?: boolean; notes?: unknown }

const STORIES = [
  {
    name: 'The error in the thesis',
    source: 'academia.stackexchange.com/q/126651 (alexz123456), adapted',
    brief: `You are Mara, 25, a research assistant. Last December you defended your master's thesis and got a very good grade. Your advisor then invited you to keep working on the topic and write a paper. Two weeks ago, while writing the first paper, you found a real mistake in the data analysis of the thesis (you had merged two survey waves wrong). The corrected numbers are very close and the conclusions don't change. You haven't told your advisor. You're scared they'll think you're careless, or worse, that the university will take back the degree. You can't put the wrong numbers in the paper either. You keep opening the file at night. Your next meeting with the advisor is on Friday. You suspect nobody would ever notice, and you feel bad for even thinking that.`,
  },
  {
    name: '“Be more modest”',
    source: 'academia.stackexchange.com/q/83086 (NoIdeaAboutName), adapted',
    brief: `You are Jun, 27, a second-year PhD student in Europe. Your advisor is abroad for a few weeks and just emailed: "I think you should be more modest, and we should meet more often." It stung. You avoid meetings because you're afraid of asking stupid questions and wasting his time, and you always feel you know nothing (you'd call it impostor feelings). You read "more modest" as him thinking you act like you don't need him, which is the opposite of how you feel. You've drafted three replies and sent none. You half know your fears don't fully add up, but they won't leave your head. You don't know whether to reply by email now or wait until he's back.`,
  },
  {
    name: 'The deleted message',
    source: 'interpersonal.stackexchange.com/q/23817 (Ganesh S), adapted',
    brief: `You are Sam, 24. You've been in a long-distance relationship with Noor for three months; you're trying to build trust. Two nights ago, texting on WhatsApp, you deleted a message "for everyone" because it had an embarrassing typo. Noor asked what you deleted and you joked "it's a secret". Since then she's been cold: short replies, no voice message last night. You keep rereading the chat and checking when she was last online. You think she now believes you're hiding something, and maybe the whole thing is falling apart. You haven't explained, because now explaining a typo feels ridiculous. You also know you might be overthinking it; she has exams this week.`,
  },
]

const PERSON = (brief: string) => `${brief}

You are chatting with an AI in an app for the evening, when something is stuck in your head. Write your NEXT message only.
- Casual, real, 1–3 sentences (sometimes just one short line). Plain English, a bit hesitant: "I guess", "like", "idk", trailing thoughts.
- Answer what the AI just asked, in your own way; don't give every detail at once — let the story come out over many messages.
- Sometimes contradict yourself or go back to the same worry. Don't sound like a therapist or summarise yourself neatly.
- When the AI invites you to look at it another way, you can find a small, tentative different view in your own words — not a big insight.
- When the AI offers to spread it out as a map, the app shows a button; you haven't pressed it yet. Never talk about the map, boxes, arrows or buttons; just keep telling your story.
- Never mention self-harm or wanting to disappear.`

async function personSays(brief: string, msgs: M[]) {
  const t = msgs.map((m) => (m.role === 'you' ? `YOU: ${m.text}` : `AI: ${m.text}`)).join('\n\n')
  const r = await client.messages.create({ model: MODEL, max_tokens: 400, system: PERSON(brief), messages: [{ role: 'user', content: (t ? `The chat so far:\n\n${t}\n\n` : 'You are opening the chat.\n\n') + 'Your next message:' }] })
  const b = r.content.find((x) => x.type === 'text')
  return b && b.type === 'text' ? b.text.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '').trim().replace(/^"|"$/g, '') : '...'
}
async function personPicks(brief: string, msgs: M[], options: string[]) {
  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 100,
    system: brief,
    messages: [{ role: 'user', content: `The AI asked you to put a word to your feeling and offered: ${options.join(', ')} (you can also add your own word). Last AI message: "${msgs.at(-1)!.text}". Reply with only the word or words you pick, comma separated (1–2 words, lowercase).` }],
  })
  const b = r.content.find((x) => x.type === 'text')
  return b && b.type === 'text' ? b.text.trim().toLowerCase().replace(/[."]/g, '') : options[0]
}
const wire = (msgs: M[]) => msgs.map(({ role, text, declined, naming }) => ({ role, text, declined, naming }))

const out = []
for (const st of STORIES) {
  const msgs: M[] = []
  let mine = 0
  while (mine < 14) {
    const last = msgs.at(-1)
    if (last?.options?.length) msgs.push({ role: 'you', text: await personPicks(st.brief, msgs, last.options), naming: true })
    else {
      if (last?.propose) {
        if (mine >= 9) break
        last.declined = true // keep talking: the story has more in it
      }
      msgs.push({ role: 'you', text: await personSays(st.brief, msgs) })
      mine++
    }
    type R = { reply: string; options: string[]; propose: boolean; notes: unknown; risk?: boolean }
    let r: R | null = null
    for (let k = 0; k < 12 && !r; k++) r = (await mapRoute(client, MODEL, 'reply', { msgs: wire(msgs) })) as R | null
    if (!r) throw new Error('reply failed 12 times')
    msgs.push({ role: 'ai', text: r.reply, ...(r.options?.length ? { options: r.options } : {}), ...(r.propose ? { propose: true } : {}), notes: r.notes })
    process.stdout.write(`${st.name}: ${mine} msgs${r.propose ? ' (propose)' : ''}${r.options?.length ? ' (naming)' : ''}\n`)
  }
  const notes = msgs.findLast((m) => m.notes)?.notes
  const c = (await mapRoute(client, MODEL, 'cards', { msgs: wire(msgs), notes })) as { you: { text: string; kind: string; from: number; why: string }[]; skipped: { text: string; why: string }[] }
  const a = (await mapRoute(client, MODEL, 'arrange', { cards: c.you.map((x, i) => ({ id: `c${i}`, text: x.text, src: 'you', kind: x.kind })) })) as { lines: { from: string; to: string }[] }
  out.push({ name: st.name, source: st.source, msgs, made: c.you, skipped: c.skipped, lines: a.lines.map((l) => [Number(l.from.slice(1)), Number(l.to.slice(1))]) })
  writeFileSync(process.argv[2], JSON.stringify(out, null, 1))
}
console.log('done')
