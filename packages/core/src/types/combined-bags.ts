import { BagOfRoutes } from '../classes/core/bag-of-routes.js'
import { Versioning } from '../enums/versioning.js'
import { AnyRouteDef } from './any-route-def.js'

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
