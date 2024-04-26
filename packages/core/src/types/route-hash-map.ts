import { HashMap } from '../utils/hash-map'
import { AnyRouteDef } from './any-route-def'
import { HTTPMethod } from './http-method'

export type RouteHashMap = HashMap<[HTTPMethod, string, string], AnyRouteDef> // [HTTPMethod, Path, Version]
