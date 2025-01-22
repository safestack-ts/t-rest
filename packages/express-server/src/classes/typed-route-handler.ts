import { AnyRouteDef, RouteValidationOutput } from '@t-rest/core'
import { ExpressRequest } from '../types/express-type-shortcuts'
import { TypedMiddleware } from '../types/typed-middleware'
import { TypedRouterBase } from './typed-router-base'
import { TypedRouteHandlerFn } from '../types/typed-route-handler-fn'

export class TypedRouteHandler<
  TVersion extends string,
  TRoute extends AnyRouteDef,
  TPathSuffix extends string,
  TRequest extends ExpressRequest
> {
  protected readonly route: TRoute
  protected readonly path: TPathSuffix
  protected readonly router: TypedRouterBase<
    AnyRouteDef,
    TRequest,
    string,
    string[]
  >
  protected readonly middlewares: TypedMiddleware<any, any>[] = []
  protected readonly version: TVersion

  constructor(
    version: TVersion,
    route: TRoute,
    path: TPathSuffix,
    router: TypedRouterBase<AnyRouteDef, TRequest, string, string[]>
  ) {
    this.route = route
    this.path = path
    this.router = router
    this.version = version
  }

  public middleware<
    TRequestIn extends TRequest,
    TRequestOut extends TRequestIn
  >(
    handler: TypedMiddleware<TRequestIn, TRequestOut>
  ): TypedRouteHandler<TVersion, TRoute, TPathSuffix, TRequestOut> {
    this.middlewares.push(handler)

    return this as any as TypedRouteHandler<
      TVersion,
      TRoute,
      TPathSuffix,
      TRequestOut
    >
  }

  public handle(
    handler: TypedRouteHandlerFn<
      TRoute,
      TRequest,
      RouteValidationOutput<TRoute>
    >
  ) {
    this.router.routing.addRoute(this.route, handler as any, this.middlewares) // @todo resolve any
  }
}
