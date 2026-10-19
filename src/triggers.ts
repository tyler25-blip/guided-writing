// M1 trigger detection (English, rule-based). In M3 the AI makes the final call; these only flag candidates.

const FIRST_PERSON = /\b(i|i'm|im|i've|me|my|myself)\b/i
// Immersed "why" / overgeneralising self-judgement (Watkins: abstract, evaluative processing).
const WHY_LOOP = /\b(why (am|do|does|did|can't|cant|is|can) (i|this|it|everything)|always|never|every ?time|what'?s wrong with me|my fault|so stupid|useless|i ruin)\b/i
// Crisis words skip the AI entirely and show the referral card (rule X6).
const CRISIS = /\b(kill myself|suicid\w*|end (it all|my life)|self[- ]?harm|hurt myself|don'?t want to (live|be here)|want to die)\b/i

export const isWhyLoop = (s: string) => FIRST_PERSON.test(s) && WHY_LOOP.test(s)
export const isCrisis = (s: string) => CRISIS.test(s)
