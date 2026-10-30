import { RouteDef } from '../classes/core/route-def.js'
import { AnyRouteDef } from './any-route-def.js'
import { RouteValidationInput } from './route-validation-input.js'

type OmitFromEach<T, TKeys extends PropertyKey> = T extends unknown
  ? Omit<T, TKeys>
  : never

/**
 * The input a binding sends for a route. On a multipart route the validator
 * describes the request after the upload middleware parsed it, so `body` and
 * the `file`/`files` keys that middleware adds give way to the wire format of
 * the binding.
 */
export type RouteRequestInput<
  TRoute extends AnyRouteDef,
  TMultipartInput
> = TRoute extends RouteDef<any, any, any, any, any, any, 'multipart'>
  ? OmitFromEach<RouteValidationInput<TRoute>, 'body' | 'file' | 'files'> &
      TMultipartInput
  : RouteValidationInput<TRoute>
