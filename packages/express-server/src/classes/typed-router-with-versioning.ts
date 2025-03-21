import {
  AnyRouteDef,
  JoinPath,
  RouteHashMap,
  VersioningRequired,
  WithoutDoubleSlash,
  WithoutTrailingSlash,
  joinPath,
} from '@t-rest/core'
import {
  ExpressRequest,
  ExpressRequestHandler,
  ExpressRouter,
} from '../types/express-type-shortcuts'
import { TypedRouterBase } from './typed-router-base'
import { PossiblePathsFromPrefix } from '../types/possible-paths-from-prefix'
import { TypedMiddleware } from '../types/typed-middleware'
import { VersionExtractor } from '../types/version-extractor'
import * as Express from 'express'
import { VersionSelector } from './version-selector'
import { VersionedRouting } from './versioned-routing'

export class TypedRouterWithVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string,
  TVersionHistory extends string[]
> extends TypedRouterBase<TRoutes, TRequest, TPath, TVersionHistory> {
  public readonly routing: VersionedRouting
  protected readonly versioning: VersioningRequired
  protected readonly versionExtractor: VersionExtractor

  constructor(
    routes: RouteHashMap,
    router: ExpressRouter,
    path: TPath,
    versioning: VersioningRequired,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor
  ) {
    super(routes, router, path, versionHistory)

    this.versioning = versioning
    this.versionExtractor = versionExtractor

    this.routing = new VersionedRouting(
      this,
      versioning,
      versionHistory,
      versionExtractor
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
      Express.Router(),
      joinPath(this.path, path),
      this.versioning,
      this.versionHistory,
      this.versionExtractor
    ) as TypedRouterWithVersioning<
      TRoutes,
      TRequest,
      JoinPath<TPath, TPathBranch>,
      TVersionHistory
    >

    this.expressRouter.use(path, newRouter.expressRouter)

    return newRouter
  }

  public get<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'GET', TPath>
  >(path: TPathSuffix) {
    return new VersionSelector<
      Extract<
        TRoutes,
        {
          method: 'GET'
          path: WithoutDoubleSlash<
            WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>
          >
        }
      >,
      TRequest,
      TPath,
      TPathSuffix,
      'GET',
      TVersionHistory
    >(this.routes, this.path, path, this, 'GET')
  }

  public post<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'POST', TPath>
  >(path: TPathSuffix) {
    return new VersionSelector<
      Extract<
        TRoutes,
        {
          method: 'POST'
          path: WithoutDoubleSlash<
            WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>
          >
        }
      >,
      TRequest,
      TPath,
      TPathSuffix,
      'POST',
      TVersionHistory
    >(this.routes, this.path, path, this, 'POST')
  }

  public put<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PUT', TPath>
  >(path: TPathSuffix) {
    return new VersionSelector<
      Extract<
        TRoutes,
        {
          method: 'PUT'
          path: WithoutDoubleSlash<
            WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>
          >
        }
      >,
      TRequest,
      TPath,
      TPathSuffix,
      'PUT',
      TVersionHistory
    >(this.routes, this.path, path, this, 'PUT')
  }

  public patch<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PATCH', TPath>
  >(path: TPathSuffix) {
    return new VersionSelector<
      Extract<
        TRoutes,
        {
          method: 'PATCH'
          path: WithoutDoubleSlash<
            WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>
          >
        }
      >,
      TRequest,
      TPath,
      TPathSuffix,
      'PATCH',
      TVersionHistory
    >(this.routes, this.path, path, this, 'PATCH')
  }

  public delete<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'DELETE', TPath>
  >(path: TPathSuffix) {
    return new VersionSelector<
      Extract<
        TRoutes,
        {
          method: 'DELETE'
          path: WithoutDoubleSlash<
            WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>
          >
        }
      >,
      TRequest,
      TPath,
      TPathSuffix,
      'DELETE',
      TVersionHistory
    >(this.routes, this.path, path, this, 'DELETE')
  }
}
