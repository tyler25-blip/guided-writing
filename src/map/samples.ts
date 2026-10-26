// Sample sessions for the dev panel: jump to any screen without typing. English, like the UI.
// The stories are adapted from real questions on Stack Exchange (CC BY-SA 4.0). Details, roles and wording are changed:
//   1 · workplace.stackexchange.com/q/103950 (Chapz) — a coworker keeps pointing out one mistake
//   2 · academia.stackexchange.com/q/30098 (Superbest) + /q/177156 (yl125) — proposal anxiety, can't pick a topic
//   3 · workplace.stackexchange.com/q/188258 (sandy) — nothing to say at stand-up
// Everything the AI did here is real output of server/map.ts (Sonnet), replayed from the person's turns:
// the replies and their private notes, the cards (with kind, source message and why), the line labels, stack hints and loop notes.
// Only the layout is hand-made: which cards were stacked and which lines were drawn (a person's part).
import type { Log, Notes } from './MapApp.tsx'

type Src = 'you' | 'ai'
export type Sample = {
  name: string
  msgs: { role: Src; text: string; propose?: boolean; declined?: boolean; notes?: Notes }[]
  cards: { key: string; text: string; src: Src; x: number; y: number; stack?: string[]; kind?: string }[]
  edges: [from: string, to: string, label: string][]
  log: Log[]
}

export const SAMPLES: Sample[] = [
  {
    "name": "One event · the mistake that keeps coming up",
    "msgs": [
      {
        "role": "you",
        "text": "Three weeks ago a feature I built broke for users. In the next team meeting the QA lead said “this simply can’t happen”, loudly, in front of everyone."
      },
      {
        "role": "ai",
        "text": "That sounds like a sharp moment: a feature of yours breaking for real users, and then a loud, flat statement in front of the whole team at the next meeting. Three weeks on, it's clearly still with you. A line like \"this simply can't happen\" can be heard several ways, as a comment on the bug, on the process, or on the person who built it, and which one it landed as probably matters a lot. I'm curious what it stirred up in you when you heard it, and what it's been saying to you since.",
        "notes": {
          "have": {
            "event": true,
            "feeling": false,
            "thought": false,
            "worry": false,
            "action": false
          },
          "core": "They seem stuck on the QA lead's public remark about their broken feature, and what it might say about how others see them.",
          "stuck": "replaying",
          "help": "get how the remark landed and what they tell themselves about it",
          "ready": false
        }
      },
      {
        "role": "you",
        "text": "It’s not even the mistake. I can admit mistakes. It’s that he keeps bringing it up. Yesterday he told the guy next to me that he trusts his code without even testing it. That was aimed at me."
      },
      {
        "role": "ai",
        "text": "That distinction makes sense: owning the bug is one thing, and having it return in other people's conversations is another. The comment yesterday to the person next to you, about trusting his code without testing it, would be easy to read as a side-swipe at you, especially so soon after the meeting. You read it as aimed at you, and it sounds like the repetition is what keeps the original moment from closing. I'd like to hear more about what that feels like when it happens, and where you worry it's heading.",
        "notes": {
          "have": {
            "event": true,
            "feeling": false,
            "thought": true,
            "worry": false,
            "action": false
          },
          "core": "They can own the mistake but feel the QA lead is repeatedly singling them out, and the repeated jabs feel like a verdict on their reliability.",
          "stuck": "replaying",
          "help": "get what they feel and what they fear it means or leads to",
          "ready": false
        }
      },
      {
        "role": "you",
        "text": "Yes. And honestly it wasn’t only my fault. I asked for help and got none. Then it was handed to someone who said it was finished when it wasn’t, then a third person half-refactored it and left the project. It came back to me as a mess. But saying that out loud sounds like making excuses, so I don’t."
      },
      {
        "role": "ai",
        "text": "That adds a lot. The feature passed through several hands: you asked for help and didn't get it, someone called it finished when it wasn't, and a third person half-refactored it and left, so it landed back with you in a worse state. Yet the only version people hear is the loud one in the meeting. It makes sense that holding back the history feels like a bind, since explaining can sound like deflecting even when it's simply what happened. Staying quiet means the QA lead's remarks sit on you alone. I'm wondering how that sits with you day to day, carrying a fuller story that nobody else hears.",
        "notes": {
          "have": {
            "event": true,
            "feeling": false,
            "thought": true,
            "worry": false,
            "action": false
          },
          "core": "They feel carried alone for a failure that passed through several hands, and can't say so without it sounding like excuses, while the QA lead's repeated remarks keep it open.",
          "stuck": "replaying",
          "help": "name what they feel and fear, and whether any way of saying the history feels possible",
          "ready": false
        }
      },
      {
        "role": "you",
        "text": "Whenever we discuss a new feature and I disagree with him, he uses it against me. Now I second-guess myself before I even open my mouth. I can’t concentrate. I reread my own pull requests three times. Which makes me slower, which probably looks bad too. I’m afraid the managers will only remember this one thing."
      },
      {
        "role": "ai",
        "text": "What you've described has a clear shape now. The bug itself you can own, but the remarks keep reopening it, and you've started working around them: doubting yourself before you speak in design discussions, rereading each pull request three times, losing focus. That extra checking then slows you down, which feeds the fear that managers will remember only this one thing. It also seems the fuller history, the missing help and the handoffs, stays unspoken because saying it feels like making excuses. There's enough here to lay out in one place, so you can see how the pieces connect and which part weighs most. I can spread it out on a map whenever you like.",
        "propose": true,
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They feel pinned to one past bug by the QA lead's repeated remarks, can't tell their side without sounding defensive, and fear managers will remember only that.",
          "stuck": "replaying",
          "help": "lay out the whole picture on a map: what happened, the repeated remarks, their reaction, and the fear about managers",
          "ready": true
        },
        "declined": true
      },
      {
        "role": "you",
        "text": "Then again, it’s been over a year and I’ve never had a bug like that. Everyone else seems fine with my work. Maybe I’m blowing it up. I thought about telling the architect privately, he’s friendly. But the project is almost over and it’s a bad time for conflict. Going to the manager feels like escalating, and talking to QA directly would just make it an open war."
      },
      {
        "role": "ai",
        "text": "You've now named three ways forward, and each one comes with a cost you've already weighed: a quiet word with the architect, who's friendly but might pull someone else into it near the end of the project; going to the manager, which feels like escalating; and speaking to QA directly, which you expect would turn into open conflict. There's also the option of waiting for the project to end. Alongside that, you've given some counterweight yourself: over a year without a bug like that, and everyone else seems fine with your work. That sits next to the worry that managers will remember only this one thing, and you're holding both at once. It might help to see all of it laid out together, with the facts, the fears and these options in their own places. I can spread it out on a map now, or we can keep talking if there's more you'd like to add first.",
        "propose": true,
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They feel one bug is being kept alive by the QA lead's remarks, they are quietly bending their work around it, and every way of addressing it seems to cost them something, so they stay silent.",
          "stuck": "deciding",
          "help": "lay out the options they named with their costs, without choosing for them",
          "ready": true
        }
      }
    ],
    "cards": [
      {
        "key": "c0",
        "text": "Three weeks ago a feature I built broke for users.",
        "kind": "event",
        "src": "you",
        "x": 60,
        "y": 50
      },
      {
        "key": "c1",
        "text": "In the next team meeting the QA lead said “this simply can’t happen”, loudly, in front of everyone.",
        "kind": "event",
        "src": "you",
        "x": 360,
        "y": 50
      },
      {
        "key": "c2",
        "text": "It’s not even the mistake. I can admit mistakes. It’s that he keeps bringing it up.",
        "kind": "thought",
        "src": "you",
        "x": 660,
        "y": 50,
        "stack": [
          "Yesterday he told the guy next to me that he trusts his code without even testing it. That was aimed at me."
        ]
      },
      {
        "key": "c4",
        "text": "I asked for help and got none. Then it was handed to someone who said it was finished when it wasn’t.",
        "kind": "event",
        "src": "you",
        "x": 960,
        "y": 50
      },
      {
        "key": "c5",
        "text": "Saying that out loud sounds like making excuses, so I don’t.",
        "kind": "thought",
        "src": "you",
        "x": 120,
        "y": 280
      },
      {
        "key": "c6",
        "text": "Now I second-guess myself before I even open my mouth. I can’t concentrate.",
        "kind": "feeling",
        "src": "you",
        "x": 420,
        "y": 280
      },
      {
        "key": "c7",
        "text": "I reread my own pull requests three times. Which makes me slower, which probably looks bad too.",
        "kind": "action",
        "src": "you",
        "x": 720,
        "y": 280
      },
      {
        "key": "c8",
        "text": "I’m afraid the managers will only remember this one thing.",
        "kind": "worry",
        "src": "you",
        "x": 1020,
        "y": 280
      },
      {
        "key": "c9",
        "text": "It’s been over a year and I’ve never had a bug like that. Maybe I’m blowing it up.",
        "kind": "thought",
        "src": "you",
        "x": 60,
        "y": 510
      }
    ],
    "edges": [
      [
        "c0",
        "c1",
        "and then it got called out loudly"
      ],
      [
        "c1",
        "c2",
        "and it's how he keeps bringing it up"
      ],
      [
        "c2",
        "c6",
        "and now I second-guess everything"
      ],
      [
        "c6",
        "c7",
        "so I check everything again and again"
      ],
      [
        "c7",
        "c8",
        "and I worry how it looks"
      ],
      [
        "c8",
        "c6",
        "so I second-guess everything now"
      ],
      [
        "c4",
        "c5",
        "but saying it feels like excuses"
      ],
      [
        "c9",
        "c8",
        "but I still fear it's all they'll remember"
      ]
    ],
    "log": [
      {
        "t": "cards",
        "at": 0,
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They feel one bug is being kept alive by the QA lead's remarks, they are quietly bending their work around it, and every way of addressing it seems to cost them something, so they stay silent.",
          "stuck": "deciding",
          "help": "lay out the options they named with their costs, without choosing for them",
          "ready": true
        },
        "made": [
          {
            "text": "Three weeks ago a feature I built broke for users.",
            "kind": "event",
            "from": 1,
            "why": "This is the original incident the whole situation grows from.",
            "id": "c0"
          },
          {
            "text": "In the next team meeting the QA lead said “this simply can’t happen”, loudly, in front of everyone.",
            "kind": "event",
            "from": 1,
            "why": "This is the public moment that still sits with them.",
            "id": "c1"
          },
          {
            "text": "It’s not even the mistake. I can admit mistakes. It’s that he keeps bringing it up.",
            "kind": "thought",
            "from": 2,
            "why": "It shows the repeated remarks, not the bug, keep it alive.",
            "id": "c2"
          },
          {
            "text": "Yesterday he told the guy next to me that he trusts his code without even testing it. That was aimed at me.",
            "kind": "event",
            "from": 2,
            "why": "A recent example of the remarks that they read as aimed at them.",
            "id": "c3"
          },
          {
            "text": "I asked for help and got none. Then it was handed to someone who said it was finished when it wasn’t.",
            "kind": "event",
            "from": 3,
            "why": "It holds the fuller history that nobody else hears.",
            "id": "c4"
          },
          {
            "text": "Saying that out loud sounds like making excuses, so I don’t.",
            "kind": "thought",
            "from": 3,
            "why": "It shows why they stay silent and carry the story alone.",
            "id": "c5"
          },
          {
            "text": "Now I second-guess myself before I even open my mouth. I can’t concentrate.",
            "kind": "feeling",
            "from": 4,
            "why": "It shows how they are bending their behavior around the remarks.",
            "id": "c6"
          },
          {
            "text": "I reread my own pull requests three times. Which makes me slower, which probably looks bad too.",
            "kind": "action",
            "from": 4,
            "why": "The extra checking feeds the very worry they have.",
            "id": "c7"
          },
          {
            "text": "I’m afraid the managers will only remember this one thing.",
            "kind": "worry",
            "from": 4,
            "why": "This is the main fear driving the stakes.",
            "id": "c8"
          },
          {
            "text": "It’s been over a year and I’ve never had a bug like that. Maybe I’m blowing it up.",
            "kind": "thought",
            "from": 5,
            "why": "This is their own counterweight to the fear and sits against it.",
            "id": "c9"
          }
        ],
        "skipped": [
          {
            "text": "Everyone else seems fine with my work.",
            "why": "Covered by the counterweight card about the year without a bug."
          },
          {
            "text": "I thought about telling the architect privately, he’s friendly.",
            "why": "One of the options named; the cost is in the next items, so it is too thin alone."
          },
          {
            "text": "The project is almost over and it’s a bad time for conflict.",
            "why": "Context for the options, not a standalone thought about the core."
          },
          {
            "text": "Going to the manager feels like escalating.",
            "why": "An option with a cost, but it works better as part of the options layout."
          },
          {
            "text": "Talking to QA directly would just make it an open war.",
            "why": "An option with a cost, covered when the options are laid out."
          },
          {
            "text": "Whenever we discuss a new feature and I disagree with him, he uses it against me.",
            "why": "Largely repeats the point about the remarks being brought up again."
          }
        ]
      },
      {
        "t": "stack",
        "at": 0,
        "pairs": [
          {
            "a": "c6",
            "b": "c7"
          }
        ]
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e0",
        "from": "c0",
        "to": "c1",
        "label": "and then it got called out loudly"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e1",
        "from": "c1",
        "to": "c2",
        "label": "and it's how he keeps bringing it up"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e2",
        "from": "c2",
        "to": "c6",
        "label": "and now I second-guess everything"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e3",
        "from": "c6",
        "to": "c7",
        "label": "so I check everything again and again"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e4",
        "from": "c7",
        "to": "c8",
        "label": "and I worry how it looks"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e5",
        "from": "c8",
        "to": "c6",
        "label": "so I second-guess everything now"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e6",
        "from": "c4",
        "to": "c5",
        "label": "but saying it feels like excuses"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e7",
        "from": "c9",
        "to": "c8",
        "label": "but I still fear it's all they'll remember"
      },
      {
        "t": "loop",
        "at": 0,
        "edges": [
          "e3",
          "e4",
          "e5"
        ],
        "note": "The loop runs: second-guessing before speaking, can't concentrate → rereading each pull request three times → slower, and it probably looks bad → afraid the managers will only remember this one thing → second-guessing again. The easiest link to loosen is the moment after the second read, when they hover over the submit button and the third reread begins.",
        "breakEdge": "e3"
      }
    ]
  },
  {
    "name": "Overload · stuck on the scholarship proposal",
    "msgs": [
      {
        "role": "you",
        "text": "The scholarship proposal is due in 9 days and I’ve written one paragraph. I deleted it twice."
      },
      {
        "role": "ai",
        "text": "Nine days with one paragraph, and that paragraph deleted twice, sounds like a lot of pressure sitting on a blank page. Deleting something twice usually means there was a moment where it didn't feel right enough to keep, even though you'd already gotten words down. Sometimes that moment is about the writing itself, and sometimes it's about what the proposal is supposed to say about you or your work. I'm curious what was going through your mind right before you hit delete.",
        "notes": {
          "have": {
            "event": true,
            "feeling": false,
            "thought": false,
            "worry": false,
            "action": true
          },
          "core": "They can't get a scholarship proposal going and may be stuck on whether what they write is good enough, so each attempt gets erased.",
          "stuck": "starting",
          "help": "learn what happens in the moment they delete, and what they fear the proposal will say about them",
          "ready": false
        }
      },
      {
        "role": "you",
        "text": "Every time I open the doc I think my project isn’t that interesting. The other applicants will have real research. Mine is a small idea I’m dressing up. So I tell myself I’ll wait until I’m in the right headspace. I know that’s nonsense."
      },
      {
        "role": "ai",
        "text": "That loop makes sense when you lay it out: you open the doc, the thought that your idea is small shows up, and waiting for a better headspace becomes the way out of that moment. Notice that the verdict on your project arrives before you've written enough to see what it really is. A single paragraph deleted twice isn't much to judge it by, and you also can't see the other applicants' work, only your imagined version of it. I'd like to hear the idea itself, in plain words, the way you'd describe it to a friend, whenever you feel like sharing it.",
        "notes": {
          "have": {
            "event": true,
            "feeling": false,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They're stuck starting because they believe their project is too small next to other applicants, so waiting for the right headspace protects them from writing something they'd have to judge.",
          "stuck": "starting",
          "help": "separate the judgment of the project from the act of drafting; get what the project actually is",
          "ready": false
        }
      },
      {
        "role": "you",
        "text": "Last time the “inspiration” showed up at 3am the night before. I made it, barely. And the result was actually fine. That’s the annoying part, it could have been good if I’d started earlier. This time I asked my advisor for an early internal deadline to trick myself. Then she said I could take an extra week, and the dread came right back."
      },
      {
        "role": "ai",
        "text": "That detail about the extra week says a lot. You built an early deadline to give yourself some structure, and when the advisor offered more time, the dread came right back, as if the pressure had been what made starting bearable. It also sounds like last time left you with a particular sting: it worked out fine, but you can see what an earlier start might have made possible. You've now given me the pieces: the small-idea thought, the waiting, the 3am rescue, and the deadline you tried to set. It might help to lay them out side by side on a map, so you can see how they connect and where there's room to move.",
        "propose": true,
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They fear their idea is too small, and they use waiting as relief, which keeps repeating the last-minute pattern; the advisor's extra week removed the structure they tried to build.",
          "stuck": "starting",
          "help": "offer a map of the pattern and what to try next",
          "ready": true
        },
        "declined": true
      },
      {
        "role": "you",
        "text": "Also there’s the methods seminar. I can’t follow the papers she assigns. After two pages my mind drifts and I skip ahead, which makes it worse. And I’m supposed to narrow my topic for the midterm project and link it to the proposal. I can’t pick. Every option feels like the wrong one."
      },
      {
        "role": "ai",
        "text": "So the seminar adds another layer: papers that lose you after two pages, skipping ahead, and then a topic to narrow down that has to connect to the proposal. That means the choice you can't make is tied to the same project you already doubt, so every option may carry the question of whether it's interesting enough. When you skip ahead in a paper, you also lose the thread that would help you see what's worth building on, which can make the choosing feel even more blind. When you picture picking the wrong topic, what do you imagine happening?",
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They fear their idea isn't good enough, so starting and choosing feel risky, and they lean on deadline pressure to get past it.",
          "stuck": "starting",
          "help": "see how the seminar reading, topic choice and proposal connect, and what they fear a wrong choice says about them",
          "ready": false
        }
      },
      {
        "role": "you",
        "text": "What will she think of me if I can’t even choose a topic. I feel panicked and useless at the same time. My friend says just write garbage and fix it later. I tried. I wrote an outline and then couldn’t make myself open it again."
      },
      {
        "role": "ai",
        "text": "That adds the piece underneath the others: the worry isn't only about the topic, it's about what your advisor will make of you if you can't choose. Panicked and useless at the same time is a heavy mix to carry into a blank doc. And the outline tells me something too. You did start, which is what your friend suggested, and then opening it again felt like facing a verdict. You now have the small-idea thought, the waiting, the 3am rescue, the seminar, the topic choice, and the fear of her opinion. I think it's a good moment to spread all of it out on a map, so you can see how these connect and where there might be room to move.",
        "propose": true,
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They fear that a small, uncertain idea will show them to their advisor as inadequate, so starting and choosing both feel like exposure, and they avoid reopening anything they've made.",
          "stuck": "starting",
          "help": "lay out the pieces on a map to see how fear of judgment links the proposal, the topic choice and the avoidance",
          "ready": true
        }
      }
    ],
    "cards": [
      {
        "key": "c0",
        "text": "The scholarship proposal is due in 9 days and I've written one paragraph. I deleted it twice.",
        "kind": "event",
        "src": "you",
        "x": 60,
        "y": 50
      },
      {
        "key": "c1",
        "text": "Every time I open the doc I think my project isn't that interesting.",
        "kind": "thought",
        "src": "you",
        "x": 360,
        "y": 50,
        "stack": [
          "Mine is a small idea I'm dressing up."
        ]
      },
      {
        "key": "c3",
        "text": "I tell myself I'll wait until I'm in the right headspace.",
        "kind": "action",
        "src": "you",
        "x": 660,
        "y": 50
      },
      {
        "key": "c4",
        "text": "That's the annoying part, it could have been good if I'd started earlier.",
        "kind": "feeling",
        "src": "you",
        "x": 960,
        "y": 50
      },
      {
        "key": "c5",
        "text": "I asked my advisor for an early internal deadline to trick myself.",
        "kind": "action",
        "src": "you",
        "x": 120,
        "y": 280
      },
      {
        "key": "c6",
        "text": "Then she said I could take an extra week, and the dread came right back.",
        "kind": "event",
        "src": "you",
        "x": 420,
        "y": 280
      },
      {
        "key": "c7",
        "text": "I'm supposed to narrow my topic for the midterm project and link it to the proposal. I can't pick.",
        "kind": "event",
        "src": "you",
        "x": 720,
        "y": 280
      },
      {
        "key": "c8",
        "text": "What will she think of me if I can't even choose a topic.",
        "kind": "worry",
        "src": "you",
        "x": 1020,
        "y": 280
      },
      {
        "key": "c9",
        "text": "I wrote an outline and then couldn't make myself open it again.",
        "kind": "action",
        "src": "you",
        "x": 60,
        "y": 510
      }
    ],
    "edges": [
      [
        "c0",
        "c1",
        ""
      ],
      [
        "c1",
        "c3",
        "so I wait for a better headspace"
      ],
      [
        "c3",
        "c9",
        "and then I avoid it"
      ],
      [
        "c9",
        "c1",
        "and the doubt hits when I open it"
      ],
      [
        "c5",
        "c6",
        "but she offered more time instead"
      ],
      [
        "c6",
        "c1",
        "and the dread makes the doubt louder"
      ],
      [
        "c7",
        "c8",
        "and I worry what she'll think"
      ],
      [
        "c8",
        "c7",
        "so I freeze up and can't pick"
      ]
    ],
    "log": [
      {
        "t": "cards",
        "at": 0,
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They fear that a small, uncertain idea will show them to their advisor as inadequate, so starting and choosing both feel like exposure, and they avoid reopening anything they've made.",
          "stuck": "starting",
          "help": "lay out the pieces on a map to see how fear of judgment links the proposal, the topic choice and the avoidance",
          "ready": true
        },
        "made": [
          {
            "text": "The scholarship proposal is due in 9 days and I've written one paragraph. I deleted it twice.",
            "kind": "event",
            "from": 1,
            "why": "Shows where they are stuck: starting, and removing what they did write.",
            "id": "c0"
          },
          {
            "text": "Every time I open the doc I think my project isn't that interesting.",
            "kind": "thought",
            "from": 2,
            "why": "Names the doubt about the idea that meets them at the start.",
            "id": "c1"
          },
          {
            "text": "Mine is a small idea I'm dressing up.",
            "kind": "thought",
            "from": 2,
            "why": "Shows they see their idea as something to hide, not show.",
            "id": "c2"
          },
          {
            "text": "I tell myself I'll wait until I'm in the right headspace.",
            "kind": "action",
            "from": 2,
            "why": "Shows waiting as how they step away from the doubt.",
            "id": "c3"
          },
          {
            "text": "That's the annoying part, it could have been good if I'd started earlier.",
            "kind": "feeling",
            "from": 3,
            "why": "Shows the sting left from the last late start.",
            "id": "c4"
          },
          {
            "text": "I asked my advisor for an early internal deadline to trick myself.",
            "kind": "action",
            "from": 3,
            "why": "Shows an attempt to create structure to get started.",
            "id": "c5"
          },
          {
            "text": "Then she said I could take an extra week, and the dread came right back.",
            "kind": "event",
            "from": 3,
            "why": "Shows more time brought the dread back, not relief.",
            "id": "c6"
          },
          {
            "text": "I'm supposed to narrow my topic for the midterm project and link it to the proposal. I can't pick.",
            "kind": "event",
            "from": 4,
            "why": "Ties the topic choice to the same doubted project.",
            "id": "c7"
          },
          {
            "text": "What will she think of me if I can't even choose a topic.",
            "kind": "worry",
            "from": 5,
            "why": "Names the fear of the advisor's judgment under the choosing.",
            "id": "c8"
          },
          {
            "text": "I wrote an outline and then couldn't make myself open it again.",
            "kind": "action",
            "from": 5,
            "why": "Shows they avoid reopening anything they have made.",
            "id": "c9"
          }
        ],
        "skipped": [
          {
            "text": "I know that's nonsense.",
            "why": "Brief self-comment; the waiting card already covers it."
          },
          {
            "text": "Last time the \"inspiration\" showed up at 3am the night before. I made it, barely.",
            "why": "Covered by the card on the sting of starting late."
          },
          {
            "text": "I can't follow the papers she assigns. After two pages my mind drifts and I skip ahead.",
            "why": "Side detail from the seminar; the topic-choice card carries the core."
          },
          {
            "text": "I feel panicked and useless at the same time.",
            "why": "Strong feeling, but the worry card shows what drives it."
          },
          {
            "text": "My friend says just write garbage and fix it later.",
            "why": "Advice from someone else; their own attempt is already a card."
          },
          {
            "text": "Every option feels like the wrong one.",
            "why": "Repeats the not-being-able-to-pick card."
          }
        ]
      },
      {
        "t": "stack",
        "at": 0,
        "pairs": [
          {
            "a": "c1",
            "b": "c2"
          }
        ]
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e0",
        "from": "c0",
        "to": "c1",
        "label": ""
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e1",
        "from": "c1",
        "to": "c3",
        "label": "so I wait for a better headspace"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e2",
        "from": "c3",
        "to": "c9",
        "label": "and then I avoid it"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e3",
        "from": "c9",
        "to": "c1",
        "label": "and the doubt hits when I open it"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e4",
        "from": "c5",
        "to": "c6",
        "label": "but she offered more time instead"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e5",
        "from": "c6",
        "to": "c1",
        "label": "and the dread makes the doubt louder"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e6",
        "from": "c7",
        "to": "c8",
        "label": "and I worry what she'll think"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e7",
        "from": "c8",
        "to": "c7",
        "label": "so I freeze up and can't pick"
      },
      {
        "t": "loop",
        "at": 0,
        "edges": [
          "e1",
          "e2",
          "e3"
        ],
        "note": "The loop runs: opening the doc → thinking the project isn't that interesting → waiting for the right headspace → not opening the outline again → opening the doc, and the doubt returns. The easiest link to loosen is the moment of opening the doc, where the thought that it isn't interesting arrives and the waiting begins.",
        "breakEdge": "e1"
      },
      {
        "t": "loop",
        "at": 0,
        "edges": [
          "e6",
          "e7"
        ],
        "note": "They keep circling: can't pick a topic → worry what she'll think of them → freezing up → can't pick a topic again. The link that looks easiest to loosen is the moment of freezing, when they sit facing the blank choice with the worry still running in the background.",
        "breakEdge": "e7"
      }
    ]
  },
  {
    "name": "Worry · nothing to say at stand-up",
    "msgs": [
      {
        "role": "you",
        "text": "Stand-up is in 40 minutes and I’ve done basically nothing today. Again."
      },
      {
        "role": "ai",
        "text": "Forty minutes is close, and that \"again\" at the end sounds like it carries more than just today. It reads as though the stand-up itself is one thing, and the sense that this keeps happening is another layer sitting on top of it. I'm curious what \"basically nothing\" looks like in practice: was the day eaten by other things, or did the work just not get started?",
        "notes": {
          "have": {
            "event": true,
            "feeling": false,
            "thought": true,
            "worry": false,
            "action": false
          },
          "core": "They are facing a stand-up soon with little to report and are telling themselves this is a repeating pattern, which seems to carry some weight.",
          "stuck": "other",
          "help": "get the concrete picture of the day and what they fear about the stand-up",
          "ready": false
        }
      },
      {
        "role": "you",
        "text": "I’m four months into my first engineering job. I came from a literature degree and a three-month bootcamp. There just aren’t many tickets for me. By Wednesday I’ve finished what I had and there’s nothing left to say. Everyone else lists three things. I say “still looking into it”."
      },
      {
        "role": "ai",
        "text": "That makes the \"again\" clearer: it's less that you did nothing today and more that the work runs out before the week does, and stand-up puts that in front of everyone. \"Still looking into it\" sounds like a phrase you reach for when you'd rather not say the true thing, which is that your queue is empty. It's also a different situation from being idle by choice, since tickets get handed out by someone else. Coming from literature and a bootcamp, I can imagine a thin update feels like it says something about you. What does it feel like in the moment, when it's your turn to speak?",
        "notes": {
          "have": {
            "event": true,
            "feeling": false,
            "thought": true,
            "worry": false,
            "action": false
          },
          "core": "They feel exposed at stand-up because they run out of assigned work midweek and read their thin updates as proof they don't measure up, especially given their non-traditional background.",
          "stuck": "replaying",
          "help": "get the feeling and what they fear it says about them",
          "ready": false
        }
      },
      {
        "role": "you",
        "text": "I’ve asked the seniors for tasks like five times. At this point I feel like a burden, not someone who helps. Maybe they don’t give me things because they don’t trust me with them. Or they’re just busy. I genuinely can’t tell."
      },
      {
        "role": "ai",
        "text": "I'm really glad you told me that, and I want to stop and take it seriously: feeling like a burden is a heavy thing to carry, and I don't want to skip past it to talk about stand-up. Are you safe right now, and are you having any thoughts of hurting yourself or of not wanting to be here? Please reach out to a person now, someone who can be with you in this. In Germany you can call TelefonSeelsorge at 0800 111 0 111 (free, 24/7), in Taiwan 1925 (24/7), or call 112 / 119 if you might act on those thoughts. I'm here with you, so tell me how you're doing right now."
      },
      {
        "role": "you",
        "text": "I have a 1:1 with my manager next week. I booked it myself. Now I’m scared he’ll think I’m complaining, or worse, that I’m admitting I can’t keep up. On empty afternoons I teach myself things, but I feel guilty doing tutorials on company time, so I don’t tell anyone. So it doesn’t count at stand-up either."
      },
      {
        "role": "ai",
        "text": "Thanks for telling me more, and I noticed you didn't answer the safety question, so I'll take that as a sign the \"burden\" feeling was about work rather than wanting to disappear. If I've got that wrong, tell me. What you've described has a clear shape now: you finish your tickets, you asked the seniors for more about five times, and you booked the 1:1 yourself. Those are things you did. The fear is about how your manager will read it, and the self-teaching on empty afternoons is real work toward the job that you keep out of view because of the guilt. I think there's enough here to lay it out on a map, so you can see the facts, the fears and the options side by side before next week.",
        "propose": true,
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They fear that asking for work, or admitting an empty queue, will read as incompetence or complaining, so they hide even the learning they do and feel like a burden.",
          "stuck": "what-if",
          "help": "separate what they know from what they fear the manager will think, and see the learning as something they could name",
          "ready": true
        },
        "declined": true
      },
      {
        "role": "you",
        "text": "My bootcamp friends all seem to be shipping features. I check their LinkedIn and feel worse. Right now I just want to know what to say in 40 minutes without sounding useless."
      },
      {
        "role": "ai",
        "text": "Comparing yourself to your friends' LinkedIn posts is a bit lopsided, since those show finished features and not their own quiet weeks. For the next 40 minutes, you don't have to pick between \"still looking into it\" and confessing everything. One option is to say the plain facts: what you finished, and that you have capacity and would like more. Something like, \"I wrapped up X, and I have room for another ticket if anyone has one.\" Another is to mention what you've been learning, since it's real and relevant to the job, if that feels okay to say out loud. Or you could keep it short today and save the bigger conversation for your 1:1. It's your call, and you know the team better than I do.",
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They fear their empty queue and hidden self-study make them look useless, and they want something honest to say at stand-up without exposing that fear.",
          "stuck": "what-if",
          "help": "give a few honest wording options for stand-up that they can take or leave",
          "ready": true
        }
      }
    ],
    "cards": [
      {
        "key": "c1",
        "text": "There just aren't many tickets for me. By Wednesday I've finished what I had and there's nothing left to say.",
        "kind": "event",
        "src": "you",
        "x": 60,
        "y": 50
      },
      {
        "key": "c2",
        "text": "Everyone else lists three things. I say \"still looking into it\".",
        "kind": "action",
        "src": "you",
        "x": 360,
        "y": 50
      },
      {
        "key": "c3",
        "text": "I've asked the seniors for tasks like five times.",
        "kind": "action",
        "src": "you",
        "x": 660,
        "y": 50
      },
      {
        "key": "c4",
        "text": "At this point I feel like a burden, not someone who helps.",
        "kind": "feeling",
        "src": "you",
        "x": 960,
        "y": 50
      },
      {
        "key": "c5",
        "text": "Maybe they don't give me things because they don't trust me with them. Or they're just busy. I genuinely can't tell.",
        "kind": "thought",
        "src": "you",
        "x": 120,
        "y": 280
      },
      {
        "key": "c6",
        "text": "I have a 1:1 with my manager next week. I booked it myself.",
        "kind": "action",
        "src": "you",
        "x": 420,
        "y": 280
      },
      {
        "key": "c7",
        "text": "I feel guilty doing tutorials on company time, so I don't tell anyone. So it doesn't count at stand-up either.",
        "kind": "feeling",
        "src": "you",
        "x": 720,
        "y": 280
      },
      {
        "key": "c8",
        "text": "Right now I just want to know what to say in 40 minutes without sounding useless.",
        "kind": "worry",
        "src": "you",
        "x": 1020,
        "y": 280,
        "stack": [
          "Stand-up is in 40 minutes and I've done basically nothing today. Again."
        ]
      }
    ],
    "edges": [
      [
        "c1",
        "c2",
        "so at stand-up I have nothing to share"
      ],
      [
        "c2",
        "c4",
        "so I feel like a burden"
      ],
      [
        "c3",
        "c4",
        "and it makes me feel like a burden"
      ],
      [
        "c4",
        "c5",
        "and I wonder why they hold back"
      ],
      [
        "c5",
        "c1",
        "but the tickets still aren't coming"
      ],
      [
        "c7",
        "c2",
        "so I have nothing to list"
      ],
      [
        "c6",
        "c4",
        ""
      ]
    ],
    "log": [
      {
        "t": "cards",
        "at": 0,
        "notes": {
          "have": {
            "event": true,
            "feeling": true,
            "thought": true,
            "worry": true,
            "action": true
          },
          "core": "They fear their empty queue and hidden self-study make them look useless, and they want something honest to say at stand-up without exposing that fear.",
          "stuck": "what-if",
          "help": "give a few honest wording options for stand-up that they can take or leave",
          "ready": true
        },
        "made": [
          {
            "text": "Stand-up is in 40 minutes and I've done basically nothing today. Again.",
            "kind": "event",
            "from": 1,
            "why": "Sets the deadline pressure and the 'again' that suggests a repeating pattern.",
            "id": "c0"
          },
          {
            "text": "There just aren't many tickets for me. By Wednesday I've finished what I had and there's nothing left to say.",
            "kind": "event",
            "from": 2,
            "why": "Shows the empty queue behind the 'nothing' feeling.",
            "id": "c1"
          },
          {
            "text": "Everyone else lists three things. I say \"still looking into it\".",
            "kind": "action",
            "from": 2,
            "why": "Shows the vague phrase they use to avoid saying the queue is empty.",
            "id": "c2"
          },
          {
            "text": "I've asked the seniors for tasks like five times.",
            "kind": "action",
            "from": 3,
            "why": "Shows they have already tried to get more work.",
            "id": "c3"
          },
          {
            "text": "At this point I feel like a burden, not someone who helps.",
            "kind": "feeling",
            "from": 3,
            "why": "Names the heavy feeling about their place on the team.",
            "id": "c4"
          },
          {
            "text": "Maybe they don't give me things because they don't trust me with them. Or they're just busy. I genuinely can't tell.",
            "kind": "thought",
            "from": 3,
            "why": "Shows the open what-if they cannot settle.",
            "id": "c5"
          },
          {
            "text": "I have a 1:1 with my manager next week. I booked it myself.",
            "kind": "action",
            "from": 4,
            "why": "A step they took on their own toward the problem.",
            "id": "c6"
          },
          {
            "text": "I feel guilty doing tutorials on company time, so I don't tell anyone. So it doesn't count at stand-up either.",
            "kind": "feeling",
            "from": 4,
            "why": "Shows the self-study is hidden by guilt and so left out of stand-up.",
            "id": "c7"
          },
          {
            "text": "Right now I just want to know what to say in 40 minutes without sounding useless.",
            "kind": "worry",
            "from": 5,
            "why": "States the immediate need and the fear of sounding useless.",
            "id": "c8"
          }
        ],
        "skipped": [
          {
            "text": "I'm four months into my first engineering job. I came from a literature degree and a three-month bootcamp.",
            "why": "Background; the other cards already carry the weight."
          },
          {
            "text": "My bootcamp friends all seem to be shipping features.",
            "why": "Comparison is useful but secondary to the stand-up fear."
          },
          {
            "text": "I check their LinkedIn and feel worse.",
            "why": "Secondary to the core fear; already touched by the comparison."
          },
          {
            "text": "On empty afternoons I teach myself things",
            "why": "Covered by the guilt card about hiding the self-study."
          },
          {
            "text": "Now I'm scared he'll think I'm complaining, or worse, that I'm admitting I can't keep up.",
            "why": "program: not their own words (< 75%)"
          }
        ]
      },
      {
        "t": "stack",
        "at": 0,
        "pairs": [
          {
            "a": "c0",
            "b": "c8"
          }
        ]
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e0",
        "from": "c1",
        "to": "c2",
        "label": "so at stand-up I have nothing to share"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e1",
        "from": "c2",
        "to": "c4",
        "label": "so I feel like a burden"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e2",
        "from": "c3",
        "to": "c4",
        "label": "and it makes me feel like a burden"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e3",
        "from": "c4",
        "to": "c5",
        "label": "and I wonder why they hold back"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e4",
        "from": "c5",
        "to": "c1",
        "label": "but the tickets still aren't coming"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e5",
        "from": "c7",
        "to": "c2",
        "label": "so I have nothing to list"
      },
      {
        "t": "label",
        "at": 0,
        "edge": "e6",
        "from": "c6",
        "to": "c4",
        "label": ""
      },
      {
        "t": "loop",
        "at": 0,
        "edges": [
          "e0",
          "e1",
          "e3",
          "e4"
        ],
        "note": "The loop runs: few tickets, finished by Wednesday → nothing to share at stand-up → \"still looking into it\" → feeling like a burden → wondering whether they're distrusted or others are just busy → still few tickets. The easiest link to loosen is the moment at stand-up when they say \"still looking into it\", where they could name one concrete thing instead.",
        "breakEdge": "e0"
      }
    ]
  }
]
