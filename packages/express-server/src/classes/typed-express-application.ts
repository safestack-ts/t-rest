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
    TRequest extends ExpressRequest,
    TMountPath extends string = '/'
  >(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>,
    mountPath: TMountPath = '/' as TMountPath
  ) {
    return new TypedExpressApplicationWithoutVersioning<
      TRoutes,
      TRequest,
      TMountPath
    >(expressApp, bagOfRoutes, mountPath)
  }

  public static withVersioning<
    TRoutes extends AnyRouteDef,
    TRequest extends ExpressRequest,
    TVersionHistory extends string[],
    TMountPath extends string = '/'
  >(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor,
    mountPath: TMountPath = '/' as TMountPath
  ) {
    return new TypedExpressApplicationWithVersioning<
      TRoutes,
      TRequest,
      TVersionHistory,
      TMountPath
    >(expressApp, bagOfRoutes, versionHistory, versionExtractor, mountPath)
  }
}
