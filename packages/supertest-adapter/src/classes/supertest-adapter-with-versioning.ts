import {
  ApplicationRoutes,
  DateVersionExtractor,
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

  // resolves like the server: by date only with a date version extractor.
  // Neither is part of the public surface of the application.
  protected versionResolution() {
    const { versionHistory, versionExtractor } = this.app as unknown as {
      versionHistory: string[]
      versionExtractor: Partial<DateVersionExtractor>
    }

    return {
      versionHistory,
      parseDate:
        typeof versionExtractor.parseDate === 'function'
          ? versionExtractor.parseDate.bind(versionExtractor)
          : undefined,
    }
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
        AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>['~responses']
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
      context: SupertestConfig & InvalidRequestInput<TMethod>
    ) => {
      return this.executeVersionedRequest<
        InvalidRequestInput<TMethod>,
        AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>['~responses']
      >(method, path, version, context)
    }
  }

  private executeVersionedRequest<TRequestInput, TResponses>(
    method: HTTPMethod,
    path: string,
    version: string,
    context: SupertestConfig & TRequestInput
  ) {
    return super.executeRequest<TRequestInput, TResponses>(
      method,
      this.versionInjector.modifyUrl(path, version),
      this.responsesOf(method, path, version),
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

  /**
   * The handlers of `invalid` under a name for valid requests whose wire
   * format the validator does not describe, e.g. because a middleware
   * reshapes the body before validation.
   */
  public untyped = this.invalid
}
