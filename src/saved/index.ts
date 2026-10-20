// Saved sessions you can reopen from the journal Controls or the monitor (no AI calls, nothing is sent anywhere).
// Each one is a small config: what was written, what the AI judged, and your labels.
// The program checks are NOT written by hand: they run on the AI text when the session is built.
import { checkComment, type Judgement } from '../checks.ts'
import type { Ev, Item, Label, Session } from '../sync.ts'
import whatIfNight from './what-if-night.ts'

export type Step =
  | { kind: 'entry'; at: string; text: string; why?: boolean; ai: Omit<Judgement, 'comment'> & { drafts: string[] }; label?: Label }
  | { kind: 'pause'; at: string; text: string; ai: Omit<Judgement, 'comment'> & { drafts: string[] }; label?: Label }
export type SavedConfig = { title: string; note: string; name: string; start: string; minGap: number; visited?: number[]; steps: Step[] }

const AI_MS = 2400

// Turns a config into a Session the journal and monitor already understand.
export function build(cfg: SavedConfig): Session {
  const t0 = new Date(cfg.start).getTime()
  const iso = (hhmm: string, plusMs = 0) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date(t0)
    d.setHours(h, m, 0, 0)
    return new Date(d.getTime() + plusMs).toISOString()
  }
  const items: Item[] = []
  const events: Ev[] = [{ t: iso(cfg.steps[0].at, -60000), type: 'session_start', detail: `saved · ${cfg.title}` }]
  const labels: Record<string, Label> = {}
  let lastReply: number | null = null
  cfg.steps.forEach((s, i) => {
    const t = iso(s.at)
    const userText = [...items.filter((x) => x.kind === 'entry').map((x) => x.text), s.text].join(' ')
    const attempts = s.ai.drafts.map((comment) => {
      const ai: Judgement = { ...s.ai, comment }
      const speak = ai.decision === 'speak' && (s.kind !== 'pause' || ai.thought_complete) && comment.trim() !== ''
      return { ai, checks: speak ? checkComment(comment, userText, ai.user_words_used, cfg.name) : null }
    })
    if (!attempts.length) attempts.push({ ai: { ...s.ai, comment: '' }, checks: null })
    const final = attempts.at(-1)!
    const spoke = !!final.checks && Object.values(final.checks).every((c) => c.ok)
    const judgement = { kind: s.kind === 'pause' ? 'pause' : 'commit', model: 'dry run · hand-written', ms: AI_MS * attempts.length, decision: spoke ? 'speak' : 'silent', comment: spoke ? final.ai.comment : '', attempts }
    if (s.kind === 'pause') {
      events.push({ t, type: 'pause_candidate', detail: `draft: ${s.text}`, data: { draftLength: s.text.length } })
      events.push({ t: iso(s.at, AI_MS), type: 'ai_judgement', detail: s.text, data: judgement })
      if (s.label) labels[iso(s.at, AI_MS)] = s.label
      return
    }
    const entryId = `e${i}`
    items.push({ id: entryId, kind: 'entry', text: s.text, at: t })
    if (i === 0) events.push({ t, type: 'first_input' })
    events.push({ t, type: 'commit', detail: s.text, data: { entryId } })
    const sinceLast = lastReply === null ? null : Math.round((new Date(t).getTime() - lastReply) / 1000)
    const gapOk = sinceLast === null || sinceLast >= cfg.minGap
    events.push({ t, type: 'decision', detail: s.text, data: { entryId, crisis: false, why: !!s.why, sinceLast, minGap: cfg.minGap, gapOk, outcome: gapOk ? 'ai' : 'throttled', condition: 'ai' } })
    if (s.label) labels[entryId] = s.label
    if (!gapOk) return // like the real system: inside the min gap the AI is not asked at all
    events.push({ t: iso(s.at, judgement.ms), type: 'ai_judgement', detail: s.text, data: { entryId, ...judgement } })
    if (spoke) {
      const replyId = `r${i}`
      const shown = iso(s.at, judgement.ms + 2000)
      items.push({ id: replyId, kind: 'reply', text: final.ai.comment, at: shown })
      events.push({ t: iso(s.at, 300), type: 'activate', detail: s.why ? 'trigger_why' : 'ai' })
      events.push({ t: shown, type: 'reply_shown', detail: final.ai.comment, data: { replyId } })
      lastReply = new Date(shown).getTime()
    }
  })
  return { started: events[0].t, mode: 'writing', items, events, labels, visits: cfg.visited?.length ?? 0, visited: (cfg.visited ?? []).map((i) => `e${i}`), title: cfg.title, note: cfg.note }
}

export const SAVED: Record<string, SavedConfig> = { 'what-if-night': whatIfNight }
