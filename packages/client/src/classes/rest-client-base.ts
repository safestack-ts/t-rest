import { AnyRouteDef, BagOfRoutes, Versioning, HTTPMethod } from '@t-rest/core'
import { HTTPAdapter } from '../types/http-adapter'
import { RequestConfig } from '../types/request-config'
import { BaseRequestInput, buildUrl } from '@t-rest/client-utils'
import { VersionInjector } from './version-injector'

export abstract class RESTClientBase<
  TRoutes extends AnyRouteDef,
  TVersionHistory extends string[]
> {
  protected readonly routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>
  protected readonly httpAdapter: HTTPAdapter
  protected readonly versionInjector: VersionInjector

  constructor(
    routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>,
    httpAdapter: HTTPAdapter,
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
    TRequestConfig extends BaseRequestInput & RequestConfig
  >(method: TMethod, path: string, requestConfig?: TRequestConfig) {
    return this.httpAdapter.request<TResponse>(
      method,
      this.versionInjector.modifyUrl(buildUrl(path, requestConfig)),
      this.getBody(method, requestConfig),
      {
        ...requestConfig,
        headers: this.versionInjector.modifyHeaders(
          requestConfig?.headers ?? {}
        ),
      }
    )
  }

  private getBody = (method: HTTPMethod, requestConfig?: BaseRequestInput) => {
    switch (method) {
      case 'GET':
      case 'DELETE':
        return undefined
      default:
        return requestConfig?.body
    }
  }
}
