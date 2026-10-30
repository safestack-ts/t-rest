// registered globally so that every copy of this module (e.g. the ESM and the
// CJS build loaded side by side) recognizes the errors of the others
const SUPERTEST_TARGET_ERROR_BRAND = Symbol.for(
  '@t-rest/supertest-adapter/SupertestTargetError'
)

// thrown when the adapter is created for a request target supertest cannot
// serve, i.e. an express router. It is a programming error in the test setup.
export class SupertestTargetError extends Error {
  constructor(message: string) {
    super(message)

    this.name = 'SupertestTargetError'

    Object.defineProperty(this, SUPERTEST_TARGET_ERROR_BRAND, { value: true })
    Object.setPrototypeOf(this, SupertestTargetError.prototype)
  }

  public static isSupertestTargetError(
    error: unknown
  ): error is SupertestTargetError {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as Record<symbol, unknown>)[SUPERTEST_TARGET_ERROR_BRAND] === true
    )
  }

  // makes `instanceof SupertestTargetError` work across module copies,
  // subclasses keep the default prototype chain check
  static [Symbol.hasInstance](instance: unknown): boolean {
    return this === SupertestTargetError
      ? SupertestTargetError.isSupertestTargetError(instance)
      : Function.prototype[Symbol.hasInstance].call(this, instance)
  }
}
