import { BagOfRoutes } from '@t-rest/core'
import { OpenAPIMetaData } from '../types/open-api-meta-data.js'
import {
  OpenAPIGeneratorOptions,
  ResolvedOpenAPIGeneratorOptions,
  resolveOpenAPIGeneratorOptions,
} from '../types/open-api-generator-options.js'

type ConstructorArgs<TBagOfRoutes extends BagOfRoutes<any, any, any>> = {
  bagOfRoutes: TBagOfRoutes
  version: string
  metaData: OpenAPIMetaData
  options?: OpenAPIGeneratorOptions
}

export class OpenAPISpecWithMetaData<
  TBagOfRoutes extends BagOfRoutes<any, any, any>
> {
  public readonly bagOfRoutes: TBagOfRoutes
  public readonly version: string
  public readonly metaData: OpenAPIMetaData
  public readonly options: ResolvedOpenAPIGeneratorOptions

  constructor(args: ConstructorArgs<TBagOfRoutes>) {
    this.bagOfRoutes = args.bagOfRoutes
    this.version = args.version
    this.metaData = args.metaData
    this.options = resolveOpenAPIGeneratorOptions(args.options)
  }
}
