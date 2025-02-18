import { RouteDef } from '../classes/core/route-def'
import { AnyRouteDef } from './any-route-def'
import type { StandardSchemaV1 } from '@standard-schema/spec'

export type RouteValidationInput<TRoute extends AnyRouteDef> =
  TRoute extends RouteDef<any, any, any, infer TValidator, any, any>
    ? StandardSchemaV1.InferInput<TValidator>
    : never
