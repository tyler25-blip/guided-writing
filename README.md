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
  - Every entry outside the min gap goes to `claude-sonnet-5-5` (effort low; roughly a cent per judgement), which returns the plan's JSON (`thought_complete`, `user_state`, `decision`, `reason`, `rules_used`, `comment`, `user_words_used`, `tone_self_check`, `confidence`). A why-loop holds the line at once; otherwise the dot only moves if the AI speaks. Pausing mid-draft (≥ 20 chars) also asks the AI.
  - The server shows a comment only if the AI wants to speak, the thought is complete, and every program check passes: S1–S5, R3, X3, X5. One failed check → one rewrite with the failures as feedback → still failing = silence. No answer within *hold timeout* (10 s) → the dot retracts. Any error → silence.
  - Monitor cards show the AI fields, each check (and where the AI's self-check disagreed), rewrites, latency.
  - Self-check: `node src/checks.check.ts`
  - Not yet: WebSocket relay for two computers (with M6 pilot).
- [x] **M4 · Condition switches + manual override + your labels** — `src/Monitor.tsx`, `src/sync.ts`
  - Monitor → journal commands over the same channel; the journal writes everything into its session, so it all lands in one export.
  - **Condition** (monitor top bar or journal Controls): *AI margin notes* · *Rules only* (why-rule + fixed reply) · *Dot only* (control, never speaks). Each switch is logged; each decision records its condition.
  - **Override** (monitor side): *Say this now* shows your own text as a margin note (Wizard-of-Oz); *Ask AI now* judges the latest entry ignoring the min gap. Both logged as `override`; the card shows “· overridden”.
  - **New session** (monitor top bar, or journal Controls): downloads the current session JSON if anything was written, then starts fresh.
  - **Your labels** on every decision card: click cycles – → ✓ → ✗. *timing* always; *S2 S5 X1 X2 X4* once something was said (the checks a program can't do). Plus a free note (Enter to save). Stats show timing agreement.
- [x] **Saved sessions** — `src/saved/`
  - Open from the journal Controls (**Open saved**) or the monitor top bar (**open saved…**). The current session is downloaded first if anything was written.
  - Each saved session is a small config (`src/saved/what-if-night.ts`): the entries, what the AI judged, and your labels. Program checks and the 3-minute gap run for real when it loads.
  - **What-if night (dry run)**: one evening of worry after a broken condom, to rehearse the rules.
  - Journal Controls → **Open exported JSON** reopens any session you exported.
  - Self-check: `node src/saved/saved.check.ts`
- [ ] M5 · Replay + export
- [ ] M6 · Pilot

The API key must never live in the front end or in git — it lives only in `.env`, read by `server/index.ts`.

## Thought map v2 (ABCDE)

`/map` is rebuilt around one mechanism: in the chat, separate what happened (A), what the person told themselves (B) and what they felt (C), let them name the feeling, then invite them to see it another way (D/E). Spec: `thoughtmap_spec_v2.md`.

- **Chat** is one full-width screen. Replies reflect the latest message in the person's words; a feeling gets two different word options as chips (plus "+ my own word"); the AI never names the feeling, never says why. Then "Want to see it as a map?" → *Lay it out for me* (AI draws dashed lines, loops allowed) or *I'll arrange it myself* (piles by kind).
- **Map** is two panes: a read-only conversation (shut by default; click a card to open it at the source message, kept words in ink, trimmed words faded) and the canvas. Cards are delete-only trims of the person's words (`trimmed()` in `mapchecks.ts`); no AI cards, no line labels. Gap hints, the "another way to see it" guide for a new thought card, loop → "When ___, I will ___", and a summary built by the program from the person's own cards (`summaryOf()` in `place.ts`).
- Storage key is now `thought-map-v2`. Old maps are not migrated.
- Demo without a key: open `/map?demo` (any build, including the GitHub Pages one). The page never calls the AI there and never asks for a key; a script answers. The dev panel has the same story as jump buttons.
- Try it without a key: `npx vite` and open `/map` (the stubs in `MapApp.tsx` answer: turn 1 asks how it feels, turn 2 offers `dread`/`overwhelmed`, a naming asks "doesn't quite fit", the next turn proposes). The dev panel (bottom-right) can load a sample, spread the chat as piles or connected, make a loop, and open the summary.
- Self-checks: `node src/map/mapchecks.check.ts`, `node src/map/graph.check.ts`, `node src/map/place.check.ts`, `node src/map/demo.check.ts`.

### Demo walkthrough (`/map?demo`)

The box is pre-filled with the next line of the story (editable); send it and the scripted reply follows after a short typing delay. Anything else you write gets the program stubs.

1. "Um, so I have a presentation on Thursday…" → the reply separates what's coming up from the thought that keeps returning (reflection in the person's words).
2. "I keep thinking I'm going to totally mess it up…" → the thought is reflected; the one question asks how it feels (what/how, never why).
3. "I feel like I'm just not good enough…" → a feeling-shaped thought, asked about once: is it something you tell yourself or a feeling?
4. "I guess it's more what I tell myself. What I feel is my chest getting really tight." → two different words (dread / overwhelmed) as chips; multi-select, "+ my own word", "That's it" makes the naming pill and the AI answers without typed text.
5. "Then I lie awake half the night, and I'll be too tired to present well." → a new thing that happened (the loop's second lap) and a new thought.
6. "Honestly I'm kind of scared. I'm going to screw this up." → a second naming (afraid / ashamed); naming here skips step 7, then the invitation to see it another way.
7. "I don't know what to call it." (only if the feeling was not named) → skipping a name is fine; the same invitation follows.
8. "Well, maybe last time I prepared properly, it actually went okay." → the person's evidence against the thought (a D card). The AI only invites: "When you say “totally mess it up”, what would that actually look like?" (logic).
9. "Probably I'd stumble on a slide or two, but that's not the whole thing falling apart." → the person's own logic check (a second D/E card). The AI invites a new belief: "If a friend had this thought…, what would you want them to tell themselves?"
10. "That I can be nervous and still get through it." → the person's new belief (a third D/E card, the E). The AI proposes the map. "Talk a bit more" brings the script's "Of course…" and the offer returns after the next message; "Yes" leads to the arrangement choice.
11. **I'll arrange it myself** → piles on the right (What happened, What I told myself, What I felt, Another way to see it); drag cards out one by one, the pile re-tidies. Unnamed feeling cards show "+ name it"; a feeling nothing leads into gets "What happened before this?".
12. **Lay it out for me** → layered top to bottom, every line horizontal and vertical runs only, no crossing lines, the loop closes as an arc outside the layout; dashed AI lines can be kept or removed. Select a card and press the eye to open the conversation at its source with the trimmed words faded. Double-click a card to edit it. The kind label opens a menu to change the kind. Hold B1 or B4 and the other lights up with "Drop here to stack"; drop it there for ×2 (dropping on any other card just moves it). Lines are rerouted while you move a card.
13. The loop chip explains the circle; clicking a line in the loop opens "When ___ / I will ___" and puts a Next step card at a free spot. Double-click empty canvas to add a card: a thought-shaped card opens the "another way to see it" guide. Drag a dot between an A and a C card to see "What did you tell yourself in between?".
14. "That's enough for now" asks for one small next step if there is none, then shows the summary built from the person's own cards; closing it pins a small summary card.
15. Pan (drag the empty canvas or two-finger scroll), zoom (pinch, ⌘/Ctrl + scroll, − / + / Fit), all at the bottom right.
