// Run: node src/saved/saved.check.ts — saved sessions build, and the real program checks agree with the dry run.
import assert from 'node:assert/strict'
import { SAVED, build } from './index.ts'

const s = build(SAVED['what-if-night'])
const replies = s.items.filter((i) => i.kind === 'reply')
assert.equal(replies.length, 3, 'three margin notes that evening')
const j = s.events.filter((e) => e.type === 'ai_judgement')
const rewrite = j.find((e) => (e.data?.attempts as unknown[]).length === 2)!
const [first, second] = rewrite.data!.attempts as { checks: Record<string, { ok: boolean }> }[]
const failed = Object.entries(first.checks).filter(([, c]) => !c.ok).map(([k]) => k)
assert.deepEqual(failed, ['S1', 'S3', 'X5'], `first draft should fail S1, S3, X5, got ${failed}`)
assert.ok(Object.values(second.checks).every((c) => c.ok), 'rewrite passes every check')
assert.ok(j.some((e) => e.data?.kind === 'pause' && e.data?.decision === 'silent'), 'pause stays silent')
assert.equal(Object.keys(s.labels!).length, 7, 'every step carries a label')
console.log('saved ok')
assert.ok(!s.events.some((e) => e.type === 'decision' && e.data?.outcome === 'throttled'), 'no entry falls inside the 3-min gap')
assert.equal(s.events.filter((e) => e.type === 'ai_judgement').length, 7, 'every step reached the AI')
console.log('saved gap ok')
