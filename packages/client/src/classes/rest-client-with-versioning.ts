import {
  AnyRouteDef,
  BagOfRoutes,
  ExtractVersionMatchingRoute,
  HTTPMethod,
  ResponseTypeKey,
  Versioning,
} from '@t-rest/core'
import { RESTClientBase } from './rest-client-base'
import { RequestArgs } from '../types/request-args'
import { RequestInput } from '../types/request-input'
import { HTTPAdapter } from '../types/http-adapter'

export class RESTClientWithVersioning<
  TRoutes extends AnyRouteDef,
  TVersion extends TRoutes['version'],
  TVersionHistory extends string[]
> extends RESTClientBase<TRoutes, TVersionHistory> {
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
