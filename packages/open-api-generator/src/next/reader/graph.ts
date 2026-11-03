import { RefShape, withDocs } from '../model/shape.js'
import type { Docs, Field, Literal, Shape } from '../model/types.js'
import type { JsonSchemaObject } from './convert.js'
import {
  isSchemaObject,
  JsonSchema,
  pointerTo,
  resolvePointer,
} from './json-schema.js'
import type { VendorPolicy } from './vendor-policy.js'

export type NodeId = number

/** A use of a node: `pointer` is where the use sits in the converted document. */
export interface Edge {
  readonly node: NodeId
  readonly pointer: string
}

/**
 * Every subschema is a node. A node's shape holds its inline structure, and a
 * ref at each child position whose `docs` are the annotations of that use site.
 * A ref to a trusted def points at the def's body, so recursion through a named
 * def is a cycle like any other.
 */
export interface SchemaGraph {
  readonly nodes: readonly Shape<Edge>[]
  readonly root: RefShape<Edge>
  /** Trusted defs by author id. */
  readonly named: ReadonlyMap<string, RefShape<Edge>>
  /** Trusted defs that are only a `$ref` to another schema. */
  readonly aliases: ReadonlySet<string>
  /** Nodes some `$ref` points at: generated defs, untrusted defs, `#`. */
  readonly refTargets: ReadonlySet<NodeId>
  readonly unsupported: readonly { keyword: string; pointer: string }[]
}

const META = new Set([
  '$schema',
  '$id',
  '$comment',
  '$anchor',
  '$dynamicAnchor',
  '$vocabulary',
  '$defs',
])
const DOCS = new Set([
  'title',
  'description',
  'examples',
  'default',
  'deprecated',
  'readOnly',
  'writeOnly',
])
const ENUM_NAMES = ['x-enum-varnames', 'x-enumNames']
const STRUCTURAL = new Set([
  'type',
  'enum',
  'const',
  'anyOf',
  'oneOf',
  'allOf',
  '$ref',
  'not',
])
const UNSUPPORTED = new Set([
  'if',
  'then',
  'else',
  'patternProperties',
  'contains',
  'minContains',
  'maxContains',
  'dependentRequired',
  'dependentSchemas',
  'dependencies',
  'unevaluatedProperties',
  'unevaluatedItems',
  '$dynamicRef',
])

type TypeName =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null'
  | 'array'
  | 'object'

/** Keywords that only apply to one type, and imply it when `type` is missing. */
const TYPE_KEYWORDS: Readonly<
  Record<'string' | 'number' | 'array' | 'object', readonly string[]>
> = {
  string: [
    'minLength',
    'maxLength',
    'pattern',
    'format',
    'contentEncoding',
    'contentMediaType',
  ],
  number: [
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
  ],
  array: ['items', 'prefixItems', 'minItems', 'maxItems', 'uniqueItems'],
  object: [
    'properties',
    'required',
    'additionalProperties',
    'propertyNames',
    'minProperties',
    'maxProperties',
  ],
}
const TYPED = new Set(Object.values(TYPE_KEYWORDS).flat())

/** The keywords among `keys` whose values pass `is`, as model fields of the same name. */
const pick = (
  node: JsonSchemaObject,
  keys: readonly string[],
  is: (v: unknown) => boolean
): {} =>
  Object.fromEntries(
    keys.filter((key) => is(node[key])).map((key) => [key, node[key]])
  )

const isNumber = (v: unknown) => typeof v === 'number'
const isString = (v: unknown) => typeof v === 'string'
const isLiteral = (v: unknown): v is Literal =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'

const isEmptySchema = (schema: unknown) =>
  schema === true ||
  (isSchemaObject(schema) && Object.keys(schema).length === 0)

const readDocs = (
  node: JsonSchemaObject,
  hasEnum: boolean
): Docs | undefined => {
  const docs: Record<string, unknown> = {}
  const extensions: Record<string, unknown> = {}
  for (const [keyword, value] of Object.entries(node)) {
    if (DOCS.has(keyword)) docs[keyword] = value
    else if (hasEnum && ENUM_NAMES.includes(keyword)) continue
    else if (
      !META.has(keyword) &&
      !STRUCTURAL.has(keyword) &&
      !UNSUPPORTED.has(keyword) &&
      !TYPED.has(keyword)
    )
      extensions[keyword] = value
  }
  if (Object.keys(extensions).length > 0) docs.extensions = extensions
  return Object.keys(docs).length > 0 ? docs : undefined
}

const typeNamesOf = (node: JsonSchemaObject): TypeName[] => {
  if (typeof node.type === 'string') return [node.type as TypeName]
  if (Array.isArray(node.type)) return node.type as TypeName[]
  return (Object.keys(TYPE_KEYWORDS) as (keyof typeof TYPE_KEYWORDS)[]).filter(
    (type) => TYPE_KEYWORDS[type].some((keyword) => keyword in node)
  )
}

const union = (members: Shape<Edge>[], exclusive: boolean): Shape<Edge> =>
  members.length === 1 ? members[0] : { kind: 'union', members, exclusive }

export const buildGraph = (
  schema: JsonSchema,
  policy: VendorPolicy
): SchemaGraph => {
  const nodes: Shape<Edge>[] = []
  const nodeAtPointer = new Map<string, NodeId>()
  const named = new Map<string, RefShape<Edge>>()
  const aliases = new Set<string>()
  const refTargets = new Set<NodeId>()
  const unsupported: { keyword: string; pointer: string }[] = []

  const defs =
    isSchemaObject(schema) && isSchemaObject(schema.$defs) ? schema.$defs : {}
  const isNamedKey = (key: string) =>
    policy.defs === 'trust' && key in defs && !policy.generatedKeys?.test(key)

  const addNode = (read: (id: NodeId) => Shape<Edge>) => {
    const id = nodes.length
    nodes.push({ kind: 'unknown' })
    nodes[id] = read(id)
    return id
  }

  const nodeAt = (pointer: string): NodeId => {
    const known = nodeAtPointer.get(pointer)
    if (known !== undefined) return known
    return addNode((id) => {
      nodeAtPointer.set(pointer, id)
      const target = resolvePointer(schema, pointer)
      if (target === undefined) unsupported.push({ keyword: '$ref', pointer })
      return readShape(target ?? true, pointer)
    })
  }

  const namedEdge = (key: string): RefShape<Edge> => {
    const known = named.get(key)
    if (known !== undefined) return known
    const def = defs[key] as JsonSchema
    const pointer = pointerTo('', '$defs', key)
    const alias = isAnnotatedRef(def)
    if (alias) aliases.add(key)
    const edge: RefShape<Edge> = alias
      ? edgeTo(def, pointer)
      : { kind: 'ref', target: { node: nodeAt(pointer), pointer } }
    named.set(key, edge)
    return edge
  }

  const refTarget = (ref: string, pointer: string): NodeId => {
    const defKey = /^#\/\$defs\/([^/]+)$/
      .exec(ref)?.[1]
      ?.replace(/~1/g, '/')
      .replace(/~0/g, '~')
    if (defKey !== undefined && isNamedKey(defKey))
      return namedEdge(defKey).target.node
    if (ref !== '#' && !ref.startsWith('#/')) {
      unsupported.push({ keyword: '$ref', pointer })
      return addNode(() => ({ kind: 'unknown' }))
    }
    const id = nodeAt(ref.slice(1))
    refTargets.add(id)
    return id
  }

  const hasOnlyAnnotations = (node: JsonSchemaObject) =>
    Object.keys(node).every(
      (keyword) =>
        keyword === '$ref' ||
        !(
          STRUCTURAL.has(keyword) ||
          TYPED.has(keyword) ||
          UNSUPPORTED.has(keyword)
        )
    )

  const isAnnotatedRef = (
    schema: JsonSchema
  ): schema is JsonSchemaObject & { $ref: string } =>
    isSchemaObject(schema) &&
    typeof schema.$ref === 'string' &&
    hasOnlyAnnotations(schema)

  const edgeTo = (child: JsonSchema, pointer: string): RefShape<Edge> => {
    if (isAnnotatedRef(child)) {
      const ref: RefShape<Edge> = {
        kind: 'ref',
        target: { node: refTarget(child.$ref, pointer), pointer },
      }
      return withDocs(ref, readDocs(child, false))
    }
    const node = addNode(() => readShape(child, pointer))
    return { kind: 'ref', target: { node, pointer } }
  }

  const literals = (
    values: unknown[],
    node: JsonSchemaObject,
    pointer: string
  ): Shape<Edge> => {
    const scalars = values.filter(isLiteral)
    if (
      scalars.length + values.filter((v) => v === null).length <
      values.length
    )
      unsupported.push({ keyword: 'enum', pointer })
    const names = ENUM_NAMES.map((key) => node[key]).find(
      (n): n is string[] =>
        Array.isArray(n) && n.length === scalars.length && n.every(isString)
    )
    const members: Shape<Edge>[] = []
    if (scalars.length > 0)
      members.push({ kind: 'enum', values: scalars, ...(names && { names }) })
    if (values.includes(null)) members.push({ kind: 'null' })
    return members.length === 0 ? { kind: 'never' } : union(members, false)
  }

  const objectShape = (
    node: JsonSchemaObject,
    pointer: string
  ): Shape<Edge> => {
    const required = new Set(Array.isArray(node.required) ? node.required : [])
    const properties = isSchemaObject(node.properties) ? node.properties : {}
    const fields: Field<Edge>[] = Object.entries(properties).map(
      ([name, property]) => ({
        name,
        required: required.has(name),
        shape: edgeTo(
          property as JsonSchema,
          pointerTo(pointer, 'properties', name)
        ),
      })
    )
    const { additionalProperties, propertyNames } = node
    return {
      kind: 'object',
      fields,
      ...(additionalProperties === false
        ? { additional: false as const }
        : additionalProperties !== undefined &&
          !isEmptySchema(additionalProperties)
        ? {
            additional: edgeTo(
              additionalProperties as JsonSchema,
              pointerTo(pointer, 'additionalProperties')
            ),
          }
        : {}),
      ...(propertyNames !== undefined && {
        propertyNames: edgeTo(
          propertyNames as JsonSchema,
          pointerTo(pointer, 'propertyNames')
        ),
      }),
      ...pick(node, ['minProperties', 'maxProperties'], isNumber),
    }
  }

  const arrayShape = (node: JsonSchemaObject, pointer: string): Shape<Edge> => {
    const { items, prefixItems } = node
    const itemsShape = (): Shape<Edge> =>
      items === undefined
        ? { kind: 'unknown' }
        : edgeTo(items as JsonSchema, pointerTo(pointer, 'items'))

    if (!Array.isArray(prefixItems))
      return {
        kind: 'array',
        items: itemsShape(),
        ...pick(node, ['minItems', 'maxItems'], isNumber),
        ...pick(node, ['uniqueItems'], (v) => typeof v === 'boolean'),
      }

    const prefix = prefixItems.map((item, index) =>
      edgeTo(item, pointerTo(pointer, 'prefixItems', index))
    )
    return {
      kind: 'tuple',
      prefix,
      ...(items !== false && { rest: itemsShape() }),
      ...(typeof node.minItems === 'number' &&
        node.minItems < prefix.length && { minItems: node.minItems }),
    }
  }

  const typedShape = (
    type: TypeName,
    node: JsonSchemaObject,
    pointer: string
  ): Shape<Edge> => {
    switch (type) {
      case 'string':
        return {
          kind: 'string',
          ...pick(
            node,
            TYPE_KEYWORDS.string,
            (v) => isString(v) || isNumber(v)
          ),
        }
      case 'number':
      case 'integer':
        return {
          kind: 'number',
          integer: type === 'integer',
          ...pick(node, TYPE_KEYWORDS.number, isNumber),
          ...pick(node, ['format'], isString),
        }
      case 'boolean':
        return { kind: 'boolean' }
      case 'null':
        return { kind: 'null' }
      case 'array':
        return arrayShape(node, pointer)
      case 'object':
        return objectShape(node, pointer)
      default:
        unsupported.push({ keyword: 'type', pointer })
        return { kind: 'unknown' }
    }
  }

  const readShape = (json: JsonSchema, pointer: string): Shape<Edge> => {
    if (json === true) return { kind: 'unknown' }
    if (json === false) return { kind: 'never' }

    const hasEnum = 'const' in json || Array.isArray(json.enum)
    for (const keyword of Object.keys(json))
      if (UNSUPPORTED.has(keyword)) unsupported.push({ keyword, pointer })

    const parts: Shape<Edge>[] = []
    if ('const' in json) parts.push(literals([json.const], json, pointer))
    else if (Array.isArray(json.enum))
      parts.push(literals(json.enum, json, pointer))
    else {
      const typed = typeNamesOf(json).map((type) =>
        typedShape(type, json, pointer)
      )
      if (typed.length > 0) parts.push(union(typed, false))
    }
    if (Array.isArray(json.anyOf))
      parts.push(
        union(
          json.anyOf.map((s, i) => edgeTo(s, pointerTo(pointer, 'anyOf', i))),
          false
        )
      )
    if (Array.isArray(json.oneOf))
      parts.push(
        union(
          json.oneOf.map((s, i) => edgeTo(s, pointerTo(pointer, 'oneOf', i))),
          true
        )
      )
    if (Array.isArray(json.allOf))
      parts.push(
        ...json.allOf.map((s, i) => edgeTo(s, pointerTo(pointer, 'allOf', i)))
      )
    if (typeof json.$ref === 'string')
      parts.push({
        kind: 'ref',
        target: { node: refTarget(json.$ref, pointer), pointer },
      })
    if ('not' in json) {
      if (isEmptySchema(json.not)) parts.push({ kind: 'never' })
      else unsupported.push({ keyword: 'not', pointer })
    }

    const shape: Shape<Edge> =
      parts.length === 0
        ? { kind: 'unknown' }
        : parts.length === 1
        ? parts[0]
        : { kind: 'intersection', members: parts }
    return withDocs(shape, readDocs(json, hasEnum))
  }

  for (const key of Object.keys(defs)) if (isNamedKey(key)) namedEdge(key)

  const root: RefShape<Edge> = isAnnotatedRef(schema)
    ? edgeTo(schema, '')
    : { kind: 'ref', target: { node: nodeAt(''), pointer: '' } }

  return { nodes, root, named, aliases, refTargets, unsupported }
}
