import { RouteDef } from '../classes/core/route-def'
import { AnyRouteDef } from './any-route-def'
import type { StandardSchemaV1 } from '@standard-schema/spec'

export type RouteValidationOutput<TRoute extends AnyRouteDef> =
  TRoute extends RouteDef<any, any, any, infer TValidator, any, any>
    ? TValidator extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<TValidator>
      : never
    : never
