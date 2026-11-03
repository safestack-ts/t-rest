import { Diagnostic, diagnostic, Location } from '../diagnostics/registry.js'
import type { DefKey, Direction, Shape, TypeDef } from '../model/types.js'
import {
  Conversion,
  convert,
  ConversionCache,
  createConversionCache,
  JsonSchemaObject,
  StandardJSONSchemaSource,
} from './convert.js'
import { buildGraph } from './graph.js'
import {
  derefPointer,
  emptySchemaPointers,
  JsonSchema,
  pointerTo,
  transformSchema,
} from './json-schema.js'
import { normalize, without } from './normalize.js'
import { unify } from './unify.js'
import { VendorPolicy, vendorPolicy } from './vendor-policy.js'

/** State shared by every read of one generator run. Never module-global. */
export interface ReaderRun {
  readonly cache: ConversionCache
  readonly policyOf: (vendor: string) => VendorPolicy
}

export const createReaderRun = (
  options: { readonly trustedVendors?: readonly string[] } = {}
): ReaderRun => ({
  cache: createConversionCache(),
  policyOf: (vendor) => vendorPolicy(vendor, options.trustedVendors ?? []),
})

export interface SchemaSlot {
  /** `Operation.key` of the route the schema belongs to. */
  readonly operation: string
  /** `request`, `response 200 application/json`, ... */
  readonly slot: string
  readonly direction: Direction
  /** Multipart file field names; placeholders under these names are expected. */
  readonly multipartFiles?: readonly string[]
}

export interface SchemaRead {
  readonly shape: Shape<DefKey>
  readonly types: Readonly<Record<DefKey, TypeDef<DefKey>>>
  readonly diagnostics: readonly Diagnostic[]
}

const unknownShape: SchemaRead['shape'] = { kind: 'unknown' }

/** Where a multipart file field of the body slot, or the items of a multiple one, sits. */
const filePointers = (schema: JsonSchema, files: readonly string[]) => {
  const body = derefPointer(
    schema,
    pointerTo(derefPointer(schema, ''), 'properties', 'body')
  )
  return files.flatMap((name) => {
    const field = derefPointer(schema, pointerTo(body, 'properties', name))
    return [field, derefPointer(schema, pointerTo(field, 'items'))]
  })
}

const lenientDiagnostic = (
  conversion: Extract<Conversion, { kind: 'lenient' }>,
  { direction, multipartFiles = [] }: SchemaSlot,
  at: Location
): Diagnostic => {
  const placeholders = emptySchemaPointers(conversion.schema)
  const data = { error: conversion.error, placeholders }
  if (direction === 'output')
    return diagnostic('schema/unrepresentable', at, data)

  const files = filePointers(conversion.schema, multipartFiles)
  const covered =
    placeholders.length > 0 &&
    placeholders.every((pointer) => files.includes(pointer))
  return covered
    ? diagnostic('schema/multipart-placeholder', at, data)
    : diagnostic('schema/unrepresentable-request', at, data)
}

const inputForClosedness = (
  schema: StandardJSONSchemaSource,
  policy: VendorPolicy,
  run: ReaderRun
): JsonSchema | undefined => {
  const input = convert(schema, 'input', policy, run.cache)
  return input.kind === 'converted' ? input.schema : undefined
}

/** `readOnly` and `writeOnly` say who sends a value, not which values validate. */
const withoutAccessAnnotations = (schema: JsonSchema) =>
  transformSchema(schema, (node) => without(node, 'readOnly', 'writeOnly'))

/**
 * Whether the input and output conversions of `schema` accept the same values
 * after normalization, so a value validated as input also documents the output.
 */
export const directionsAgree = (
  schema: StandardJSONSchemaSource,
  run: ReaderRun
): boolean => {
  const policy = run.policyOf(schema['~standard'].vendor)
  const input = convert(schema, 'input', policy, run.cache)
  const output = convert(schema, 'output', policy, run.cache)
  if (input.kind !== 'converted' || output.kind !== 'converted') return false

  const options = { policy, input: input.schema }
  const normalized = (direction: Direction, converted: JsonSchemaObject) =>
    JSON.stringify(
      withoutAccessAnnotations(normalize(converted, { ...options, direction }))
    )
  return (
    normalized('input', input.schema) === normalized('output', output.schema)
  )
}

/** Reads one schema in one direction into model shapes. Pure apart from the run's cache. */
export const readSchema = (
  schema: StandardJSONSchemaSource,
  slot: SchemaSlot,
  run: ReaderRun
): SchemaRead => {
  const at: Location = { operation: slot.operation, slot: slot.slot }
  const vendor = schema['~standard'].vendor
  const policy = run.policyOf(vendor)
  const conversion = convert(schema, slot.direction, policy, run.cache)

  switch (conversion.kind) {
    case 'no-json-schema':
      return {
        shape: unknownShape,
        types: {},
        diagnostics: [diagnostic('schema/no-json-schema', at, { vendor })],
      }
    case 'duplicate-id':
      return {
        shape: unknownShape,
        types: {},
        diagnostics: [
          diagnostic('naming/duplicate-id', at, { id: conversion.id }),
        ],
      }
    case 'failed':
      return {
        shape: unknownShape,
        types: {},
        diagnostics: [
          diagnostic('schema/conversion-failed', at, {
            error: conversion.error,
          }),
        ],
      }
  }

  const normalized = normalize(conversion.schema, {
    direction: slot.direction,
    policy,
    input:
      slot.direction === 'output'
        ? inputForClosedness(schema, policy, run)
        : undefined,
  })
  const graph = buildGraph(normalized, policy)
  const { shape, types } = unify(graph, {
    direction: slot.direction,
    anonymousScope: `${slot.operation}#${slot.slot}`,
  })

  return {
    shape,
    types,
    diagnostics: [
      ...(conversion.kind === 'lenient'
        ? [lenientDiagnostic(conversion, slot, at)]
        : []),
      ...graph.unsupported.map(({ keyword, pointer }) =>
        diagnostic(
          'schema/unsupported-keyword',
          { ...at, pointer },
          { keyword }
        )
      ),
    ],
  }
}
