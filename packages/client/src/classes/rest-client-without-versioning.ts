import { AnyRouteDef, BagOfRoutes, HTTPMethod, Versioning } from '@t-rest/core'
import { RESTClientBase } from './rest-client-base'
import { RequestArgs } from '../types/request-args'
import { RequestInput } from '../types/request-input'
import { HTTPAdapter } from '../types/http-adapter'
import { NoVersionInjector } from './version-injector'

export class RESTClientWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TRequestContext
> extends RESTClientBase<TRoutes, never, TRequestContext> {
  constructor(
    routes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>,
    httpAdapter: HTTPAdapter<TRequestContext>
  ) {
    super(routes, httpAdapter, new NoVersionInjector(''))
  }

  private makeRouteHandler<TMethod extends HTTPMethod>(method: TMethod) {
    return <
      TAbsolutePath extends Extract<TRoutes, { method: TMethod }>['path']
    >(
      ...args: RequestArgs<
        RequestInput<
          Extract<TRoutes, { method: TMethod; path: TAbsolutePath }>
        >,
        TAbsolutePath,
        TRequestContext
      >
    ) => {
      return super.request<
        TMethod,
        Extract<
          TRoutes,
          { method: TMethod; path: TAbsolutePath }
        >['~responseType'],
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
