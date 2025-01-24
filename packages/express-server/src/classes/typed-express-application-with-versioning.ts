import {
  AnyRouteDef,
  BagOfRoutes,
  Versioning,
  VersioningRequired,
} from '@t-rest/core'
import { ExpressRequest, ExpressApp } from '../types/express-type-shortcuts'
import { VersionExtractor } from '../types/version-extractor'
import { TypedRouterWithVersioning } from './typed-router-with-versioning'

export class TypedExpressApplicationWithVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TVersionHistory extends string[],
  TMountPath extends string
> extends TypedRouterWithVersioning<
  TRoutes,
  TRequest,
  TMountPath,
  TVersionHistory
> {
  protected readonly bagOfRoutes: BagOfRoutes<
    TRoutes,
    Versioning,
    TVersionHistory
  >

  constructor(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor,
    mountPath: TMountPath
  ) {
    super(
      bagOfRoutes.routes,
      expressApp,
      mountPath,
      bagOfRoutes.versioning,
      versionHistory,
      versionExtractor
    )

    this.bagOfRoutes = bagOfRoutes
  }
}
