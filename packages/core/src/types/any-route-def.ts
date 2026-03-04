import { RouteDef } from '../classes/core/route-def.js'
import { HTTPMethod } from './http-method.js'
import { AnyRouteValidator } from './any-route-validator.js'

export type AnyRouteDef = RouteDef<
  string,
  HTTPMethod,
  string,
  AnyRouteValidator,
  any,
  unknown
>
