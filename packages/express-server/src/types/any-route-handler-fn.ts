import { AnyRouteDef } from '@t-rest/core'
import { ExpressRequest } from './express-type-shortcuts'
import { TypedRouteHandlerFn } from './typed-route-handler-fn'

export type AnyRouteHandlerFn = TypedRouteHandlerFn<
  AnyRouteDef,
  ExpressRequest,
  unknown
>
