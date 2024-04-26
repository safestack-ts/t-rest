import { z } from 'zod'
import { RouteDef } from '../classes/core/route-def'
import { HTTPMethod } from './http-method'

export type AnyRouteDef = RouteDef<
  string,
  HTTPMethod,
  string,
  z.ZodTypeAny,
  any,
  unknown
>
