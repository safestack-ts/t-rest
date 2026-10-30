import { RouteHashMap } from '../types/route-hash-map.js'
import { AnyRouteDef } from '../types/any-route-def.js'
import { HashMap } from '../utils/hash-map.js'

type RouteKey = Parameters<RouteHashMap['set']>[0] // [HTTPMethod, Path, Version]

/**
 * Collision-free hash of a route key. The previous `key.join('-')` mapped
 * `['GET', '/x-2024', '01-01']` and `['GET', '/x', '2024-01-01']` to the same
 * `GET-/x-2024-01-01`, because paths and date versions both contain `-`.
 * The JSON encoding of the tuple is injective.
 */
const routeKeyHash = (key: RouteKey): string => JSON.stringify(key)

export const createRouteHashMap = (
  entries?: Iterable<readonly [RouteKey, AnyRouteDef]>
): RouteHashMap => new HashMap(routeKeyHash, Array.from(entries ?? []))

/**
 * Storage key of a route. Unversioned bags store every route under the
 * version `''`.
 */
export const storageKeyOf = (
  route: Pick<AnyRouteDef, 'method' | 'path' | 'version'>,
  versioned: boolean
): RouteKey => [route.method, route.path, versioned ? route.version : '']
