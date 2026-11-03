import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import type { StandardJSONSchemaSource } from '../reader/convert.js'
import { createReaderRun, readSchema } from '../reader/read-schema.js'

const isSchema = (value: unknown): value is StandardJSONSchemaSource =>
  typeof value === 'object' &&
  value !== null &&
  '~standard' in value &&
  typeof (value as StandardJSONSchemaSource)['~standard'].jsonSchema ===
    'object'

/**
 * `naming/model-without-id` for every schema of a models module whose root is
 * not a reference to an id. Other exports of the module are ignored.
 */
export const modelsWithoutId = (
  models: Readonly<Record<string, unknown>>,
  trustedVendors?: readonly string[]
): Diagnostic[] => {
  const run = createReaderRun({ trustedVendors })
  return Object.entries(models).flatMap(([key, value]) => {
    if (!isSchema(value)) return []
    const { shape, types } = readSchema(
      value,
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
