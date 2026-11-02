import { BagOfRoutes } from '../classes/core/bag-of-routes.js'
import { AnyRouteDef } from './any-route-def.js'
import { HTTPMethod } from './http-method.js'
import { BodyOf, DeclaredStatus } from './response-descriptor.js'

type RouteAt<
  TBagOfRoutes extends BagOfRoutes<any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TVersion extends string
> = TBagOfRoutes extends BagOfRoutes<
  infer TRoutes extends AnyRouteDef,
  any,
  any
>
  ? Extract<TRoutes, { method: TMethod; path: TPath; version: TVersion }>
  : never

export type RouteInput<
  TBagOfRoutes extends BagOfRoutes<any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TVersion extends string = ''
> = RouteAt<TBagOfRoutes, TMethod, TPath, TVersion>['~validatorOutputType']

/**
 * The body type of a route, of the given statuses or by default the union of
 * the bodies of all statuses it declares.
 */
export type RouteOutput<
  TBagOfRoutes extends BagOfRoutes<any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TVersion extends string = '',
  TStatus extends number = DeclaredStatus<
    RouteAt<TBagOfRoutes, TMethod, TPath, TVersion>
  >
> = BodyOf<RouteAt<TBagOfRoutes, TMethod, TPath, TVersion>, TStatus>
