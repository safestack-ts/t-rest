import { AnyRouteDef } from '@t-rest/core'
import { ExpressRequest, ExpressResponse } from './express-type-shortcuts.js'
import { HandlerReturnType } from './handler-return-type.js'

export type TypedRouteHandlerFn<
  TRoute extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TValidationResult
> = (
  request: TRequest,
  validationOutput: TValidationResult,
  response: ExpressResponse<HandlerReturnType<TRoute>>
) => void | Promise<void>
