import {
  BinaryResponseDescriptor,
  EmptyResponseDescriptor,
  JsonResponseDescriptor,
  TextResponseDescriptor,
} from '@t-rest/core'
import supertest from 'supertest'

type SupertestBody<TDescriptor> = TDescriptor extends JsonResponseDescriptor<
  infer TBody
>
  ? TBody
  : TDescriptor extends TextResponseDescriptor<string>
  ? string
  : TDescriptor extends BinaryResponseDescriptor
  ? Buffer
  : TDescriptor extends EmptyResponseDescriptor
  ? Record<string, never>
  : never

/** Discriminated union of the responses a route declares, by `status`. */
export type SupertestResponse<TResponses> = TResponses extends unknown
  ? {
      [TStatus in keyof TResponses & number]: Omit<
        supertest.Response,
        'body' | 'status' | 'statusCode'
      > & {
        body: SupertestBody<TResponses[TStatus]>
        status: TStatus
        statusCode: TStatus
      }
    }[keyof TResponses & number]
  : never
