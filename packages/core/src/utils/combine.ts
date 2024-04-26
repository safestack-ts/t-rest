import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { Versioning } from '../enums/versioning'
import { AnyRouteDef } from '../types/any-route-def'
import { CombinedBags } from '../types/combined-bags'
import { NonEmptyArray, first } from '../types/non-empty-array'
import { HashMap } from './hash-map'

export const combine = <
  TVersioning extends Versioning,
  TBags extends NonEmptyArray<BagOfRoutes<AnyRouteDef, TVersioning>>
>(
  ...bags: TBags
): BagOfRoutes<CombinedBags<never, TBags>, TVersioning> =>
  new BagOfRoutes<CombinedBags<never, TBags>, TVersioning>(
    new HashMap(
      (key) => key.join('-'),
      bags.flatMap((bag) => Array.from(bag.routes.entries()))
    ),
    first(bags).versioning
  )
