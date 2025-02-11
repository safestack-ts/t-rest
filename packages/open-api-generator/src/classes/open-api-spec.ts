import { BagOfRoutes, BagOfRoutesVersions } from '@t-rest/core'
import { OpenAPISpecWithBagOfRoutes } from './open-api-spec-with-bag-of-routes'

export abstract class OpenAPISpec {
  public static ofVersion<
    TBagOfRoutes extends BagOfRoutes<any, any, any>,
    TVersion extends BagOfRoutesVersions<TBagOfRoutes>
  >(bagOfRoutes: TBagOfRoutes, version: TVersion) {
    return new OpenAPISpecWithBagOfRoutes(bagOfRoutes, version)
  }

  public static of(bagOfRoutes: BagOfRoutes<any, any, any>) {
    return new OpenAPISpecWithBagOfRoutes(bagOfRoutes, '')
  }
}
