// Sample sessions for the dev panel: jump to any screen without typing. English, like the UI.
// The stories are adapted from real questions on Stack Exchange (CC BY-SA 4.0). Details, roles and wording are changed:
//   1 · workplace.stackexchange.com/q/103950 (Chapz) — a coworker keeps pointing out one mistake
//   2 · academia.stackexchange.com/q/30098 (Superbest) + /q/177156 (yl125) — proposal anxiety, can't pick a topic
//   3 · workplace.stackexchange.com/q/188258 (sandy) — nothing to say at stand-up
// The AI turns are real output of server/map.ts (Sonnet, the chat limits B1–B6), replayed from the person's turns.
type Src = 'you' | 'ai'
export type Sample = {
  name: string
  msgs: { role: Src; text: string; propose?: boolean; declined?: boolean }[]
  cards: { key: string; text: string; src: Src; x: number; y: number; stack?: string[] }[]
  edges: [from: string, to: string, label: string][]
}

export const SAMPLES: Sample[] = [
  {
    name: 'One event · the mistake that keeps coming up',
    msgs: [
      { role: 'you', text: "Three weeks ago a feature I built broke for users. In the next team meeting the QA lead said “this simply can’t happen”, loudly, in front of everyone." },
      { role: 'ai', text: "That sounds like a sting that's lingered. The break itself is one thing, but being named in front of everyone, with that loud \"this simply can't happen,\" is another, and it makes sense that the second part is the one still replaying three weeks later. I'm curious what has stayed with you most: the words, the room's reaction, or something about the bug itself?" },
      { role: 'you', text: "It’s not even the mistake. I can admit mistakes. It’s that he keeps bringing it up. Yesterday he told the guy next to me that he trusts his code without even testing it. That was aimed at me." },
      { role: 'ai', text: "So the original bug has become less of the issue than the way it keeps resurfacing, and that comment yesterday sounds like it landed as a comparison with you on the losing side. When something is mentioned again and again, it can start to feel like the matter was never closed, even though you owned the mistake. Remarks like that one, said sideways to someone else, are also hard to answer, because there's nothing direct to respond to. It sounds like you're left carrying it quietly." },
      { role: 'you', text: "Yes. And honestly it wasn’t only my fault. I asked for help and got none. Then it was handed to someone who said it was finished when it wasn’t, then a third person half-refactored it and left the project. It came back to me as a mess. But saying that out loud sounds like making excuses, so I don’t." },
      { role: 'ai', text: "That adds a lot to the picture: you asked for help and didn't get it, the work passed through two other people, and then it landed back on you in a worse state. No wonder it's hard to stay quiet about that. There's a difference between explaining how something happened and excusing it, and you've said plainly that you own your part. It sounds like the story told in the meeting has only one name in it, while the one you're carrying has several. There are quite a few threads here now, and I could help you spread them out on a map if you'd like to see them side by side.", propose: true, declined: true },
      { role: 'you', text: "Whenever we discuss a new feature and I disagree with him, he uses it against me. Now I second-guess myself before I even open my mouth. I can’t concentrate. I reread my own pull requests three times. Which makes me slower, which probably looks bad too. I’m afraid the managers will only remember this one thing." },
      { role: 'ai', text: "That's a heavy knock-on effect: you hold back in discussions where you have a view, you reread each pull request three times, and the extra care costs you time that you worry will be read as another mark against you. The fear that managers will remember only this one thing makes sense when the reminders keep coming. It also seems the original bug has stopped being the main weight. What weighs more is how it now colors every room you're in with him. You've shared the meeting, the comments aimed sideways, the handoffs, the second-guessing and the worry about managers, and that's enough material that I could lay it all out on a map whenever you want to see how the pieces connect." },
      { role: 'you', text: "Then again, it’s been over a year and I’ve never had a bug like that. Everyone else seems fine with my work. Maybe I’m blowing it up. I thought about telling the architect privately, he’s friendly. But the project is almost over and it’s a bad time for conflict. Going to the manager feels like escalating, and talking to QA directly would just make it an open war." },
      { role: 'ai', text: "You've laid out three options and each one has a cost: the architect might feel safest but you worry about timing, the manager feels like escalating, and QA directly feels like open war. Also worth noting that a year without a bug like this, and colleagues who seem fine with your work, are real evidence too, so doubting yourself here doesn't mean the weight is imagined. You don't have to settle which path, if any, is right tonight; it may help to see how these pieces sit next to each other. We've now covered quite a lot, and I can spread it all out on a map for you whenever you'd like.", propose: true },
    ],
    cards: [
      { key: 'broke', text: 'A feature I built broke; QA said “this simply can’t happen” in front of everyone.', src: 'you', x: 60, y: 40 },
      { key: 'keeps', text: 'He keeps bringing it up, three weeks later.', src: 'you', x: 380, y: 40, stack: ['“I trust his code without testing it” was aimed at me.', 'He uses it against me when I disagree.'] },
      { key: 'doubt', text: 'I second-guess myself before I speak.', src: 'you', x: 700, y: 60 },
      { key: 'slow', text: 'I can’t concentrate, so I’m slower.', src: 'you', x: 1000, y: 240 },
      { key: 'afraid', text: 'Afraid the managers will only remember this.', src: 'you', x: 700, y: 400 },
      { key: 'year', text: 'Over a year with no bug like that.', src: 'you', x: 1000, y: 560 },
      { key: 'fault', text: 'It wasn’t only my fault: it went through three people before it came back to me.', src: 'you', x: 60, y: 300 },
      { key: 'excuse', text: 'Saying that sounds like making excuses.', src: 'you', x: 380, y: 300 },
      { key: 'arch', text: 'Tell the architect privately?', src: 'you', x: 380, y: 540 },
      { key: 'end', text: 'The project is almost over; bad time for conflict.', src: 'you', x: 60, y: 560 },
      { key: 'ai', text: 'Write the three-handover timeline down once, just for yourself', src: 'ai', x: 60, y: 760 },
    ],
    edges: [
      ['broke', 'keeps', 'and it doesn’t end'],
      ['keeps', 'doubt', 'so I hold back'],
      ['doubt', 'slow', 'I check everything twice'],
      ['slow', 'afraid', 'that looks bad too'],
      ['afraid', 'doubt', 'so I hold back more'],
      ['year', 'afraid', 'doesn’t feel like it counts'],
      ['fault', 'excuse', 'but I can’t say it'],
      ['excuse', 'arch', 'maybe he’d hear it'],
      ['end', 'arch', 'bad timing'],
    ],
  },
  {
    name: 'Overload · stuck on the scholarship proposal',
    msgs: [
      { role: 'you', text: "The scholarship proposal is due in 9 days and I’ve written one paragraph. I deleted it twice." },
      { role: 'ai', text: "Nine days with one paragraph standing, after deleting it twice, sounds like a lot of pressure packed into a small amount of text. It's also worth noticing that you keep writing it, which means some version of it keeps coming out of you before something stops you. I'm curious what happens in the moment right before you delete it: is it the wording that feels wrong, or something about what the proposal is supposed to say about you?" },
      { role: 'you', text: "Every time I open the doc I think my project isn’t that interesting. The other applicants will have real research. Mine is a small idea I’m dressing up. So I tell myself I’ll wait until I’m in the right headspace. I know that’s nonsense." },
      { role: 'ai', text: "That's a clear picture of the loop: you open the doc, the thought arrives that your project is small next to everyone else's real research, and waiting for the right headspace becomes the way out of the moment. Calling it nonsense is harsh, though it also sounds like part of you can see that the waiting doesn't change the nine days. One thing that might be useful is that you're comparing your idea to applicants you've never read, so the comparison is built from your imagination of their work, not from their actual proposals. You don't have to settle whether the idea is interesting tonight, only get it out of your head. What does the idea actually look like when you describe it plainly?" },
      { role: 'you', text: "Last time the “inspiration” showed up at 3am the night before. I made it, barely. And the result was actually fine. That’s the annoying part, it could have been good if I’d started earlier. This time I asked my advisor for an early internal deadline to trick myself. Then she said I could take an extra week, and the dread came right back." },
      { role: 'ai', text: "So there's a pattern you can see clearly: last time it came together at 3am and was fine, and what stings is the \"could have been good\" part. The early internal deadline was a clever way to give yourself a push, and then the extra week took that push away, which would explain the dread coming straight back. A deadline you set to hold yourself accountable can feel very different once someone else has loosened it. There are quite a few threads here now: the paragraph you deleted, the worry about other applicants, the last-minute history, and the advisor's extra week. If you'd like, we can spread them out on a map so you can see how they connect.", propose: true, declined: true },
      { role: 'you', text: "Also there’s the methods seminar. I can’t follow the papers she assigns. After two pages my mind drifts and I skip ahead, which makes it worse. And I’m supposed to narrow my topic for the midterm project and link it to the proposal. I can’t pick. Every option feels like the wrong one." },
      { role: 'ai', text: "So the methods seminar adds another strand: the papers lose you after two pages, skipping ahead leaves you more lost, and the midterm topic has to connect to the proposal, so the pressure to choose lands in both places at once. It makes sense that every option feels wrong when each one has to carry that much. One thing that may help is that a midterm topic and a proposal can overlap without either being final. It doesn't have to be settled tonight. You've now laid out the proposal, the comparison with other applicants, the extra week, and the seminar, and I think that's enough to see together. If you want, we can spread it all out on a map now." },
      { role: 'you', text: "What will she think of me if I can’t even choose a topic. I feel panicked and useless at the same time. My friend says just write garbage and fix it later. I tried. I wrote an outline and then couldn’t make myself open it again." },
      { role: 'ai', text: "That fear about what your advisor will think sits right underneath all of this, and it makes sense that panic and feeling useless show up together when so much seems to ride on one choice. It also counts for something that you wrote an outline at all, even though opening it again was the hard part. Your friend's \"write garbage\" idea didn't land, and that tells us something about where the sticking point is: it seems to be less about producing words and more about facing what they might say about you. You've now put a lot on the table: the proposal, the other applicants, the extra week, the seminar papers, the topic choice, and what your advisor might think. If you'd like, we can spread it all out on a map now and see how the pieces connect.", propose: true },
    ],
    cards: [
      { key: 'due', text: 'Proposal due in 9 days, one paragraph written.', src: 'you', x: 60, y: 40 },
      { key: 'dull', text: 'My project isn’t that interesting.', src: 'you', x: 380, y: 40, stack: ['The other applicants will have real research.'] },
      { key: 'wait', text: 'Waiting for the right headspace (I know it’s nonsense).', src: 'you', x: 700, y: 40 },
      { key: '3am', text: 'Last time it came together at 3am the night before.', src: 'you', x: 1000, y: 240 },
      { key: 'fine', text: 'The result was fine; it could have been good if I’d started earlier.', src: 'you', x: 700, y: 380 },
      { key: 'week', text: 'I got an extra week, and the dread came right back.', src: 'you', x: 380, y: 260 },
      { key: 'outline', text: 'I wrote an outline and couldn’t open it again.', src: 'you', x: 1000, y: 40 },
      { key: 'papers', text: 'I can’t follow the seminar papers, so I skip ahead.', src: 'you', x: 60, y: 500 },
      { key: 'topic', text: 'I can’t pick a topic; every option feels wrong.', src: 'you', x: 380, y: 520 },
      { key: 'advisor', text: 'What will my advisor think of me?', src: 'you', x: 220, y: 760 },
      { key: 'ai', text: 'Write three sentences of the proposal that are allowed to be bad', src: 'ai', x: 60, y: 260 },
    ],
    edges: [
      ['due', 'dull', 'every time I open it'],
      ['dull', 'wait', 'so I put it off'],
      ['wait', '3am', 'until the deadline forces it'],
      ['3am', 'fine', 'and it works out'],
      ['fine', 'wait', 'so waiting “works”'],
      ['week', 'dull', 'pressure gone, fear back'],
      ['outline', 'wait', 'same thing again'],
      ['papers', 'topic', 'so I still can’t choose'],
      ['topic', 'advisor', 'she’ll notice'],
      ['advisor', 'papers', 'too tense to read'],
    ],
  },
  {
    name: 'Worry · nothing to say at stand-up',
    msgs: [
      { role: 'you', text: "Stand-up is in 40 minutes and I’ve done basically nothing today. Again." },
      { role: 'ai', text: "Forty minutes is a tight window, especially with that \"again\" hanging over it. It sounds like the day slipped by without you getting to the things you meant to, and now stand-up is about to put a spotlight on that. I can hear some weight in how you wrote it. What's sitting heaviest right now: having to say something in the meeting, or the feeling that this keeps happening?" },
      { role: 'you', text: "I’m four months into my first engineering job. I came from a literature degree and a three-month bootcamp. There just aren’t many tickets for me. By Wednesday I’ve finished what I had and there’s nothing left to say. Everyone else lists three things. I say “still looking into it”." },
      { role: 'ai', text: "That picture is quite specific: you finish your tickets by Wednesday, the queue runs dry, and then stand-up asks you for a list when you have nothing to put on it. Four months in, coming from literature and a bootcamp, you're also probably measuring yourself against people who have had years more practice. It may be worth noticing that an empty queue is partly about how work gets handed out, not only about you. How does \"still looking into it\" feel when you say it out loud to the team?" },
      { role: 'you', text: "I’ve asked the seniors for tasks like five times. At this point I feel like a burden, not someone who helps. Maybe they don’t give me things because they don’t trust me with them. Or they’re just busy. I genuinely can’t tell." },
      { role: 'ai', text: "Asking five times and still coming away with nothing would leave anyone unsure what's going on, and you've named the two possibilities yourself: they don't trust you with the work, or they're simply busy. From where you sit, those two look identical, because both end in an empty queue. That gap between what you can see and what's actually going on is probably part of why it weighs so much. There are a few separate things in here now: the empty days, the stand-up moment, the five requests, and the feeling of being a burden. It might help to lay them out side by side on a map, so you can see them as separate pieces rather than one knot.", propose: true, declined: true },
      { role: 'you', text: "I have a 1:1 with my manager next week. I booked it myself. Now I’m scared he’ll think I’m complaining, or worse, that I’m admitting I can’t keep up. On empty afternoons I teach myself things, but I feel guilty doing tutorials on company time, so I don’t tell anyone. So it doesn’t count at stand-up either." },
      { role: 'ai', text: "Booking that 1:1 yourself is already a concrete step, and it puts the real questions in front of the one person who can answer them. I notice the fear points in two directions: that he'll hear complaining, or that he'll hear you can't keep up. Meanwhile the tutorials sit in a odd spot, because they're real learning, yet because you keep them quiet and feel guilty about them, they never show up anywhere. Those afternoons are part of the picture of your four months, even if no one else has seen them yet. If it would be useful, you could bring them into the 1:1 as one of the things you want him to know about, but that's entirely your call." },
      { role: 'you', text: "My bootcamp friends all seem to be shipping features. I check their LinkedIn and feel worse. Right now I just want to know what to say in 40 minutes without sounding useless." },
      { role: 'ai', text: "Comparing yourself to your friends' LinkedIn posts adds another layer, since those show the announcements and not the quiet stretches in between. For the next 40 minutes, you could simply say what's true: what you finished, what you've been learning on the quiet afternoons, and that you have capacity for more. Something like \"I wrapped up X, I've been working through Y to build my skills, and I have room for another ticket\" is one possibility, and you can word it however feels like you. That puts the open capacity out loud in front of the seniors instead of leaving it as 'still looking into it'. There's plenty on the table now, so after stand-up we could spread it all out on a map whenever you like.", propose: true },
    ],
    cards: [
      { key: 'few', text: 'There aren’t many tickets for me.', src: 'you', x: 60, y: 60 },
      { key: 'empty', text: 'By Wednesday I have nothing left to say.', src: 'you', x: 380, y: 60, stack: ['Stand-up in 40 minutes; I did basically nothing today.'] },
      { key: 'burden', text: 'I feel like a burden.', src: 'you', x: 700, y: 240 },
      { key: 'trust', text: 'Maybe they don’t trust me. Or they’re just busy.', src: 'you', x: 380, y: 400 },
      { key: 'asked', text: 'I’ve asked the seniors for tasks five times.', src: 'you', x: 1000, y: 60 },
      { key: 'bg', text: 'Four months in, after literature and a bootcamp.', src: 'you', x: 60, y: 660 },
      { key: 'learn', text: 'I teach myself things but don’t tell anyone.', src: 'you', x: 700, y: 20 },
      { key: 'friends', text: 'Bootcamp friends are shipping features.', src: 'you', x: 1000, y: 420 },
      { key: 'oneone', text: '1:1 with my manager next week (I booked it).', src: 'you', x: 380, y: 640 },
      { key: 'scared', text: 'Scared he’ll think I’m complaining or can’t keep up.', src: 'you', x: 700, y: 620 },
      { key: 'ai', text: 'Say what you learned today as your stand-up item', src: 'ai', x: 1000, y: 640 },
    ],
    edges: [
      ['few', 'empty', 'the work runs out'],
      ['empty', 'burden', ''],
      ['asked', 'burden', 'and still nothing'],
      ['burden', 'trust', 'maybe that’s why'],
      ['trust', 'few', 'so fewer tickets'],
      ['bg', 'trust', 'they know where I came from'],
      ['learn', 'empty', 'stays invisible'],
      ['friends', 'burden', 'compared to them'],
      ['oneone', 'scared', ''],
      ['scared', 'burden', 'same fear'],
    ],
  },
]
