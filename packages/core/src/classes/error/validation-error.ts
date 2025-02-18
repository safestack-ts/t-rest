import { StandardSchemaV1 } from '@standard-schema/spec'
import { util } from 'zod'

export class ValidationError extends Error {
  public readonly issues: readonly StandardSchemaV1.Issue[]
  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super(issues.map((issue) => issue.message).join('\n'))

    this.issues = issues

    Object.setPrototypeOf(this, ValidationError.prototype)
  }

  override toString() {
    return this.message
  }
  override get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2)
  }
}
