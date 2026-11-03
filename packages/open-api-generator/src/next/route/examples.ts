import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Examples } from '@t-rest/core'
import { Diagnostic, diagnostic, Location } from '../diagnostics/registry.js'
import type { Example } from '../model/types.js'

export interface ExamplesRead {
  readonly examples: Readonly<Record<string, Example>>
  readonly diagnostics: readonly Diagnostic[]
}

const ASYNC_REASON = 'the schema validates asynchronously'

/** Keeps the examples `schema` accepts; the others are `operation/example-invalid`. */
export const validateExamples = (
  schema: StandardSchemaV1,
  examples: Examples<unknown>,
  at: Location
): ExamplesRead => {
  const valid: Record<string, Example> = {}
  const diagnostics: Diagnostic[] = []
  const unchecked: string[] = []

  for (const [name, example] of Object.entries(examples)) {
    const result = schema['~standard'].validate(example.value)
    if (result instanceof Promise) {
      unchecked.push(name)
      valid[name] = example
    } else if (result.issues) {
      diagnostics.push(
        diagnostic('operation/example-invalid', at, {
          example: name,
          issues: result.issues.map(({ message, path }) =>
            path?.length
              ? `${path
                  .map((key) => (typeof key === 'object' ? key.key : key))
                  .join('.')}: ${message}`
              : message
          ),
        })
      )
    } else {
      valid[name] = example
    }
  }

  return {
    examples: valid,
    diagnostics: [
      ...diagnostics,
      ...(unchecked.length > 0
        ? [unverifiable(unchecked, ASYNC_REASON, at)]
        : []),
    ],
  }
}

export const unverifiable = (
  examples: readonly string[],
  reason: string,
  at: Location
): Diagnostic =>
  diagnostic('operation/example-unverifiable', at, {
    examples: [...examples],
    reason,
  })
