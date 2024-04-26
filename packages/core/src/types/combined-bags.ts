import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { Versioning } from '../enums/versioning'
import { AnyRouteDef } from './any-route-def'

export type CombinedBags<
  TRoutes extends AnyRouteDef,
  TBags extends BagOfRoutes<any, Versioning>[]
> = TBags extends [
  BagOfRoutes<infer TRoute, Versioning>,
  ...infer TRemainingClients
]
  ? TRemainingClients extends BagOfRoutes<any, Versioning>[]
    ? CombinedBags<TRoutes | TRoute, TRemainingClients>
    : TRoutes
  : TRoutes
