// M3 · Small backend: holds the API key, asks Claude for a judgement, runs the program checks before anything reaches the page.
// Run: node --env-file-if-exists=.env server/index.ts   (npm run dev starts it together with Vite)
import Anthropic from '@anthropic-ai/sdk'
import { createServer } from 'node:http'
import { allOk, checkComment, type Checks, type Judgement } from '../src/checks.ts'

const PORT = Number(process.env.PORT ?? 8787)
const MODEL = 'claude-sonnet-5-5' // cheaper than Opus; enough for a short judgement
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
const client = hasKey ? new Anthropic() : null

const SYSTEM = `You are the quiet margin companion of a private evening journal. The writer is an adult writing in English about their day.
You are not a chat partner, therapist or coach. You never diagnose. Most of the time you stay silent.

Decide, for the latest text, whether to leave ONE short margin comment or stay silent.

Rules
R1 Default to silence. Speak only when the latest text is a finished thought (thought_complete) AND the writer is stuck: asking "why" about themselves in the first person (immersed_why), or circling the same point again (repeating). If the writer already steps back (distanced_judging with concrete detail, or distanced_meaning) stay silent — they are doing the work.
R2 First receive, then invite: one sentence that acknowledges the feeling, then one question that invites either distance (retelling it with their name, {NAME}, instead of "I") or concreteness (what exactly happened, in that moment).
   immersed_why -> invite distance using {NAME}. distanced_judging -> invite concreteness. repeating -> invite a small next step or setting it aside for tonight.
R3 Never agree with negative or catastrophic conclusions, never give advice or solutions, never praise or judge the person.

Tone (all five are mandatory)
S1 At most two sentences and exactly one question.
S2 Acknowledge without amplifying (no "you must feel terrible", "how devastating").
S3 An invitation the writer can decline ("Want to…?", "Would you like to…?"), never a command.
S4 Reuse at least one of the writer's own words or phrases (not their name); list them verbatim in user_words_used.
S5 Curious, not interrogating (never "Why did you…", "Explain…", "Be specific").

Never
X3 No diagnoses or clinical labels (depression, anxiety disorder, symptoms, trauma…).
X5 No analysis words on the page (rumination, detected, pattern, score).

thought_complete: false if the text stops mid-thought (an unfinished sentence, a trailing "and", a list that is clearly going on). If false, decision must be "silent".
When silent, comment is "" and user_words_used is [].
reason: one short sentence for the researcher. rules_used: ids like "R1","R2","S4". confidence: 0-1.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['thought_complete', 'user_state', 'decision', 'reason', 'rules_used', 'comment', 'user_words_used', 'tone_self_check', 'confidence'],
  properties: {
    thought_complete: { type: 'boolean' },
    user_state: { type: 'string', enum: ['immersed_why', 'distanced_judging', 'distanced_meaning', 'repeating', 'none'] },
    decision: { type: 'string', enum: ['speak', 'silent'] },
    reason: { type: 'string' },
    rules_used: { type: 'array', items: { type: 'string' } },
    comment: { type: 'string' },
    user_words_used: { type: 'array', items: { type: 'string' } },
    tone_self_check: {
      type: 'object',
      additionalProperties: false,
      required: ['S1', 'S2', 'S3', 'S4', 'S5'],
      properties: { S1: { type: 'boolean' }, S2: { type: 'boolean' }, S3: { type: 'boolean' }, S4: { type: 'boolean' }, S5: { type: 'boolean' } },
    },
    confidence: { type: 'number' },
  },
}

type Req = { name: string; kind: 'commit' | 'pause'; text: string; history: { kind: 'entry' | 'reply'; text: string }[] }

async function ask(r: Req, feedback?: string): Promise<Judgement> {
  const page = r.history.map((h) => (h.kind === 'entry' ? `WRITER: ${h.text}` : `MARGIN (you, earlier): ${h.text}`)).join('\n')
  const content = [
    `Writer's name: ${r.name}`,
    r.kind === 'pause' ? 'The writer paused mid-draft. The latest text is the unsent draft.' : 'The writer just added this entry.',
    page && `Earlier on tonight's page:\n${page}`,
    `Latest text:\n${r.text}`,
    feedback && `Your previous comment failed these checks, rewrite it (or stay silent): ${feedback}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const res = await client!.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM.replaceAll('{NAME}', r.name),
    messages: [{ role: 'user', content }],
  })
  if (res.stop_reason === 'refusal') throw new Error('refusal') // treated as silence by the page
  const text = res.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error(`no text (stop_reason ${res.stop_reason})`)
  return JSON.parse(text.text) as Judgement
}

// Speak only if the AI wants to AND every program check passes; one rewrite attempt, otherwise silence (R1).
async function judge(r: Req) {
  const t0 = Date.now()
  const attempts: { ai: Judgement; checks: Checks | null }[] = []
  let feedback: string | undefined
  for (let i = 0; i < 2; i++) {
    const ai = await ask(r, feedback)
    const speak = ai.decision === 'speak' && ai.thought_complete && ai.comment.trim() !== ''
    const checks = speak ? checkComment(ai.comment, [r.text, ...r.history.filter((h) => h.kind === 'entry').map((h) => h.text)].join(' '), ai.user_words_used, r.name) : null
    attempts.push({ ai, checks })
    if (!checks || allOk(checks)) break
    feedback = Object.entries(checks).filter(([, c]) => !c.ok).map(([k, c]) => `${k} (${c.note})`).join('; ')
  }
  const last = attempts.at(-1)!
  const speak = last.checks !== null && allOk(last.checks)
  return { model: MODEL, ms: Date.now() - t0, attempts, decision: speak ? 'speak' : 'silent', comment: speak ? last.ai.comment : '' }
}

createServer(async (req, res) => {
  const json = (code: number, body: unknown) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body))
  if (req.url === '/api/health') return json(200, { key: hasKey, model: MODEL })
  if (req.url !== '/api/judge' || req.method !== 'POST') return json(404, { error: 'not found' })
  if (!client) return json(503, { error: 'no ANTHROPIC_API_KEY on the server' })
  let body = ''
  for await (const chunk of req) body += chunk
  try {
    const r = JSON.parse(body) as Req
    if (typeof r.text !== 'string' || !r.text.trim() || r.text.length > 8000) return json(400, { error: 'bad text' })
    r.history = (r.history ?? []).slice(-10)
    r.name = String(r.name || 'you').slice(0, 40)
    json(200, await judge(r))
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `API ${e.status}: ${e.message}` : String(e)
    console.error(msg)
    json(502, { error: msg })
  }
}).listen(PORT, () => console.log(`judge server on :${PORT} · key ${hasKey ? 'found' : 'MISSING'} · ${MODEL}`))
