import {
  AnyRouteDef,
  RouteRequestInput,
  RouteValidationInput,
} from '@t-rest/core'
import { MultipartInput } from './multipart.js'

export type RequestInput<TRoute extends AnyRouteDef> = RouteRequestInput<
  TRoute,
  { multipart: MultipartInput<RouteValidationInput<TRoute>> }
>
