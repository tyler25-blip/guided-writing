# Thought Map: dark mode, road map, explanation panel — design

Date: 2026-11-15 · Branch: `feat/dark-road-panel` · Scope: `/map` only (opening, chat, map, summary).
`/map/admin`, `/` (journal) and `/monitor` are not touched.

Design source: the "Thought Map 夜色版" design note (Figma page "Dark mode", frame "Dark · Road map" is the reference)
and the screenshots given in the session (dark composer, road map with cream cards, right-side "Demo explanation only" panel).

## Decisions

| Question | Decision |
| --- | --- |
| Light mode | Removed from `/map`. Dark only, no toggle, no `prefers-color-scheme` switch. |
| Accent colour | Cream `#FDF6E9` (not the orange in the design note) for primary buttons, the send button and focus rings. |
| Next step card | Stays orange-brown (as in the reference). |
| Explanation panel | Only in demo mode with explanations on (`/map?demo`, Demo menu → Explanations). Visible in chat **and** map phases. Shows the current step only. Replaces the popup. |
| Road | Static gradient road, plus two motions: unconfirmed lines flow, and the Summary walk. No particles. |
| After the cut | One road: it leaves the ring at the cut the person chose, passes the kind they chose first (DE or Next step), then the other kind, then leaves the canvas. |

## 1. Dark theme

Replace the token values on `.tm` in `src/map/map.css` (and any hard-coded light colours in the `/map` styles):

| Role | Value |
| --- | --- |
| Canvas / page background | `#120F0D` |
| Raised surfaces (composer, panes, dialogs, menus) | `#1B1714` |
| Lines / borders | `#3A342F` |
| Text | `#F3F0EB` |
| Muted text | `#B3ADA6` |
| A / B / C cards ("thought" cards) | background `#FDF6E9`, text `#0A0908`, tag outline `#463F39` |
| DE cards (Another way) | background `#1F3A57`, border/tag `#6FA8DA`, text `#F3F0EB` |
| Next step card | background `#4D2A14`, border/tag `#F5782E`, text `#F3F0EB` |
| Accent (primary buttons, send, focus ring) | `#FDF6E9` with `#0A0908` icon/text |
| Road | dim `#3A332E` → bright `#D8D1C6` |

- The card SVG shapes in `src/map/cards/` must take the new colours (recolour the files or drive them from CSS).
- Composer as in the screenshot: dark pill (`#1B1714`-ish), mic as a dark round button, send as a cream round button
  with a dark arrow; placeholder "Write what's on your mind…". No "+" button (it would do nothing).
- Conversation pane toggle ("Conversation") styled like the screenshot (quiet and active states).
- All dialogs (name-the-feeling, add a step, API key, crisis card, summary sheet, demo menu, dev panel) dark.
- Shadows: on a dark ground, replace the black-alpha shadows with subtle lighter borders or deeper black shadows so
  surfaces still separate.

### Buttons are slimmer

All `/map` buttons get less horizontal and vertical padding (currently `5px 12px`, pill). Target about `3px 10px` for
text buttons, keep the pill radius, keep a minimum hit area of 28px height. Round icon buttons (mic, send) stay round.

## 2. Explanation panel (replaces the popup)

- New component `src/map/ExplainPanel.tsx`; `MapApp.tsx` only decides what to show.
- Fixed on the right: translucent dark box (`rgba(27,23,20,0.82)` + backdrop blur), about 360px wide, inset 16px from
  top, right and bottom, rounded 20px, with a tab at the top reading **"Demo explanation only"** (as in the screenshot).
- Top of the panel: the five labels A · B · C · DE · Next step. A label lights up once collected (same `collected`
  logic as the current `.tm-progress` legend, extended in the map phase with the kinds of the cards shown).
  Lit colours follow the cards: A/B/C cream, DE blue, Next orange. Unlit: muted outline.
- Below: the current step's explanation, the same `Why` text the popup shows today (what happened / mechanism / what the
  AI did and did not do). Chat phase: the `why` of the latest assistant message. Map phase: `walkWhy(plan, step, cards,
  hint)` for the current walk step (including the three hint levels). If there is nothing for the current step, show the
  last one.
- Removed: the click-to-open / click-to-close popup flow, its "seen" list, the dimmed background and the arrow button.
  The flow is never blocked by the explanation.
- Space: in the chat phase the chat column is laid out so it is not covered by the panel; in the map phase "fit view"
  and auto-centering treat the panel's width as unavailable.
- The Demo menu item "Explanations: on/off" toggles the panel (still remembered in `localStorage` as `tm-explain`).
- The old `.tm-progress` legend at the top of the chat/map is replaced by the panel's label bar (not shown twice).

## 3. Road map

### Look
- Every confirmed line is a road: about 28px wide, no arrowheads, butt caps, drawn under the cards (the card covers the
  road so it looks like it passes through).
- Each segment is a gradient from dim to bright in the direction of travel (SVG `linearGradient`,
  `gradientUnits="userSpaceOnUse"`, from the segment start to its end).
- Entry: a segment comes from outside the canvas (above the first "What happened" card), fading in from transparent.
- Exit: after the last card of the escape column, the road turns right and leaves the canvas, fading out to transparent.
  If the person chose "I'm not sure yet" (no cut), the road still leaves: from the ring's last card it fades out towards
  the canvas edge.
- The cut segment of the ring is drawn at 30% opacity.
- Lines that are not on the ring and not on the escape column get rounded corners instead of right angles
  (`routeOrtho` in `place.ts` / `flow.ts`), so the road never looks like a circuit board.

### Unconfirmed lines
- A line waiting for "Yes" is the same width as the road, not a thin dashed line.
- It is a static road with a softer dim → `#7A736B` gradient. (Flowing variants were tried during review and
  removed by the designer: they read as a light running rather than a calm hint.)
- On "Yes" it becomes the full gradient road.

### After the cut: one road
- The road leaves the ring at the cut the person chose.
- It runs down a column to the right of the ring through the cards of the kind they chose (DE or Next step), in the
  order the cards were made, then through the other kind, then exits right.
- Chose "see it another way" → leaves at the thought card, DE cards, then Next step (the reference image).
- Chose "do something different" → leaves at the action card (e.g. "I just haven't texted anyone all week"), Next step,
  then DE cards.
- Layout (`flow.ts`) places the escape column accordingly; the fan of separate lines from one card to every DE card is
  replaced by the single chain (data edges may stay; the chain is what is laid out and drawn).
- Self-checks (`flow.check.ts`, `walk.check.ts`) cover both orders.

### The ring keeps its shape
- Today, dragging a card that sits on the ring distorts the circle (arcs follow the moved card).
- After the change the ring stays a circle: dragging a ring card moves it along the ring (constrained to the circle);
  the arcs are always computed from the ring's centre and radius. Dragging a card that is not on the ring is unchanged.

### Summary walk
- Pressing Summary plays the walk before the summary sheet appears:
  1. The view fits the whole road (including the entry and exit) with the panel width excluded.
  2. A soft cream light starts outside the canvas, travels along the road in order (entry → each card in the order made →
     around the ring to the cut → down the escape column → out of the canvas), about 4–6 s in total.
  3. Each card lights up briefly as the light passes it.
  4. When the light has left the canvas, the summary sheet appears.
- One click or key press skips straight to the summary.
- `prefers-reduced-motion`: no walk, the summary appears directly.
- Implementation: one SVG path for the whole route; position with `getPointAtLength` in `requestAnimationFrame`.
  No new packages.

## Out of scope
Particles, the halftone dot cloud, the confirm-gathers-into-road and cut-scatters motions, a light mode, the admin and
journal pages, any "+" composer feature.

## Plan (two parts, in order, on this branch)

**Part 1 — theme, buttons, panel.** Tokens and hard-coded colours in `map.css` (and `/map` parts of `index.css` if
any), card SVG colours, composer and pane toggle, dialogs, slimmer buttons, `ExplainPanel.tsx`, removal of the popup
flow, layout space for the panel. Commit.

**Part 2 — road.** Road rendering (gradient segments, entry, exit, cut at 30%, rounded non-ring routes), flowing
unconfirmed lines, the one-road escape column in `flow.ts` with checks, ring keeps its shape while dragging, Summary walk.
Commit.

## Acceptance
- `npm run build` (tsc + vite) and `npm run lint` pass.
- All self-checks pass: `node src/map/mapchecks.check.ts`, `graph.check.ts`, `place.check.ts`, `demo.check.ts`,
  `walk.check.ts`, `flow.check.ts`, and the others in `src/` that already exist.
- Walking `/map?demo` from the first message to the summary in a browser:
  - every screen is dark, buttons are slimmer, accent is cream, Next step card orange-brown;
  - the panel is always on the right, its labels light up as collected, its text changes with each reply and map step,
    and no popup ever blocks the flow;
  - unconfirmed lines are full-width and flowing; confirmed ones are gradient roads; the cut is at 30%;
  - the road enters from outside, leaves the ring at the cut, runs through the chosen kind then the other, and exits;
  - dragging a ring card keeps the circle;
  - Summary plays the light walk from outside to outside, then shows the sheet; a click skips it.
