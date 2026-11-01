// Step 4 · Program checks on what the thought-map AI writes. Server gate (rewrite once, else fall back); runnable alone.
const DIAGNOSE = /\b(depress\w*|anxiety disorder|disorder|symptom\w*|diagnos\w*|trauma\w*|ptsd|adhd|ocd|mental illness|patholog\w*)\b/i
const STRONG = /\b(you should|you must|you need to|you have to|you ought to|i (strongly )?(suggest|recommend|advise)|the (best|right) (thing|move) is)\b/i
const JUDGE = /\b(you('re| are) (right|wrong|overreacting|being dramatic|lazy|strong|brave|amazing)|good job|well done|that'?s (silly|irrational|wrong|crazy)|overthinking)\b/i
const ANALYSIS = /\b(rumina\w*|detected|cognitive distortion|catastrophi[sz]\w*|pattern of)\b/i

const hit = (re: RegExp, s: string) => s.match(re)?.[0]
const questions = (s: string) => (s.match(/\?/g) ?? []).length

// "It's common / normal / many people…": fine once, a tic after that (the reviewers all noticed it).
const COMMON = /\b(common|normal|many people|lots of people|a lot of people|most people|very human|not alone)\b/i
export const saysCommon = (s: string) => COMMON.test(s)

// Problems found in a piece of AI text; [] = passes. `maxQ` = most questions allowed; noCommon = no "this is common".
export function problems(text: string, o: { maxWords?: number; maxQ?: number; noCommon?: boolean } = {}): string[] {
  const out: string[] = []
  if (o.noCommon && hit(COMMON, text)) out.push(`says “${hit(COMMON, text)}” again (once per session at most)`)
  const w = text.trim().split(/\s+/).filter(Boolean).length
  for (const [re, what] of [[DIAGNOSE, 'clinical label'], [STRONG, 'strong advice'], [JUDGE, 'judges the person'], [ANALYSIS, 'analysis word']] as const) {
    const h = hit(re, text)
    if (h) out.push(`${what}: “${h}”`)
  }
  if (o.maxWords && w > o.maxWords) out.push(`${w} words (max ${o.maxWords})`)
  if (o.maxQ !== undefined && questions(text) > o.maxQ) out.push(`${questions(text)} questions (max ${o.maxQ})`)
  return out
}

// A card must be the user's own words, trimmed: every card word appears in their message, in order (words only, punctuation ignored).
const words = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").match(/[\p{L}\d']+/gu) ?? []
export const tokens = words
export function ownWords(card: string, said: string) {
  const have = new Set(words(said))
  const ws = words(card)
  return ws.length > 0 && ws.filter((x) => have.has(x)).length / ws.length >= 0.75
}

// Words that carry how sure / how strong / whose: cutting one between two kept words changes what the person said.
const KEEP = new Set(['maybe', 'might', 'kind', 'probably', 'guess', 'sort', 'perhaps', 'not', 'no', 'never', 'nothing', 'nobody', 'so', 'totally', 'really', 'very', 'always', 'every', 'completely', 'extremely', 'keep', 'i', 'me', 'my', 'mine', 'myself'])
const keeps = (w: string) => KEEP.has(w) || /n't$/.test(w) || /^i'(m|ll|ve|d)$/.test(w)

// Where the card's words sit in the message (indices into src tokens): in order, the tightest match that drops the fewest KEEP words.
export function matchIn(card: string[], src: string[]): { idx: number[]; lost: string[] } | null {
  let best: { idx: number[]; lost: string[] } | null = null
  for (let i = 0; i < src.length && card.length; i++) {
    if (src[i] !== card[0]) continue
    const idx = [i]
    let j = i + 1
    for (let k = 1; k < card.length; k++) {
      while (j < src.length && src[j] !== card[k]) j++
      if (j >= src.length) break
      idx.push(j++)
    }
    if (idx.length < card.length) continue
    const hit = new Set(idx)
    const lost: string[] = []
    for (let m = idx[0]; m <= idx[idx.length - 1]; m++) if (!hit.has(m) && keeps(src[m])) lost.push(src[m])
    const span = idx[idx.length - 1] - idx[0]
    if (!best || lost.length < best.lost.length || (lost.length === best.lost.length && span < best.idx[best.idx.length - 1] - best.idx[0])) best = { idx, lost }
  }
  return best
}

// [] = the card is a delete-only trim of the source message that keeps hedges, negations, intensity words and first person.
export function trimmed(card: string, source: string): string[] {
  const c = words(card)
  const src = words(source)
  if (!c.length) return ['empty card']
  const m = matchIn(c, src)
  if (!m) {
    const have = new Set(src)
    const added = c.filter((w) => !have.has(w))
    return [added.length ? `adds words that aren't in their message: ${added.join(', ')}` : 'words are not in their original order']
  }
  return m.lost.map((w) => `drops “${w}”, which changes how sure or how strong it is`)
}

// Extra checks on a chat reply (used with problems()).
const opening = (s: string) => words(s).slice(0, 4).join(' ')
export function replyProblems(o: { reply: string; options: string[] }, prev?: string): string[] {
  const out: string[] = []
  if (/\bfacts?\b/i.test(o.reply)) out.push('calls something a fact; say what happened')
  if (prev && opening(o.reply) && opening(o.reply) === opening(prev)) out.push('same opening as last time')
  if (o.options.length) {
    if (o.options.length !== 2) out.push(`${o.options.length} naming options (exactly 2)`)
    if (new Set(o.options.map((x) => x.toLowerCase().trim())).size < o.options.length) out.push('naming options are the same word')
    for (const x of o.options) {
      if (x.trim().split(/\s+/).length > 2) out.push(`naming option “${x}” is longer than 2 words`)
      out.push(...problems(x))
    }
    if (o.reply.includes('?')) out.push('a reply that offers naming options must not contain a question mark')
  }
  return out
}
