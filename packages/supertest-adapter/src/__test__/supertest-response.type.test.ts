import { json, ResponseMap } from '@t-rest/core'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import {
  AnySupertestResponse,
  SupertestResponse,
} from '../types/supertest-response.js'

// helpers handling the responses of any route
type _unknownResponses = AssertTrue<
  IsExact<SupertestResponse<unknown>, AnySupertestResponse>
>
type _anyResponses = AssertTrue<
  IsExact<SupertestResponse<any>, AnySupertestResponse>
>
type _responseMap = AssertTrue<
  IsExact<SupertestResponse<ResponseMap>, AnySupertestResponse>
>

// the response of every route is an AnySupertestResponse
declare const invoice: SupertestResponse<{
  200: ReturnType<typeof json<{ id: number }>>
}>
export const anyResponse: AnySupertestResponse = invoice
