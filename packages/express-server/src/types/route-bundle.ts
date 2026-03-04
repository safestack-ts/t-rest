import { AnyRouteDef } from '@t-rest/core'
import { AnyRouteHandlerFn } from './any-route-handler-fn.js'
import { TypedMiddleware } from './typed-middleware.js'

export type ParamAlias = {
  oldName: string
  newName: string
  since: string // version when the rename occurred
}

export type RouteBundle = {
  route: AnyRouteDef
  handler: AnyRouteHandlerFn
  middlewares: TypedMiddleware<any, any>[]
  paramAliases: ParamAlias[]
}
