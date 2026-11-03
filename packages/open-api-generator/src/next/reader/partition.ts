// Graph algorithms over nodes numbered 0..count-1.

/**
 * Coarsest partition stable under `signature` (Moore-style partition
 * refinement): two nodes share a block iff they have the same label and their
 * signatures agree given the current blocks of their successors. This is
 * bisimulation minimization when `signature` lists successors' blocks.
 */
export const refinePartition = (
  count: number,
  signature: (node: number, blockOf: (node: number) => number) => string
): number[] => {
  let blocks: number[] = new Array(count).fill(0)
  let blockCount = 1

  for (;;) {
    const ids = new Map<string, number>()
    const current = blocks
    const next = current.map((block, node) => {
      const key = `${block}|${signature(node, (other) => current[other])}`
      const known = ids.get(key)
      if (known !== undefined) return known
      ids.set(key, ids.size)
      return ids.size - 1
    })
    blocks = next
    if (ids.size === blockCount) return blocks
    blockCount = ids.size
  }
}

/** Tarjan's algorithm. Components come out sinks first (reverse topological order). */
export const stronglyConnectedComponents = (
  count: number,
  successors: (node: number) => readonly number[]
): number[][] => {
  const index = new Array<number>(count).fill(-1)
  const low = new Array<number>(count).fill(0)
  const onStack = new Array<boolean>(count).fill(false)
  const stack: number[] = []
  const components: number[][] = []
  let counter = 0

  const visit = (node: number) => {
    index[node] = low[node] = counter++
    stack.push(node)
    onStack[node] = true
    for (const next of successors(node)) {
      if (index[next] === -1) {
        visit(next)
        low[node] = Math.min(low[node], low[next])
      } else if (onStack[next]) {
        low[node] = Math.min(low[node], index[next])
      }
    }
    if (low[node] === index[node]) {
      const component: number[] = []
      let member: number
      do {
        member = stack.pop() as number
        onStack[member] = false
        component.push(member)
      } while (member !== node)
      components.push(component)
    }
  }

  for (let node = 0; node < count; node++) if (index[node] === -1) visit(node)
  return components
}

/** Nodes that lie on a cycle. */
export const cyclicNodes = (
  count: number,
  successors: (node: number) => readonly number[]
): Set<number> =>
  new Set(
    stronglyConnectedComponents(count, successors).flatMap((component) =>
      component.length > 1 || successors(component[0]).includes(component[0])
        ? component
        : []
    )
  )

/** Nodes from which some cycle is reachable, so their unfolding is infinite. */
export const nodesReachingCycles = (
  count: number,
  successors: (node: number) => readonly number[]
): Set<number> => {
  const reaching = new Set<number>()
  for (const component of stronglyConnectedComponents(count, successors)) {
    const cyclic =
      component.length > 1 || successors(component[0]).includes(component[0])
    if (
      cyclic ||
      component.some((node) =>
        successors(node).some((next) => reaching.has(next))
      )
    )
      component.forEach((node) => reaching.add(node))
  }
  return reaching
}
