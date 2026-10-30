import {
  AnyRouteDef,
  BagOfRoutes,
  Versioning,
  VersioningRequired,
} from '@t-rest/core'
import {
  ExpressRequest,
  ExpressApp,
  ExpressRouter,
} from '../types/express-type-shortcuts.js'
import { VersionExtractor } from '../types/version-extractor.js'
import { TypedExpressApplicationWithoutVersioning } from './typed-express-application-without-versioning.js'
import { TypedExpressApplicationWithVersioning } from './typed-express-application-with-versioning.js'

export abstract class TypedExpressApplication {
  public static withoutVersioning<
    TRoutes extends AnyRouteDef,
    TRequest extends ExpressRequest,
    TMountPath extends string = '/'
  >(
    expressApp: ExpressApp | ExpressRouter,
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
    expressApp: ExpressApp | ExpressRouter,
    bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>,
    versionExtractor: VersionExtractor,
    mountPath?: TMountPath
  ): TypedExpressApplicationWithVersioning<
    TRoutes,
    TRequest,
    TMountPath,
    TVersionHistory
  >
  /**
   * @deprecated The version history is taken from the bag of routes, omit the
   * `versionHistory` argument.
   */
  public static withVersioning<
    TRoutes extends AnyRouteDef,
    TRequest extends ExpressRequest,
    TVersionHistory extends string[],
    TMountPath extends string = '/'
  >(
    expressApp: ExpressApp | ExpressRouter,
    bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor,
    mountPath?: TMountPath
  ): TypedExpressApplicationWithVersioning<
    TRoutes,
    TRequest,
    TMountPath,
    TVersionHistory
  >
  public static withVersioning(
    expressApp: ExpressApp | ExpressRouter,
    bagOfRoutes: BagOfRoutes<AnyRouteDef, VersioningRequired, string[]>,
    ...args: [string[], VersionExtractor, string?] | [VersionExtractor, string?]
  ) {
    // the deprecated overload passes the version history as third argument
    const [versionHistory, versionExtractor, mountPath = '/'] = Array.isArray(
      args[0]
    )
      ? (args as [string[], VersionExtractor, string?])
      : [bagOfRoutes.versionHistory, ...(args as [VersionExtractor, string?])]

    return new TypedExpressApplicationWithVersioning(
      expressApp,
      bagOfRoutes,
      versionHistory,
      versionExtractor,
      mountPath
    )
  }
}
