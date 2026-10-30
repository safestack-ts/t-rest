// registered globally so that every copy of this module (e.g. the ESM and the
// CJS build loaded side by side) recognizes the errors of the others
const ROUTE_SETUP_ERROR_BRAND = Symbol.for(
  '@t-rest/express-server/RouteSetupError'
)

// thrown while setting up the application if a route cannot be registered,
// i.e. a route which is not part of the bag of routes or a route version
// which is handled twice. It is a programming error, not a request error.
export class RouteSetupError extends Error {
  constructor(message: string) {
    super(message)

    this.name = 'RouteSetupError'

    Object.defineProperty(this, ROUTE_SETUP_ERROR_BRAND, { value: true })
    Object.setPrototypeOf(this, RouteSetupError.prototype)
  }

  public static isRouteSetupError(error: unknown): error is RouteSetupError {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as Record<symbol, unknown>)[ROUTE_SETUP_ERROR_BRAND] === true
    )
  }

  // makes `instanceof RouteSetupError` work across module copies,
  // subclasses keep the default prototype chain check
  static [Symbol.hasInstance](instance: unknown): boolean {
    return this === RouteSetupError
      ? RouteSetupError.isRouteSetupError(instance)
      : Function.prototype[Symbol.hasInstance].call(this, instance)
  }
}
