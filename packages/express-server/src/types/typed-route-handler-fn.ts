import { AnyRouteDef } from '@t-rest/core'
import { ExpressRequest } from './express-type-shortcuts.js'
import { TypedResponse } from './typed-response.js'

export type TypedRouteHandlerFn<
  TRoute extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TValidationResult
> = (
  request: TRequest,
  validationOutput: TValidationResult,
  response: TypedResponse<TRoute>
) => void | Promise<void>
