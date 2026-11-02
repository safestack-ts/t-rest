import { DecodedBody } from '@t-rest/core'

/** Response headers with lower-case keys. Headers sent multiple times, e.g. `set-cookie`, are arrays. */
export type HTTPResponseHeaders = Record<string, string | string[] | undefined>

type ResponseOfStatus<TResponses, TStatus extends keyof TResponses & number> = {
  data: DecodedBody<TResponses[TStatus], ArrayBuffer, undefined>
  statusCode: TStatus
  /**
   * Optional so that existing custom `HTTPAdapter` implementations keep working,
   * but they should return it. Always set by `AxiosHTTPAdapter`.
   */
  headers?: HTTPResponseHeaders
}

/** Any response of any route, e.g. for helpers which handle every route. */
export type AnyHTTPResponse = {
  data: any
  statusCode: number
  /**
   * Optional so that existing custom `HTTPAdapter` implementations keep working,
   * but they should return it. Always set by `AxiosHTTPAdapter`.
   */
  headers?: HTTPResponseHeaders
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
