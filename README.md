# Guided Writing — prototype

A journaling companion that stays silent while you write and speaks only when you start to ruminate.
Plans live in `plans/` (research plan + prototype v1 plan, PDF).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Milestones

- [x] **M0 · Ink dot playground** — `src/App.tsx`
  - Look: blurred glow (night palette, 80% opacity) + grain + three organic threads that wobble and tumble around each other.
  - Companion: breathes beside the page; every *N* s the dot stretches into a line under the latest paragraph, gathers back into a dot at the end, and returns (skipped while you typed in the last 3 s).
  - Active: moves to the line below your text right away to hold the spot, waits for the (simulated) AI, then spreads into a band of light and the reply fades in. "Stay silent" retracts instead.
  - Sliders tune every parameter; values persist in localStorage. **Copy params JSON** to keep the tuned values for M1.
  - Palette follows the time of day only (never the writer's mood). Reduced-motion is respected.
- [x] **M1 · Journal page + break/trigger detection (no AI)** — `src/App.tsx`, `src/ink.tsx`, `src/triggers.ts`
  - Chat-window-style card, still a diary: date header, timestamped entries, composer at the bottom (Enter adds, Shift+Enter new line).
  - Intro: the ink dot sits large in the centre with a greeting; first keystroke sends it to the side, small.
  - Evening palette only. Collapsible **Controls** (bottom-left): manual visit/activate, writer name, mock replies, parameters, event log, export JSON.
  - Triggers (English, rules): immersed "why"-loop on commit → reply (mock), throttled by *min gap*; pause candidate after *N* s idle (logged; the AI decides in M3); crisis words → referral card, never sent to the AI.
  - Dot actions run in a queue, so a trigger arriving mid-move waits instead of being dropped.
  - Self-check: `node src/triggers.check.ts`
- [x] **M2 · Monitor + event sync** — `src/Monitor.tsx`, `src/sync.ts`
  - Open the journal at `/` and the monitor at `/monitor` (or Controls → *Open monitor*) in two windows of the **same browser**; they sync via BroadcastChannel.
  - Text mirror (live draft, triggered entries highlighted, dot-visited entries underlined), decision cards (crisis / why-loop / gap gates + outcome + reply), event rows, stats, first-person-word ratio per entry, current params, export JSON.
  - Two computers (pilot with participants): swap `send`/`listen` in `src/sync.ts` for a WebSocket relay on the small backend (M3).
- [x] **M3 · AI + rule checks** — `server/index.ts`, `src/checks.ts` (code done; needs `npm i @anthropic-ai/sdk` + a key to run live)
  - Setup once: `npm i @anthropic-ai/sdk`, then copy `.env.example` to `.env` and put your `ANTHROPIC_API_KEY` in it (`.env` is git-ignored). `npm run dev` starts the judge server (:8787) and Vite together; Vite proxies `/api`.
  - Controls → untick **Mock replies (no AI)** to use the AI. Controls shows `AI · ready / no API key / server offline`.
  - Every entry outside the min gap goes to `claude-opus-5-5` (effort low, server-side fallback on), which returns the plan's JSON (`thought_complete`, `user_state`, `decision`, `reason`, `rules_used`, `comment`, `user_words_used`, `tone_self_check`, `confidence`). A why-loop holds the line at once; otherwise the dot only moves if the AI speaks. Pausing mid-draft (≥ 20 chars) also asks the AI.
  - The server shows a comment only if the AI wants to speak, the thought is complete, and every program check passes: S1–S5, R3, X3, X5. One failed check → one rewrite with the failures as feedback → still failing = silence. No answer within *hold timeout* (10 s) → the dot retracts. Any error → silence.
  - Monitor cards show the AI fields, each check (and where the AI's self-check disagreed), rewrites, latency.
  - Self-check: `node src/checks.check.ts`
  - Not yet: WebSocket relay for two computers (with M6 pilot).
- [ ] M4 · Manual override + condition switches + your labels
- [ ] M5 · Replay + export
- [ ] M6 · Pilot

The API key must never live in the front end or in git — it lives only in `.env`, read by `server/index.ts`.
