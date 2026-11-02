import { BaseRequestInput, planRequest } from '@t-rest/protocol'
import { AnyTypedExpressApplication } from '../types/any-typed-express-application.js'
import {
  createRouteResolver,
  HTTPMethod,
  ResponseMap,
  typedLowerCase,
} from '@t-rest/core'
import { MultipartBody } from '../types/multipart.js'
import { SupertestConfig } from '../types/supertest-config.js'
import supertest from 'supertest'
import { SupertestResponse } from '../types/supertest-response.js'
import { DefaultSupertestAdapterConfig } from '../types/default-supertest-adapter-config.js'
import { encodeMultipart } from '../utils/encode-multipart.js'
import { SupertestTargetError } from './supertest-target-error.js'
import { descriptorParser } from '../utils/descriptor-parser.js'

type SuperagentParser = Parameters<supertest.Test['parse']>[0]

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

  private resolveRoute?: ReturnType<typeof createRouteResolver>

  /**
   * The history and the date parsing the server resolves versions with,
   * unversioned applications have neither.
   */
  protected versionResolution(): {
    versionHistory: readonly string[]
    parseDate?: (version: string) => Date
  } {
    return { versionHistory: [] }
  }

  /**
   * The responses of the route the server executes for the request: the route
   * declared for the version, else the newest route of an older version.
   */
  protected responsesOf(
    method: HTTPMethod,
    path: string,
    version: string
  ): ResponseMap {
    // indexed on the first request, once the routes of the application exist
    if (!this.resolveRoute) {
      const { versionHistory, parseDate } = this.versionResolution()

      this.resolveRoute = createRouteResolver(
        this.app.routes,
        versionHistory,
        parseDate
      )
    }

    return this.resolveRoute(method, path, version)?.responses ?? {}
  }

  protected async executeRequest<TRequestInput, TResponses>(
    method: HTTPMethod,
    path: string,
    responses: ResponseMap,
    context: SupertestConfig &
      TRequestInput &
      BaseRequestInput & { multipart?: MultipartBody }
  ) {
    // the version injector already modified the path template, before its
    // params and query are put into it
    const plan = planRequest(method, path, context)
    // the body is decoded by the declared descriptor of the status, which is
    // only known once the response arrives
    let request = supertest(this.requestTarget)
      [typedLowerCase(method)](plan.url)
      .buffer(true)
      // superagent types the parser for the browser, node passes the
      // incoming message
      .parse(descriptorParser(responses) as unknown as SuperagentParser)

    const isMultipart = context.multipart !== undefined && plan.body.send
    const headers: Record<string, string | number | boolean> = {
      ...this.defaultConfig.headers,
      ...context.headers,
    }

    if (isMultipart) {
      const form = await encodeMultipart(context.multipart as MultipartBody)
      // a content type of the call is kept, e.g. to test its rejection, the
      // default headers usually describe json
      const callContentType = Object.entries(context.headers ?? {}).find(
        ([name]) => name.toLowerCase() === 'content-type'
      )?.[1]

      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === 'content-type') {
          delete headers[name]
        }
      }

      request = request
        .set('Content-Type', String(callContentType ?? form.contentType))
        .send(form.body)
    } else if (plan.body.send) {
      request = isJsonPrimitive(plan.body.value)
        ? request.type('json').send(JSON.stringify(plan.body.value))
        : request.send(plan.body.value as string | object | undefined)
    }

    if (Object.entries(headers).length > 0) {
      request = request.set(headers as Record<string, string>)
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

    return response as unknown as SupertestResponse<TResponses>
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
