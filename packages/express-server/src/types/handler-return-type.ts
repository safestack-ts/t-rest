import { AnyRouteDef } from '@t-rest/core'

export type HandlerReturnType<TRoute extends AnyRouteDef> =
  TRoute['~responseType']
