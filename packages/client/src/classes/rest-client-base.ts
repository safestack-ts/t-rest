import {
  AnyRouteDef,
  BagOfRoutes,
  createRouteResolver,
  Versioning,
  HTTPMethod,
  ResponseMap,
} from '@t-rest/core'
import { HTTPAdapter } from '../types/http-adapter.js'
import { RequestConfig } from '../types/request-config.js'
import { BaseRequestInput, planRequest } from '@t-rest/protocol'
import { VersionInjector } from './version-injector.js'

export abstract class RESTClientBase<
  TRoutes extends AnyRouteDef,
  TVersionHistory extends string[],
  TRequestContext
> {
  protected readonly routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>
  protected readonly httpAdapter: HTTPAdapter<TRequestContext>
  protected readonly versionInjector: VersionInjector
  private readonly resolveRoute: ReturnType<typeof createRouteResolver>

  constructor(
    routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>,
    httpAdapter: HTTPAdapter<TRequestContext>,
    versionInjector: VersionInjector
  ) {
    this.routes = routes
    this.httpAdapter = httpAdapter
    this.versionInjector = versionInjector
    this.resolveRoute = createRouteResolver(
      routes.routes,
      routes.versionHistory ?? [],
      // resolves like a server with a date version extractor, the version of
      // a client is part of the history, which resolves the same either way
      routes.versioning === Versioning.DATE
        ? (version) => new Date(version)
        : undefined
    )
  }

  // the route definition holds the responses of the request at runtime
  private routeOf(method: HTTPMethod, path: string): AnyRouteDef {
    const route = this.resolveRoute(method, path, this.requestedVersion())

    if (!route) {
      throw new Error(
        `Route ${method} ${path} is not part of the bag of routes`
      )
    }

    return route
  }

  // the version requests are sent with, unversioned routes are stored as ''
  protected requestedVersion() {
    return ''
  }

  // http method implementations
  protected async request<
    TMethod extends HTTPMethod,
    TResponses extends ResponseMap,
    TRequestConfig extends BaseRequestInput & RequestConfig & TRequestContext
  >(method: TMethod, path: string, requestConfig?: TRequestConfig) {
    // errors of planning the request reject the returned promise as well
    const plan = planRequest(method, path, requestConfig)

    return this.httpAdapter.request<TResponses>(
      method,
      // the client injects the version into the built url
      this.versionInjector.modifyUrl(plan.url),
      plan.body.send ? plan.body.value : undefined,
      {
        ...(requestConfig as TRequestContext),
        headers: this.versionInjector.modifyHeaders(
          requestConfig?.headers ?? {}
        ),
      },
      this.routeOf(method, path).responses as TResponses
    )
  }
}
