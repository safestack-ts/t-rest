import {
  AnyRouteDef,
  BagOfRoutes,
  Versioning,
  VersioningRequired,
} from '@typed-rest/core'
import { ExpressRequest, ExpressApp } from '../types/express-type-shortcuts'
import { VersionExtractor } from '../types/version-extractor'
import { TypedRouterWithVersioning } from './typed-router-with-versioning'

export class TypedExpressApplicationWithVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TVersionHistory extends string[]
> extends TypedRouterWithVersioning<TRoutes, TRequest, '/', TVersionHistory> {
  protected readonly bagOfRoutes: BagOfRoutes<
    TRoutes,
    Versioning,
    TVersionHistory
  >

  constructor(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor
  ) {
    super(
      bagOfRoutes.routes,
      expressApp,
      '/',
      bagOfRoutes.versioning,
      versionHistory,
      versionExtractor
    )

    this.bagOfRoutes = bagOfRoutes
  }
}
