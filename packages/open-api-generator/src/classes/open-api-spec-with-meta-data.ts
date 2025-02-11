import { BagOfRoutes } from '@t-rest/core'
import { OpenAPIMetaData } from '../types/open-api-meta-data'

type ConstructorArgs<TBagOfRoutes extends BagOfRoutes<any, any, any>> = {
  bagOfRoutes: TBagOfRoutes
  version: string
  metaData: OpenAPIMetaData
}

export class OpenAPISpecWithMetaData<
  TBagOfRoutes extends BagOfRoutes<any, any, any>
> {
  public readonly bagOfRoutes: TBagOfRoutes
  public readonly version: string
  public readonly metaData: OpenAPIMetaData

  constructor(args: ConstructorArgs<TBagOfRoutes>) {
    this.bagOfRoutes = args.bagOfRoutes
    this.version = args.version
    this.metaData = args.metaData
  }
}
