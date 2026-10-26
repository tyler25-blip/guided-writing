// Loop detection for the thought map, done by code (never guessed by the AI).
export type E = { id: string; from: string; to: string }

// Edges that lie on a directed cycle, grouped by the strongly connected part they belong to (one group = one loop chip).
export function loops(edges: E[]): string[][] {
  const out = new Map<string, string[]>()
  for (const e of edges) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to)
  const memo = new Map<string, Set<string>>()
  const reach = (a: string) => {
    if (memo.has(a)) return memo.get(a)!
    const seen = new Set<string>()
    const todo = [a]
    while (todo.length) for (const m of out.get(todo.pop()!) ?? []) if (!seen.has(m)) seen.add(m), todo.push(m)
    memo.set(a, seen)
    return seen
  }
  const groups = new Map<string, string[]>()
  for (const e of edges) {
    if (!reach(e.to).has(e.from)) continue // not on a cycle
    const key = [...reach(e.from)].filter((n) => reach(n).has(e.from)).sort().join('|')
    ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(e.id)
  }
  return [...groups.values()]
}
