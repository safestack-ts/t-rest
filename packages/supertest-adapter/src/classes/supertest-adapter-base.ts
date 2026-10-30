import { BaseRequestInput, planRequest } from '@t-rest/protocol'
import { AnyTypedExpressApplication } from '../types/any-typed-express-application.js'
import { HTTPMethod, typedLowerCase } from '@t-rest/core'
import { SupertestConfig } from '../types/supertest-config.js'
import supertest from 'supertest'
import { SupertestResponse } from '../types/supertest-response.js'
import { DefaultSupertestAdapterConfig } from '../types/default-supertest-adapter-config.js'
import { SupertestTargetError } from './supertest-target-error.js'

// express applications and http servers can be listened on, routers cannot
const isExpressRouter = (target: unknown) =>
  typeof target === 'function' && 'stack' in target && !('listen' in target)

// superagent only serializes objects and would fail on the other json values
const isJsonPrimitive = (value: unknown) =>
  typeof value === 'number' || typeof value === 'boolean' || value === null

export abstract class SupertestAdapterBase<
  TApp extends AnyTypedExpressApplication
> {
  protected app: TApp
  protected defaultConfig: DefaultSupertestAdapterConfig
  private readonly requestTarget: Parameters<typeof supertest>[0]

  constructor(app: TApp, defaultConfig: DefaultSupertestAdapterConfig) {
    this.app = app
    this.defaultConfig = defaultConfig
    const requestTarget = defaultConfig.expressApp ?? app.expressApp

    // supertest would serve the router alone: requests it does not handle
    // never complete instead of responding with 404
    if (isExpressRouter(requestTarget)) {
      throw new SupertestTargetError(
        'The typed application is built on an express router, which cannot be served on its own. ' +
          'Pass the root express application as `expressApp` in the config of the supertest adapter.'
      )
    }

    this.requestTarget = requestTarget as Parameters<typeof supertest>[0]
  }

  protected async executeRequest<TRequestInput, TResponseType>(
    method: HTTPMethod,
    path: string,
    context: SupertestConfig & TRequestInput & BaseRequestInput
  ) {
    // the version injector already modified the path template, before its
    // params and query are put into it
    const plan = planRequest(method, path, context)
    let request = supertest(this.requestTarget)[typedLowerCase(method)](
      plan.url
    )

    if (plan.body.send) {
      request = isJsonPrimitive(plan.body.value)
        ? request.type('json').send(JSON.stringify(plan.body.value))
        : request.send(plan.body.value as string | object | undefined)
    }

    const headers = { ...this.defaultConfig.headers, ...context.headers }

    if (Object.entries(headers).length > 0) {
      request = request.set(headers)
    }

    if (context.expect?.status !== undefined) {
      request = request
        .expect((res) =>
          res.status !== context.expect?.status
            ? console.error(this.stringifyBody(res.body, res.text))
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

  private stringifyBody(body: any, text?: string) {
    if (typeof body === 'string') {
      return body
    }

    // non-json responses (e.g. express' default html error page) are not
    // parsed into the body, so their text is logged instead
    const isEmptyBody =
      body === undefined ||
      (typeof body === 'object' &&
        body !== null &&
        Object.keys(body).length === 0)
    if (isEmptyBody && text) {
      return text
    }

    try {
      return JSON.stringify(body)
    } catch {
      return String(body)
    }
  }
}
