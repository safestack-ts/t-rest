import type { Shape } from './types.js'

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
