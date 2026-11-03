import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Examples } from './response-descriptor.js'

export interface ValidateOptions<TValidator> {
  /** Example requests, typed against the input of the validator. */
  readonly examples?: Examples<
    TValidator extends StandardSchemaV1
      ? StandardSchemaV1.InferInput<TValidator>
      : never
  >
}
