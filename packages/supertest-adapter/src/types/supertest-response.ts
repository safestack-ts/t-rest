import { DecodedBody } from '@t-rest/core'
import supertest from 'supertest'

type ResponseOfStatus<TBody, TStatus extends number> = Omit<
  supertest.Response,
  'body' | 'status' | 'statusCode'
> & {
  body: TBody
  status: TStatus
  statusCode: TStatus
}

/** Any response of any route, e.g. for helpers which handle every route. */
export type AnySupertestResponse = ResponseOfStatus<any, number>

/**
 * Discriminated union of the responses a route declares, by `status`. Unknown
 * responses (`unknown`, `any` or `ResponseMap`) are `AnySupertestResponse`.
 */
export type SupertestResponse<TResponses> = unknown extends TResponses
  ? AnySupertestResponse
  : number extends keyof TResponses
  ? AnySupertestResponse
  : TResponses extends unknown
  ? {
      [TStatus in keyof TResponses & number]: ResponseOfStatus<
        DecodedBody<TResponses[TStatus], Buffer, Record<string, never>>,
        TStatus
      >
    }[keyof TResponses & number]
  : never
