// thrown if the requested version cannot be resolved to a route version.
// `status` and `statusCode` are picked up by express' default error handler
// so the client receives a 400 instead of a generic 500.
export class VersionResolutionError extends Error {
  public readonly status = 400
  public readonly statusCode = 400

  constructor(message: string) {
    super(message)

    this.name = 'VersionResolutionError'

    Object.setPrototypeOf(this, VersionResolutionError.prototype)
  }
}
