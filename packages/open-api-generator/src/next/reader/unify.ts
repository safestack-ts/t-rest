import { mapRefs, RefShape, refsOf, withDocs } from '../model/shape.js'
import type { DefKey, Direction, Docs, Shape, TypeDef } from '../model/types.js'
import type { Edge, NodeId, SchemaGraph } from './graph.js'
import {
  cyclicNodes,
  nodesReachingCycles,
  refinePartition,
} from './partition.js'

export interface UnifyContext {
  readonly direction: Direction
  /** Prefix of anonymous keys outside any named def: `<operation key>#<slot>`. */
  readonly anonymousScope: string
}

export interface UnifiedSchema {
  readonly shape: Shape<DefKey>
  readonly types: Readonly<Record<DefKey, TypeDef<DefKey>>>
}

const ANNOTATIONS = ['title', 'description', 'examples']

/** Docs that change what a value means; annotations never separate nodes. */
const semanticDocs = (docs: Docs | undefined) => {
  const entries = Object.entries(docs ?? {})
    .filter(([key]) => !ANNOTATIONS.includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
  return entries.length > 0 ? JSON.stringify(entries) : ''
}

/** Structure and semantic docs, children by block, fields and members in a canonical order. */
const canonical = (
  shape: Shape<Edge>,
  blockOf: (node: NodeId) => number
): string => `${structureOf(shape, blockOf)}${semanticDocs(shape.docs)}`

const structureOf = (
  shape: Shape<Edge>,
  blockOf: (node: NodeId) => number
): string => {
  const of = (child: Shape<Edge>) => canonical(child, blockOf)
  const { docs: _, ...structure } = shape
  switch (shape.kind) {
    case 'ref':
      return `#${blockOf(shape.target.node)}`
    case 'array':
      return JSON.stringify({ ...structure, items: of(shape.items) })
    case 'tuple':
      return JSON.stringify({
        ...structure,
        prefix: shape.prefix.map(of),
        rest: shape.rest && of(shape.rest),
      })
    case 'object':
      return JSON.stringify({
        ...structure,
        fields: shape.fields
          .map((field) => [field.name, field.required, of(field.shape)])
          .sort(([a], [b]) => String(a).localeCompare(String(b))),
        additional:
          shape.additional === false
            ? false
            : shape.additional && of(shape.additional),
        propertyNames: shape.propertyNames && of(shape.propertyNames),
      })
    case 'union':
    case 'intersection':
      return JSON.stringify({
        ...structure,
        members: shape.members.map(of).sort(),
      })
    default:
      return JSON.stringify(structure)
  }
}

const docsDiff = (own: Docs | undefined, base: Docs | undefined): Docs =>
  Object.fromEntries(
    Object.entries(own ?? {}).filter(
      ([key, value]) =>
        JSON.stringify(value) !==
        JSON.stringify((base as Record<string, unknown> | undefined)?.[key])
    )
  )

/**
 * Turns one conversion's graph into model shapes. Nodes are partitioned by
 * bisimulation, ignoring title, description and examples. A node whose own
 * unfolding is infinite (recursion that does not pass through a named def) and
 * that is bisimilar to a named def becomes a ref to it (smallest id on ties).
 * Generated defs left on a cycle become anonymous types; every other node is
 * inlined.
 */
export const unify = (
  graph: SchemaGraph,
  { direction, anonymousScope }: UnifyContext
): UnifiedSchema => {
  const { nodes } = graph
  const childrenOf = (node: NodeId) => refsOf(nodes[node])
  const successors = (node: NodeId) =>
    childrenOf(node).map((ref) => ref.target.node)
  const docsOf = (node: NodeId) => nodes[node].docs

  const blocks = refinePartition(nodes.length, (node, blockOf) =>
    canonical(nodes[node], blockOf)
  )
  const blockOf = (node: NodeId) => blocks[node]

  const namedIds = [...graph.named.keys()].sort()
  const bodyOf = (id: string) =>
    (graph.named.get(id) as RefShape<Edge>).target.node
  // An alias owns the node it points at only when no non-alias def sits there.
  const bodyOwner = new Map<NodeId, string>()
  for (const id of [
    ...namedIds.filter((id) => !graph.aliases.has(id)),
    ...namedIds.filter((id) => graph.aliases.has(id)),
  ])
    if (!bodyOwner.has(bodyOf(id))) bodyOwner.set(bodyOf(id), id)
  const namedInBlock = new Map<number, string>()
  for (const id of namedIds) {
    const block = blockOf(bodyOf(id))
    if (bodyOwner.get(bodyOf(id)) === id && !namedInBlock.has(block))
      namedInBlock.set(block, id)
  }

  const unowned = (node: NodeId) =>
    successors(node).filter((next) => !bodyOwner.has(next))
  const infinite = nodesReachingCycles(nodes.length, unowned)
  const namedTarget = (node: NodeId): string | undefined =>
    bodyOwner.get(node) ??
    (infinite.has(node) ? namedInBlock.get(blockOf(node)) : undefined)

  const remaining = (node: NodeId) =>
    successors(node).filter((next) => namedTarget(next) === undefined)
  const onCycle = cyclicNodes(nodes.length, remaining)
  const anonymousBlocks = new Set(
    [...graph.refTargets].filter((node) => onCycle.has(node)).map(blockOf)
  )

  const namedKey = (id: string) => `${direction}:${id}` as DefKey

  // Keys under a named def come from the def, so every read of it is equal.
  const representative = new Map<number, { node: NodeId; key: DefKey }>()
  const visited = new Set<NodeId>()
  const visit = (ref: RefShape<Edge>, scope: string, base: string) => {
    const { node, pointer } = ref.target
    if (visited.has(node)) return
    visited.add(node)
    const block = blockOf(node)
    if (anonymousBlocks.has(block) && !representative.has(block))
      representative.set(block, {
        node,
        key: `anon:${scope}#${pointer.slice(base.length)}` as DefKey,
      })
    childrenOf(node)
      .filter((child) => !bodyOwner.has(child.target.node))
      .forEach((child) => visit(child, scope, base))
  }
  for (const id of namedIds) {
    const body = graph.named.get(id) as RefShape<Edge>
    if (bodyOwner.get(body.target.node) === id)
      visit(body, namedKey(id), body.target.pointer)
  }
  visit(graph.root, anonymousScope, '')
  const anonymousKey = (block: number) =>
    (representative.get(block) as { key: DefKey }).key

  const emitNode = (node: NodeId): Shape<DefKey> =>
    mapRefs(nodes[node], emitEdge)

  const emitEdge = (ref: RefShape<Edge>): Shape<DefKey> => {
    const { node } = ref.target
    const named = namedTarget(node)
    if (named !== undefined) {
      return withDocs(
        { kind: 'ref', target: namedKey(named) },
        { ...docsDiff(docsOf(node), docsOf(bodyOf(named))), ...ref.docs }
      )
    }
    const block = blockOf(node)
    if (anonymousBlocks.has(block)) {
      const base = (representative.get(block) as { node: NodeId }).node
      return withDocs(
        { kind: 'ref', target: anonymousKey(block) },
        { ...docsDiff(docsOf(node), docsOf(base)), ...ref.docs }
      )
    }
    return withDocs(emitNode(node), ref.docs)
  }

  const types: Record<DefKey, TypeDef<DefKey>> = {}
  for (const id of namedIds) {
    const body = graph.named.get(id) as RefShape<Edge>
    const shape =
      bodyOwner.get(body.target.node) === id
        ? withDocs(emitNode(body.target.node), body.docs)
        : emitEdge(body)
    types[namedKey(id)] = { kind: 'named', id, direction, shape }
  }
  for (const [block, { node }] of representative)
    types[anonymousKey(block)] = {
      kind: 'anonymous',
      direction,
      shape: emitNode(node),
    }

  return { shape: emitEdge(graph.root), types }
}
