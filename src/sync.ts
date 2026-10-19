// Shared types + journal→monitor sync. Same computer: BroadcastChannel between two windows.
// ponytail: BroadcastChannel only reaches windows of the same browser; swap send/listen for a WebSocket relay when testing on two computers.

export type Item = { id: string; kind: 'entry' | 'reply'; text: string; at: string }
export type Ev = { t: string; type: string; detail?: string; data?: Record<string, unknown> }
export type Mode = 'intro' | 'writing' | 'closed'
// Visits are only counted (not logged as events); `visited` keeps which entries the dot passed under.
// M4 · Your manual labels per decision (key = entryId, or the event time for pause judgements). undefined = not labelled yet.
export type Label = Partial<Record<'S2' | 'S5' | 'X1' | 'X2' | 'X4' | 'timing', boolean>> & { note?: string }
export type Condition = 'ai' | 'rules' | 'none'
export const CONDITIONS: [Condition, string][] = [
  ['ai', 'AI margin notes'],
  ['rules', 'Rules only (fixed reply)'],
  ['none', 'Dot only (no replies)'],
]
// title/note are set on saved sessions (e.g. dry runs) so they are recognisable when reopened.
export type Session = { started: string; mode: Mode; items: Item[]; events: Ev[]; visits?: number; visited?: string[]; labels?: Record<string, Label>; title?: string; note?: string }
export type Snapshot = { session: Session; draft: string; status: string; params: Record<string, unknown>; at: number }

// Monitor → journal commands. The journal owns the session, so labels and overrides land in its log and export.
export type Cmd =
  | { cmd: 'condition'; value: Condition }
  | { cmd: 'say'; text: string } // Wizard-of-Oz: show exactly this text now
  | { cmd: 'ask_ai' } // ask the AI about the latest entry now, ignoring the min gap
  | { cmd: 'label'; key: string; label: Label }
  | { cmd: 'new_session' } // journal downloads the old session JSON, then starts fresh
  | { cmd: 'open_saved'; key: string } // load a saved session from src/saved (old one downloaded first)
type Msg = { kind: 'snapshot'; snap: Snapshot } | { kind: 'hello' } | ({ kind: 'cmd' } & Cmd)

const ch = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('guided-writing')

export const send = (msg: Msg) => ch?.postMessage(msg)
export const command = (c: Cmd) => send({ kind: 'cmd', ...c })
export const listen = (cb: (msg: Msg) => void) => {
  const h = (e: MessageEvent<Msg>) => cb(e.data)
  ch?.addEventListener('message', h)
  return () => ch?.removeEventListener('message', h)
}
