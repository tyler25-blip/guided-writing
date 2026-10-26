// Sample sessions for the dev panel: jump to any screen without typing. English, like the UI.
type Src = 'you' | 'ai'
export type Sample = {
  name: string
  msgs: { role: Src; text: string }[]
  cands: { text: string; src: Src; on: boolean }[]
  cards: { key: string; text: string; src: Src; x: number; y: number; stack?: string[] }[]
  edges: [from: string, to: string, label: string][]
}

export const SAMPLES: Sample[] = [
  {
    name: 'Overload · work + final report',
    msgs: [
      { role: 'you', text: 'Work and my final report piled up this week. I feel like I can’t breathe.' },
      { role: 'ai', text: 'That sounds like a lot landing at once. Which part is taking up the most room right now?' },
      { role: 'you', text: 'The report. Jonas is still waiting for my part and I keep putting it off. I sleep badly too.' },
      { role: 'ai', text: 'It’s very common to put off the heaviest thing when deadlines stack up; avoiding it brings short relief, then more pressure.' },
    ],
    cands: [
      { text: 'Work and my final report piled up this week.', src: 'you', on: true },
      { text: 'I feel like I can’t breathe.', src: 'you', on: false },
      { text: 'Jonas is still waiting for my part.', src: 'you', on: true },
      { text: 'I keep putting it off.', src: 'you', on: true },
      { text: 'I sleep badly.', src: 'you', on: true },
      { text: 'Send Jonas a one-line status update', src: 'ai', on: true },
      { text: 'Split the report into one small first task', src: 'ai', on: false },
    ],
    cards: [
      { key: 'w', text: 'Work and my final report piled up this week.', src: 'you', x: 60, y: 60 },
      { key: 'p', text: 'I keep putting it off.', src: 'you', x: 420, y: 300, stack: ['Still haven’t started the report'] },
      { key: 'j', text: 'Jonas is still waiting for my part.', src: 'you', x: 780, y: 60 },
      { key: 's', text: 'I sleep badly.', src: 'you', x: 60, y: 420 },
      { key: 'f', text: 'Afraid he thinks I’m unreliable', src: 'you', x: 1100, y: 300 },
      { key: 'a', text: 'Send Jonas a one-line status update', src: 'ai', x: 780, y: 520 },
    ],
    edges: [
      ['w', 'p', 'too much, so I avoid it'],
      ['p', 'j', 'the longer I wait, the worse'],
      ['j', 's', 'keeps me up at night'],
      ['s', 'p', 'tired, so I put it off more'],
      ['j', 'f', ''],
    ],
  },
  {
    name: 'One event · froze in a meeting',
    msgs: [
      { role: 'you', text: 'I froze when my manager asked me a question in the meeting today. Everyone was looking at me.' },
      { role: 'ai', text: 'Freezing with everyone looking is a really uncomfortable moment. What happened right after?' },
      { role: 'you', text: 'I said something vague and moved on. Now I keep replaying it. Why do I always do this?' },
      { role: 'ai', text: 'Replaying an awkward moment is something most people do; the mind keeps returning to things that feel unfinished.' },
    ],
    cands: [
      { text: 'I froze when my manager asked me a question.', src: 'you', on: true },
      { text: 'Everyone was looking at me.', src: 'you', on: true },
      { text: 'I said something vague and moved on.', src: 'you', on: true },
      { text: 'I keep replaying it.', src: 'you', on: true },
      { text: 'Why do I always do this?', src: 'you', on: true },
      { text: 'Write the answer you’d give now, in two lines', src: 'ai', on: true },
    ],
    cards: [
      { key: 'f', text: 'I froze when my manager asked me a question.', src: 'you', x: 80, y: 80 },
      { key: 'e', text: 'Everyone was looking at me.', src: 'you', x: 80, y: 360 },
      { key: 'r', text: 'I keep replaying it.', src: 'you', x: 520, y: 200, stack: ['Why do I always do this?'] },
      { key: 'v', text: 'I said something vague and moved on.', src: 'you', x: 520, y: 460 },
      { key: 'a', text: 'Write the answer you’d give now, in two lines', src: 'ai', x: 940, y: 200 },
    ],
    edges: [
      ['f', 'e', 'and then I noticed'],
      ['e', 'v', 'so I rushed'],
      ['v', 'r', ''],
    ],
  },
  {
    name: 'Worry · waiting for exam results',
    msgs: [
      { role: 'you', text: 'Exam results come out on Friday. I keep checking the portal even though I know it’s not there yet.' },
      { role: 'ai', text: 'Waiting with no way to speed it up is hard. What do you picture happening on Friday?' },
      { role: 'you', text: 'That I failed and have to retake it and my summer is gone.' },
      { role: 'ai', text: 'Checking again and again is a very human way to cope with uncertainty, even though it rarely brings relief.' },
    ],
    cands: [
      { text: 'Exam results come out on Friday.', src: 'you', on: true },
      { text: 'I keep checking the portal.', src: 'you', on: true },
      { text: 'That I failed and have to retake it.', src: 'you', on: true },
      { text: 'My summer is gone.', src: 'you', on: true },
      { text: 'Pick one time on Friday to check, and only then', src: 'ai', on: true },
    ],
    cards: [
      { key: 'r', text: 'Exam results come out on Friday.', src: 'you', x: 80, y: 120 },
      { key: 'c', text: 'I keep checking the portal.', src: 'you', x: 500, y: 120 },
      { key: 'f', text: 'That I failed and have to retake it.', src: 'you', x: 500, y: 420 },
      { key: 's', text: 'My summer is gone.', src: 'you', x: 920, y: 420 },
      { key: 'a', text: 'Pick one time on Friday to check, and only then', src: 'ai', x: 920, y: 120 },
    ],
    edges: [
      ['r', 'c', 'can’t wait, so I check'],
      ['c', 'f', 'nothing there, so I imagine the worst'],
      ['f', 'c', 'scared, so I check again'],
      ['f', 's', ''],
    ],
  },
]
