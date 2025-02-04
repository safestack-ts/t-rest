import {
  AnyRouteDef,
  BagOfRoutes,
  ExtractLatestMatchingRoutePerPath,
  HTTPMethod,
  NewerVersions,
  ResponseTypeKey,
  Versioning,
} from '@t-rest/core'
import { RESTClientBase } from './rest-client-base'
import { RequestArgs } from '../types/request-args'
import { RequestInput } from '../types/request-input'
import { HTTPAdapter } from '../types/http-adapter'
import { VersionInjectorConstructor } from './version-injector'

export class RESTClientWithVersioning<
  TRoutes extends AnyRouteDef,
  TVersion extends TRoutes['version'],
  TVersionHistory extends string[]
> extends RESTClientBase<TRoutes, TVersionHistory> {
  protected readonly version: TVersion
  protected readonly versionInjectorConstructor: VersionInjectorConstructor

  constructor(
    routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>,
    version: TVersion,
    httpAdapter: HTTPAdapter,
    versionInjectorConstructor: VersionInjectorConstructor
  ) {
    super(routes, httpAdapter, new versionInjectorConstructor(version))

    this.version = version
    this.versionInjectorConstructor = versionInjectorConstructor
  }

  private makeRouteHandler<TMethod extends HTTPMethod>(method: TMethod) {
    return <
      TAbsolutePath extends ExtractLatestMatchingRoutePerPath<
        Extract<TRoutes, { method: TMethod }>,
        TVersion,
        TVersionHistory
      >['path']
    >(
      ...args: RequestArgs<
        RequestInput<
          ExtractLatestMatchingRoutePerPath<
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
        ExtractLatestMatchingRoutePerPath<
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

  public withVersion<
    TNewVersion extends NewerVersions<TVersionHistory, TVersion>
  >(
    version: TNewVersion
  ): RESTClientWithVersioning<TRoutes, TNewVersion, TVersionHistory> {
    return new RESTClientWithVersioning(
      this.routes,
      version,
      this.httpAdapter,
      this.versionInjectorConstructor
    )
  }
}
