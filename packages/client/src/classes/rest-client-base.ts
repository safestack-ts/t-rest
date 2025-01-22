import { AnyRouteDef, BagOfRoutes, Versioning, HTTPMethod } from '@t-rest/core'
import { HTTPAdapter } from '../types/http-adapter'
import { RequestConfig } from '../types/request-config'
import { BaseRequestInput, buildUrl } from '../utils/build-url'

export abstract class RESTClientBase<
  TRoutes extends AnyRouteDef,
  TVersionHistory extends string[]
> {
  protected readonly routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>
  protected readonly httpAdapter: HTTPAdapter

  constructor(
    routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>,
    httpAdapter: HTTPAdapter
  ) {
    this.routes = routes
    this.httpAdapter = httpAdapter
  }

  // http method implementations
  protected request<
    TMethod extends HTTPMethod,
    TResponse,
    TRequestConfig extends BaseRequestInput & RequestConfig
  >(method: TMethod, path: string, requestConfig?: TRequestConfig) {
    return this.httpAdapter.request<TResponse>(
      method,
      buildUrl(path, requestConfig),
      this.getBody(method, requestConfig),
      requestConfig
    )
  }

  private getBody = <TRequestConfig extends BaseRequestInput & RequestConfig>(
    method: HTTPMethod,
    requestConfig?: TRequestConfig
  ) => {
    switch (method) {
      case 'GET':
      case 'DELETE':
        return undefined
      default:
        return requestConfig?.body
    }
  }
}
