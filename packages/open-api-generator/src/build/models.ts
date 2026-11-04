import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import type { StandardJSONSchemaSource } from '../reader/convert.js'
import { createReaderRun, readSchema } from '../reader/read-schema.js'

type Container = Readonly<Record<string, unknown>>

/**
 * A Standard Schema validator or Standard JSON Schema source, whether or not it
 * can convert to JSON Schema. Some libraries' schemas are functions.
 */
const isSchema = (value: unknown): value is StandardJSONSchemaSource => {
  if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null
  )
    return false
  const standard: unknown = (value as { '~standard'?: unknown })['~standard']
  return (
    typeof standard === 'object' &&
    standard !== null &&
    (typeof (standard as { validate?: unknown }).validate === 'function' ||
      typeof (standard as { jsonSchema?: unknown }).jsonSchema === 'object')
  )
}

/** A module namespace (`export * as Customer`) or a plain object grouping models. */
const isContainer = (value: unknown): value is Container => {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}

/**
 * Every schema reachable from `models` through nested containers, keyed by its
 * dotted export path. Each schema and container is visited once, so re-exports
 * and cycles neither repeat nor loop.
 */
const exportedSchemas = (models: Container) => {
  const seen = new Set<unknown>([models])
  const visit = (
    container: Container,
    prefix: string
  ): { key: string; schema: StandardJSONSchemaSource }[] =>
    Object.entries(container).flatMap(([name, value]) => {
      if (seen.has(value)) return []
      const key = `${prefix}${name}`
      if (isSchema(value)) {
        seen.add(value)
        return [{ key, schema: value }]
      }
      if (!isContainer(value)) return []
      seen.add(value)
      return visit(value, `${key}.`)
    })
  return visit(models, '')
}

/**
 * `naming/model-without-id` for every schema of a models module, or of a
 * namespace it exports, whose root is not a reference to an id, and
 * `schema/no-json-schema` for one that cannot convert to JSON Schema. Other
 * exports are ignored.
 */
export const modelsWithoutId = (
  models: Container,
  trustedVendors?: readonly string[]
): Diagnostic[] => {
  const run = createReaderRun({ trustedVendors })
  return exportedSchemas(models).flatMap(({ key, schema }) => {
    const slot = `naming.models ${key}`
    const { vendor, jsonSchema } = schema['~standard']
    if (!jsonSchema)
      return [diagnostic('schema/no-json-schema', { slot }, { vendor })]

    const { shape, types } = readSchema(
      schema,
      { operation: 'config', slot, direction: 'output' },
      run
    )
    return shape.kind === 'ref' && types[shape.target]?.kind === 'named'
      ? []
      : [diagnostic('naming/model-without-id', { slot }, { key })]
  })
}
