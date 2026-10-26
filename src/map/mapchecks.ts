// Step 4 · Program checks on what the thought-map AI writes. Server gate (rewrite once, else fall back); runnable alone.
const DIAGNOSE = /\b(depress\w*|anxiety disorder|disorder|symptom\w*|diagnos\w*|trauma\w*|ptsd|adhd|ocd|mental illness|patholog\w*)\b/i
const STRONG = /\b(you should|you must|you need to|you have to|you ought to|i (strongly )?(suggest|recommend|advise)|the (best|right) (thing|move) is)\b/i
const JUDGE = /\b(you('re| are) (right|wrong|overreacting|being dramatic|lazy|strong|brave|amazing)|good job|well done|that'?s (silly|irrational|wrong|crazy)|overthinking)\b/i
const ANALYSIS = /\b(rumina\w*|detected|cognitive distortion|catastrophi[sz]\w*|pattern of)\b/i

const hit = (re: RegExp, s: string) => s.match(re)?.[0]
const questions = (s: string) => (s.match(/\?/g) ?? []).length

// Problems found in a piece of AI text; [] = passes. `maxQ` = most questions allowed.
export function problems(text: string, o: { maxWords?: number; maxQ?: number } = {}): string[] {
  const out: string[] = []
  const w = text.trim().split(/\s+/).filter(Boolean).length
  for (const [re, what] of [[DIAGNOSE, 'clinical label'], [STRONG, 'strong advice'], [JUDGE, 'judges the person'], [ANALYSIS, 'analysis word']] as const) {
    const h = hit(re, text)
    if (h) out.push(`${what}: “${h}”`)
  }
  if (o.maxWords && w > o.maxWords) out.push(`${w} words (max ${o.maxWords})`)
  if (o.maxQ !== undefined && questions(text) > o.maxQ) out.push(`${questions(text)} questions (max ${o.maxQ})`)
  return out
}

// A "you" card must be the user's own words: most of its words appear in what they wrote.
const words = (s: string) => s.toLowerCase().match(/[\p{L}\d']+/gu) ?? []
export function ownWords(card: string, said: string) {
  const have = new Set(words(said))
  const ws = words(card)
  return ws.length > 0 && ws.filter((x) => have.has(x)).length / ws.length >= 0.75
}
