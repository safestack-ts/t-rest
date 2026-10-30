import {
  AnyRouteDef,
  BagOfRoutes,
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

  constructor(
    routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>,
    httpAdapter: HTTPAdapter<TRequestContext>,
    versionInjector: VersionInjector
  ) {
    this.routes = routes
    this.httpAdapter = httpAdapter
    this.versionInjector = versionInjector
  }

  // the route definition holds the responses of the request at runtime
  private routeOf(method: HTTPMethod, path: string): AnyRouteDef {
    const route = this.routes.routes.get([
      method,
      path,
      this.routeVersion(method, path),
    ])

    if (!route) {
      throw new Error(
        `Route ${method} ${path} is not part of the bag of routes`
      )
    }

    return route
  }

  protected routeVersion(_method: HTTPMethod, _path: string) {
    return ''
  }

  // http method implementations
  protected request<
    TMethod extends HTTPMethod,
    TResponses extends ResponseMap,
    TRequestConfig extends BaseRequestInput & RequestConfig & TRequestContext
  >(method: TMethod, path: string, requestConfig?: TRequestConfig) {
    const plan = planRequest(method, path, requestConfig)

    return this.httpAdapter.request<TResponses>(
      method,
      // the client injects the version into the built url
      this.versionInjector.modifyUrl(plan.url),
      plan.body.send ? plan.body.value : undefined,
      this.routeOf(method, path).responses,
      {
        ...(requestConfig as TRequestContext),
        headers: this.versionInjector.modifyHeaders(
          requestConfig?.headers ?? {}
        ),
      }
    )
  }
}
