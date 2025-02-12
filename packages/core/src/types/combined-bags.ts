import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { Versioning } from '../enums/versioning'
import { AnyRouteDef } from './any-route-def'

export type CombinedBags<
  TRoutes extends AnyRouteDef,
  TBags extends BagOfRoutes<any, Versioning, any>[]
> = TBags extends [
  BagOfRoutes<infer TRoute, infer TVersioning, infer TVersionHistory>,
  ...infer TRemainingClients
]
  ? TRemainingClients extends BagOfRoutes<any, TVersioning, TVersionHistory>[]
    ? CombinedBags<TRoutes | TRoute, TRemainingClients>
    : TRoutes
  : TRoutes
