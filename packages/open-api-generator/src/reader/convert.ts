import type { Direction } from '../model/types.js'
import type { VendorPolicy } from './vendor-policy.js'

export type JsonSchemaObject = { readonly [keyword: string]: unknown }

interface JsonSchemaOptions {
  readonly target: 'draft-2020-12'
  readonly libraryOptions?: Readonly<Record<string, unknown>>
}

/** The part of a Standard JSON Schema the reader uses. */
export interface StandardJSONSchemaSource {
  readonly '~standard': {
    readonly vendor: string
    readonly jsonSchema?: {
      readonly input: (options: JsonSchemaOptions) => JsonSchemaObject
      readonly output: (options: JsonSchemaOptions) => JsonSchemaObject
    }
  }
}

export type Conversion =
  | { readonly kind: 'converted'; readonly schema: JsonSchemaObject }
  /** The strict call threw; `schema` is the vendor's lenient result. */
  | {
      readonly kind: 'lenient'
      readonly schema: JsonSchemaObject
      readonly error: string
    }
  | { readonly kind: 'duplicate-id'; readonly id: string }
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'no-json-schema' }

/** One per generator run, so a schema shared by many routes converts once. */
export type ConversionCache = WeakMap<
  object,
  Partial<Record<Direction, Conversion>>
>

export const createConversionCache = (): ConversionCache => new WeakMap()

const DUPLICATE_ID = /Duplicate schema id "([^"]+)"/

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const convertUncached = (
  schema: StandardJSONSchemaSource,
  direction: Direction,
  policy: VendorPolicy
): Conversion => {
  const jsonSchema = schema['~standard'].jsonSchema
  if (!jsonSchema) return { kind: 'no-json-schema' }

  try {
    return {
      kind: 'converted',
      schema: jsonSchema[direction]({ target: 'draft-2020-12' }),
    }
  } catch (strictError) {
    const error = messageOf(strictError)
    const duplicate = DUPLICATE_ID.exec(error)
    if (duplicate) return { kind: 'duplicate-id', id: duplicate[1] }
    if (!policy.lenientOptions) return { kind: 'failed', error }

    try {
      return {
        kind: 'lenient',
        error,
        schema: jsonSchema[direction]({
          target: 'draft-2020-12',
          libraryOptions: policy.lenientOptions,
        }),
      }
    } catch (lenientError) {
      return { kind: 'failed', error: messageOf(lenientError) }
    }
  }
}

export const convert = (
  schema: StandardJSONSchemaSource,
  direction: Direction,
  policy: VendorPolicy,
  cache: ConversionCache
): Conversion => {
  const entry = cache.get(schema) ?? {}
  const conversion =
    entry[direction] ?? convertUncached(schema, direction, policy)
  cache.set(schema, { ...entry, [direction]: conversion })
  return conversion
}
