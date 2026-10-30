import { buildUrl, type BaseRequestInput } from './build-url.js'
import { methodSendsBody, type HttpMethod } from './http-method.js'

export type PlannedBody = { send: false } | { send: true; value: unknown }

export type RequestPlan = {
  url: string
  body: PlannedBody
}

/** The url and the body of a request, GET and DELETE never send a body. */
export const planRequest = (
  method: HttpMethod,
  path: string,
  input?: BaseRequestInput
): RequestPlan => ({
  url: buildUrl(path, input),
  body: methodSendsBody(method)
    ? { send: true, value: input?.body }
    : { send: false },
})
