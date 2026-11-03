import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import { stableStringify } from '../model/json.js'
import { dereference } from '../model/shape.js'
import type {
  ComponentName,
  Docs,
  Literal,
  Shape,
  TypeDef,
} from '../model/types.js'
import { pointerTo } from '../reader/json-schema.js'
import type { Capabilities, Capability } from './capabilities.js'
import { inferDiscriminator } from './discriminator.js'

export type SchemaObject = { [keyword: string]: unknown }

type Types = Readonly<Record<ComponentName, TypeDef<ComponentName>>>
type Of<K extends Shape<unknown>['kind']> = Extract<
  Shape<ComponentName>,
  { kind: K }
>

export interface SchemaContext {
  readonly capabilities: Capabilities
  readonly types: Types
  readonly report: (diagnostic: Diagnostic) => void
  /** The schemas describe a body that is not JSON, where a string with a media type and no encoding is raw bytes. */
  readonly rawBody: boolean
}

export const componentRef = (name: ComponentName) =>
  `#/components/schemas/${name}`

const NULL: Shape<ComponentName> = { kind: 'null' }

const TYPED = new Set([
  'string',
  'number',
  'boolean',
  'array',
  'tuple',
  'object',
])

type EnumType = 'string' | 'number' | 'boolean'

/** Enum values by JSON type, in order of first appearance, each with its name. */
const enumGroups = (values: readonly Literal[], names?: readonly string[]) => {
  const groups = new Map<EnumType, { value: Literal; name?: string }[]>()
  values.forEach((value, index) => {
    const type = typeof value as EnumType
    groups.set(type, [
      ...(groups.get(type) ?? []),
      { value, ...(names && { name: names[index] }) },
    ])
  })
  return [...groups]
}

/** `value` without its `undefined` entries. */
export const compact = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T

const isPlainString = (shape: Shape<ComponentName>) => {
  const { kind, ...rest } = shape
  return kind === 'string' && Object.keys(rest).length === 0
}

/**
 * Writes model shapes as Schema Objects of one target. Every difference
 * between targets is read from `capabilities`; each approximation is reported
 * as `writer/downgrade` at its JSON pointer in the emitted document.
 */
export const schemaWriter = ({
  capabilities,
  types,
  report,
  rawBody,
}: SchemaContext) => {
  const downgrade = (capability: Capability, pointer: string) =>
    report(
      diagnostic(
        'writer/downgrade',
        { pointer },
        { capability, target: capabilities.openapi }
      )
    )

  const nullKeyword = capabilities.nullable === 'nullable-keyword'
  const nullSchema: SchemaObject = nullKeyword
    ? { type: 'string', enum: [null], nullable: true }
    : { type: 'null' }
  const nullWrapper = nullKeyword ? 'oneOf' : 'anyOf'

  const annotations = (docs: Docs | undefined, pointer: string) => {
    const { examples, extensions = {}, ...plain } = docs ?? {}
    const written: SchemaObject = { ...plain }
    if (examples !== undefined && examples.length > 0) {
      if (capabilities.schemaExamples === 'examples')
        written.examples = examples
      else {
        written.example = examples[0]
        if (examples.length > 1) downgrade('schemaExamples', pointer)
      }
    }
    const keywords = Object.entries(extensions)
    const kept = keywords.filter(
      ([keyword]) =>
        capabilities.annotations === 'any-keyword' || keyword.startsWith('x-')
    )
    if (kept.length < keywords.length) downgrade('annotations', pointer)
    return { ...written, ...Object.fromEntries(kept) }
  }

  const write = (
    shape: Shape<ComponentName>,
    pointer: string
  ): SchemaObject => {
    const schema = core(shape, pointer)
    const docs = annotations(shape.docs, pointer)
    if (Object.keys(docs).length === 0) return schema
    return '$ref' in schema && capabilities.refSiblings === 'all-of-wrapper'
      ? { allOf: [schema], ...docs }
      : { ...schema, ...docs }
  }

  const string = (shape: Of<'string'>, pointer: string): SchemaObject => {
    const {
      kind: _kind,
      docs: _docs,
      contentMediaType,
      contentEncoding,
      ...rest
    } = shape
    if (
      capabilities.binary === 'content-keywords' ||
      (contentMediaType === undefined && contentEncoding === undefined)
    )
      return compact({
        type: 'string',
        ...rest,
        contentEncoding,
        contentMediaType,
      })
    // `byte` keeps a base64 encoding; `binary` keeps raw bytes, whose media type the body declares
    const [format, lossless] =
      contentEncoding === 'base64'
        ? ['byte', contentMediaType === undefined]
        : contentEncoding === undefined && rawBody
        ? ['binary', true]
        : [rest.format, false]
    if (!lossless) downgrade('binary', pointer)
    return compact({ type: 'string', ...rest, format })
  }

  const number = (shape: Of<'number'>): SchemaObject => {
    const {
      kind: _kind,
      docs: _docs,
      integer,
      minimum,
      maximum,
      exclusiveMinimum,
      exclusiveMaximum,
      ...rest
    } = shape
    const type = integer ? 'integer' : 'number'
    if (capabilities.exclusiveBounds === 'number')
      return compact({
        type,
        ...rest,
        minimum,
        maximum,
        exclusiveMinimum,
        exclusiveMaximum,
      })
    const lower =
      exclusiveMinimum === undefined ||
      (minimum !== undefined && minimum > exclusiveMinimum)
        ? { minimum }
        : { minimum: exclusiveMinimum, exclusiveMinimum: true }
    const upper =
      exclusiveMaximum === undefined ||
      (maximum !== undefined && maximum < exclusiveMaximum)
        ? { maximum }
        : { maximum: exclusiveMaximum, exclusiveMaximum: true }
    return compact({ type, ...rest, ...lower, ...upper })
  }

  const enumeration = ({ values, names }: Of<'enum'>): SchemaObject => {
    const schemas = enumGroups(values, names).map(([type, members]) => {
      const memberNames = members.flatMap(({ name }) =>
        name === undefined ? [] : [name]
      )
      return {
        type,
        ...(members.length === 1 && capabilities.literal === 'const'
          ? { const: members[0].value }
          : { enum: members.map(({ value }) => value) }),
        ...(memberNames.length > 0 && { 'x-enum-varnames': memberNames }),
      }
    })
    return schemas.length === 1 ? schemas[0] : { oneOf: schemas }
  }

  const tuple = (shape: Of<'tuple'>, pointer: string): SchemaObject => {
    const { prefix, rest, minItems = prefix.length } = shape
    const bounds = {
      minItems,
      ...(rest === undefined && { maxItems: prefix.length }),
    }
    if (capabilities.tuple === 'prefix-items')
      return {
        type: 'array',
        prefixItems: prefix.map((item, index) =>
          write(item, pointerTo(pointer, 'prefixItems', index))
        ),
        items:
          rest === undefined ? false : write(rest, pointerTo(pointer, 'items')),
        ...bounds,
      }

    const elements = [...prefix, ...(rest ? [rest] : [])]
    const distinct = elements.filter(
      (element, index) =>
        elements.findIndex(
          (other) => stableStringify(other) === stableStringify(element)
        ) === index
    )
    if (distinct.length > 1) downgrade('tuple', pointer)
    const items =
      distinct.length === 0
        ? {}
        : distinct.length === 1
        ? write(distinct[0], pointerTo(pointer, 'items'))
        : {
            anyOf: distinct.map((element, index) =>
              write(element, pointerTo(pointer, 'items', 'anyOf', index))
            ),
          }
    return { type: 'array', items, ...bounds }
  }

  const object = (shape: Of<'object'>, pointer: string): SchemaObject => {
    const { fields, additional, propertyNames } = shape
    const required = fields.filter((field) => field.required)
    const names =
      propertyNames === undefined || isPlainString(propertyNames)
        ? undefined
        : propertyNames
    if (names && capabilities.propertyNames === 'dropped')
      downgrade('propertyNames', pointer)

    return compact({
      type: 'object',
      ...(fields.length > 0 && {
        properties: Object.fromEntries(
          fields.map(({ name, shape }) => [
            name,
            write(shape, pointerTo(pointer, 'properties', name)),
          ])
        ),
      }),
      ...(required.length > 0 && {
        required: required.map(({ name }) => name),
      }),
      ...(additional !== undefined && {
        additionalProperties:
          additional === false
            ? false
            : write(additional, pointerTo(pointer, 'additionalProperties')),
      }),
      ...(names &&
        capabilities.propertyNames === 'kept' && {
          propertyNames: write(names, pointerTo(pointer, 'propertyNames')),
        }),
      minProperties: shape.minProperties,
      maxProperties: shape.maxProperties,
    })
  }

  const isTyped = (shape: Shape<ComponentName>) =>
    TYPED.has(shape.kind) ||
    (shape.kind === 'enum' && enumGroups(shape.values).length === 1)

  const acceptsNull = (
    shape: Shape<ComponentName>,
    seen = new Set<Shape<ComponentName>>()
  ): boolean => {
    const target = dereference(shape, types)
    if (seen.has(target)) return false
    seen.add(target)
    return (
      target.kind === 'null' ||
      (target.kind === 'union' &&
        target.members.some((member) => acceptsNull(member, seen)))
    )
  }

  /** `schema`'s enum with `null` appended, named `Null` when the members are named. */
  const enumWithNull = (schema: SchemaObject, values: unknown) => {
    const names = schema['x-enum-varnames']
    return {
      ...(Array.isArray(values) && { enum: [...values, null] }),
      ...(Array.isArray(names) && { 'x-enum-varnames': [...names, 'Null'] }),
    }
  }

  /** `shape` or `null`; a typed schema stays one schema, anything else gets a null alternative. */
  const nullable = (
    shape: Shape<ComponentName>,
    pointer: string
  ): SchemaObject => {
    // a second null alternative would make `oneOf` reject null
    if (acceptsNull(shape)) return write(shape, pointer)
    if (shape.kind === 'union')
      return write({ ...shape, members: [...shape.members, NULL] }, pointer)
    if (!isTyped(shape))
      return {
        [nullWrapper]: [
          write(shape, pointerTo(pointer, nullWrapper, 0)),
          nullSchema,
        ],
      }
    const schema = write(shape, pointer)
    if (nullKeyword)
      return { ...schema, ...enumWithNull(schema, schema.enum), nullable: true }
    const { const: literal, ...rest } = schema
    return {
      ...rest,
      type: [schema.type, 'null'],
      ...enumWithNull(schema, 'const' in schema ? [literal] : schema.enum),
    }
  }

  /** One enum of literal members, each value once with its name; `undefined` unless every member is a plain enum. */
  const literals = (
    members: readonly Shape<ComponentName>[]
  ): Of<'enum'> | undefined => {
    if (
      !members.every(
        (member): member is Of<'enum'> => member.kind === 'enum' && !member.docs
      )
    )
      return undefined
    const named = new Map<Literal, string | undefined>()
    for (const { values, names } of members)
      values.forEach((value, index) => {
        if (!named.has(value)) named.set(value, names?.[index])
      })
    return {
      kind: 'enum',
      values: [...named.keys()],
      ...(members.every(({ names }) => names !== undefined) && {
        names: [...named.values()] as string[],
      }),
    }
  }

  // a discriminator maps values to components, so inline members get none
  const discriminator = (
    members: readonly Shape<ComponentName>[],
    pointer: string
  ) => {
    const inferred = inferDiscriminator(members, types)
    if (inferred === undefined) return undefined
    if (
      !members.every((member): member is Of<'ref'> => member.kind === 'ref')
    ) {
      report(
        diagnostic(
          'writer/discriminator-not-emitted',
          { pointer },
          { property: inferred.propertyName }
        )
      )
      return undefined
    }
    return {
      propertyName: inferred.propertyName,
      mapping: Object.fromEntries(
        members.map(({ target }, index) => [
          inferred.tags[index],
          componentRef(target),
        ])
      ),
    }
  }

  const union = (shape: Of<'union'>, pointer: string): SchemaObject => {
    const members = shape.members.filter(({ kind }) => kind !== 'null')
    const withNull = members.length < shape.members.length
    if (members.length === 0) return nullSchema
    if (members.some(({ kind }) => kind === 'unknown')) return {}

    const single = members.length === 1 ? members[0] : literals(members)
    if (single)
      return withNull ? nullable(single, pointer) : write(single, pointer)

    const keyword = shape.exclusive ? 'oneOf' : 'anyOf'
    const alternatives = (at: string) =>
      members.map((member, index) =>
        write(member, pointerTo(at, keyword, index))
      )
    const mapping = discriminator(members, pointer)
    if (!mapping)
      return {
        [keyword]: [
          ...alternatives(pointer),
          ...(withNull ? [nullSchema] : []),
        ],
      }
    if (!withNull)
      return { [keyword]: alternatives(pointer), discriminator: mapping }
    // Null sits outside the discriminated union, whose members must be
    // objects. `anyOf`, since a validator that dispatches on the
    // discriminator passes non-objects through it.
    return {
      anyOf: [
        {
          [keyword]: alternatives(pointerTo(pointer, 'anyOf', 0)),
          discriminator: mapping,
        },
        nullSchema,
      ],
    }
  }

  const core = (shape: Shape<ComponentName>, pointer: string): SchemaObject => {
    switch (shape.kind) {
      case 'unknown':
        return {}
      case 'never':
        return { not: {} }
      case 'null':
        return nullSchema
      case 'boolean':
        return { type: 'boolean' }
      case 'string':
        return string(shape, pointer)
      case 'number':
        return number(shape)
      case 'enum':
        return enumeration(shape)
      case 'array':
        return compact({
          type: 'array',
          items: write(shape.items, pointerTo(pointer, 'items')),
          minItems: shape.minItems,
          maxItems: shape.maxItems,
          uniqueItems: shape.uniqueItems,
        })
      case 'tuple':
        return tuple(shape, pointer)
      case 'object':
        return object(shape, pointer)
      case 'union':
        return union(shape, pointer)
      case 'intersection':
        return {
          allOf: shape.members.map((member, index) =>
            write(member, pointerTo(pointer, 'allOf', index))
          ),
        }
      case 'ref':
        return { $ref: componentRef(shape.target) }
    }
  }

  return write
}
