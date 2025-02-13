import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { HTTPMethod } from './http-method'

export type RouteInput<
  TBagOfRoutes extends BagOfRoutes<any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TVersion extends string = ''
> = TBagOfRoutes extends BagOfRoutes<infer TRoutes, any, any>
  ? Extract<
      TRoutes,
      { method: TMethod; path: TPath; version: TVersion }
    >['~validatorOutputType']
  : never

export type RouteOutput<
  TBagOfRoutes extends BagOfRoutes<any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TVersion extends string = ''
> = TBagOfRoutes extends BagOfRoutes<infer TRoutes, any, any>
  ? Extract<
      TRoutes,
      { method: TMethod; path: TPath; version: TVersion }
    >['~responseType']
  : never
