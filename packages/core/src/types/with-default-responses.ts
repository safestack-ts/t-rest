import type { RouteDef } from '../classes/core/route-def.js'
import type { AnyRouteValidator } from './any-route-validator.js'
import type { BodyEncoding } from './body-encoding.js'
import type { HTTPMethod } from './http-method.js'
import type { StrictResponseMap } from './response-descriptor.js'

/** Keys a quoted status like `'400'` by its number, the same property at runtime. */
type NumericStatusKeys<TResponses> = {
  [TKey in keyof TResponses as TKey extends `${infer TStatus extends number}`
    ? `${TStatus}` extends TKey
      ? TStatus
      : TKey
    : TKey]: TResponses[TKey]
}

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
  ? Omit<NumericStatusKeys<TDefaults>, keyof NumericStatusKeys<TResponses>> &
      NumericStatusKeys<TResponses> extends infer TMerged extends StrictResponseMap<TMerged>
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
