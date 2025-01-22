import { AnyRouteDef, RouteValidationInput } from '@t-rest/core'

export type RequestInput<TRoute extends AnyRouteDef> =
  RouteValidationInput<TRoute>
