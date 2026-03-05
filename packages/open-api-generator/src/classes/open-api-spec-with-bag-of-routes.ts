import { BagOfRoutes, Versioning } from '@t-rest/core'
import { OpenAPIMetaData } from '../types/open-api-meta-data.js'
import { OpenAPIGeneratorOptions } from '../types/open-api-generator-options.js'
import { OpenAPISpecWithMetaData } from './open-api-spec-with-meta-data.js'

type MetaDataArgs<TBagOfRoutes extends BagOfRoutes<any, any, any>> =
  TBagOfRoutes extends BagOfRoutes<any, infer TVersioning, any>
    ? TVersioning extends Versioning.NO_VERSIONING
      ? OpenAPIMetaData
      : Omit<OpenAPIMetaData, 'version'>
    : never

export class OpenAPISpecWithBagOfRoutes<
  TBagOfRoutes extends BagOfRoutes<any, any, any>
> {
  protected readonly version: string
  protected readonly bagOfRoutes: TBagOfRoutes

  constructor(bagOfRoutes: TBagOfRoutes, version: string) {
    this.version = version
    this.bagOfRoutes = bagOfRoutes
  }

  public withMetaData(
    metaData: MetaDataArgs<TBagOfRoutes>,
    options?: OpenAPIGeneratorOptions
  ) {
    return new OpenAPISpecWithMetaData({
      bagOfRoutes: this.bagOfRoutes,
      version: this.version,
      metaData: {
        ...metaData,
        version: (metaData as OpenAPIMetaData).version ?? this.version,
      },
      options,
    })
  }
}
