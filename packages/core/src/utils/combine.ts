import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { AnyRouteDef } from '../types/any-route-def'
import { CombinedBags } from '../types/combined-bags'
import { NonEmptyArray, first } from '../types/non-empty-array'
import { HashMap } from './hash-map'

type EnsureSameVersioning<T extends BagOfRoutes<any, any, any>[]> = T extends []
  ? never
  : T extends [infer _First extends BagOfRoutes<any, any, any>]
  ? T
  : T extends [
      infer First extends BagOfRoutes<any, any, any>,
      ...infer Rest extends BagOfRoutes<any, any, any>[]
    ]
  ? First['versioning'] extends Rest[number]['versioning']
    ? Rest[number]['versioning'] extends First['versioning']
      ? T
      : never
    : never
  : never

export const combine = <
  TBags extends NonEmptyArray<BagOfRoutes<AnyRouteDef, any, any>>,
  TVersioning extends TBags[number]['versioning'],
  TVersionHistory extends TBags[number]['versionHistory']
>(
  ...bags: EnsureSameVersioning<TBags>
): BagOfRoutes<CombinedBags<never, TBags>, TVersioning, TVersionHistory> => {
  const firstBag = first(bags)

  return new BagOfRoutes<
    CombinedBags<never, TBags>,
    TVersioning,
    TVersionHistory
  >(
    new HashMap(
      (key) => key.join('-'),
      bags.flatMap((bag) => Array.from(bag.routes.entries()))
    ),
    firstBag.versioning,
    firstBag.versionHistory
  )
}
