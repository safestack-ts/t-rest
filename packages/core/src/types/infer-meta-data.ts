import { RouteDef } from '../classes/core/route-def.js'
import { AnyRouteDef } from './any-route-def.js'

export type InferMetaData<T extends AnyRouteDef> = T extends RouteDef<
  any,
  any,
  any,
  any,
  any,
  infer TMetaData
>
  ? TMetaData
  : never
