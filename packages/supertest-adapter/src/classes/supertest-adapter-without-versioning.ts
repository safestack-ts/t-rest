import {
  ApplicationRoutes,
  TypedExpressApplicationWithoutVersioning,
} from '@t-rest/express-server'
import { SupertestConfig } from '../types/supertest-config.js'
import { RequestInput } from '../types/request-input.js'
import { InvalidRequestInput } from '../types/invalid-request-input.js'
import { HTTPMethod } from '@t-rest/core'
import { SupertestAdapterBase } from './supertest-adapter-base.js'

export class SupertestAdapterWithoutVersioning<
  TApp extends TypedExpressApplicationWithoutVersioning<any, any, any>
> extends SupertestAdapterBase<TApp> {
  protected makeRouteHandler<TMethod extends HTTPMethod>(method: TMethod) {
    return <
      TAbsolutePath extends Extract<
        ApplicationRoutes<TApp>,
        { method: TMethod }
      >['path']
    >(
      path: TAbsolutePath,
      context: SupertestConfig &
        RequestInput<
          Extract<
            ApplicationRoutes<TApp>,
            { method: TMethod; path: TAbsolutePath }
          >
        >
    ) => {
      return super.executeRequest<
        RequestInput<
          Extract<
            ApplicationRoutes<TApp>,
            { method: TMethod; path: TAbsolutePath }
          >
        >,
        Extract<
          ApplicationRoutes<TApp>,
          { method: TMethod; path: TAbsolutePath }
        >['~responseType']
      >(method, path, context)
    }
  }

  protected makeInvalidRouteHandler<TMethod extends HTTPMethod>(
    method: TMethod
  ) {
    return <
      TAbsolutePath extends Extract<
        ApplicationRoutes<TApp>,
        { method: TMethod }
      >['path']
    >(
      path: TAbsolutePath,
      context: SupertestConfig & InvalidRequestInput
    ) => {
      return super.executeRequest<
        InvalidRequestInput,
        Extract<
          ApplicationRoutes<TApp>,
          { method: TMethod; path: TAbsolutePath }
        >['~responseType']
      >(method, path, context)
    }
  }

  public get = this.makeRouteHandler('GET')

  public post = this.makeRouteHandler('POST')

  public put = this.makeRouteHandler('PUT')

  public patch = this.makeRouteHandler('PATCH')

  public delete = this.makeRouteHandler('DELETE')

  /**
   * Same routes, but `params`, `query` and `body` are not checked against the
   * validator of the route, to test how the server rejects invalid input.
   */
  public invalid = {
    get: this.makeInvalidRouteHandler('GET'),
    post: this.makeInvalidRouteHandler('POST'),
    put: this.makeInvalidRouteHandler('PUT'),
    patch: this.makeInvalidRouteHandler('PATCH'),
    delete: this.makeInvalidRouteHandler('DELETE'),
  }
}
