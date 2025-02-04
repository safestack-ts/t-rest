import { BagOfRoutes } from '../classes/core/bag-of-routes'

export type BagOfRoutesVersions<
  TBagOfRoutes extends BagOfRoutes<any, any, any>
> = TBagOfRoutes extends BagOfRoutes<any, any, infer TVersionHistory>
  ? TVersionHistory[number]
  : never
