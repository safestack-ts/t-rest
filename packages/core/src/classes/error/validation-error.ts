import { StandardSchemaV1 } from '@standard-schema/spec'

export class ValidationError extends Error {
  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super(issues.map((issue) => issue.message).join('\n'))

    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}
