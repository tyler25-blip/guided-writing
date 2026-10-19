// Shared types + journal→monitor sync. Same computer: BroadcastChannel between two windows.
// ponytail: BroadcastChannel only reaches windows of the same browser; swap send/listen for a WebSocket relay when testing on two computers.

export type Item = { id: string; kind: 'entry' | 'reply'; text: string; at: string }
export type Ev = { t: string; type: string; detail?: string; data?: Record<string, unknown> }
export type Mode = 'intro' | 'writing' | 'closed'
// Visits are only counted (not logged as events); `visited` keeps which entries the dot passed under.
export type Session = { started: string; mode: Mode; items: Item[]; events: Ev[]; visits?: number; visited?: string[] }
export type Snapshot = { session: Session; draft: string; status: string; params: Record<string, unknown>; at: number }

type Msg = { kind: 'snapshot'; snap: Snapshot } | { kind: 'hello' }

const ch = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('guided-writing')

export const send = (msg: Msg) => ch?.postMessage(msg)
export const listen = (cb: (msg: Msg) => void) => {
  const h = (e: MessageEvent<Msg>) => cb(e.data)
  ch?.addEventListener('message', h)
  return () => ch?.removeEventListener('message', h)
}
