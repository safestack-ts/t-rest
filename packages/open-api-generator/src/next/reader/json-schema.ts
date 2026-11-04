import type { JsonSchemaObject } from './convert.js'

export type JsonSchema = JsonSchemaObject | boolean

const SINGLE = [
  'additionalProperties',
  'propertyNames',
  'items',
  'not',
  'if',
  'then',
  'else',
  'contains',
  'unevaluatedItems',
  'unevaluatedProperties',
  'contentSchema',
] as const
const LISTS = ['prefixItems', 'anyOf', 'oneOf', 'allOf'] as const
const MAPS = [
  'properties',
  'patternProperties',
  '$defs',
  'dependentSchemas',
] as const

export const isSchemaObject = (value: unknown): value is JsonSchemaObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSchema = (value: unknown): value is JsonSchema =>
  typeof value === 'boolean' || isSchemaObject(value)

const escape = (segment: string) =>
  segment.replace(/~/g, '~0').replace(/\//g, '~1')

export const pointerTo = (base: string, ...segments: (string | number)[]) =>
  segments.reduce<string>(
    (pointer, segment) => `${pointer}/${escape(String(segment))}`,
    base
  )

export const resolvePointer = (
  root: JsonSchema,
  pointer: string
): JsonSchema | undefined =>
  pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>(
      (node, segment) =>
        isSchemaObject(node) || Array.isArray(node)
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      root
    ) as JsonSchema | undefined

/** Follows local `$ref`s from `pointer` to the pointer of the subschema they end at. */
export const derefPointer = (root: JsonSchema, pointer: string): string => {
  const seen = new Set<string>()
  let current = pointer
  for (;;) {
    const node = resolvePointer(root, current)
    if (
      !isSchemaObject(node) ||
      typeof node.$ref !== 'string' ||
      !node.$ref.startsWith('#') ||
      seen.has(current)
    )
      return current
    seen.add(current)
    current = node.$ref.slice(1)
  }
}

/** The path below `node` of each of its direct subschemas. */
export const subschemaPaths = (
  node: JsonSchemaObject
): (string | number)[][] => [
  ...SINGLE.filter((keyword) => isSchema(node[keyword])).map((keyword) => [
    keyword,
  ]),
  ...LISTS.flatMap((keyword) => {
    const children = node[keyword]
    return Array.isArray(children)
      ? children.map((_, index) => [keyword, index])
      : []
  }),
  ...MAPS.flatMap((keyword) => {
    const children = node[keyword]
    return isSchemaObject(children)
      ? Object.keys(children)
          .filter((key) => isSchema(children[key]))
          .map((key) => [keyword, key])
      : []
  }),
]

/** Rebuilds a schema bottom-up, calling `visit` on every subschema object with its JSON pointer. */
export const transformSchema = (
  schema: JsonSchema,
  visit: (node: JsonSchemaObject, pointer: string) => JsonSchemaObject,
  pointer = ''
): JsonSchema => {
  if (!isSchemaObject(schema)) return schema

  const node: Record<string, unknown> = { ...schema }
  for (const keyword of SINGLE) {
    const child = node[keyword]
    if (isSchema(child))
      node[keyword] = transformSchema(child, visit, pointerTo(pointer, keyword))
  }
  for (const keyword of LISTS) {
    const children = node[keyword]
    if (Array.isArray(children))
      node[keyword] = children.map((child, index) =>
        transformSchema(child, visit, pointerTo(pointer, keyword, index))
      )
  }
  for (const keyword of MAPS) {
    const children = node[keyword]
    if (isSchemaObject(children))
      node[keyword] = Object.fromEntries(
        Object.entries(children).map(([key, child]) => [
          key,
          isSchema(child)
            ? transformSchema(child, visit, pointerTo(pointer, keyword, key))
            : child,
        ])
      )
  }
  return visit(node, pointer)
}

/** JSON pointers of every subschema that accepts anything (`{}`). */
export const emptySchemaPointers = (schema: JsonSchema): string[] => {
  const pointers: string[] = []
  transformSchema(schema, (node, pointer) => {
    if (Object.keys(node).length === 0) pointers.push(pointer || '/')
    return node
  })
  return pointers
}
