import { DecodedBody } from '@t-rest/core'

type ResponseOfStatus<TResponses, TStatus extends keyof TResponses & number> = {
  data: DecodedBody<TResponses[TStatus], ArrayBuffer, undefined>
  statusCode: TStatus
  // @todo add more
}

/** Any response of any route, e.g. for helpers which handle every route. */
export type AnyHTTPResponse = {
  data: any
  statusCode: number
}

/**
 * Discriminated union of the responses a route declares, by `statusCode`.
 * Unknown responses (`unknown`, `any` or `ResponseMap`) are `AnyHTTPResponse`.
 */
export type HTTPResponse<TResponses> = unknown extends TResponses
  ? AnyHTTPResponse
  : number extends keyof TResponses
  ? AnyHTTPResponse
  : TResponses extends unknown
  ? {
      [TStatus in keyof TResponses & number]: ResponseOfStatus<
        TResponses,
        TStatus
      >
    }[keyof TResponses & number]
  : never
