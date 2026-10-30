import {
  ApplicationRoutes,
  TypedExpressApplicationWithVersioning,
} from '@t-rest/express-server'
import { HTTPMethod } from '@t-rest/core'
import { SupertestConfig } from '../types/supertest-config.js'
import { RequestInput } from '../types/request-input.js'
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
      return super.executeRequest<
        RequestInput<AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>>,
        AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>['~responseType']
      >(method, this.versionInjector.modifyUrl(path, version), {
        ...(context as any),
        headers: this.versionInjector.modifyHeaders(
          (context as any)?.headers ?? {},
          version
        ),
      })
    }
  }

  public get = this.makeRouteHandler('GET')

  public post = this.makeRouteHandler('POST')

  public put = this.makeRouteHandler('PUT')

  public patch = this.makeRouteHandler('PATCH')

  public delete = this.makeRouteHandler('DELETE')
}
