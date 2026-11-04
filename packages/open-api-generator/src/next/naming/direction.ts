import { stableStringify } from '../model/json.js'
import { mapRefs } from '../model/shape.js'
import type { DefKey, TypeDef } from '../model/types.js'
import { refinePartition } from '../reader/partition.js'

export interface TypeBlocks {
  /** Ids whose `input:` and `output:` types are one component. */
  readonly merged: ReadonlySet<string>
  /** Types in one block are equal. */
  readonly blockOf: (key: DefKey) => number
}

/**
 * The coarsest partition of the type graph in which types share a block when
 * their shapes are equal, assuming every pair they reference shares one too:
 * the greatest fixpoint. Named types share a block only with the other
 * direction of their id, types named by `nameAnonymous` for a slot only with
 * types of the same name; anonymous recursion with any equal anonymous recursion.
 */
export const typeBlocks = (
  types: Readonly<Record<DefKey, TypeDef<DefKey>>>,
  slotNames: ReadonlyMap<DefKey, string>
): TypeBlocks => {
  const keys = Object.keys(types) as DefKey[]
  const index = new Map(keys.map((key, node) => [key, node]))
  const label = (type: TypeDef<DefKey>, key: DefKey) =>
    type.kind === 'named'
      ? `id:${type.id}`
      : slotNames.has(key)
      ? `slot:${slotNames.get(key)}`
      : 'anonymous'

  const blocks = refinePartition(keys.length, (node, blockOf) => {
    const type = types[keys[node]]
    const shape = mapRefs(type.shape, (ref) => {
      const target = index.get(ref.target)
      return target === undefined
        ? ref
        : { ...ref, target: `#${blockOf(target)}` }
    })
    return `${label(type, keys[node])}|${stableStringify(shape)}`
  })
  const blockOf = (key: DefKey) => blocks[index.get(key) as number]

  const merged = new Set<string>()
  for (const key of keys) {
    const type = types[key]
    if (type.kind !== 'named' || type.direction !== 'input') continue
    const output = `output:${type.id}` as DefKey
    if (index.has(output) && blockOf(output) === blockOf(key))
      merged.add(type.id)
  }
  return { merged, blockOf }
}
