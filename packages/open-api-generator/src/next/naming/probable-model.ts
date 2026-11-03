import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import { stableStringify } from '../model/json.js'
import type { Operation, Shape } from '../model/types.js'

const MIN_FIELDS = 2
const MIN_OPERATIONS = 2

const withoutDocs = <R>(shape: Shape<R>): unknown => {
  const { docs: _, ...structure } = shape
  switch (shape.kind) {
    case 'array':
      return { ...structure, items: withoutDocs(shape.items) }
    case 'tuple':
      return {
        ...structure,
        prefix: shape.prefix.map(withoutDocs),
        rest: shape.rest && withoutDocs(shape.rest),
      }
    case 'object':
      return {
        ...structure,
        fields: shape.fields.map((field) => ({
          ...field,
          shape: withoutDocs(field.shape),
        })),
        additional: shape.additional && withoutDocs(shape.additional),
        propertyNames: shape.propertyNames && withoutDocs(shape.propertyNames),
      }
    case 'union':
    case 'intersection':
      return { ...structure, members: shape.members.map(withoutDocs) }
    default:
      return structure
  }
}

/** Inline objects of a body, the root and every nested one; refs are not followed. */
const inlineObjects = <R>(
  shape: Shape<R>
): Extract<Shape<R>, { kind: 'object' }>[] => {
  switch (shape.kind) {
    case 'object':
      return [
        shape,
        ...shape.fields.flatMap((field) => inlineObjects(field.shape)),
        ...(shape.additional ? inlineObjects(shape.additional) : []),
      ]
    case 'array':
      return inlineObjects(shape.items)
    case 'tuple':
      return [...shape.prefix, ...(shape.rest ? [shape.rest] : [])].flatMap(
        inlineObjects
      )
    case 'union':
    case 'intersection':
      return shape.members.flatMap(inlineObjects)
    default:
      return []
  }
}

const bodies = <R>(operation: Operation<R>) => [
  ...Object.values(operation.requestBody?.content ?? {}).map((media) => ({
    slot: 'body',
    shape: media.shape,
  })),
  ...Object.entries(operation.responses).flatMap(([status, slot]) =>
    slot.kind === 'inline'
      ? Object.values(slot.response.content).map((media) => ({
          slot: `response ${status}`,
          shape: media.shape,
        }))
      : []
  ),
]

/**
 * `naming/probable-model-without-id` for each inline object of at least two
 * fields that request or response bodies of two or more operations repeat.
 */
export const probableModels = <R>(
  operations: readonly Operation<R>[]
): Diagnostic[] => {
  const seen = new Map<
    string,
    { fields: string[]; slot: string; operations: Set<string> }
  >()
  for (const operation of operations)
    for (const { slot, shape } of bodies(operation))
      for (const object of inlineObjects(shape)) {
        if (object.fields.length < MIN_FIELDS) continue
        const key = stableStringify(withoutDocs(object))
        const entry = seen.get(key) ?? {
          fields: object.fields.map(({ name }) => name),
          slot,
          operations: new Set<string>(),
        }
        entry.operations.add(operation.key)
        seen.set(key, entry)
      }

  return [...seen.values()]
    .filter((entry) => entry.operations.size >= MIN_OPERATIONS)
    .map(({ fields, slot, operations }) => {
      const keys = [...operations]
      return diagnostic(
        'naming/probable-model-without-id',
        { operation: keys[0], slot },
        { fields, operations: keys }
      )
    })
}
