import type { RouteDef } from '../classes/core/route-def.js'
import type { AnyRouteValidator } from './any-route-validator.js'
import type { BodyEncoding } from './body-encoding.js'
import type { HTTPMethod } from './http-method.js'
import type { StrictResponseMap } from './response-descriptor.js'

/** A route whose responses are filled with the defaults, its own declarations win. */
export type WithDefaultResponses<TRoute, TDefaults> = TRoute extends RouteDef<
  infer TVersion extends string,
  infer TMethod extends HTTPMethod,
  infer TPath extends string,
  infer TValidator extends AnyRouteValidator,
  infer TResponses,
  infer TMetaData,
  infer TBodyEncoding extends BodyEncoding
>
  ? Omit<TDefaults, keyof TResponses> &
      TResponses extends infer TMerged extends StrictResponseMap<TMerged>
    ? RouteDef<
        TVersion,
        TMethod,
        TPath,
        TValidator,
        TMerged,
        TMetaData,
        TBodyEncoding
      >
    : never
  : never
