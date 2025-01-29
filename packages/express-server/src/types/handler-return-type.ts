import { AnyRouteDef, ResponseTypeKey } from '@t-rest/core'

export type HandlerReturnType<TRoute extends AnyRouteDef> =
  TRoute[ResponseTypeKey]
