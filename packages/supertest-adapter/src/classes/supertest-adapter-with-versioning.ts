import {
  ApplicationRoutes,
  TypedExpressApplicationWithVersioning,
} from '@t-rest/express-server'
import { HTTPMethod } from '@t-rest/core'
import { SupertestConfig } from '../types/supertest-config.js'
import { RequestInput } from '../types/request-input.js'
import { InvalidRequestInput } from '../types/invalid-request-input.js'
import { SupertestVersionInjector } from './version-injector.js'
import { SupertestAdapterBase } from './supertest-adapter-base.js'
import { AppRouteAt, CallableVersions } from '../types/app-route-at.js'
import { DefaultSupertestAdapterConfig } from '../types/default-supertest-adapter-config.js'
export class SupertestAdapterWithVersioning<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>
> extends SupertestAdapterBase<TApp> {
  private readonly versionInjector: SupertestVersionInjector

  constructor(
    app: TApp,
    versionInjector: SupertestVersionInjector,
    defaultConfig: DefaultSupertestAdapterConfig
  ) {
    super(app, defaultConfig)

    this.versionInjector = versionInjector
  }

  protected makeRouteHandler<TMethod extends HTTPMethod>(method: TMethod) {
    return <
      TAbsolutePath extends Extract<
        ApplicationRoutes<TApp>,
        { method: TMethod }
      >['path'],
      TVersion extends CallableVersions<TApp, TMethod, TAbsolutePath>
    >(
      path: TAbsolutePath,
      version: TVersion,
      context: SupertestConfig &
        RequestInput<AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>>
    ) => {
      return this.executeVersionedRequest<
        RequestInput<AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>>,
        AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>['~responseType']
      >(method, path, version, context)
    }
  }

  protected makeInvalidRouteHandler<TMethod extends HTTPMethod>(
    method: TMethod
  ) {
    return <
      TAbsolutePath extends Extract<
        ApplicationRoutes<TApp>,
        { method: TMethod }
      >['path'],
      TVersion extends CallableVersions<TApp, TMethod, TAbsolutePath>
    >(
      path: TAbsolutePath,
      version: TVersion,
      context: SupertestConfig & InvalidRequestInput
    ) => {
      return this.executeVersionedRequest<
        InvalidRequestInput,
        AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>['~responseType']
      >(method, path, version, context)
    }
  }

  private executeVersionedRequest<TRequestInput, TResponseType>(
    method: HTTPMethod,
    path: string,
    version: string,
    context: SupertestConfig & TRequestInput
  ) {
    return super.executeRequest<TRequestInput, TResponseType>(
      method,
      this.versionInjector.modifyUrl(path, version),
      {
        ...(context as any),
        headers: this.versionInjector.modifyHeaders(
          (context as any)?.headers ?? {},
          version
        ),
      }
    )
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
