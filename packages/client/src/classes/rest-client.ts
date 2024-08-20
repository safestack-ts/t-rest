import {
  AnyRouteDef,
  BagOfRoutes,
  Versioning,
  VersioningRequired,
  HTTPMethod,
} from '@typed-rest/core'
import { HTTPAdapter } from '../types/http-adapter'
import { RequestConfig } from '../types/request-config'
import { BaseRequestInput, buildUrl } from '../utils/build-url'
import { RESTClientWithVersioning } from './rest-client-with-versioning'
import { RESTClientWithoutVersioning } from './rest-client-without-versioning'

export abstract class RESTClient<
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

  public static withoutVersioning<TRoutes extends AnyRouteDef>(
    bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>,
    httpAdapter: HTTPAdapter
  ) {
    return new RESTClientWithoutVersioning(bagOfRoutes, httpAdapter)
  }

  public static withVersioning<
    TRoutes extends AnyRouteDef,
    TVersionHistory extends string[],
    TVersion extends TVersionHistory[number]
  >(
    bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>,
    version: TVersion,
    httpAdapter: HTTPAdapter
  ) {
    return new RESTClientWithVersioning(bagOfRoutes, version, httpAdapter)
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
