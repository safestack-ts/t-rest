import {
  AnyRouteDef,
  HTTPMethod,
  JoinPath,
  RouteHashMap,
  Versioning,
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
import * as Express from 'express'
import { VersionedRouting } from './versioned-routing.js'
import { RouterRoute } from '../internal/router-route.js'
import { VersionRegistry } from '../internal/version-registry.js'
import { NoVersionExtractor } from './no-version-extractor.js'
import { RouteSetupError } from './route-setup-error.js'
import { TypedRouteHandler } from './typed-route-handler.js'
import type { TypedRouterModuleWithoutVersioning } from '../types/typed-router-module.js'

export class TypedRouterWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string
> extends TypedRouterBase<TRoutes, TRequest, TPath, string[]> {
  public readonly routing: VersionedRouting
  protected readonly versionRegistry: VersionRegistry

  constructor(
    routes: RouteHashMap,
    router: ExpressRouter,
    path: TPath,
    // shared with everything branched from this router
    versionRegistry: VersionRegistry = new VersionRegistry()
  ) {
    super(routes, router, path, [])

    this.versionRegistry = versionRegistry

    this.routing = new VersionedRouting(
      this,
      Versioning.NO_VERSIONING,
      [],
      new NoVersionExtractor(),
      versionRegistry
    )
  }

  public use<TRequestIn extends TRequest, TRequestOut>(
    handler: TypedMiddleware<TRequestIn, TRequestOut>
  ): TypedRouterWithoutVersioning<TRoutes, TRequest & TRequestOut, TPath> {
    this.expressRouter.use(handler as ExpressRequestHandler)

    return this as any as TypedRouterWithoutVersioning<
      TRoutes,
      TRequest & TRequestOut,
      TPath
    >
  }

  public branch<TPathBranch extends string>(
    path: TPathBranch
  ): TypedRouterWithoutVersioning<
    TRoutes,
    TRequest,
    JoinPath<TPath, TPathBranch>
  > {
    const newRouter = new TypedRouterWithoutVersioning(
      this.routes,
      // branch paths can contain params, which handlers of the branch need to see
      Express.Router({ mergeParams: true }),
      joinPath(this.path, path),
      this.versionRegistry
    ) as TypedRouterWithoutVersioning<
      TRoutes,
      TRequest,
      JoinPath<TPath, TPathBranch>
    >

    this.expressRouter.use(path, newRouter.expressRouter)

    return newRouter
  }

  public mount<
    TModuleRoutes extends TRoutes,
    TModuleContext extends ExpressRequest
  >(
    routerModule: TRequest extends TModuleContext
      ? TypedRouterModuleWithoutVersioning<TModuleRoutes, TPath, TModuleContext>
      : never
  ): this {
    routerModule.configure(this as any)

    return this
  }

  private getRouteHandler<
    TMethod extends HTTPMethod,
    TPathSuffix extends string
  >(
    method: TMethod,
    path: TPathSuffix
  ): TypedRouteHandler<
    '',
    RouterRoute<TRoutes, TMethod, TPath, TPathSuffix>,
    TPathSuffix,
    TRequest
  > {
    type TRoute = RouterRoute<TRoutes, TMethod, TPath, TPathSuffix>
    const route = this.routes.get([method, joinPath(this.path, path), ''])

    if (!route) {
      throw new RouteSetupError(
        `Route not found for path: ${joinPath(this.path, path)}`
      )
    }

    return new TypedRouteHandler<'', TRoute, TPathSuffix, TRequest>(
      '',
      route as TRoute,
      path,
      this
    )
  }

  public get<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'GET', TPath>
  >(
    path: TPathSuffix
  ): TypedRouteHandler<
    '',
    RouterRoute<TRoutes, 'GET', TPath, TPathSuffix>,
    TPathSuffix,
    TRequest
  > {
    return this.getRouteHandler('GET', path)
  }

  public post<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'POST', TPath>
  >(
    path: TPathSuffix
  ): TypedRouteHandler<
    '',
    RouterRoute<TRoutes, 'POST', TPath, TPathSuffix>,
    TPathSuffix,
    TRequest
  > {
    return this.getRouteHandler('POST', path)
  }

  public put<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PUT', TPath>
  >(
    path: TPathSuffix
  ): TypedRouteHandler<
    '',
    RouterRoute<TRoutes, 'PUT', TPath, TPathSuffix>,
    TPathSuffix,
    TRequest
  > {
    return this.getRouteHandler('PUT', path)
  }

  public patch<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PATCH', TPath>
  >(
    path: TPathSuffix
  ): TypedRouteHandler<
    '',
    RouterRoute<TRoutes, 'PATCH', TPath, TPathSuffix>,
    TPathSuffix,
    TRequest
  > {
    return this.getRouteHandler('PATCH', path)
  }

  public delete<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'DELETE', TPath>
  >(
    path: TPathSuffix
  ): TypedRouteHandler<
    '',
    RouterRoute<TRoutes, 'DELETE', TPath, TPathSuffix>,
    TPathSuffix,
    TRequest
  > {
    return this.getRouteHandler('DELETE', path)
  }
}
