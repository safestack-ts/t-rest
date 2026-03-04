import { AnyRouteDef } from '@t-rest/core'
import { ExpressRequest } from './express-type-shortcuts.js'
import { TypedRouteHandlerFn } from './typed-route-handler-fn.js'

export type AnyRouteHandlerFn = TypedRouteHandlerFn<
  AnyRouteDef,
  ExpressRequest,
  unknown
>
