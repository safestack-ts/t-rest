import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from '@standard-schema/spec'

export interface EmptySchema
  extends StandardSchemaV1<{}>,
    StandardJSONSchemaV1<{}> {
  type: 'empty'
  readonly '~standard': StandardSchemaV1.Props<{}> &
    StandardJSONSchemaV1.Props<{}>
}

const objectWithoutProperties = () => ({ type: 'object' })

export const emptyValidation: EmptySchema = {
  type: 'empty',
  '~standard': {
    version: 1,
    vendor: 't-rest',
    validate(value) {
      return typeof value === 'object' && !!value
        ? { value }
        : { issues: [{ message: 'Received a non-object request type input' }] }
    },
    jsonSchema: {
      input: objectWithoutProperties,
      output: objectWithoutProperties,
    },
  },
}

export type EmptyValidation = StandardSchemaV1.InferOutput<EmptySchema>
