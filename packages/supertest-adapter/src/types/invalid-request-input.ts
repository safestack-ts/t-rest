import { HTTPMethod } from '@t-rest/core'
import { BaseRequestInput } from '@t-rest/protocol'
import { MultipartBody } from './multipart.js'

type BaseRequestInputWithoutBody = Omit<BaseRequestInput, 'body'>

export interface InvalidBodyRequestInput extends BaseRequestInputWithoutBody {
  body?: unknown
  multipart?: undefined
}

export interface InvalidMultipartRequestInput
  extends BaseRequestInputWithoutBody {
  body?: undefined
  multipart: MultipartBody
}

/**
 * The input of a request that is meant to fail validation: `params`, `query`
 * and `body` are not tied to the validator of the route and may be left out.
 * A form can be sent as untyped `multipart` instead of a `body`, but not on
 * GET and DELETE, which send no body.
 */
export type InvalidRequestInput<TMethod extends HTTPMethod = HTTPMethod> =
  | InvalidBodyRequestInput
  | (TMethod extends 'GET' | 'DELETE' ? never : InvalidMultipartRequestInput)
