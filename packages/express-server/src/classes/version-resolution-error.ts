// registered globally so that every copy of this module (e.g. the ESM and the
// CJS build loaded side by side) recognizes the errors of the others
const VERSION_RESOLUTION_ERROR_BRAND = Symbol.for(
  '@t-rest/express-server/VersionResolutionError'
)

// thrown if the requested version cannot be resolved to a route version.
// `status` and `statusCode` are picked up by express' default error handler
// so the client receives a 400 instead of a generic 500.
export class VersionResolutionError extends Error {
  public readonly status = 400
  public readonly statusCode = 400

  constructor(message: string) {
    super(message)

    this.name = 'VersionResolutionError'

    Object.defineProperty(this, VERSION_RESOLUTION_ERROR_BRAND, { value: true })
    Object.setPrototypeOf(this, VersionResolutionError.prototype)
  }

  public static isVersionResolutionError(
    error: unknown
  ): error is VersionResolutionError {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as Record<symbol, unknown>)[VERSION_RESOLUTION_ERROR_BRAND] ===
        true
    )
  }

  // makes `instanceof VersionResolutionError` work across module copies,
  // subclasses keep the default prototype chain check
  static [Symbol.hasInstance](instance: unknown): boolean {
    return this === VersionResolutionError
      ? VersionResolutionError.isVersionResolutionError(instance)
      : Function.prototype[Symbol.hasInstance].call(this, instance)
  }
}
