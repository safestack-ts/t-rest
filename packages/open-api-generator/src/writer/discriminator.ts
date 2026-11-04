import { dereference } from '../model/shape.js'
import type { ComponentName, Shape, TypeDef } from '../model/types.js'

type ObjectShape = Extract<Shape<ComponentName>, { kind: 'object' }>

export interface Discriminator {
  readonly propertyName: string
  /** The literal of each member, in member order. */
  readonly tags: readonly string[]
}

/** The single string literal of `field`, if it is required in `object`. */
const tagOf = (
  object: ObjectShape,
  field: string,
  types: Readonly<Record<ComponentName, TypeDef<ComponentName>>>
) => {
  const found = object.fields.find(({ name }) => name === field)
  if (!found?.required) return undefined
  const shape = dereference(found.shape, types)
  return shape.kind === 'enum' &&
    shape.values.length === 1 &&
    typeof shape.values[0] === 'string'
    ? shape.values[0]
    : undefined
}

/**
 * The property that tells the object members of a union apart: required in
 * every member, one string literal each, unique across members. Inferred only
 * when exactly one property qualifies.
 */
export const inferDiscriminator = (
  members: readonly Shape<ComponentName>[],
  types: Readonly<Record<ComponentName, TypeDef<ComponentName>>>
): Discriminator | undefined => {
  const objects = members.map((member) => dereference(member, types))
  if (
    !objects.every((member): member is ObjectShape => member.kind === 'object')
  )
    return undefined

  const found = objects[0].fields.flatMap(({ name }) => {
    const tags = objects.map((member) => tagOf(member, name, types))
    return tags.every((tag): tag is string => tag !== undefined) &&
      new Set(tags).size === tags.length
      ? [{ propertyName: name, tags }]
      : []
  })
  return found.length === 1 ? found[0] : undefined
}
