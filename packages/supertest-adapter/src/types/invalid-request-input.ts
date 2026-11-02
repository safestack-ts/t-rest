import { BaseRequestInput } from '@t-rest/protocol'
import { MultipartBody } from './multipart.js'

/**
 * The input of a request that is meant to fail validation: `params`, `query`
 * and `body` are not tied to the validator of the route and may be left out.
 * A form can be sent as untyped `multipart` instead of a `body`.
 */
export type InvalidRequestInput = Omit<BaseRequestInput, 'body'> &
  (
    | { body?: unknown; multipart?: undefined }
    | { body?: undefined; multipart: MultipartBody }
  )
