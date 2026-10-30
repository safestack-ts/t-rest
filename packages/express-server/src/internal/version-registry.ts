import { HTTPMethod } from '@t-rest/core'
import { pathShape } from '@t-rest/protocol'
import { ExpressRequest } from '../types/express-type-shortcuts.js'
import { Resolution } from './version-policy.js'

// the versions an application handles per method and path shape, shared by the
// application and everything branched or mounted from it, so that a request
// is resolved against all versions no matter which router handles them
export class VersionRegistry {
  private readonly versions = new Map<string, string[]>()
  // a request passes the routes of all versions of a path, but is resolved once
  private readonly resolutions = new WeakMap<
    ExpressRequest,
    Map<string, Resolution>
  >()

  // returns false if the version has been registered before
  public register(method: HTTPMethod, path: string, version: string) {
    const key = VersionRegistry.keyOf(method, path)
    const versions = this.versions.get(key)

    if (versions === undefined) {
      this.versions.set(key, [version])
      return true
    }

    if (versions.includes(version)) {
      return false
    }

    versions.push(version)
    return true
  }

  public handledVersions(key: string): readonly string[] {
    return this.versions.get(key) ?? []
  }

  public resolve(
    request: ExpressRequest,
    key: string,
    resolve: () => Resolution
  ) {
    const resolutions =
      this.resolutions.get(request) ?? new Map<string, Resolution>()
    this.resolutions.set(request, resolutions)

    const cached = resolutions.get(key)
    if (cached !== undefined) {
      return cached
    }

    const resolution = resolve()
    resolutions.set(key, resolution)

    return resolution
  }

  public static keyOf(method: HTTPMethod, path: string) {
    return `${method} ${pathShape(path)}`
  }
}
