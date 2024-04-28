import { z } from 'zod'
import { RouteDef } from '../classes/core/route-def'
import { AnyRouteDef } from './any-route-def'

export type RouteValidationOutput<TRoute extends AnyRouteDef> =
  TRoute extends RouteDef<any, any, any, infer TValidator, any, any>
    ? z.output<TValidator>
    : never
