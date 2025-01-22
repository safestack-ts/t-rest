import {
  AnyRouteDef,
  BagOfRoutes,
  Versioning,
  VersioningRequired,
} from '@t-rest/core'
import { ExpressRequest, ExpressApp } from '../types/express-type-shortcuts'
import { VersionExtractor } from '../types/version-extractor'
import { TypedExpressApplicationWithoutVersioning } from './typed-express-application-without-versioning'
import { TypedExpressApplicationWithVersioning } from './typed-express-application-with-versioning'

export abstract class TypedExpressApplication {
  public static withoutVersioning<
    TRoutes extends AnyRouteDef,
    TRequest extends ExpressRequest
  >(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>
  ) {
    return new TypedExpressApplicationWithoutVersioning<TRoutes, TRequest>(
      expressApp,
      bagOfRoutes
    )
  }

  public static withVersioning<
    TRoutes extends AnyRouteDef,
    TRequest extends ExpressRequest,
    TVersionHistory extends string[]
  >(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor
  ) {
    return new TypedExpressApplicationWithVersioning<
      TRoutes,
      TRequest,
      TVersionHistory
    >(expressApp, bagOfRoutes, versionHistory, versionExtractor)
  }
}
