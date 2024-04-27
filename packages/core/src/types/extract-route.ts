import { AnyRouteDef, BagOfRoutes, HTTPMethod, Versioning } from '../index'

export type ExtractRoutes<
  TBagOfRoutes extends BagOfRoutes<AnyRouteDef, any, any>
> = TBagOfRoutes extends BagOfRoutes<infer TRoutes, any, any> ? TRoutes : never

export type ExtractRoute<
  TBagOfRoutes,
  TMethod extends HTTPMethod,
  TPath extends string
> = TBagOfRoutes extends BagOfRoutes<AnyRouteDef, Versioning, any>
  ? Extract<ExtractRoutes<TBagOfRoutes>, { method: TMethod; path: TPath }>
  : never
