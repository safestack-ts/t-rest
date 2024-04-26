import {
  AnyRouteDef,
  HTTPMethod,
  JoinPath,
  RouteHashMap,
  Versioning,
  WithoutTrailingSlash,
  joinPath,
} from '@typed-rest/core'
import {
  ExpressRequest,
  ExpressRequestHandler,
  ExpressRouter,
} from '../types/express-type-shortcuts'
import { TypedRouterBase } from './typed-router-base'
import { PossiblePathsFromPrefix } from '../types/possible-paths-from-prefix'
import { TypedMiddleware } from '../types/typed-middleware'
import * as Express from 'express'
import { VersionedRouting } from './versioned-routing'
import { NoVersionExtractor } from './no-version-extractor'
import { TypedRouteHandler } from './typed-route-handler'

export class TypedRouterWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string
> extends TypedRouterBase<TRoutes, TRequest, TPath, string[]> {
  public readonly routing: VersionedRouting

  constructor(routes: RouteHashMap, router: ExpressRouter, path: TPath) {
    super(routes, router, path, [])

    this.routing = new VersionedRouting(
      this,
      Versioning.NO_VERSIONING,
      [],
      new NoVersionExtractor()
    )
  }

  public use<TRequestIn extends TRequest, TRequestOut extends TRequestIn>(
    handler: TypedMiddleware<TRequestIn, TRequestOut>
  ): TypedRouterWithoutVersioning<TRoutes, TRequestOut, TPath> {
    this.expressRouter.use(handler as ExpressRequestHandler)

    return this as any as TypedRouterWithoutVersioning<
      TRoutes,
      TRequestOut,
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
      Express.Router(),
      joinPath(this.path, path)
    ) as TypedRouterWithoutVersioning<
      TRoutes,
      TRequest,
      JoinPath<TPath, TPathBranch>
    >

    this.expressRouter.use(path, newRouter.expressRouter)

    return newRouter
  }

  private getRouteHandler<
    TMethod extends HTTPMethod,
    TPathSuffix extends string
  >(method: TMethod, path: TPathSuffix) {
    type TRoute = Extract<
      TRoutes,
      {
        method: TMethod
        path: WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>
      }
    >
    const route = this.routes.get([method, joinPath(this.path, path), ''])

    if (!route) {
      throw new Error(`Route not found for path: ${joinPath(this.path, path)}`)
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
  >(path: TPathSuffix) {
    return this.getRouteHandler('GET', path)
  }

  public post<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'POST', TPath>
  >(path: TPathSuffix) {
    return this.getRouteHandler('POST', path)
  }

  public put<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PUT', TPath>
  >(path: TPathSuffix) {
    return this.getRouteHandler('PUT', path)
  }

  public patch<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PATCH', TPath>
  >(path: TPathSuffix) {
    return this.getRouteHandler('PATCH', path)
  }

  public delete<
    TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'DELETE', TPath>
  >(path: TPathSuffix) {
    return this.getRouteHandler('DELETE', path)
  }
}
