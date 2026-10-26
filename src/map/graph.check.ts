// Run: node src/map/graph.check.ts
import assert from 'node:assert/strict'
import { loops } from './graph.ts'

const e = (id: string, from: string, to: string) => ({ id, from, to })
assert.deepEqual(loops([e('1', 'A', 'B'), e('2', 'B', 'C')]), []) // a chain is not a loop
assert.deepEqual(loops([e('1', 'A', 'B'), e('2', 'B', 'C'), e('3', 'C', 'A'), e('4', 'D', 'A')]), [['1', '2', '3']]) // tail D→A not included
assert.equal(loops([e('1', 'A', 'B'), e('2', 'B', 'A'), e('3', 'C', 'D'), e('4', 'D', 'C')]).length, 2) // two separate loops
assert.deepEqual(loops([e('1', 'A', 'B'), e('2', 'B', 'A'), e('3', 'B', 'C'), e('4', 'C', 'A')]).map((g) => g.length), [4]) // figure-eight = one loop
console.log('graph ok')
