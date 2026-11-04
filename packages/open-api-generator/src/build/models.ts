import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import type { StandardJSONSchemaSource } from '../reader/convert.js'
import { createReaderRun, readSchema } from '../reader/read-schema.js'

type Container = Readonly<Record<string, unknown>>

const isSchema = (value: unknown): value is StandardJSONSchemaSource =>
  typeof value === 'object' &&
  value !== null &&
  '~standard' in value &&
  typeof (value as StandardJSONSchemaSource)['~standard'].jsonSchema ===
    'object'

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
 * namespace it exports, whose root is not a reference to an id. Other exports
 * are ignored.
 */
export const modelsWithoutId = (
  models: Container,
  trustedVendors?: readonly string[]
): Diagnostic[] => {
  const run = createReaderRun({ trustedVendors })
  return exportedSchemas(models).flatMap(({ key, schema }) => {
    const { shape, types } = readSchema(
      schema,
      {
        operation: 'config',
        slot: `naming.models ${key}`,
        direction: 'output',
      },
      run
    )
    return shape.kind === 'ref' && types[shape.target]?.kind === 'named'
      ? []
      : [
          diagnostic(
            'naming/model-without-id',
            { slot: `naming.models ${key}` },
            { key }
          ),
        ]
  })
}
