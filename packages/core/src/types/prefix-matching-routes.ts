import { AnyRouteDef } from './any-route-def.js'
import { StringStartsWith } from './string-starts-with.js'

export type PrefixMatchingRoutes<
  TRoutes extends AnyRouteDef,
  TPrefix extends string
> = TRoutes extends AnyRouteDef
  ? StringStartsWith<TRoutes['path'], TPrefix> extends never
    ? never
    : TRoutes
  : never
