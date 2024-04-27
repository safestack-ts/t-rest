import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { Versioning } from '../enums/versioning'
import { AnyRouteDef } from './any-route-def'

export type CombinedBags<
  TRoutes extends AnyRouteDef,
  TBags extends BagOfRoutes<any, Versioning, any>[]
> = TBags extends [
  BagOfRoutes<infer TRoute, Versioning, any>,
  ...infer TRemainingClients
]
  ? TRemainingClients extends BagOfRoutes<any, Versioning, any>[]
    ? CombinedBags<TRoutes | TRoute, TRemainingClients>
    : TRoutes
  : TRoutes
