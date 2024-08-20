import { AnyRouteDef, HTTPMethod, ResponseTypeKey } from '@typed-rest/core'
import { RESTClient } from './rest-client'
import { RequestArgs } from '../types/request-args'
import { RequestInput } from '../types/request-input'

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
