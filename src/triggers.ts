// M1 trigger detection (English, rule-based). In M3 the AI makes the final call; these only flag candidates.

const FIRST_PERSON = /\b(i|i'm|im|i've|me|my|myself)\b/i
// Immersed "why" / overgeneralising self-judgement (Watkins: abstract, evaluative processing).
const WHY_LOOP = /\b(why (am|do|does|did|can't|cant|is|can) (i|this|it|everything)|always|never|every ?time|what'?s wrong with me|my fault|so stupid|useless|i ruin)\b/i
// Crisis words skip the AI entirely and show the referral card (rule X6). Includes indirect hopelessness / burdensomeness.
// ponytail: word list only; the chat AI also flags indirect risk (server/map.ts). A real study needs a reviewed list.
const CRISIS =
  /\b(kill(ing)? myself|suicid\w*|end (it all|my life|things)|self[- ]?harm|hurt(ing)? myself|cut(ting)? myself|don'?t want to (live|be here|exist|wake up)|want(ed)? to die|wish i (was|were) dead|(better|fine) off without me|no (point|reason) (in )?(living|going on|to live)|can'?t go on|(i'?m|i am) a burden|(didn'?t|not|never|don'?t) wake up|disappear forever|umbringen|selbstmord|suizid|nicht mehr leben|sterben will|ohne mich besser)\b/i
const CRISIS_ZH = /想死|自殺|自杀|不想活|活不下去|輕生|结束生命|結束生命|傷害自己|伤害自己|割腕|沒有我.{0,4}(更好|比較好)|消失就好|是個負擔|是负担/

export const isWhyLoop = (s: string) => FIRST_PERSON.test(s) && WHY_LOOP.test(s)
export const isCrisis = (s: string) => CRISIS.test(s.replace(/’/g, "'")) || CRISIS_ZH.test(s)
