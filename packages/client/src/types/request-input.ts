import { AnyRouteDef, RouteValidationInput } from '@typed-rest/core'

export type RequestInput<TRoute extends AnyRouteDef> =
  RouteValidationInput<TRoute>
