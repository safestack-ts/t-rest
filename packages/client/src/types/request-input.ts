import { AnyRouteDef, RouteRequestInput } from '@t-rest/core'

export type RequestInput<TRoute extends AnyRouteDef> = RouteRequestInput<
  TRoute,
  { body: FormData }
>
