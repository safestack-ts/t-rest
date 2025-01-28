import { RouteDef } from '../classes/core/route-def'
import { AnyRouteDef } from './any-route-def'
import { StringStartsWith } from './string-starts-with'

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
