import {
  AnyRouteDef,
  ExtractVersionMatchingRoute,
  HTTPMethod,
  JoinPath,
  RouteHashMap,
  WithoutDoubleSlash,
  WithoutTrailingSlash,
  joinPath,
} from '@t-rest/core'
import { ExpressRequest } from '../types/express-type-shortcuts'
import { RequestVersion } from '../types/request-version'
import { RouteVersions } from '../types/route-versions'
import { TypedRouterBase } from './typed-router-base'
import { TypedRouteHandler } from './typed-route-handler'

export class VersionSelector<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string,
  TPathSuffix extends string,
  TMethod extends HTTPMethod,
  TVersionHistory extends string[]
> {
  public readonly routes: RouteHashMap
  private readonly path: TPath
  private readonly pathSuffix: TPathSuffix
  private readonly router: TypedRouterBase<
    TRoutes,
    TRequest,
    TPath,
    TVersionHistory
  >
  private readonly method: TMethod

  constructor(
    routes: RouteHashMap,
    path: TPath,
    pathSuffix: TPathSuffix,
    router: TypedRouterBase<TRoutes, TRequest, TPath, TVersionHistory>,
    method: TMethod
  ) {
    this.routes = routes
    this.path = path
    this.pathSuffix = pathSuffix
    this.router = router
    this.method = method
  }

  private getRouteHandler<TVersion extends string>(version: TVersion) {
    type TRoutesWithMatchingVersion = ExtractVersionMatchingRoute<
      TRoutes,
      TVersion,
      TVersionHistory
    >

    const route = this.routes.get([
      this.method,
      joinPath(this.path, this.pathSuffix),
      version,
    ])

    if (!route) {
      throw new Error(
        `Route not found for path ${joinPath(
          this.path,
          this.pathSuffix
        )} and version ${version}`
      )
    }

    return new TypedRouteHandler<
      TVersion,
      TRoutesWithMatchingVersion,
      TPathSuffix,
      TRequest & RequestVersion
    >(
      version,
      route as TRoutesWithMatchingVersion,
      this.pathSuffix,
      this.router
    )
  }

  public version<
    TVersion extends RouteVersions<
      TRoutes,
      TMethod,
      WithoutDoubleSlash<WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>>
    >
  >(version: TVersion) {
    return this.getRouteHandler(version)
  }
}
