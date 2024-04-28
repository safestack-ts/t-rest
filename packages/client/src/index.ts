import {
  AnyRouteDef,
  BagOfRoutes,
  ResponseTypeKey,
  Versioning,
  VersioningRequired,
  demoBagOfRoutes,
  ExtractVersionMatchingRoute,
  ExtractRoutes,
  RouteValidationInput,
  HTTPMethod,
} from '@typed-rest/core'
import axios, { AxiosInstance } from 'axios'
import { BaseRequestInput, buildUrl } from './utils/build-url'

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

type RequestInput<TRoute extends AnyRouteDef> = RouteValidationInput<TRoute>
// @todo add type tests
type RequestArgs<TRequestInput, TPath extends string> = {} extends TRequestInput
  ? [path: TPath, requestConfig?: RequestConfig]
  : [path: TPath, requestConfig: RequestConfig & TRequestInput]

export class RESTClientWithoutVersioning<
  TRoutes extends AnyRouteDef
> extends RESTClient<TRoutes, never> {
  private makeRouteHandler<TMethod extends HTTPMethod>(method: TMethod) {
    return <
      TAbsolutePath extends Extract<TRoutes, { method: TMethod }>['path']
    >(
      ...args: RequestArgs<
        RequestInput<
          Extract<TRoutes, { method: TMethod; path: TAbsolutePath }>
        >,
        TAbsolutePath
      >
    ) => {
      return super.request<
        TMethod,
        Extract<
          TRoutes,
          { method: TMethod; path: TAbsolutePath }
        >[ResponseTypeKey],
        NonNullable<(typeof args)[1]>
      >(method, args[0], args[1])
    }
  }
  public get = this.makeRouteHandler('GET')

  public post = this.makeRouteHandler('POST')

  public put = this.makeRouteHandler('PUT')

  public patch = this.makeRouteHandler('PATCH')

  public delete = this.makeRouteHandler('DELETE')
}

export class RESTClientWithVersioning<
  TRoutes extends AnyRouteDef,
  TVersion extends TRoutes['version'],
  TVersionHistory extends string[]
> extends RESTClient<TRoutes, TVersionHistory> {
  protected readonly version: TVersion

  constructor(
    routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>,
    version: TVersion,
    httpAdapter: HTTPAdapter
  ) {
    super(routes, httpAdapter)
    this.version = version
  }

  private makeRouteHandler<TMethod extends HTTPMethod>(method: TMethod) {
    return <
      TAbsolutePath extends ExtractVersionMatchingRoute<
        Extract<TRoutes, { method: TMethod }>,
        TVersion,
        TVersionHistory
      >['path']
    >(
      ...args: RequestArgs<
        RequestInput<
          ExtractVersionMatchingRoute<
            Extract<TRoutes, { method: TMethod; path: TAbsolutePath }>,
            TVersion,
            TVersionHistory
          >
        >,
        TAbsolutePath
      >
    ) => {
      return super.request<
        TMethod,
        ExtractVersionMatchingRoute<
          Extract<TRoutes, { method: TMethod; path: TAbsolutePath }>,
          TVersion,
          TVersionHistory
        >[ResponseTypeKey],
        NonNullable<(typeof args)[1]>
      >(method, args[0], args[1])
    }
  }

  public get = this.makeRouteHandler('GET')

  public post = this.makeRouteHandler('POST')

  public put = this.makeRouteHandler('PUT')

  public patch = this.makeRouteHandler('PATCH')

  public delete = this.makeRouteHandler('DELETE')
}

type RequestConfig = {
  headers?: Record<string, string>
}

type HTTPResponse<TResponse> = {
  data: TResponse
  statusCode: number
  // @todo add more
}

interface HTTPAdapter {
  request<TResponse>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig?: RequestConfig
  ): Promise<HTTPResponse<TResponse>>
}

class AxiosHTTPAdapter implements HTTPAdapter {
  private readonly axiosInstance: AxiosInstance

  constructor(axiosInstance: AxiosInstance) {
    this.axiosInstance = axiosInstance
  }

  async request<TResponse>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig?: RequestConfig
  ) {
    const response = await this.axiosInstance.request<TResponse>({
      url,
      method,
      data,
      headers: requestConfig?.headers,
    })

    return {
      data: response.data,
      statusCode: response.status,
    }
  }
}

// Playground
const axiosInstance = axios.create()
const client = RESTClient.withVersioning(
  demoBagOfRoutes,
  '2024-03-01',
  new AxiosHTTPAdapter(axiosInstance)
)

const main = async () => {
  const a = await client.get('/basket')

  const b = await client.post('/basket', { body: { entries: [{ id: '1' }] } })
}

type Routes = ExtractRoutes<typeof demoBagOfRoutes>
type GetBasketRoute = Extract<Routes, { method: 'GET'; path: '/basket' }>
type GetBasketRouteInput = RequestInput<GetBasketRoute>
type GetBasketRouteRequestArgs = RequestArgs<GetBasketRoute, '/basket'>
