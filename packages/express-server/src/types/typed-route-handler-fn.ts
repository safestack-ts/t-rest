import { AnyRouteDef } from '@t-rest/core'
import { ExpressRequest } from './express-type-shortcuts'
import { HandlerReturnType } from './handler-return-type'

export type TypedRouteHandlerFn<
  TRoute extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TValidationResult
> = (
  request: TRequest,
  validationOutput: TValidationResult
) => HandlerReturnType<TRoute> | Promise<HandlerReturnType<TRoute>>
