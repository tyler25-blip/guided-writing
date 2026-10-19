// Dry run · "What-if night": one evening of worry after a broken condom (adapted from a friend's experience, name changed).
// Hand-written to rehearse the rules; the program checks run for real when it loads.
import type { SavedConfig } from './index.ts'

const silent = (user_state: 'none' | 'distanced_meaning' | 'repeating', reason: string, confidence: number, thought_complete = true) => ({
  thought_complete, user_state, decision: 'silent' as const, reason, rules_used: thought_complete ? ['R1', 'C3'] : ['R1', 'T2'], user_words_used: [],
  tone_self_check: { S1: true, S2: true, S3: true, S4: true, S5: true }, confidence, drafts: [] as string[],
})
const allTrue = { S1: true, S2: true, S3: true, S4: true, S5: true }

const config: SavedConfig = {
  title: 'What-if night (dry run)',
  note: '改寫自朋友的經驗：保險套破掉後，一整晚反覆確認「到底有多危險」。用來預演規則，不是真的 AI 輸出。',
  name: 'Sara',
  start: '2026-10-19T21:00:00+02:00',
  minGap: 180,
  visited: [0, 3, 6],
  steps: [
    { kind: 'entry', at: '21:02', text: "Last night the condom broke with J. We stopped right away, but I can't stop thinking about it.",
      ai: silent('none', 'First time she names it; she is describing what happened, not looping.', 0.72),
      label: { timing: true, note: '第一次說出來，在敘述，不打擾是對的。' } },
    { kind: 'entry', at: '21:06', text: "What if I'm pregnant. What are the chances, really? I keep doing the math in my head.",
      ai: { thought_complete: true, user_state: 'immersed_why', decision: 'speak', reason: 'Finished thought; she keeps calculating odds. Invite distance by retelling it as Sara.', rules_used: ['R1', 'R2', 'C1', 'S1', 'S2', 'S3', 'S4', 'S5'],
        user_words_used: ['doing the math'], tone_self_check: allTrue, confidence: 0.62,
        drafts: ["Doing the math over and over sounds exhausting. Would you like to write what happened last night, step by step, as Sara's story?"] },
      label: { timing: false, S2: true, S5: true, note: '規則全過但方向錯：她在擔心未來（萬一），不是問為什麼；邀請寫故事像在轉移話題。信心 62%，照 T4 應該沉默。→ 缺口：少了 worry_loop 狀態。' } },
    { kind: 'entry', at: '21:10', why: true, text: 'I googled it again. One site says 3%, another says 20%. Why do I keep doing this?',
      ai: { thought_complete: true, user_state: 'repeating', decision: 'speak', reason: 'Third pass at the same worry plus a first-person why; offer one small next step.', rules_used: ['R1', 'C4', 'S1', 'S2', 'S3', 'S4', 'S5'],
        user_words_used: ['googled'], tone_self_check: allTrue, confidence: 0.84,
        drafts: [
          "You're caught in a rumination loop. The real chance from one broken condom is low, so try to stop googling.",
          'Googling it again and getting two different numbers sounds draining. Would you like to name one small thing you could do about it tomorrow?',
        ] },
      label: { timing: true, S2: true, S5: true, X1: true, X2: true, note: '第一版就是朋友討厭的那種 AI：說出她的狀態、叫她停，被 X5 / S3 擋下。重寫後改成 C4：明天能做的一件小事。' } },
    { kind: 'entry', at: '21:14', text: "Okay. One thing: tomorrow at 8 I go to the pharmacy and ask about the morning-after pill. It's still within the time window.",
      ai: silent('distanced_meaning', 'She made her own concrete plan. Do not interrupt.', 0.91),
      label: { timing: true, note: '具體的計畫是她自己寫出來的，AI 沒有給醫療建議。' } },
    { kind: 'entry', at: '21:19', text: "But what if it's already too late. What are the odds. I need someone to just tell me it's fine.",
      ai: { thought_complete: true, user_state: 'repeating', decision: 'speak', reason: 'Reassurance seeking. Do not give odds; point the question to the pharmacist she already plans to see.', rules_used: ['R1', 'R3', 'C4', 'S1', 'S2', 'S3', 'S4', 'S5'],
        user_words_used: ["it's fine"], tone_self_check: allTrue, confidence: 0.78,
        drafts: ['Needing someone to tell you it\'s fine makes sense tonight. Want to leave the question here, next to "8:00 pharmacy", for someone there to answer?'] },
      label: { timing: true, S2: true, S5: true, X1: true, X2: true, note: '沒給機率、把問題交給藥師，很好；但規則裡沒有任何一條要求這樣做。→ 缺口：反覆確認不給機率（Salkovskis 1985; Rachman 2002）、有時效的問題指向真人（提案 X7）。13 分鐘內第 3 則，可能太密。' } },
    { kind: 'pause', at: '21:24', text: "I haven't told J that I'm",
      ai: silent('none', 'Draft stops mid-sentence; she is still finding the words.', 0.95, false),
      label: { timing: true, note: '寫到一半，不打擾。' } },
    { kind: 'entry', at: '21:31', text: "I told J. He said he'll come with me tomorrow. I feel a bit less alone.",
      ai: silent('distanced_meaning', 'She found a person to lean on; this moment is hers.', 0.93),
      label: { timing: true, note: '找到真人陪伴，是最好的結果。' } },
  ],
}

export default config
