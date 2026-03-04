import { HashMap } from '../utils/hash-map.js'
import { AnyRouteDef } from './any-route-def.js'
import { HTTPMethod } from './http-method.js'

export type RouteHashMap = HashMap<[HTTPMethod, string, string], AnyRouteDef> // [HTTPMethod, Path, Version]
