import { RouteDef } from '../classes/core/route-def.js'
import { AnyRouteDef } from './any-route-def.js'
import { StringStartsWith } from './string-starts-with.js'

export type PrefixMatchingRoutes<
  TRoutes extends AnyRouteDef,
  TPrefix extends string
> = TRoutes extends RouteDef<
  infer TVersion,
  infer TMethod,
  infer TPath,
  infer TValidator,
  infer TResponse,
  infer TMetaData
>
  ? StringStartsWith<TPath, TPrefix> extends never
    ? never
    : RouteDef<TVersion, TMethod, TPath, TValidator, TResponse, TMetaData>
  : never
