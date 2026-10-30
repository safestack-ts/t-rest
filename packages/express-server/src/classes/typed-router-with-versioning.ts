import {
  AnyRouteDef,
  HTTPMethod,
  JoinPath,
  RouteHashMap,
  VersioningRequired,
  joinPath,
} from '@t-rest/core'
import {
  ExpressRequest,
  ExpressRequestHandler,
  ExpressRouter,
} from '../types/express-type-shortcuts.js'
import { TypedRouterBase } from './typed-router-base.js'
import { PossiblePathsFromPrefix } from '../types/possible-paths-from-prefix.js'
import { TypedMiddleware } from '../types/typed-middleware.js'
import { VersionExtractor } from '../types/version-extractor.js'
import * as Express from 'express'
import { VersionSelector } from './version-selector.js'
import { VersionedRouting } from './versioned-routing.js'
import { RouterRoute } from '../internal/router-route.js'
import { VersionRegistry } from '../internal/version-registry.js'
import type { TypedRouterModuleWithVersioning } from '../types/typed-router-module.js'

export class TypedRouterWithVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string,
  TVersionHistory extends string[]
> extends TypedRouterBase<TRoutes, TRequest, TPath, TVersionHistory> {
  public readonly routing: VersionedRouting
  protected readonly versioning: VersioningRequired
  protected readonly versionExtractor: VersionExtractor
  protected readonly versionRegistry: VersionRegistry

  constructor(
    routes: RouteHashMap,
    router: ExpressRouter,
    path: TPath,
    versioning: VersioningRequired,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor,
    // shared with everything branched from this router
    versionRegistry: VersionRegistry = new VersionRegistry()
  ) {
    super(routes, router, path, versionHistory)

    this.versioning = versioning
    this.versionExtractor = versionExtractor
    this.versionRegistry = versionRegistry

    this.routing = new VersionedRouting(
      this,
      versioning,
      versionHistory,
      versionExtractor,
      versionRegistry
    )
  }

  // @todo might be generalized
  public use<TRequestIn extends TRequest, TRequestOut>(
    handler: TypedMiddleware<TRequestIn, TRequestOut>
  ): TypedRouterWithVersioning<
    TRoutes,
    TRequest & TRequestOut,
    TPath,
    TVersionHistory
  > {
    this.expressRouter.use(handler as ExpressRequestHandler)

    return this as any as TypedRouterWithVersioning<
      TRoutes,
      TRequest & TRequestOut,
      TPath,
      TVersionHistory
    >
  }

  // @todo might be generalized
  public branch<TPathBranch extends string>(
    path: TPathBranch
  ): TypedRouterWithVersioning<
    TRoutes,
    TRequest,
    JoinPath<TPath, TPathBranch>,
    TVersionHistory
  > {
    const newRouter = new TypedRouterWithVersioning(
      this.routes,
      // branch paths can contain params, which handlers of the branch need to see
      Express.Router({ mergeParams: true }),
      joinPath(this.path, path),
      this.versioning,
      this.versionHistory,
      this.versionExtractor,
      this.versionRegistry
    ) as TypedRouterWithVersioning<
      TRoutes,
      TRequest,
      JoinPath<TPath, TPathBranch>,
      TVersionHistory
    >

    this.expressRouter.use(path, newRouter.expressRouter)

    return newRouter
  }

  public mount<
    TModuleRoutes extends TRoutes,
    TModuleContext extends ExpressRequest
  >(
    routerModule: TRequest extends TModuleContext
      ? TypedRouterModuleWithVersioning<
          TModuleRoutes,
          TPath,
          TModuleContext,
          TVersionHistory
        >
      : never
  ): this {
    routerModule.configure(this as any)

    return this
  }

  private select<TMethod extends HTTPMethod, TPathSuffix extends string>(
    method: TMethod,
    path: TPathSuffix
  ): VersionSelector<
    RouterRoute<TRoutes, TMethod, TPath, TPathSuffix>,
    TRequest,
    TPath,
    TPathSuffix,
    TMethod,
    TVersionHistory
  > {
    return new VersionSelector(this.routes, this.path, path, this, method)
  }

  public get<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'GET', TPath>
  >(
    path: TPathSuffix
  ): VersionSelector<
    RouterRoute<TRoutes, 'GET', TPath, TPathSuffix>,
    TRequest,
    TPath,
    TPathSuffix,
    'GET',
    TVersionHistory
  > {
    return this.select('GET', path)
  }

  public post<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'POST', TPath>
  >(
    path: TPathSuffix
  ): VersionSelector<
    RouterRoute<TRoutes, 'POST', TPath, TPathSuffix>,
    TRequest,
    TPath,
    TPathSuffix,
    'POST',
    TVersionHistory
  > {
    return this.select('POST', path)
  }

  public put<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PUT', TPath>
  >(
    path: TPathSuffix
  ): VersionSelector<
    RouterRoute<TRoutes, 'PUT', TPath, TPathSuffix>,
    TRequest,
    TPath,
    TPathSuffix,
    'PUT',
    TVersionHistory
  > {
    return this.select('PUT', path)
  }

  public patch<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PATCH', TPath>
  >(
    path: TPathSuffix
  ): VersionSelector<
    RouterRoute<TRoutes, 'PATCH', TPath, TPathSuffix>,
    TRequest,
    TPath,
    TPathSuffix,
    'PATCH',
    TVersionHistory
  > {
    return this.select('PATCH', path)
  }

  public delete<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'DELETE', TPath>
  >(
    path: TPathSuffix
  ): VersionSelector<
    RouterRoute<TRoutes, 'DELETE', TPath, TPathSuffix>,
    TRequest,
    TPath,
    TPathSuffix,
    'DELETE',
    TVersionHistory
  > {
    return this.select('DELETE', path)
  }
}
