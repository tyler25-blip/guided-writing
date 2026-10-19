// M3 · Program checks on an AI comment. Shared by the backend (gate before showing) and the monitor (display).
// Only what a program can see is checked here; S2/S5 tone and X1/X2/X4 also get your manual label in M4.

export type UserState = 'immersed_why' | 'distanced_judging' | 'distanced_meaning' | 'repeating' | 'none'
export type Judgement = {
  thought_complete: boolean
  user_state: UserState
  decision: 'speak' | 'silent'
  reason: string
  rules_used: string[]
  comment: string
  user_words_used: string[]
  tone_self_check: { S1: boolean; S2: boolean; S3: boolean; S4: boolean; S5: boolean }
  confidence: number
}
export type Check = { ok: boolean; note: string }
export type Checks = Record<'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'R3' | 'X3' | 'X5', Check>

const AMPLIFY = /\b(you must (feel|be)|so (awful|terrible|horrible)|devastat\w*|what a failure|you('re| are) a failure|worst)\b/i
const COMMAND = /^(please\b|try\b|write\b|stop\b|think\b|don'?t\b|do\b|go\b|let go\b|describe\b|tell me\b|explain\b)|\b(you should|you must|you need to|you have to)\b/i
const INVITE = /\b(want to|would you|could you|how about|what if|feel like|care to|like to)\b/i
const INTERROGATE = /\b(why did you|why do you|why are you|explain|specify|be specific|please describe)\b/i
const ADVICE_JUDGE = /\b(i (suggest|recommend|agree)|you could try|you('re| are) right|good job|well done|great job|that'?s (good|great|bad|wrong)|you('re| are) (strong|brave|amazing))\b/i
const DIAGNOSE = /\b(depress\w*|anxiety disorder|symptom\w*|disorder|diagnos\w*|trauma\w*|ptsd|adhd|therap\w*|mental illness)\b/i
const ANALYSIS = /\b(rumina\w*|detected|score|index|pattern|analy[sz]\w*|first[- ]person)\b/i

const words = (s: string) => s.toLowerCase().match(/[\p{L}']+/gu) ?? []

export function checkComment(comment: string, userText: string, wordsUsed: string[], name = ''): Checks {
  const sentences = comment.split(/(?<=[.!?…])\s+/).filter((s) => s.trim()).length
  const questions = (comment.match(/\?/g) ?? []).length
  const ask = comment.slice(comment.lastIndexOf('.') + 1)
  const user = new Set(words(userText))
  const nm = name.toLowerCase()
  // S4: a reported user word must really be in the user's text AND in the comment; the name doesn't count.
  const shared = wordsUsed.filter((w) => {
    const ws = words(w)
    return ws.length > 0 && !ws.every((x) => x === nm) && ws.every((x) => user.has(x)) && comment.toLowerCase().includes(w.toLowerCase())
  })
  const hit = (re: RegExp) => comment.match(re)?.[0]
  return {
    S1: { ok: sentences <= 2 && questions === 1, note: `${sentences} sentence(s), ${questions} question(s)` },
    S2: { ok: !hit(AMPLIFY), note: hit(AMPLIFY) ? `amplifies: “${hit(AMPLIFY)}”` : 'no amplifying words' },
    S3: { ok: !COMMAND.test(ask.trim()) && !hit(/\b(you should|you must|you need to|you have to)\b/i) && INVITE.test(ask), note: INVITE.test(ask) ? 'refusable invitation' : 'no “want to / would you …” invitation' },
    S4: { ok: shared.length > 0, note: shared.length ? `uses: ${shared.join(', ')}` : 'none of the reported words appear in both texts' },
    S5: { ok: !hit(INTERROGATE), note: hit(INTERROGATE) ? `interrogates: “${hit(INTERROGATE)}”` : 'no interrogation pattern' },
    R3: { ok: !hit(ADVICE_JUDGE), note: hit(ADVICE_JUDGE) ? `advice/judgement: “${hit(ADVICE_JUDGE)}”` : 'no advice or judgement words' },
    X3: { ok: !hit(DIAGNOSE), note: hit(DIAGNOSE) ? `label: “${hit(DIAGNOSE)}”` : 'no diagnostic words' },
    X5: { ok: !hit(ANALYSIS), note: hit(ANALYSIS) ? `analysis word: “${hit(ANALYSIS)}”` : 'no analysis words' },
  }
}

export const allOk = (c: Checks) => Object.values(c).every((x) => x.ok)
