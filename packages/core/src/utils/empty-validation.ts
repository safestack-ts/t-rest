import type { StandardSchemaV1 } from '@standard-schema/spec'

export interface EmptySchema extends StandardSchemaV1<{}> {
  type: 'empty'
}

export const emptyValidation: EmptySchema = {
  type: 'empty',
  '~standard': {
    version: 1,
    vendor: 'valizod',
    validate(value) {
      return typeof value === 'object' && !!value
        ? { value }
        : { issues: [{ message: 'Received an non-object reuqest type input' }] }
    },
  },
}

export type EmptyValidation = StandardSchemaV1.InferOutput<EmptySchema>
