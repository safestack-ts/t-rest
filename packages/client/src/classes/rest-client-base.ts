import { AnyRouteDef, BagOfRoutes, Versioning, HTTPMethod } from '@t-rest/core'
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

  // http method implementations
  protected request<
    TMethod extends HTTPMethod,
    TResponse,
    TRequestConfig extends BaseRequestInput & RequestConfig & TRequestContext
  >(method: TMethod, path: string, requestConfig?: TRequestConfig) {
    const plan = planRequest(method, path, requestConfig)

    return this.httpAdapter.request<TResponse>(
      method,
      // the client injects the version into the built url
      this.versionInjector.modifyUrl(plan.url),
      plan.body.send ? plan.body.value : undefined,
      {
        ...(requestConfig as TRequestContext),
        headers: this.versionInjector.modifyHeaders(
          requestConfig?.headers ?? {}
        ),
      }
    )
  }
}
