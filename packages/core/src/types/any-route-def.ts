import { RouteDef } from '../classes/core/route-def'
import { HTTPMethod } from './http-method'
import { AnyRouteValidator } from './any-route-validator'

export type AnyRouteDef = RouteDef<
  string,
  HTTPMethod,
  string,
  AnyRouteValidator,
  any,
  unknown
>
