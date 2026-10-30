import { StandardSchemaV1 } from '@standard-schema/spec'

// registered globally so that every copy of this module (e.g. the ESM and the
// CJS build loaded side by side) recognizes the errors of the others
const VALIDATION_ERROR_BRAND = Symbol.for('@t-rest/core/ValidationError')

export class ValidationError extends Error {
  public readonly issues: readonly StandardSchemaV1.Issue[]
  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super(issues.map((issue) => issue.message).join('\n'))

    this.issues = issues
    this.name = 'ValidationError'

    Object.defineProperty(this, VALIDATION_ERROR_BRAND, { value: true })
    Object.setPrototypeOf(this, ValidationError.prototype)
  }

  public static isValidationError(error: unknown): error is ValidationError {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as Record<symbol, unknown>)[VALIDATION_ERROR_BRAND] === true
    )
  }

  // makes `instanceof ValidationError` work across module copies,
  // subclasses keep the default prototype chain check
  static [Symbol.hasInstance](instance: unknown): boolean {
    return this === ValidationError
      ? ValidationError.isValidationError(instance)
      : Function.prototype[Symbol.hasInstance].call(this, instance)
  }

  override toString() {
    return this.message
  }
}
