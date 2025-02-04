import {
  ApplicationRoutes,
  TypedExpressApplicationWithoutVersioning,
} from '@t-rest/express-server'
import { SupertestConfig } from '../types/supertest-config'
import { RequestInput } from '../types/request-input'
import { HTTPMethod } from '@t-rest/core'
import { SupertestAdapterBase } from './supertest-adapter-base'

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

  public get = this.makeRouteHandler('GET')

  public post = this.makeRouteHandler('POST')

  public put = this.makeRouteHandler('PUT')

  public patch = this.makeRouteHandler('PATCH')

  public delete = this.makeRouteHandler('DELETE')
}
