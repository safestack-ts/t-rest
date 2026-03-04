import {
  ApplicationRoutes,
  TypedExpressApplicationWithVersioning,
} from '@t-rest/express-server'
import { HTTPMethod } from '@t-rest/core'
import { SupertestConfig } from '../types/supertest-config.js'
import { RequestInput } from '../types/request-input.js'
import { VersionInjector } from './version-injector.js'
import { SupertestAdapterBase } from './supertest-adapter-base.js'
import { DefaultSupertestAdapterConfig } from '../types/default-supertest-adapter-config.js'
export class SupertestAdapterWithVersioning<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>
> extends SupertestAdapterBase<TApp> {
  private readonly versionInjector: VersionInjector

  constructor(
    app: TApp,
    versionInjector: VersionInjector,
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
      TVersion extends Extract<
        ApplicationRoutes<TApp>,
        { method: TMethod; path: TAbsolutePath }
      >['version']
    >(
      path: TAbsolutePath,
      version: TVersion,
      context: SupertestConfig &
        RequestInput<
          Extract<
            ApplicationRoutes<TApp>,
            { method: TMethod; path: TAbsolutePath; version: TVersion }
          >
        >
    ) => {
      return super.executeRequest<
        RequestInput<
          Extract<
            ApplicationRoutes<TApp>,
            { method: TMethod; path: TAbsolutePath; version: TVersion }
          >
        >,
        Extract<
          ApplicationRoutes<TApp>,
          { method: TMethod; path: TAbsolutePath; version: TVersion }
        >['~responseType']
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
