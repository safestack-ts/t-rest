import type { Docs, Shape, TypeDef } from './types.js'

export type RefShape<R> = Extract<Shape<R>, { kind: 'ref' }>

/** Rebuilds `shape` with every ref replaced by `replace(ref)`, at any depth. */
export const mapRefs = <A, B>(
  shape: Shape<A>,
  replace: (ref: RefShape<A>) => Shape<B>
): Shape<B> => {
  const map = (child: Shape<A>) => mapRefs(child, replace)

  switch (shape.kind) {
    case 'ref':
      return replace(shape)
    case 'array':
      return { ...shape, items: map(shape.items) }
    case 'tuple':
      return {
        ...shape,
        prefix: shape.prefix.map(map),
        ...(shape.rest && { rest: map(shape.rest) }),
      }
    case 'object':
      return {
        ...shape,
        fields: shape.fields.map((field) => ({
          ...field,
          shape: map(field.shape),
        })),
        ...(shape.additional && { additional: map(shape.additional) }),
        ...(shape.propertyNames && { propertyNames: map(shape.propertyNames) }),
      }
    case 'union':
    case 'intersection':
      return { ...shape, members: shape.members.map(map) }
    default:
      return shape
  }
}

/** Every ref in `shape`, in schema order. */
export const refsOf = <R>(shape: Shape<R>): RefShape<R>[] => {
  const refs: RefShape<R>[] = []
  mapRefs(shape, (ref) => {
    refs.push(ref)
    return ref
  })
  return refs
}

export const withDocs = <S extends Shape<unknown>>(
  shape: S,
  docs: Docs | undefined
): S => {
  const merged = { ...shape.docs, ...docs }
  const { docs: _, ...rest } = shape
  return (
    Object.keys(merged).length > 0 ? { ...rest, docs: merged } : rest
  ) as S
}

/** Follows refs from `shape` to the first shape that is not a ref to a known type. */
export const dereference = <R extends string>(
  shape: Shape<R>,
  types: Readonly<Record<R, TypeDef<R>>>
): Shape<R> => {
  const seen = new Set<R>()
  let current = shape
  while (
    current.kind === 'ref' &&
    !seen.has(current.target) &&
    types[current.target]
  ) {
    seen.add(current.target)
    current = types[current.target].shape
  }
  return current
}
