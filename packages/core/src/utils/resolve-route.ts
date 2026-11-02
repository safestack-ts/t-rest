import { AnyRouteDef } from '../types/any-route-def.js'
import { HTTPMethod } from '../types/http-method.js'
import { RouteHashMap } from '../types/route-hash-map.js'
import { resolveDateVersion, resolveVersion } from './resolve-version.js'

/**
 * Creates a lookup of the route a server executes for a request: the route of
 * the requested version, else the newest route of an older version of the
 * history. With `parseDate` versions outside of the history are resolved by
 * date, like a server with a date version extractor does. Unversioned routes
 * are looked up with the version `''`.
 *
 * The versions of each route are indexed once, so the routes must not change
 * afterwards.
 */
export const createRouteResolver = (
  routes: RouteHashMap,
  versionHistory: readonly string[],
  parseDate?: (version: string) => Date
) => {
  const versionsOfRoute = new Map<string, string[]>()

  for (const [method, path, version] of routes.keys()) {
    const key = JSON.stringify([method, path])

    versionsOfRoute.set(key, [...(versionsOfRoute.get(key) ?? []), version])
  }

  // core resolves on mutable arrays without modifying them
  const history = versionHistory as string[]

  return (
    method: HTTPMethod,
    path: string,
    version: string
  ): AnyRouteDef | undefined => {
    const versions = versionsOfRoute.get(JSON.stringify([method, path])) ?? []
    const resolved = parseDate
      ? resolveDateVersion(history, versions, version, parseDate)
      : resolveVersion(history, versions, version)

    return routes.get([method, path, resolved ?? version])
  }
}
