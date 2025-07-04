import { BaseRequestInput, buildUrl } from '@t-rest/client-utils'
import { AnyTypedExpressApplication } from '../types/any-typed-express-application'
import { HTTPMethod, typedLowerCase } from '@t-rest/core'
import { SupertestConfig } from '../types/supertest-config'
import supertest from 'supertest'
import { SupertestResponse } from '../types/supertest-response'
import { DefaultSupertestAdapterConfig } from '../types/default-supertest-adapter-config'

export abstract class SupertestAdapterBase<
  TApp extends AnyTypedExpressApplication
> {
  protected app: TApp
  protected defaultConfig: DefaultSupertestAdapterConfig

  constructor(app: TApp, defaultConfig: DefaultSupertestAdapterConfig) {
    this.app = app
    this.defaultConfig = defaultConfig
  }

  protected async executeRequest<TRequestInput, TResponseType>(
    method: HTTPMethod,
    path: string,
    context: SupertestConfig & TRequestInput & BaseRequestInput
  ) {
    let request = supertest(this.app.expressApp as any)[typedLowerCase(method)](
      buildUrl(path, context)
    )

    if (method !== 'GET' && method !== 'DELETE') {
      request = request.send(context.body as string | object | undefined)
    }

    const headers = { ...this.defaultConfig.headers, ...context.headers }

    if (Object.entries(headers).length > 0) {
      request = request.set(headers)
    }

    if (context.expect?.status !== undefined) {
      request = request
        .expect((res) =>
          res.status !== context.expect?.status
            ? console.error(this.stringifyBody(res.body))
            : 0
        )
        .expect(context.expect.status)
    }

    if (context.expect?.headers !== undefined) {
      for (const [headerKey, headerValue] of Object.entries(
        context.expect.headers
      )) {
        request = request.expect(headerKey, headerValue)
      }
    }

    const response = await request

    return response as SupertestResponse<TResponseType>
  }

  private stringifyBody(body: any) {
    if (typeof body === 'string') {
      return body
    }

    try {
      return JSON.stringify(body)
    } catch (e) {
      return String(body)
    }
  }
}
